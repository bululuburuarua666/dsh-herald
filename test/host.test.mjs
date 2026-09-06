// Black-box tests for the host side of dsh-task-notify (lib/index.js):
// push key-dedup, prune, snapshot order, ack/clear/purge, the ntfy_status
// stale diagnostic, and (v0.5.0) JSON persistence + the pullSince protocol.
//
// v0.5.0: every boot goes through createPlugin({ dataDir: <fresh tmpdir> })
// so tests never touch the real profile storage and never see each other's
// records. Restart cycles are simulated as two createPlugin applies against
// the SAME dir (dispose fires the final flush).
//
// Depends on the plugin's peer packages being resolvable from the repo root.
// A local symlink to an installed DSH profile's node_modules suffices:
//   ln -s ~/.dsh/profiles/node_modules node_modules
//
// Run: node --test test/host.test.mjs

import assert from 'node:assert/strict'
import { test } from 'node:test'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const { name, inject, createPlugin, resolveDataDir } = await import(pathToFileURL(path.resolve('lib/index.js')).href)
const store = await import(pathToFileURL(path.resolve('lib/store.js')).href)

const tmpDataDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ntfy-host-'))

function makeCtx() {
  const host = { provided: {}, listeners: {}, tools: [], typert: null }
  const ctx = {
    reflect: { provide: (n, svc) => { host.provided[n] = svc; return () => {} } },
    get: () => undefined, // sessionTitle / jobs services absent
    on: (evt, cb) => { host.listeners[evt] = cb; return () => {} },
    effect: (fn) => fn(),
    typert: { register: (m) => { host.typert = m; return () => {} } },
    // v0.2.0-local fix (upstreamed in 0.3.0): 'tools' is injected at
    // RUNTIME (ctx.inject) because the static ['tools','typert'] inject
    // never settles in the web composition. 'typert' stays static.
    inject: (names, cb) => {
      host.runtimeInjects = host.runtimeInjects || []
      host.runtimeInjects.push(names)
      cb({ tools: { register: (t) => { host.tools.push(t) } } })
    },
  }
  return { ctx, host }
}

async function bootHost(overrides = {}) {
  const { ctx, host } = makeCtx()
  const P = createPlugin({
    dataDir: overrides.dataDir !== undefined ? overrides.dataDir : tmpDataDir(),
    fs: overrides.fs,
    timers: overrides.timers,
    // v0.6.0: default the OS adapter to a no-op platform so tests never
    // spawn a REAL powershell toast; OS-integration tests pass a fake
    // spawn explicitly (or 'win32' + fake spawn).
    platform: overrides.platform !== undefined ? overrides.platform : 'none',
    spawn: overrides.spawn,
    env: overrides.env,
  })
  await P.apply(ctx)
  return { ctx, host, P }
}

const svc = (host) => host.provided.taskNotify

test('exports name + inject contract (REGRESSION LOCK: runtime tools inject)', () => {
  assert.equal(name, 'herald')
  // The web-composition deadlock fix: 'tools' must NEVER return to the
  // static inject list — the loader tree would never settle again.
  assert.deepEqual(inject, ['typert'])
})

test('ntfy_status registers through the RUNTIME tools inject', async () => {
  const { host } = await bootHost()
  assert.ok((host.runtimeInjects || []).some((names) => Array.isArray(names) && names.includes('tools')), 'ctx.inject(["tools"], …) called')
  assert.equal(host.tools.length, 1)
  assert.equal(host.tools[0].name, 'ntfy_status')
})

test('boot wires the typert manifest and the taskNotify service', async () => {
  const { host } = await bootHost()
  assert.ok(host.typert)
  assert.equal(host.typert.package, 'dsh-herald')
  assert.ok(Array.isArray(host.typert.invocations))
  assert.ok(host.typert.invocations.some((i) => i.method === 'pullSince'), 'pullSince declared in the manifest')
  assert.ok(svc(host))
  assert.deepEqual(svc(host).pull(), [])
})

