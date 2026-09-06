// Hermetic unit tests for lib/osnotify.js — the host-direct OS toast
// adapter. Everything is faked: virtual clock, fireable timers, a spawn
// recorder whose children close on command. No real desktop is touched.
//
// Run: node --test test/osnotify.test.mjs

import assert from 'node:assert/strict'
import { test } from 'node:test'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const { createOsNotifier, buildCommand, cleanTag, MIN_GAP_MS, WINDOW_MS, COALESCE_MAX, FLUSH_DELAY_MS, SPAWN_TIMEOUT_MS } =
  await import(pathToFileURL(path.resolve('lib/osnotify.js')).href)

// ── virtual clock + fireable timers ──
const makeClock = () => {
  let t = 1000
  const jobs = [] // { at, fn, dead }
  return {
    now: () => t,
    set: (fn, ms) => { const j = { at: t + ms, fn, dead: false }; jobs.push(j); return j },
    clear: (j) => { if (j) j.dead = true },
    advance: (ms) => {
      const target = t + ms
      for (;;) {
        const due = jobs.filter((j) => !j.dead && j.at <= target).sort((a, b) => a.at - b.at)[0]
        if (!due) break
        t = due.at
        due.dead = true
        due.fn()
      }
      t = target
    },
  }
}

// ── fake spawn ──
// behavior(i) per invocation (1-based): {} → auto-close 0 once the
// adapter registers its handlers; { closeCode } → auto-close with that
// code; { manual: true } → the test closes the child itself.
const makeRecorder = (behavior) => {
  const calls = []
  const spawn = (file, args, opts) => {
    const b = behavior ? behavior(calls.length + 1) : {}
    const child = {
      killed: false,
      _on: {},
      on(evt, fn) {
        child._on[evt] = fn
        // auto-close only AFTER the 'close' handler exists, mirroring a
        // child that exits immediately after spawn
        if (evt === 'close' && b.manual !== true) child.close(b.closeCode !== undefined ? b.closeCode : 0)
      },
      kill() { child.killed = true },
      close(code) { if (child._on.close) child._on.close(code) },
      error(e) { if (child._on.error) child._on.error(e) },
    }
    calls.push({ file, args, opts, child })
    return child
  }
  return { calls, spawn }
}

