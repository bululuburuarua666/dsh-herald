// v0.6.0 host-side OS notification adapter — the "outside the browser"
// delivery channel. The HOST process raises the system toast directly
// (PowerShell + WinRT on Windows, osascript on macOS, notify-send on
// Linux), so notifications keep landing when the browser is closed,
// hidden, or throttled by background-tab timer clamping.
//
// Design rules:
//  - NEVER throws upward: notification delivery is a side channel; every
//    failure is recorded in stats() and swallowed.
//  - No shell, no raw interpolation: user text reaches the platform tool
//    base64-encoded (win32) or backslash-escaped (darwin); tags are
//    sanitized to [A-Za-z0-9_-] before embedding. Zero injection surface.
//  - Serialized spawns (concurrency 1) with a minimum gap; a burst beyond
//    COALESCE_MAX accepted toasts inside WINDOW_MS folds into ONE summary
//    toast. approval/test kinds are exempt — they always fire
//    individually and jump the queue.
//  - One retry per payload; a stuck child is killed after SPAWN_TIMEOUT_MS.
//
// Everything injectable (platform, spawn, spawnSync, timers, now) so the
// unit tests run hermetically without touching a real desktop.

import { spawn as nodeSpawn, spawnSync as nodeSpawnSync } from 'node:child_process'

const MIN_GAP_MS = 1200     // min spacing between toast spawns
const WINDOW_MS = 10000     // burst-coalescing window (arrival times)
const COALESCE_MAX = 5      // individual toasts accepted per window
const FLUSH_DELAY_MS = 3000 // burst summary lands 3s after the overflow starts
const SPAWN_TIMEOUT_MS = 5000
const QUEUE_CAP = 8

const TITLE_CAP = 60
const BODY_CAP = 140

// PowerShell's own AppUserModelID: toasts attribute to "Windows
// PowerShell" in the action center and need no AUMID registration of
// our own (verified working on this machine's Win10/11 build).
const PS_APPID = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'

const SUMMARY_TITLE = 'DSH 任务通知'
const KIND_NAMES = { approval: '审批', reply: '回复', 'task-end': '任务结束' }

const b16 = (s) => Buffer.from(String(s), 'utf16le').toString('base64')
const cap = (s, n) => {
  const v = String(s == null ? '' : s)
  return v.length > n ? v.slice(0, n) + '…' : v
}
const cleanTag = (s) => String(s == null ? '' : s).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60)

const summaryBody = (count, kinds) => {
  const parts = []
  for (const k of Object.keys(kinds)) parts.push((KIND_NAMES[k] || k) + ' ×' + kinds[k])
  return '新增 ' + count + ' 条：' + parts.join('、')
}

// ── platform commands (pure; exercised by tests) ──────────────────────
const buildCommand = (platform, payload) => {
  if (platform === 'win32') {
    // Title/body travel as base64(UTF-16LE) and are decoded inside
    // PowerShell; the tag is pre-sanitized to [A-Za-z0-9_-]. Nothing
    // user-controlled is ever interpolated raw into the script.
    const script = '$ErrorActionPreference=\'Stop\';'
      + '$t=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String(\'' + b16(payload.title) + '\'));'
      + '$b=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String(\'' + b16(payload.body) + '\'));'
      + '[Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime]|Out-Null;'
      + '$x=[Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);'
      + '$n=$x.GetElementsByTagName(\'text\');'
      + '$n.Item(0).AppendChild($x.CreateTextNode($t))|Out-Null;'
      + '$n.Item(1).AppendChild($x.CreateTextNode($b))|Out-Null;'
      + '$o=[Windows.UI.Notifications.ToastNotification]::new($x);'
      + (payload.tag !== '' ? '$o.Tag=\'' + payload.tag + '\';' : '')
      + '[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier(\'' + PS_APPID + '\').Show($o)'
    return { file: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script] }
  }
  if (platform === 'darwin') {
    const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n\t]+/g, ' ')
    return { file: 'osascript', args: ['-e', 'display notification "' + esc(payload.body) + '" with title "' + esc(payload.title) + '"'] }
  }
  if (platform === 'linux') return { file: 'notify-send', args: [payload.title, payload.body] }
  return null
}