test('turn-stopping pushes a reply record labeled by agent id', async () => {
  const { host } = await bootHost()
  host.listeners['agent/turn-stopping']({ agent: { id: 'a1', session: 's1' }, turn: 1 })
  const list = svc(host).pull()
  assert.equal(list.length, 1)
  assert.equal(list[0].kind, 'reply')
  assert.equal(list[0].label, 'a1')
  assert.equal(list[0].read, false)
})

test('approval request dedupes by callId and never breaks the waterfall', async () => {
  const { host } = await bootHost()
  let nextCalls = 0
  const req = { agent: { id: 'a1' }, callId: 'c1', toolName: 'bash', reason: 'rm -rf' }
  host.listeners['approval/request'](req, () => { nextCalls++ })
  host.listeners['approval/request'](req, () => { nextCalls++ })
  assert.equal(nextCalls, 2)
  const list = svc(host).pull()
  assert.equal(list.length, 1)
  assert.equal(list[0].kind, 'approval')
  assert.match(list[0].detail, /bash/)
  assert.match(list[0].detail, /rm -rf/)
})

test('subagent/end carries child id and output summary', async () => {
  const { host } = await bootHost()
  host.listeners['subagent/end']({
    runId: 'r1', provider: 'claude', id: 'ses-9', stopReason: 'completed',
    lastAssistantMessage: [{ type: 'text', text: '  done with the audit  ' }],
  })
  const [rec] = svc(host).pull()
  assert.equal(rec.subkind, 'subagent')
  assert.equal(rec.label, 'ses-9')
  assert.equal(rec.outcome, 'ok')
  assert.match(rec.detail, /claude/)
  assert.match(rec.detail, /completed/)
  assert.match(rec.detail, /done with the audit/)
})

test('subagent/end marks non-completed outcomes failed', async () => {
  const { host } = await bootHost()
  host.listeners['subagent/end']({ runId: 'r2', provider: 'claude', id: 'ses-10', stopReason: 'error' })
  const [rec] = svc(host).pull()
  assert.equal(rec.outcome, 'failed')
})

test('workflow/end records name and stop reason', async () => {
  const { host } = await bootHost()
  host.listeners['workflow/end']({ id: 'wf1', meta: { name: 'audit' } }, { stopReason: 'completed' })
  const [rec] = svc(host).pull()
  assert.equal(rec.subkind, 'workflow')
  assert.equal(rec.label, 'audit')
  assert.equal(rec.outcome, 'ok')
})

test('prune keeps at most 300 records, evicting the oldest unread', async () => {
  const { host } = await bootHost()
  const realNow = Date.now
  let t = 1_000_000
  Date.now = () => t++
  try {
    for (let i = 0; i < 301; i++) {
      host.listeners['approval/request']({ agent: { id: 'a' + i }, callId: 'c' + i, toolName: 't' }, () => {})
    }
  } finally {
    Date.now = realNow
  }
  const list = svc(host).pull()
  assert.equal(list.length, 300)
  assert.ok(!list.some((r) => r.id === undefined))
  // newest first
  const first = list[0]
  assert.equal(first.detail, 't')
})

test('ack marks read, clear marks all read, purge empties', async () => {
  const { host } = await bootHost()
  host.listeners['agent/turn-stopping']({ agent: { id: 'a1' }, turn: 1 })
  host.listeners['agent/turn-stopping']({ agent: { id: 'a1' }, turn: 2 })
  const [newer, older] = svc(host).pull()
  assert.equal(newer.read, false)
  svc(host).ack({ id: older.id })
  assert.equal(svc(host).pull().find((r) => r.id === older.id).read, true)
  svc(host).clear()
  assert.ok(svc(host).pull().every((r) => r.read === true))
  svc(host).purge()
  assert.deepEqual(svc(host).pull(), [])
})