const decodeB64Segments = (script) =>
  [...script.matchAll(/FromBase64String\('([^']+)'\)/g)].map((m) => Buffer.from(m[1], 'base64').toString('utf16le'))

test('win32: show → one powershell spawn; text travels base64, never raw', () => {
  const clock = makeClock()
  const rec = makeRecorder()
  const osn = createOsNotifier({ platform: 'win32', spawn: rec.spawn, timers: clock, now: clock.now })
  assert.equal(osn.available, true)
  osn.show({ title: '需要审批 "rm -rf"', body: "body with 'quotes' and `backticks`", tag: 'nt-abc-12', kind: 'approval' })
  clock.advance(0)
  assert.equal(rec.calls.length, 1)
  assert.equal(rec.calls[0].file, 'powershell.exe')
  assert.deepEqual(rec.calls[0].args.slice(0, 4), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass'])
  const script = rec.calls[0].args[rec.calls[0].args.length - 1]
  assert.ok(script.includes('ToastNotificationManager'), 'WinRT toast script')
  assert.ok(!script.includes('rm -rf'), 'no raw user text in the script (injection safety)')
  assert.ok(!script.includes('quotes'), 'no raw body either')
  const segs = decodeB64Segments(script)
  assert.equal(segs[0], '需要审批 "rm -rf"', 'title round-trips UTF-16LE base64')
  assert.equal(segs[1], "body with 'quotes' and `backticks`")
  assert.ok(script.includes("Tag='nt-abc-12'"), 'sanitized tag embedded')
  assert.equal(osn.stats().sent, 1)
})

test('serialization: one spawn at a time, MIN_GAP spacing between starts', () => {
  const clock = makeClock()
  const rec = makeRecorder(() => ({ manual: true }))
  const osn = createOsNotifier({ platform: 'win32', spawn: rec.spawn, timers: clock, now: clock.now })
  osn.show({ title: 'a', body: 'a', kind: 'reply' })
  osn.show({ title: 'b', body: 'b', kind: 'reply' })
  clock.advance(0)
  assert.equal(rec.calls.length, 1, 'concurrency 1 — second waits')
  rec.calls[0].child.close(0)
  clock.advance(0)
  assert.equal(rec.calls.length, 1, 'MIN_GAP not elapsed yet')
  clock.advance(MIN_GAP_MS)
  assert.equal(rec.calls.length, 2, 'second fires after the gap')
  rec.calls[1].child.close(0)
})

test('burst coalescing: 6th+ arrivals fold into ONE summary toast', () => {
  const clock = makeClock()
  const rec = makeRecorder()
  const osn = createOsNotifier({ platform: 'win32', spawn: rec.spawn, timers: clock, now: clock.now })
  for (let i = 1; i <= 5; i++) osn.show({ title: 'job' + i, body: 'x', kind: 'task-end' })
  osn.show({ title: 'job6', body: 'x', kind: 'task-end' })
  osn.show({ title: 'job7', body: 'x', kind: 'reply' })
  assert.equal(osn.stats().queued, 5, 'jobs 1-5 queued (pump timer not fired yet); 6-7 went to overflow')
  clock.advance(FLUSH_DELAY_MS + MIN_GAP_MS * 10) // drain queue + flush the summary
  assert.equal(rec.calls.length, 6, '5 individual + exactly one summary')
  const last = rec.calls[5]
  const segs = decodeB64Segments(last.args[last.args.length - 1])
  assert.equal(segs[0], 'DSH 任务通知', 'summary title')
  assert.ok(segs[1].includes('新增 2 条'), 'overflow count folded: ' + segs[1])
  assert.ok(segs[1].includes('任务结束 ×1') && segs[1].includes('回复 ×1'), 'kind counts present')
})

test('approvals are exempt from coalescing and always fire individually', () => {
  const clock = makeClock()
  const rec = makeRecorder()
  const osn = createOsNotifier({ platform: 'win32', spawn: rec.spawn, timers: clock, now: clock.now })
  for (let i = 1; i <= 8; i++) osn.show({ title: '需要审批' + i, body: 'x', kind: 'approval' })
  clock.advance(MIN_GAP_MS * 10)
  assert.equal(rec.calls.length, 8, 'every approval gets its own banner — no summary')
})

test('failure path: one retry per payload, then recorded in stats', () => {
  const clock = makeClock()
  let n = 0
  const rec = makeRecorder(() => { n++; return n === 1 ? { closeCode: 1 } : {} })
  const osn = createOsNotifier({ platform: 'win32', spawn: rec.spawn, timers: clock, now: clock.now })
  osn.show({ title: 'x', body: 'x', kind: 'reply' })
  clock.advance(0)
  assert.equal(rec.calls.length, 1, 'first attempt failed (exit 1)')
  clock.advance(MIN_GAP_MS)
  assert.equal(rec.calls.length, 2, 'retried exactly once')
  clock.advance(MIN_GAP_MS)
  assert.equal(rec.calls.length, 2, 'no third attempt')
  assert.equal(osn.stats().sent, 1, 'retry succeeded → counted')
  assert.equal(osn.stats().lastError, 'exit:1')
})

test('timeout: a stuck child is killed and the payload retried once', () => {
  const clock = makeClock()
  const rec = makeRecorder(() => ({ manual: true }))
  const osn = createOsNotifier({ platform: 'win32', spawn: rec.spawn, timers: clock, now: clock.now })
  osn.show({ title: 'x', body: 'x', kind: 'reply' })
  clock.advance(0)
  assert.equal(rec.calls.length, 1)
  clock.advance(SPAWN_TIMEOUT_MS)
  assert.equal(rec.calls[0].child.killed, true, 'killer fired')
  assert.equal(osn.stats().lastError, 'timeout')
  clock.advance(MIN_GAP_MS)
  assert.equal(rec.calls.length, 2, 'retried after the timeout kill')
  clock.advance(SPAWN_TIMEOUT_MS)
  assert.equal(rec.calls[1].child.killed, true)
  clock.advance(MIN_GAP_MS)
  assert.equal(rec.calls.length, 2, 'second timeout is final — no infinite loop')
})

test('window prunes: after WINDOW_MS the counter starts fresh', () => {
  const clock = makeClock()
  const rec = makeRecorder()
  const osn = createOsNotifier({ platform: 'win32', spawn: rec.spawn, timers: clock, now: clock.now })
  for (let i = 1; i <= 5; i++) osn.show({ title: 'a' + i, body: 'x', kind: 'task-end' })
  clock.advance(WINDOW_MS + MIN_GAP_MS * 10) // window fully pruned, queue drained
  const before = rec.calls.length
  osn.show({ title: 'after-window', body: 'x', kind: 'task-end' })
  clock.advance(MIN_GAP_MS)
  assert.equal(rec.calls.length, before + 1, 'accepted individually again — no summary after a quiet period')
})

test('unsupported platform: available=false, show is a no-op', () => {
  const clock = makeClock()
  const rec = makeRecorder()
  const osn = createOsNotifier({ platform: 'none', spawn: rec.spawn, timers: clock, now: clock.now })
  assert.equal(osn.available, false)
  osn.show({ title: 'x', body: 'x', kind: 'reply' })
  clock.advance(10)
  assert.equal(rec.calls.length, 0)
  assert.equal(osn.stats().sent, 0)
})

test('dispose stops everything', () => {
  const clock = makeClock()
  const rec = makeRecorder(() => ({ manual: true }))
  const osn = createOsNotifier({ platform: 'win32', spawn: rec.spawn, timers: clock, now: clock.now })
  osn.show({ title: 'a', body: 'x', kind: 'reply' })
  osn.show({ title: 'b', body: 'x', kind: 'reply' })
  clock.advance(0)
  assert.equal(rec.calls.length, 1, 'first toast spawned before dispose')
  osn.dispose()
  rec.calls[0].child.close(0)
  clock.advance(MIN_GAP_MS * 5)
  assert.equal(rec.calls.length, 1, 'disposed → pump never starts the queued item')
})

test('pure: buildCommand escapes darwin text; cleanTag strips hostile chars', () => {
  const mac = buildCommand('darwin', { title: 'a"b\\c', body: 'd"e' })
  assert.equal(mac.file, 'osascript')
  assert.ok(mac.args[1].includes('\\"'), 'double quotes escaped')
  const linux = buildCommand('linux', { title: 't', body: 'b' })
  assert.deepEqual([linux.file, linux.args[0], linux.args[1]], ['notify-send', 't', 'b'])
  assert.equal(cleanTag('nt-abc-12); Remove-Item'), 'nt-abc-12Remove-Item')
  assert.equal(buildCommand('plan9', {}), null)
})

test('caps: over-long title/body are truncated with an ellipsis', () => {
  const clock = makeClock()
  const rec = makeRecorder()
  const osn = createOsNotifier({ platform: 'win32', spawn: rec.spawn, timers: clock, now: clock.now })
  const long = 'x'.repeat(500)
  osn.show({ title: long, body: long, kind: 'reply' })
  clock.advance(0)
  const segs = decodeB64Segments(rec.calls[0].args[rec.calls[0].args.length - 1])
  assert.equal(segs[0].length, 61, '60 chars + ellipsis')
  assert.equal(segs[1].length, 141, '140 chars + ellipsis')
})

test('acceptance constants hold the design contract', () => {
  assert.equal(MIN_GAP_MS, 1200)
  assert.equal(WINDOW_MS, 10000)
  assert.equal(COALESCE_MAX, 5)
  assert.equal(FLUSH_DELAY_MS, 3000)
  assert.equal(SPAWN_TIMEOUT_MS, 5000)
})