const createOsNotifier = (overrides = {}) => {
  const platform = typeof overrides.platform === 'string'
    ? overrides.platform
    : (typeof process !== 'undefined' && typeof process.platform === 'string' ? process.platform : 'none')
  const spawnFn = typeof overrides.spawn === 'function'
    ? overrides.spawn
    : (typeof nodeSpawn === 'function' ? nodeSpawn : undefined)
  const spawnSyncFn = typeof overrides.spawnSync === 'function' ? overrides.spawnSync : nodeSpawnSync
  const timers = overrides.timers !== undefined ? overrides.timers
    : { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h) }
  const now = typeof overrides.now === 'function' ? overrides.now : () => Date.now()

  let available = false
  if (platform === 'win32' || platform === 'darwin') {
    available = spawnFn !== undefined
  } else if (platform === 'linux') {
    try {
      available = spawnFn !== undefined && spawnSyncFn('notify-send', ['--version'], { stdio: 'ignore' }).status === 0
    } catch (e) { available = false }
  }

  const queue = []
  const acceptTimes = [] // arrival (accept) times of individual toasts
  let overflow = { count: 0, kinds: {} }
  let overflowTimer = null
  let active = false
  let nextAt = 0
  let disposed = false
  const stats = { sent: 0, lastError: '', lastErrorAt: 0 }

  const pump = () => {
    if (disposed || active || queue.length === 0) return
    const delay = Math.max(0, nextAt - now())
    timers.set(() => {
      if (disposed || active || queue.length === 0) return
      start(queue.shift())
    }, delay)
  }

  const finish = (payload, err) => {
    const t = now()
    active = false
    nextAt = t + MIN_GAP_MS
    if (err !== '') {
      stats.lastError = err
      stats.lastErrorAt = t
      if (payload._retried !== true) { payload._retried = true; queue.unshift(payload) }
    } else {
      stats.sent++
    }
    pump()
  }

  const start = (payload) => {
    active = true
    const cmd = buildCommand(platform, payload)
    if (cmd === null || spawnFn === undefined) { finish(payload, 'no-adapter'); return }
    let settled = false
    let killer = null
    const settle = (err) => {
      if (settled) return
      settled = true
      if (killer !== null) timers.clear(killer)
      finish(payload, err)
    }
    let child = null
    try {
      child = spawnFn(cmd.file, cmd.args, { stdio: 'ignore', windowsHide: true })
    } catch (e) {
      settle('spawn:' + (e && e.message ? e.message : String(e)))
      return
    }
    if (child === null || typeof child.on !== 'function') { settle('spawn:no-child'); return }
    killer = timers.set(() => {
      settle('timeout')
      try { if (typeof child.kill === 'function') child.kill() } catch (e) { /* ignore */ }
    }, SPAWN_TIMEOUT_MS)
    child.on('error', (e) => settle('error:' + (e && e.message ? e.message : String(e))))
    child.on('close', (code) => settle(code === 0 ? '' : 'exit:' + code))
  }

  const enqueue = (payload) => {
    queue.push(payload)
    if (queue.length > QUEUE_CAP) queue.splice(0, queue.length - QUEUE_CAP)
    pump()
  }

  const show = (input) => {
    if (disposed || available !== true || input === null || typeof input !== 'object') return
    const payload = {
      title: cap(input.title, TITLE_CAP),
      body: cap(input.body, BODY_CAP),
      tag: cleanTag(input.tag),
      kind: typeof input.kind === 'string' ? input.kind : '',
    }
    // Approvals (and manual test fires) never fold into a summary and
    // jump the queue — an approval is always its own immediate banner.
    if (payload.kind === 'approval' || payload.kind === 'test') {
      queue.unshift(payload)
      pump()
      return
    }
    const t = now()
    while (acceptTimes.length > 0 && t - acceptTimes[0] > WINDOW_MS) acceptTimes.shift()
    if (acceptTimes.length >= COALESCE_MAX) {
      overflow.count++
      overflow.kinds[payload.kind] = (overflow.kinds[payload.kind] || 0) + 1
      if (overflowTimer === null) {
        overflowTimer = timers.set(() => {
          overflowTimer = null
          if (overflow.count <= 0) return
          const count = overflow.count
          const kinds = overflow.kinds
          overflow = { count: 0, kinds: {} }
          acceptTimes.length = 0 // a summary restarts the burst window
          enqueue({ title: SUMMARY_TITLE, body: summaryBody(count, kinds), tag: 'summary-' + t.toString(36) + '-' + String(count), kind: 'summary' })
        }, FLUSH_DELAY_MS)
      }
      return
    }
    acceptTimes.push(t)
    enqueue(payload)
  }

  const dispose = () => {
    disposed = true
    if (overflowTimer !== null) { timers.clear(overflowTimer); overflowTimer = null }
  }

  return {
    platform,
    available: available === true,
    show,
    dispose,
    stats: () => ({ sent: stats.sent, lastError: stats.lastError, lastErrorAt: stats.lastErrorAt, queued: queue.length, platform, available: available === true }),
  }
}

export { createOsNotifier, buildCommand, cleanTag, summaryBody, MIN_GAP_MS, WINDOW_MS, COALESCE_MAX, FLUSH_DELAY_MS, SPAWN_TIMEOUT_MS }