test('ntfy_status reports stale diagnostics (persist/channels fields are additive)', async () => {
  const { host } = await bootHost()
  assert.equal(host.tools.length, 1)
  const tool = host.tools[0]
  assert.equal(tool.name, 'ntfy_status')
  // never reported — channels reflects the (platform:'none') test boot
  assert.deepEqual(await tool.execute({}), {
    reported: false, stale: true, persist: 'ok',
    channels: { osEnabled: true, osAdapter: 'none', osAvailable: false, osSent: 0, osLastError: '', osVia: 'unknown', clientInApp: false, clientOsBrowser: false },
  })
  // reported 10 minutes ago → stale
  svc(host).diag({ supported: true, permission: 'granted', secure: true, at: Date.now() - 10 * 60 * 1000 })
  const stale = await tool.execute({})
  assert.equal(stale.reported, true)
  assert.equal(stale.stale, true)
  assert.equal(stale.persist, 'ok')
  // reported just now → fresh
  svc(host).diag({ supported: true, permission: 'denied', secure: true, at: Date.now() })
  const fresh = await tool.execute({})
  assert.equal(fresh.stale, false)
  assert.equal(fresh.permission, 'denied')
})

// ── v0.5.0: persistence + incremental protocol ──────────────────────

test('v0.5 store: serialize→parse roundtrip keeps records, seq and keys; header versioned', () => {
  const recs = [
    { id: 'nt-a-1', kind: 'reply', subkind: 'reply', label: 'L', detail: 'd', outcome: '', at: 123, read: false, seq: 1 },
    { id: 'nt-a-2', kind: 'task-end', subkind: 'job', label: 'J', detail: 'x', outcome: 'ok', at: 456, read: true, seq: 2 },
  ]
  const keys = new Map([['reply:a1:1', 'nt-a-1']])
  const text = store.serialize(recs, 2, keys, 789)
  const parsed = store.parseStore(text)
  assert.equal(parsed.seq, 2)
  assert.deepEqual(parsed.records, recs, 'roundtrip identity (seq-asc layout)')
  assert.deepEqual(parsed.keys, { 'reply:a1:1': 'nt-a-1' })
  const head = JSON.parse(text)
  assert.equal(head.version, store.STORE_VERSION, 'version field for future migrations')
  assert.equal(head.savedAt, 789)
})

test('v0.5 store: corrupt JSON → recovered-empty; missing file → new; parse is total', () => {
  const dir = tmpDataDir()
  fs.writeFileSync(path.join(dir, 'records.json'), '{oops', 'utf8')
  const loaded = store.loadStore(dir)
  assert.equal(loaded.status, 'recovered')
  assert.deepEqual(loaded.records, [])
  assert.equal(loaded.seq, 0)
  assert.equal(store.parseStore('{"records":[{"id":"x"}]}'), null, 'record missing required fields → whole file rejected')
  const fresh = store.loadStore(path.join(dir, 'nope'))
  assert.equal(fresh.status, 'new', 'ENOENT is a fresh install, not an error')
  fs.rmSync(dir, { recursive: true, force: true })
})

test('v1.0 store: resolveDataDir walks out of node_modules — scoped AND unscoped layouts', () => {
  const fakeRoot = path.resolve(os.tmpdir(), 'fakeprof-' + String(process.pid))
  // unscoped: <root>/node_modules/dsh-herald/lib/index.js
  const unscoped = path.join(fakeRoot, 'node_modules', 'dsh-herald', 'lib', 'index.js')
  assert.equal(resolveDataDir(pathToFileURL(unscoped).href), path.join(fakeRoot, 'data', 'task-notify'))
  // scoped: <root>/node_modules/@scope/dsh-herald/lib/index.js
  const scoped = path.join(fakeRoot, 'node_modules', '@some-scope', 'dsh-herald', 'lib', 'index.js')
  const dir = resolveDataDir(pathToFileURL(scoped).href)
  assert.equal(dir, path.join(fakeRoot, 'data', 'task-notify'))
  assert.ok(!dir.includes('node_modules'), 'never inside the package install')
  // the data leaf stays 'task-notify' across renames — upgrades keep history
})

