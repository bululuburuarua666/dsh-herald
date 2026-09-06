import { defineTool } from '@deepseek-ai/dsh-tools'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { TYPERT } from './typert.js'
import fs from 'node:fs'
import { loadStore, saveStore, serialize, probeWritable, resolveDataDir } from './store.js'
import { loadSettings, saveSettings, envOsEnabled } from './settings.js'
import { createOsNotifier } from './osnotify.js'

const name = 'herald'
// 'tools' 服务在 web 组合中的定义时机与静态 inject 的等待机制不合拍
// (等不到,插件永远不挂载,loader 树永不 settle)。改为运行时注入:
// 不阻塞挂载,服务就绪时再注册诊断工具。'typert' 是 apply 首行的硬依赖,保留静态。
// (REGRESSION LOCK: never go back to a static ['tools','typert'] inject.)
const inject = ['typert']

const CAP = 300
// Flush debounce: a change is on disk at most 2s after the FIRST dirty mark
// (max-latency debounce — a stream of pushes still flushes every 2s).
const FLUSH_MS = 2000

// createPlugin(overrides) exists so tests (and any future embedder) can run
// the host against a temp data dir / fake fs / fake timers. The default
// instance — what DSH mounts — derives its data dir from this file's URL:
//   <profile>/node_modules/dsh-herald/lib/index.js
//     → <profile>/data/task-notify
// (never inside node_modules: a reinstall would destroy the history).
const createPlugin = (overrides = {}) => {
  const fsx = overrides.fs !== undefined ? overrides.fs : fs
  const dataDir = typeof overrides.dataDir === 'string' && overrides.dataDir !== ''
    ? overrides.dataDir
    : resolveDataDir(import.meta.url)
  const timers = overrides.timers !== undefined ? overrides.timers
    : { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h) }

  function apply(ctx) {
    // typert-loader validates ./typert exports against the strict FaceModel
    // format (model.services + strict zod codecs), which this hand-written
    // src-json manifest predates. Register directly: the registry itself
    // accepts src-json codecs and does not require a non-empty model.
    const disposeTypert = ctx.typert.register(TYPERT)
    ctx.on('dispose', disposeTypert)

    // v0.6.0: the host-direct OS toast adapter. Created early and disposed
    // early on purpose: the test ctx keeps ONE listener per event name, so
    // this registration must NOT become the last 'dispose' handler (the
    // records flush below owns that slot in tests; real Cordis runs both).
    const osn = createOsNotifier({ platform: overrides.platform, spawn: overrides.spawn, timers })
    ctx.on('dispose', () => osn.dispose())

    const records = new Map()
    const keyIndex = new Map()
    let nextId = 1
    // Process-unique boot nonce: record ids must never repeat across plugin
    // restarts, because the client uses them as OS-notification tags and a
    // reused tag silently replaces an old notification-center entry instead
    // of showing a new banner.
    const BOOT = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
    // v0.5.0: monotonic change counter. Assigned at creation, bumped on
    // ack/clear/key-touch — so pullSince(cursor) is a change feed that also
    // propagates read-state across tabs, not just an append log.
    let seqCounter = 0
    const titleSvc = ctx.get('sessionTitle')

    // ── persistence (v0.5.0) ─────────────────────────────────────────
    // Load FIRST (before any listener can fire), best-effort: a corrupt or
    // unwritable store degrades the status but NEVER blocks the mount.
    let persistStatus = 'ok' // 'ok' | 'recovered' | 'disabled'
    let dirty = false
    let flushTimer = null
    let warnedDisabled = false
    const warnDisabled = () => {
      if (warnedDisabled) return
      warnedDisabled = true
      try { console.warn('task-notify: persistence unavailable — continuing in memory') } catch (e) { /* ignore */ }
    }
    const flush = () => {
      if (flushTimer !== null) { timers.clear(flushTimer); flushTimer = null }
      if (dirty !== true || persistStatus === 'disabled') return
      dirty = false
      const text = serialize([...records.values()], seqCounter, keyIndex, Date.now())
      if (saveStore(dataDir, text, fsx) !== true) { persistStatus = 'disabled'; warnDisabled() }
    }
    const markDirty = () => {
      if (persistStatus === 'disabled') return
      dirty = true
      if (flushTimer === null) {
        flushTimer = timers.set(flush, FLUSH_MS)
        if (flushTimer !== null && typeof flushTimer.unref === 'function') flushTimer.unref()
      }
    }
    try {
      const loaded = loadStore(dataDir, fsx)
      if (loaded.status === 'recovered') {
        persistStatus = 'recovered'
        try { console.warn('task-notify: stored history corrupt — recovered to empty') } catch (e) { /* ignore */ }
      } else if (loaded.status === 'disabled') {
        persistStatus = 'disabled'
      }
      if (persistStatus !== 'disabled') {
        for (const rec of loaded.records) records.set(rec.id, rec)
        seqCounter = loaded.seq
        for (const k of Object.keys(loaded.keys)) {
          const id = loaded.keys[k]
          if (records.has(id)) keyIndex.set(k, id)
        }
        if (probeWritable(dataDir, fsx) !== true) persistStatus = 'disabled'
      }
      if (persistStatus === 'disabled') warnDisabled()
      // Same-process remount safety: ids from a previous apply with the SAME
      // boot nonce must never be handed out again (OS-notification tags).
      const bootPrefix = 'nt-' + BOOT + '-'
      for (const id of records.keys()) {
        if (typeof id === 'string' && id.startsWith(bootPrefix)) {
          const n = Number(id.slice(bootPrefix.length))
          if (Number.isFinite(n) && n >= nextId) nextId = n + 1
        }
      }
    } catch (e) {
      persistStatus = 'disabled'
      warnDisabled()
    }
    ctx.on('dispose', flush)

    // ── channel settings + host OS adapter (v0.6.0) ────────────────────
    // The OS ("outside the browser") switch is HOST-owned and persists
    // next to records.json: out-of-browser delivery must stay functional
    // — and configurable — with no browser attached at all.
    // DSH_TASK_NOTIFY_OS=0|1 in the environment overrides the file
    // (headless ops); while set, RPC writes are refused and reported as
    // `locked` so the panel never shows a switch that lies.
    let settingsStatus = 'ok' // 'ok' | 'recovered' | 'disabled'
    let settings = null
    try {
      const loadedS = loadSettings(dataDir, fsx)
      settings = loadedS.settings
      if (loadedS.status === 'recovered') {
        settingsStatus = 'recovered'
        try { console.warn('task-notify: settings file corrupt — defaults restored') } catch (e) { /* ignore */ }
      } else if (loadedS.status === 'disabled') {
        settingsStatus = 'disabled'
      }
    } catch (e) {
      settings = { os: { enabled: true } }
      settingsStatus = 'disabled'
    }
    let settingsLocked = false
    const envOs = envOsEnabled(overrides.env)
    if (envOs !== undefined) { settings.os.enabled = envOs; settingsLocked = true }

    // Host-side OS toast copy — mirrors the client's textOf() titles (zh).
    const osTitleOf = (kind, subkind) => {
      if (kind === 'approval') return '需要审批'
      if (kind === 'reply') return '需要回复'
      if (subkind === 'subagent') return '子任务结束'
      if (subkind === 'workflow') return '工作流结束'
      return '后台任务结束'
    }
    const osBodyOf = (kind, label, detail, outcome) => {
      if (kind === 'approval') return detail || label || ''
      if (kind === 'reply') return label || ''
      const parts = []
      if (label) parts.push(label)
      if (detail) parts.push(detail)
      if (outcome === 'ok') parts.push('完成')
      else if (outcome === 'failed') parts.push('失败')
      else if (outcome === 'killed') parts.push('已终止')
      return parts.join(' · ')
    }

    const labelOf = (agent) => {
      if (!agent) return ''
      try {
        if (titleSvc !== undefined) {
          const snap = titleSvc.get(agent.session)
          if (snap !== undefined && typeof snap.title === 'string' && snap.title) return snap.title
        }
      } catch (e) { /* best-effort */ }
      try { return String(agent.id) } catch (e) { return '' }
    }

    // Eviction prefers the oldest READ record; seq order is the stable time
    // order (creation/touch both bump seq monotonically with wall time).
    const prune = () => {
      if (records.size <= CAP) return
      let victim = null
      for (const r of records.values()) {
        if (r.read && (victim === null || r.seq < victim.seq)) victim = r
      }
      if (victim === null) {
        for (const r of records.values()) {
          if (victim === null || r.seq < victim.seq) victim = r
        }
      }
      if (victim !== null) {
        records.delete(victim.id)
        for (const [k, v] of keyIndex) if (v === victim.id) keyIndex.delete(k)
        markDirty()
      }
    }

    const push = (key, kind, subkind, label, detail, outcome) => {
      try {
        const now = Date.now()
        if (key) {
          const existingId = keyIndex.get(key)
          if (existingId !== undefined) {
            const rec = records.get(existingId)
            if (rec !== undefined) { rec.at = now; rec.seq = ++seqCounter; markDirty(); return existingId }
          }
        }
        const id = 'nt-' + BOOT + '-' + String(nextId++)
        records.set(id, { id, kind, subkind, label: label || '', detail: detail || '', outcome: outcome || '', at: now, read: false, seq: ++seqCounter })
        if (key) keyIndex.set(key, id)
        prune()
        markDirty()
        // v0.6.0: the host raises the OS toast ITSELF (the outside-the-
        // browser channel) for every genuinely NEW record — key-touches
        // above return early, so re-notifications are deduped by
        // construction. Fire-and-forget: the adapter swallows failures
        // and the spawn is async, so the approval waterfall never waits.
        try {
          if (settings.os.enabled === true && osn.available === true) {
            osn.show({ title: osTitleOf(kind, subkind), body: osBodyOf(kind, label, detail, outcome), tag: id, kind })
          }
        } catch (e) { /* side channel — never break the queue */ }
        return id
      } catch (e) {
        console.error('task-notify push failed', e)
        return undefined
      }
    }

    const snapshotList = () =>
      [...records.values()].sort((a, b) => b.at - a.at).slice(0, CAP)

    // ── 需要审批: observe only — never break the waterfall ──
    ctx.on('approval/request', (req, next) => {
      try {
        if (req && typeof req === 'object') {
          const aid = req.agent ? String(req.agent.id) : ''
          const label = req.agent ? labelOf(req.agent) : aid
          let detail = typeof req.toolName === 'string' ? req.toolName : ''
          if (typeof req.reason === 'string' && req.reason) detail = detail ? detail + ' — ' + req.reason : req.reason
          if (detail.length > 140) detail = detail.slice(0, 140) + '…'
          push(req.callId ? 'approval:' + String(req.callId) : undefined, 'approval', 'approval', label, detail, '')
        }
      } catch (e) { console.error('task-notify approval listener failed', e) }
      return next()
    }, { global: true, prepend: true })

    // ── 需要回复: turn closes, the model owes no response ──
    ctx.on('agent/turn-stopping', (payload) => {
      try {
        if (payload && payload.agent) {
          const aid = String(payload.agent.id)
          push('reply:' + aid + ':' + String(payload.turn), 'reply', 'reply', labelOf(payload.agent), '', '')
        }
      } catch (e) { console.error('task-notify turn-stopping listener failed', e) }
    })

    // ── 任务结束: subagents ──
    ctx.on('subagent/end', (info) => {
      try {
        if (!info) return
        const ok = info.stopReason === 'completed'
        let summary = ''
        if (Array.isArray(info.lastAssistantMessage)) {
          for (const block of info.lastAssistantMessage) {
            if (block && typeof block.text === 'string' && block.text) { summary = block.text.trim(); break }
          }
        }
        if (summary.length > 120) summary = summary.slice(0, 120) + '…'
        let detail = (typeof info.provider === 'string' ? info.provider : 'subagent') + ' · ' + String(info.stopReason || 'ended')
        if (summary) detail += ' — ' + summary
        push(info.runId ? 'sub:' + String(info.runId) : undefined, 'task-end', 'subagent', info.id ? String(info.id) : '', detail, ok ? 'ok' : 'failed')
      } catch (e) { console.error('task-notify subagent/end listener failed', e) }
    })

    // ── 任务结束: workflows ──
    ctx.on('workflow/end', (info, result) => {
      try {
        if (!info) return
        const name = info.meta && typeof info.meta.name === 'string' ? info.meta.name : ''
        const ok = !result || result.stopReason === 'completed'
        const detail = (result && result.stopReason ? String(result.stopReason) : '') + (result && result.error ? ' — ' + String(result.error) : '')
        push('wf:' + String(info.id), 'task-end', 'workflow', name, detail, ok ? 'ok' : 'failed')
      } catch (e) { console.error('task-notify workflow/end listener failed', e) }
    })

    // ── 任务结束: background jobs (host scope serves every owner) ──
    const jobs = ctx.get('jobs')
    if (jobs !== undefined && typeof jobs.onJobDone === 'function') {
      ctx.effect(() => jobs.onJobDone((snapshot) => {
        try {
          if (!snapshot) return
          const label = typeof snapshot.label === 'string' ? snapshot.label : ''
          const detail = (typeof snapshot.kind === 'string' ? snapshot.kind : 'job') + ' · ' + String(snapshot.status || 'ended')
          const outcome = snapshot.status === 'completed' ? 'ok' : snapshot.status === 'killed' ? 'killed' : 'failed'
          push('job:' + String(snapshot.id), 'task-end', 'job', label, detail, outcome)
        } catch (e) { console.error('task-notify job listener failed', e) }
      }))
    }

    // host service the client polls through the Remote gateway.
    // Must carry a typertRemote binding (TypertRemoteService base) or the
    // gateway rejects the receiver with 'no visible typertRemote binding'.
    let clientDiag = null
    class TaskNotifyService extends TypertRemoteService {
      // Legacy full pull — the array shape is a wire contract (old clients
      // and the client's pre-0.5 fallback mode depend on it).
      pull() { return snapshotList() }
      // v0.5.0 incremental pull. cursor <= 0 (first round) or beyond the
      // server's seq (history purged / storage reset / new browser) →
      // reset:true + full snapshot so the client rebuilds from scratch.
      // v0.7.1 shape fix: the gateway applies DECLARED PARAMETERS
      // POSITIONALLY (Reflect.apply(method, receiver, [paramValues])) —
      // on the wire `input` is the cursor SCALAR, while direct calls and
      // the tests pass { cursor }. Accept both. Before this fix every
      // production round read cursor=0 → full reset pulls (the client
      // tolerated it, so the incremental protocol silently degraded).
      pullSince(input) {
        const raw = input !== null && typeof input === 'object' && input.cursor !== undefined ? input.cursor : input
        const cursor = typeof raw === 'number' && isFinite(raw) ? Math.floor(raw) : 0
        const maxSeq = seqCounter
        if (cursor <= 0 || cursor > maxSeq) {
          return { items: snapshotList(), cursor: maxSeq, reset: true }
        }
        const items = []
        for (const r of records.values()) if (r.seq > cursor) items.push(r)
        items.sort((a, b) => a.seq - b.seq)
        return { items, cursor: maxSeq, reset: false }
      }
      ack(input) {
        try {
          // v0.7.1: wire shape is the id SCALAR (positional parameter);
          // direct calls pass { id }. Accept both. Before this fix
          // production acks silently no-op'd, so cross-tab read-state
          // never propagated (the poller re-saw records as unread).
          const id = typeof input === 'string' ? input
            : (input !== null && typeof input === 'object' && typeof input.id === 'string' ? input.id : undefined)
          if (id !== undefined) {
            const rec = records.get(id)
            if (rec !== undefined) { rec.read = true; rec.seq = ++seqCounter; markDirty() }
          }
        } catch (e) { /* ignore */ }
        return null
      }
      clear() {
        for (const rec of records.values()) {
          if (rec.read !== true) { rec.read = true; rec.seq = ++seqCounter }
        }
        markDirty()
        return null
      }
      // Purge wipes the history AND resets the seq generation: any client
      // holding an old cursor now sits beyond maxSeq and is told (reset:true)
      // to rebuild — which lands on the empty list. No extra protocol field.
      purge() {
        records.clear()
        keyIndex.clear()
        seqCounter = 0
        markDirty()
        return null
      }
      // ── v0.6.0 channel-settings surface ──
      getSettings() {
        return {
          os: { enabled: settings.os.enabled === true },
          locked: settingsLocked === true,
          adapter: { available: osn.available === true, platform: osn.platform },
          settingsStatus,
        }
      }
      setSettings(input) {
        // v0.7.1: wire shape is the os VALUE positionally ({ enabled });
        // direct calls pass { os: { enabled } }. Accept both. Before this
        // fix the panel's OS switch reconciled straight back (silent no-op).
        const os = input !== null && typeof input === 'object'
          ? (input.os !== null && typeof input.os === 'object' ? input.os : input)
          : undefined
        if (os !== undefined && typeof os.enabled === 'boolean') {
          if (settingsLocked !== true) {
            settings.os.enabled = os.enabled
            if (saveSettings(dataDir, settings, fsx) !== true) settingsStatus = 'disabled'
          }
          // When env-locked the file is left untouched and the effective
          // value stays env-controlled — getSettings() reports `locked`.
        }
        return this.getSettings()
      }
      testOs() {
        if (settings.os.enabled !== true) return { ok: false, error: 'os-disabled' }
        if (osn.available !== true) return { ok: false, error: 'adapter-unavailable(' + osn.platform + ')' }
        osn.show({ title: 'dsh-task-notify', body: '系统通知测试（宿主直发，不经浏览器）', tag: 'test-' + Date.now().toString(36), kind: 'test' })
        return { ok: true }
      }
      diag(state) {
        if (state && typeof state === 'object') clientDiag = state
        return { persist: persistStatus }
      }
    }
    new TaskNotifyService(ctx, 'taskNotify')

    // ── diagnostic tool: read the client Notification state ──
    // 运行时注入 'tools'(见文件头注释):apply 内不能直接访问 ctx.tools。
    ctx.inject(['tools'], (toolsCtx) => {
      toolsCtx.tools.register(defineTool({
        name: 'ntfy_status',
        description: 'Read the task-notify plugin diagnostics: whether the browser supports the Notification API, the current permission state, secure-context status, the last report time, whether that report has gone stale (older than two minutes), and the host-side history persistence status (ok / recovered / disabled).',
        parameters: {},
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              reported: { type: 'boolean' },
              stale: { type: 'boolean' },
              supported: { type: 'boolean' },
              permission: { type: 'string' },
              secure: { type: 'boolean' },
              at: { type: 'number' },
              persist: { type: 'string' },
              channels: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  osEnabled: { type: 'boolean' },
                  osAdapter: { type: 'string' },
                  osAvailable: { type: 'boolean' },
                  osSent: { type: 'number' },
                  osLastError: { type: 'string' },
                  osVia: { type: 'string' },
                  clientInApp: { type: 'boolean' },
                  clientOsBrowser: { type: 'boolean' },
                },
              },
            },
          },
          render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
        },
        execute() {
          const st = osn.stats()
          const base = clientDiag === null
            ? { reported: false, stale: true }
            : {
              reported: true,
              stale: Date.now() - (typeof clientDiag.at === 'number' ? clientDiag.at : 0) > 2 * 60 * 1000,
              supported: clientDiag.supported === true,
              permission: typeof clientDiag.permission === 'string' ? clientDiag.permission : 'unknown',
              secure: clientDiag.secure === true,
              at: typeof clientDiag.at === 'number' ? clientDiag.at : 0,
            }
          return Object.assign(base, {
            persist: persistStatus,
            channels: {
              osEnabled: settings.os.enabled === true,
              osAdapter: osn.platform,
              osAvailable: osn.available === true,
              osSent: st.sent,
              osLastError: st.lastError || '',
              osVia: clientDiag !== null && typeof clientDiag.osVia === 'string' ? clientDiag.osVia : 'unknown',
              clientInApp: clientDiag !== null && clientDiag.inApp === true,
              clientOsBrowser: clientDiag !== null && clientDiag.osBrowser === true,
            },
          })
        },
      }))
    })
  }

  return { name, inject, apply }
}

const defaultPlugin = createPlugin({})
const apply = defaultPlugin.apply

export { name, inject, apply, createPlugin, resolveDataDir, TYPERT }