test('v0.5 host: history survives a restart; seq never regresses', async () => {
  const dir = tmpDataDir()
  const h1 = await bootHost({ dataDir: dir })
  h1.host.listeners['agent/turn-stopping']({ agent: { id: 'a1' }, turn: 1 })
  h1.host.listeners['agent/turn-stopping']({ agent: { id: 'a1' }, turn: 2 })
  const before = svc(h1.host).pull()
  assert.equal(before.length, 2)
  h1.host.listeners['dispose']() // dispose fires the final flush
  const h2 = await bootHost({ dataDir: dir })
  const after = svc(h2.host).pull()
  assert.deepEqual(after.map((r) => r.id), before.map((r) => r.id), 'records restored in the same order')
  const maxSeqBefore = Math.max(...before.map((r) => r.seq))
  h2.host.listeners['agent/turn-stopping']({ agent: { id: 'a1' }, turn: 3 })
  const continued = svc(h2.host).pull()[0]
  assert.ok(continued.seq > maxSeqBefore, 'seq continues past the restored maximum')
  fs.rmSync(dir, { recursive: true, force: true })
})

test('v0.5 host: pullSince returns only records changed after the cursor', async () => {
  const { host } = await bootHost()
  for (let i = 1; i <= 3; i++) host.listeners['agent/turn-stopping']({ agent: { id: 'a' + i }, turn: 1 })
  const first = svc(host).pullSince({ cursor: 0 })
  assert.equal(first.reset, true, 'cursor 0 → reset + full history')
  assert.equal(first.items.length, 3)
  const seqs = first.items.map((r) => r.seq).sort((a, b) => a - b)
  // middle cursor: only the later changes come back, seq-ascending
  const mid = svc(host).pullSince({ cursor: seqs[0] })
  assert.equal(mid.reset, false)
  assert.deepEqual(mid.items.map((r) => r.seq), seqs.slice(1))
  // steady state: nothing new → empty delta, tiny payload
  const steady = svc(host).pullSince({ cursor: first.cursor })
  assert.equal(steady.reset, false)
  assert.deepEqual(steady.items, [])
  // new record after the cursor → exactly that record
  host.listeners['agent/turn-stopping']({ agent: { id: 'a9' }, turn: 1 })
  const delta = svc(host).pullSince({ cursor: first.cursor })
  assert.equal(delta.reset, false)
  assert.deepEqual(delta.items.map((r) => r.label), ['a9'])
  // cursor beyond the server seq (new browser / purged storage) → reset
  const beyond = svc(host).pullSince({ cursor: 99999 })
  assert.equal(beyond.reset, true)
  assert.equal(beyond.items.length, 4)
})

test('v0.5 host: pull() keeps the legacy full-array shape, now seq-carrying', async () => {
  const { host } = await bootHost()
  host.listeners['agent/turn-stopping']({ agent: { id: 'a1' }, turn: 1 })
  const list = svc(host).pull()
  assert.ok(Array.isArray(list), 'array envelope unchanged (old clients depend on it)')
  assert.equal(list.length, 1)
  assert.equal(typeof list[0].seq, 'number')
})

test('v0.5 host: ack bumps seq so other tabs see read-state deltas', async () => {
  const { host } = await bootHost()
  host.listeners['agent/turn-stopping']({ agent: { id: 'a1' }, turn: 1 })
  const full = svc(host).pullSince({ cursor: 0 })
  const id = full.items[0].id
  svc(host).ack({ id })
  const delta = svc(host).pullSince({ cursor: full.cursor })
  assert.equal(delta.items.length, 1)
  assert.equal(delta.items[0].id, id)
  assert.equal(delta.items[0].read, true, 'read state travels the delta channel')
})

test('v0.5 host: purge resets the cursor generation — stale clients get reset + empty', async () => {
  const { host } = await bootHost()
  host.listeners['agent/turn-stopping']({ agent: { id: 'a1' }, turn: 1 })
  const before = svc(host).pullSince({ cursor: 0 })
  assert.equal(before.items.length, 1)
  svc(host).purge()
  const after = svc(host).pullSince({ cursor: before.cursor })
  assert.equal(after.reset, true, 'stale cursor is told to rebuild')
  assert.deepEqual(after.items, [])
  assert.equal(after.cursor, 0)
})

test('v0.5 host: read-only storage degrades to disabled; history still works in memory', async () => {
  const deny = (code) => Object.assign(new Error('denied'), { code })
  const fsx = {
    readFileSync: () => { throw deny('ENOENT') },
    mkdirSync: () => { throw deny('EACCES') },
    accessSync: () => { throw deny('EACCES') },
    writeFileSync: () => { throw deny('EACCES') },
    renameSync: () => { throw deny('EACCES') },
    unlinkSync: () => {},
    constants: { W_OK: 2 },
  }
  const { host } = await bootHost({ fs: fsx })
  assert.equal(svc(host).diag({}).persist, 'disabled')
  host.listeners['agent/turn-stopping']({ agent: { id: 'a1' }, turn: 1 })
  assert.equal(svc(host).pull().length, 1, 'in-memory history unaffected')
})

test('v0.5 host: flush writes tmp-then-rename (atomic) and only when dirty', async () => {
  const dir = tmpDataDir()
  const calls = []
  const fsx = {
    readFileSync: () => { throw Object.assign(new Error('no file'), { code: 'ENOENT' }) },
    mkdirSync: () => {},
    accessSync: () => {},
    writeFileSync: (p) => { calls.push(['write', path.basename(p)]) },
    renameSync: (a, b) => { calls.push(['rename', path.basename(a), path.basename(b)]) },
    unlinkSync: () => {},
    constants: { W_OK: 2 },
  }
  const { host } = await bootHost({ dataDir: dir, fs: fsx })
  host.listeners['dispose']()
  assert.deepEqual(calls, [], 'nothing dirty → no write at dispose')
  host.listeners['agent/turn-stopping']({ agent: { id: 'a1' }, turn: 1 })
  host.listeners['dispose']()
  assert.deepEqual(calls, [
    ['write', 'records.json.tmp'],
    ['rename', 'records.json.tmp', 'records.json'],
  ], 'atomic: tmp write, then rename over the target')
  fs.rmSync(dir, { recursive: true, force: true })
})

test('v0.5 host: corrupt stored file → recovered status, empty history, mount succeeds', async () => {
  const dir = tmpDataDir()
  fs.writeFileSync(path.join(dir, 'records.json'), '<<<corrupt>>>', 'utf8')
  const { host } = await bootHost({ dataDir: dir })
  assert.equal(svc(host).diag({}).persist, 'recovered')
  assert.deepEqual(svc(host).pull(), [], 'recovered to empty — never a failed mount')
  // and the next flush REPLACES the corrupt file with a valid one
  host.listeners['agent/turn-stopping']({ agent: { id: 'a1' }, turn: 1 })
  host.listeners['dispose']()
  const h2 = await bootHost({ dataDir: dir })
  assert.equal(svc(h2.host).diag({}).persist, 'ok', 'healed on the next boot')
  assert.equal(svc(h2.host).pull().length, 1)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('v0.5 host: ntfy_status + diag expose the persistence status', async () => {
  const { host } = await bootHost()
  assert.deepEqual(svc(host).diag({ supported: true, permission: 'granted', secure: true, at: Date.now() }), { persist: 'ok' })
  const out = await host.tools[0].execute({})
  assert.equal(out.persist, 'ok')
})

// ── v0.6.0: channel settings + host-direct OS delivery ──────────────

const makeSpawnRecorder = () => {
  const calls = []
  const spawn = (file, args) => {
    const child = {
      killed: false,
      on(evt, fn) { child._on = child._on || {}; child._on[evt] = fn },
      kill() { child.killed = true },
      close(code) { if (child._on && child._on.close) child._on.close(code) },
    }
    calls.push({ file, args, child })
    return child
  }
  return { calls, spawn }
}
const settleSpawns = (rec, code = 0) => { for (const c of rec.calls) c.child.close(code) }

test('v0.6 host: getSettings default view (os on, adapter reported)', async () => {
  const { host } = await bootHost()
  const v = svc(host).getSettings()
  assert.deepEqual(v, { os: { enabled: true }, locked: false, adapter: { available: false, platform: 'none' }, settingsStatus: 'ok' })
})

test('v0.6 host: setSettings persists across restarts', async () => {
  const dir = tmpDataDir()
  const h1 = await bootHost({ dataDir: dir })
  const v1 = svc(h1.host).setSettings({ os: { enabled: false } })
  assert.equal(v1.os.enabled, false)
  assert.equal(v1.locked, false)
  const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'))
  assert.equal(onDisk.os.enabled, false, 'settings.json written atomically next to records.json')
  const h2 = await bootHost({ dataDir: dir })
  assert.equal(svc(h2.host).getSettings().os.enabled, false, 'restart restores the switch')
  fs.rmSync(dir, { recursive: true, force: true })
})

test('v0.6 host: DSH_TASK_NOTIFY_OS env locks the switch', async () => {
  const dir = tmpDataDir()
  const h1 = await bootHost({ dataDir: dir, env: { DSH_TASK_NOTIFY_OS: '0' } })
  assert.equal(svc(h1.host).getSettings().os.enabled, false)
  assert.equal(svc(h1.host).getSettings().locked, true)
  const v = svc(h1.host).setSettings({ os: { enabled: true } })
  assert.equal(v.os.enabled, false, 'env wins — the write is refused')
  assert.equal(fs.existsSync(path.join(dir, 'settings.json')), false, 'file untouched while locked')
  fs.rmSync(dir, { recursive: true, force: true })
})

test('v0.6 host: a new record raises an OS toast from the host process', async () => {
  const rec = makeSpawnRecorder()
  const { host } = await bootHost({ platform: 'win32', spawn: rec.spawn })
  host.listeners['agent/turn-stopping']({ agent: { id: 'a1' }, turn: 1 })
  await new Promise((r) => setTimeout(r, 25)) // pump timer (0ms) fires
  settleSpawns(rec)
  assert.equal(rec.calls.length, 1, 'exactly one spawn (key-deduped pushes only)')
  assert.equal(rec.calls[0].file, 'powershell.exe')
  const script = rec.calls[0].args[rec.calls[0].args.length - 1]
  assert.ok(script.includes('ToastNotificationManager'), 'WinRT toast script')
  assert.ok(!script.includes('a1'), 'raw user text never interpolated — base64 only')
  const b64 = /FromBase64String\('([^']+)'\)/g
  const segs = [...script.matchAll(b64)].map((m) => Buffer.from(m[1], 'base64').toString('utf16le'))
  assert.equal(segs[0], '需要回复', 'title round-trips through base64(UTF-16LE)')
  assert.equal(segs[1], 'a1', 'body carries the agent label')
  assert.equal(svc(host).pull().length, 1, 'queue unaffected by the side channel')
})

test('v0.6 host: key-touch re-notifications never re-toast', async () => {
  const rec = makeSpawnRecorder()
  const { host } = await bootHost({ platform: 'win32', spawn: rec.spawn })
  const req = { agent: { id: 'a1' }, callId: 'c1', toolName: 'bash' }
  host.listeners['approval/request'](req, () => {})
  host.listeners['approval/request'](req, () => {})
  await new Promise((r) => setTimeout(r, 25))
  settleSpawns(rec)
  assert.equal(rec.calls.length, 1, 'second push is a key-touch — no second banner')
})

test('v0.6 host: os disabled (env) → no spawn at all', async () => {
  const rec = makeSpawnRecorder()
  const { host } = await bootHost({ platform: 'win32', spawn: rec.spawn, env: { DSH_TASK_NOTIFY_OS: '0' } })
  host.listeners['agent/turn-stopping']({ agent: { id: 'a1' }, turn: 1 })
  await new Promise((r) => setTimeout(r, 25))
  settleSpawns(rec)
  assert.equal(rec.calls.length, 0, 'the OS channel is off — records still queue though')
  assert.equal(svc(host).pull().length, 1)
})

test('v0.6 host: testOs fires the exempt test toast and reports', async () => {
  const rec = makeSpawnRecorder()
  const { host } = await bootHost({ platform: 'win32', spawn: rec.spawn })
  const r = svc(host).testOs()
  assert.deepEqual(r, { ok: true })
  await new Promise((res) => setTimeout(res, 25))
  settleSpawns(rec)
  assert.equal(rec.calls.length, 1)
})

test('v0.6 host: manifest declares the settings invocations', async () => {
  const { host } = await bootHost()
  const methods = host.typert.invocations.map((i) => i.method)
  for (const m of ['getSettings', 'setSettings', 'testOs']) assert.ok(methods.includes(m), m + ' declared')
})

// ── v0.7.1: gateway positional-parameter shape ──────────────────────
// The typert gateway invokes declared methods with Reflect.apply(method,
// receiver, [paramValues]) — ONE positional value per declared parameter,
// never a named args object. These tests pin BOTH shapes (wire scalar and
// direct-call object) for every parameterized method, reproducing the
// production regressions each fix closes (silent full-reset pulls, silent
// ack no-ops, silent setSettings no-ops).

test('v0.7.1: pullSince accepts the cursor SCALAR (wire shape) and { cursor } (direct)', async () => {
  const { host } = await bootHost()
  host.listeners['agent/turn-stopping']({ agent: { id: 'a1' }, turn: 1 })
  host.listeners['agent/turn-stopping']({ agent: { id: 'a2' }, turn: 1 })
  const full = svc(host).pullSince(0) // scalar, like the gateway passes it
  assert.equal(full.reset, true)
  assert.equal(full.items.length, 2)
  // scalar cursor at maxSeq → true steady-state delta (the regression:
  // every round used to come back reset:true with the full history)
  const steady = svc(host).pullSince(full.cursor)
  assert.equal(steady.reset, false, 'scalar cursor is RESPECTED — no silent full pulls')
  assert.deepEqual(steady.items, [])
  // object shape (direct calls / older clients) still works
  const obj = svc(host).pullSince({ cursor: 0 })
  assert.equal(obj.reset, true)
  assert.equal(obj.items.length, 2)
})

test('v0.7.1: ack accepts the id SCALAR (wire shape) and { id } (direct)', async () => {
  const { host } = await bootHost()
  host.listeners['agent/turn-stopping']({ agent: { id: 'a1' }, turn: 1 })
  const id = svc(host).pull()[0].id
  svc(host).ack(id) // scalar, like the gateway passes it
  assert.equal(svc(host).pull().find((r) => r.id === id).read, true, 'scalar ack marks read (the regression: silent no-op)')
  host.listeners['agent/turn-stopping']({ agent: { id: 'a2' }, turn: 1 })
  const id2 = svc(host).pull().find((r) => !r.read).id
  assert.equal(svc(host).pull().find((r) => r.id === id2).read, false)
  svc(host).ack({ id: id2 }) // object shape still works
  assert.equal(svc(host).pull().find((r) => r.id === id2).read, true)
})

test('v0.7.1: setSettings accepts { enabled } (wire shape) and { os: { enabled } } (direct)', async () => {
  const dir = tmpDataDir()
  const { host } = await bootHost({ dataDir: dir })
  const v = svc(host).setSettings({ enabled: false }) // positional os value, as the gateway passes it
  assert.equal(v.os.enabled, false, 'wire shape applies (the regression: switch bounced back)')
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8')).os.enabled, false, 'and persists')
  const v2 = svc(host).setSettings({ os: { enabled: true } }) // direct shape still works
  assert.equal(v2.os.enabled, true)
  fs.rmSync(dir, { recursive: true, force: true })
})
