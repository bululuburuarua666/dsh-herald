// Zero-dependency black-box tests for lib/client.js pure logic.
// Mocks the browser globals (window.__ModuleLoader__, React, Notification,
// localStorage, document) and drives the plugin through its slot-render
// callbacks, asserting on the rendered element tree and on Notification calls.
//
// Run: node --test test/client.test.mjs

import assert from 'node:assert/strict'
import { test } from 'node:test'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// ── mocks ──

const React = {
  useState: (init) => [init, () => {}],
  useEffect: (fn) => { try { return fn() } catch (e) { return undefined } },
  createElement: (type, props, ...children) => {
    const p = props || {}
    const kids = children.flat(Infinity)
    // Real React invokes function components at render time; simulate that
    // and merge their props into the result so tests can inspect `item`.
    if (typeof type === 'function') {
      const el = type(p)
      if (el && typeof el === 'object') el.props = Object.assign({}, p, el.props || {})
      return el
    }
    return { type, props: p, children: kids }
  },
}

class FakeNotification {
  static permission = 'granted'
  static requestPermission = async () => 'granted'
  static instances = []
  static reset() { FakeNotification.instances = [] }
  constructor(title, options) {
    this.title = title
    this.options = options || {}
    FakeNotification.instances.push(this)
  }
}

function makeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
  }
}

function makeDocument() {
  const doc = {
    visibilityState: 'visible',
    styleTags: [],
    head: { appendChild(el) { doc.styleTags.push(el && el.textContent) } },
    createElement: () => ({ textContent: '', remove() {}, setAttribute() {} }),
    listeners: new Map(),
    addEventListener(evt, fn) { doc.listeners.set(evt, fn) },
    removeEventListener(evt) { doc.listeners.delete(evt) },
    __bellEl: null,
    querySelector(sel) { return sel === '.ntfy-bell' && doc.__bellEl !== null ? doc.__bellEl : null },
  }
  return doc
}

function makeCtx(rpc, doc) {
  const ctx = {
    injected: {},
    timeouts: [],
    timeoutMs: [],
    rpcMethods: [],
    get(name) {
      if (name === 'slots') return ctx.slots
      if (name === 'locale') return ctx.locale
      return undefined
    },
    slots: {
      inject(name, cb) { ctx.injected[name] = cb },
      register(_desc, render) { return render },
    },
    locale: {
      getLocale: () => ({ active: 'zh' }),
      subscribe: () => () => {},
    },
    connection: { rpc: { call: async (channel, method, body) => { ctx.rpcMethods.push(method); return rpc(channel, method, body) } } },
    effect(fn) { return fn() },
    // v0.3.0: disposers are REAL — a disposed timer never fires (hover-pause
    // tests rely on it). The array keeps plain fireable wrappers so legacy
    // `for (const cb of ctx.timeouts) cb()` loops keep working.
    // v0.5.0: the Poller is a self-rescheduling ctx.timeout chain (backoff
    // ladder 1500/2500/4000/5000) — there is no ctx.interval anymore.
    timeout(cb, ms) {
      const rec = { dead: false }
      ctx.timeoutMs.push(ms)
      ctx.timeouts.push(() => { if (!rec.dead) cb() })
      return () => { rec.dead = true }
    },
  }
  void doc
  return ctx
}

// ── module loading ──

let factory = null
globalThis.window = {
  __ModuleLoader__: {
    load(spec) {
      if (spec && spec.id === 'dsh-herald') factory = spec.factory
    },
  },
  isSecureContext: true,
  focus() {},
  innerWidth: 1440,
  innerHeight: 900,
  listeners: new Map(),
  addEventListener(evt, fn) { globalThis.window.listeners.set(evt, fn) },
  removeEventListener(evt) { globalThis.window.listeners.delete(evt) },
}
globalThis.Notification = FakeNotification

const modUrl = pathToFileURL(path.resolve('lib/client.js')).href
const applyReady = (async () => {
  await import(modUrl)
  const mod = factory((name) => {
    if (name === 'react') return React
    throw new Error('unexpected require: ' + name)
  })
  return mod
})()

const flush = async () => {
  await new Promise((r) => setImmediate(r))
  await new Promise((r) => setImmediate(r))
}

const item = (id, at, read = false) => ({
  id, kind: 'task-end', subkind: 'job', label: 'job-' + id, detail: '', outcome: 'ok', at, read,
})

function findNodes(node, pred, out = []) {
  if (!node || typeof node !== 'object') return out
  if (pred(node)) out.push(node)
  for (const c of node.children || []) findNodes(c, pred, out)
  return out
}

const renderOverlay = (ctx) => ctx.injected['shell.overlay']()()

function panelItems(tree) {
  const list = findNodes(tree, (n) => n.props && n.props.className === 'ntfy-list')[0]
  if (!list) return []
  return (list.children || []).filter((c) => c && c.props && c.props.item).map((c) => c.props.item)
}

function toastIds(tree) {
  const box = findNodes(tree, (n) => n.props && n.props.className === 'ntfy-toasts')[0]
  if (!box) return []
  return (box.children || []).filter((c) => c && c.props && c.props.item).map((c) => c.props.item.id)
}

function clickBell(ctx) {
  const tree = ctx.injected['sidebar.footer.action']()({})
  const bell = findNodes(tree, (n) => n.props && typeof n.props.className === 'string' && n.props.className.startsWith('ntfy-bell'))[0]
  assert.ok(bell, 'bell should be mounted')
  bell.props.onClick()
  return renderOverlay(ctx)
}

// v0.5.0: poll delays live on the backoff ladder — the only timeouts with
// these ms values are poll re-arms (toasts 6000/500, purge arm 3000).
const POLL_MS = new Set([1500, 2500, 4000, 5000])
// Fire the NEWEST armed poll timer (older wrappers are spent; dead ones no-op).
const firePoll = (ctx) => {
  for (let i = ctx.timeoutMs.length - 1; i >= 0; i--) {
    if (POLL_MS.has(ctx.timeoutMs[i])) { ctx.timeouts[i](); return true }
  }
  return false
}

async function boot(pullHandler, { storage = null, hidden = false } = {}) {
  const doc = makeDocument()
  doc.visibilityState = hidden ? 'hidden' : 'visible'
  globalThis.document = doc
  if (storage !== null) globalThis.localStorage = storage
  else delete globalThis.localStorage
  const pullCount = { n: 0 }
  // v0.5.0 translation of the v0.4 "full snapshot every poll" world: every
  // pullSince round is answered reset:true with the handler's list, so the
  // legacy assertions keep their exact full-replace semantics.
  const rpc = async (_channel, method) => {
    if (method === 'taskNotify/pullSince') {
      pullCount.n++
      return { ok: true, value: { items: pullHandler(pullCount.n), cursor: pullCount.n * 100, reset: true } }
    }
    return { ok: true, value: null }
  }
  const ctx = makeCtx(rpc, doc)
  const mod = await applyReady
  await mod.apply(ctx)
  renderOverlay(ctx) // mount the overlay → Poller effect fires its first poll
  return { ctx, doc, pullCount }
}

// ── tests ──

test('module exposes apply + inject', async () => {
  const mod = await applyReady
  assert.equal(typeof mod.apply, 'function')
  assert.deepEqual(mod.inject, ['slots', 'locale', 'timer', 'connection'])
})

test('dedupes pushes across polls within one session', async () => {
  FakeNotification.reset()
  const list = [item('a', 200), item('b', 100)]
  const { ctx } = await boot(() => list, { storage: makeStorage() })
  await flush()
  assert.equal(FakeNotification.instances.length, 2)
  firePoll(ctx)
  await flush()
  assert.equal(FakeNotification.instances.length, 2)
  const tags = FakeNotification.instances.map((n) => n.options.tag).sort()
  assert.deepEqual(tags, ['ntfy-a', 'ntfy-b'])
})

test('refresh does not re-push thanks to localStorage dedupe', async () => {
  FakeNotification.reset()
  const storage = makeStorage()
  const list = [item('a', 200), item('b', 100)]
  await boot(() => list, { storage })
  await flush()
  assert.equal(FakeNotification.instances.length, 2)
  // second page load: fresh module state, same origin storage
  const second = await boot(() => list, { storage })
  await flush()
  assert.equal(FakeNotification.instances.length, 2)
  assert.deepEqual(toastIds(renderOverlay(second.ctx)), [])
  const tree = clickBell(second.ctx)
  assert.deepEqual(panelItems(tree).map((x) => x.id), ['a', 'b'])
})

test('reconciles server-deleted ids out of panel and toasts', async () => {
  FakeNotification.reset()
  const list = [item('a', 300), item('b', 200), item('c', 100)]
  let current = list
  const { ctx } = await boot(() => current, { storage: makeStorage() })
  await flush()
  assert.equal(FakeNotification.instances.length, 3)
  current = [item('b', 200)]
  firePoll(ctx)
  await flush()
  const tree = clickBell(ctx)
  assert.deepEqual(panelItems(tree).map((x) => x.id), ['b'])
  assert.deepEqual(toastIds(renderOverlay(ctx)), ['b'])
})

test('keeps server order: newest first', async () => {
  FakeNotification.reset()
  const list = [item('new', 500), item('old', 100)]
  const { ctx } = await boot(() => list, { storage: makeStorage() })
  await flush()
  const tree = clickBell(ctx)
  assert.deepEqual(panelItems(tree).map((x) => x.id), ['new', 'old'])
})

test('skips polling while hidden and polls on visibilitychange', async () => {
  FakeNotification.reset()
  let pulls = 0
  const { ctx, doc } = await boot((n) => { pulls = n; return [item('a', 100)] }, { storage: makeStorage(), hidden: true })
  await flush()
  assert.equal(pulls, 0)
  firePoll(ctx)
  await flush()
  assert.equal(pulls, 0)
  assert.equal(FakeNotification.instances.length, 0)
  doc.visibilityState = 'visible'
  doc.listeners.get('visibilitychange')()
  await flush()
  assert.equal(pulls, 1)
  assert.equal(FakeNotification.instances.length, 1)
})

test('budgets at most 3 new pushes per poll round', async () => {
  FakeNotification.reset()
  const list = Array.from({ length: 10 }, (_, i) => item('x' + i, 1000 - i))
  const { ctx } = await boot(() => list) // no storage → in-memory fallback
  await flush()
  assert.equal(FakeNotification.instances.length, 3)
  firePoll(ctx); await flush()
  assert.equal(FakeNotification.instances.length, 6)
  firePoll(ctx); await flush()
  assert.equal(FakeNotification.instances.length, 9)
  firePoll(ctx); await flush()
  assert.equal(FakeNotification.instances.length, 10)
  firePoll(ctx); await flush()
  assert.equal(FakeNotification.instances.length, 10)
})

test('never pushes read items', async () => {
  FakeNotification.reset()
  const list = [item('a', 100, true), item('b', 200, false)]
  await boot(() => list, { storage: makeStorage() })
  await flush()
  assert.equal(FakeNotification.instances.length, 1)
  assert.equal(FakeNotification.instances[0].options.tag, 'ntfy-b')
})

test('toast disappears after its timeout', async () => {
  FakeNotification.reset()
  const list = [item('a', 100)]
  const { ctx } = await boot(() => list, { storage: makeStorage() })
  await flush()
  assert.deepEqual(toastIds(renderOverlay(ctx)), ['a'])
  for (const cb of ctx.timeouts) cb()
  assert.deepEqual(toastIds(renderOverlay(ctx)), [])
})

// ── v0.3.0: UI & chimes ─────────────────────────────────────────────

// Audio spy: records construction + every oscillator/gain handed out.
class FakeAudio {
  static instances = []
  static reset() { FakeAudio.instances = [] }
  constructor() {
    this.currentTime = 0
    this.state = 'running'
    this.destination = {}
    this.oscs = []
    this.gains = []
    FakeAudio.instances.push(this)
  }
  async resume() { this.resumeCalls = (this.resumeCalls || 0) + 1; this.state = 'running' }
  createOscillator() {
    const o = { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }
    this.oscs.push(o)
    return o
  }
  createGain() {
    const g = { ramps: [], gain: { setValueAtTime() {}, exponentialRampToValueAtTime(v) { g.ramps.push(v) } }, connect() {} }
    this.gains.push(g)
    return g
  }
}

const firstNodes = (tree, pred) => findNodes(tree, pred)

async function bootV3(pullHandler, opts = {}) {
  const h = await boot(pullHandler, opts)
  return h
}

test('v0.3 pure: chimePlan splits task-end by outcome; direction encoding holds', async () => {
  const mod = await applyReady
  const { chimePlan } = mod.__internals
  const ok = chimePlan('task-end', 'ok').notes.map((n) => n.f)
  const failed = chimePlan('task-end', 'failed').notes.map((n) => n.f)
  const killed = chimePlan('task-end', 'killed').notes.map((n) => n.f)
  assert.deepEqual(ok, [523, 784], 'ok ascends')
  assert.deepEqual(failed, [330, 262], 'failed descends')
  assert.deepEqual(killed, [440], 'killed: single low note')
  assert.deepEqual(chimePlan('approval', '').notes.map((n) => n.f), [880, 880], 'approval double-taps')
  assert.deepEqual(chimePlan('reply', '').notes.map((n) => n.f), [523, 659], 'reply ascends')
  // Wave discipline: triangle/sine only, never sawtooth.
  for (const plan of [chimePlan('approval', ''), chimePlan('reply', ''), chimePlan('task-end', 'ok'), chimePlan('task-end', 'failed'), chimePlan('task-end', 'killed')]) {
    for (const n of plan.notes) assert.ok(n.w === 'triangle' || n.w === 'sine', 'wave ' + n.w)
  }
  assert.equal(chimePlan('unknown-kind', ''), null)
})

test('v0.3 pure: volume clamps and the unified gain coefficient', async () => {
  const mod = await applyReady
  const { clampVolume, effectiveGain } = mod.__internals
  assert.equal(clampVolume(1.5), 1)
  assert.equal(clampVolume(-0.2), 0)
  assert.equal(clampVolume(0.7), 0.7)
  assert.equal(effectiveGain(0.22, 0), 0, 'volume 0 → every gain is exactly 0')
  assert.equal(effectiveGain(0.22, 0.5), 0.11)
  assert.equal(effectiveGain(0.22, 2), 0.22, 'out-of-range volume clamps to 1')
})

test('v0.3 pure: corrupt audio storage falls back to defaults; partial values honored', async () => {
  const mod = await applyReady
  const { parseAudioConfig, AUDIO_DEFAULTS } = mod.__internals
  assert.deepEqual(parseAudioConfig('not json at all'), AUDIO_DEFAULTS)
  assert.deepEqual(parseAudioConfig(''), AUDIO_DEFAULTS)
  assert.deepEqual(parseAudioConfig('{"enabled":false,"volume":2,"muteWhenHidden":false}'), { enabled: false, volume: 1, muteWhenHidden: false })
  assert.deepEqual(parseAudioConfig('{"volume":"bogus"}'), AUDIO_DEFAULTS, 'non-numeric volume ignored → default')
})

test('v0.3 pure: panel anchor clamps at the viewport edge; mobile centers', async () => {
  const mod = await applyReady
  const { computePanelPos } = mod.__internals
  // Desktop: bell right 260 → left 268; bell bottom 780 of 900 → bottom 120.
  const near = computePanelPos({ right: 260, bottom: 780 }, 1440, 900, 340)
  assert.equal(near.mobile, false)
  assert.equal(near.left, 268)
  assert.equal(near.bottom, 120)
  // Clamp: bell far right → panel never crosses viewport - width - 12.
  const clamped = computePanelPos({ right: 2000, bottom: 780 }, 1440, 900, 340)
  assert.equal(clamped.left, 1440 - 340 - 12)
  // Mobile: centered card geometry.
  const mob = computePanelPos({ right: 300, bottom: 600 }, 390, 844, 340)
  assert.equal(mob.mobile, true)
  assert.equal(mob.left, 12)
  assert.equal(mob.bottom, 12)
  assert.equal(mob.maxHeight, Math.min(Math.round(844 * 0.65), 560))
})

test('v0.3 mounted: ok vs failed task-end play DIFFERENT oscillator sequences', async () => {
  FakeNotification.reset()
  FakeAudio.reset()
  globalThis.AudioContext = FakeAudio
  try {
    const okItem = { id: 'ok1', kind: 'task-end', subkind: 'job', label: 'l', detail: '', outcome: 'ok', at: 300, read: false }
    const failItem = { id: 'bad1', kind: 'task-end', subkind: 'job', label: 'l', detail: '', outcome: 'failed', at: 100, read: false }
    const { ctx } = await bootV3(() => [okItem, failItem], { storage: makeStorage() })
    await flush()
    assert.equal(FakeAudio.instances.length, 1, 'one lazy context')
    const freqs = FakeAudio.instances[0].oscs.map((o) => o.frequency.value)
    assert.deepEqual(freqs.slice(0, 2), [523, 784], 'ok chime ascends')
    assert.deepEqual(freqs.slice(2, 4), [330, 262], 'failed chime descends')
    assert.deepEqual(toastIds(renderOverlay(ctx)), ['ok1', 'bad1'])
  } finally {
    delete globalThis.AudioContext
  }
})

test('v0.3 mounted: enabled=false never constructs an AudioContext', async () => {
  FakeNotification.reset()
  FakeAudio.reset()
  globalThis.AudioContext = FakeAudio
  const storage = makeStorage()
  storage.setItem('dsh-task-notify:audio', JSON.stringify({ enabled: false, volume: 0.5, muteWhenHidden: false }))
  try {
    await bootV3(() => [item('a', 100)], { storage })
    await flush()
    assert.equal(FakeAudio.instances.length, 0, 'no context, no oscillators')
    assert.equal(FakeNotification.instances.length, 1, 'OS notifications unaffected')
  } finally {
    delete globalThis.AudioContext
  }
})

test('v0.3 mounted: toast hover pauses the countdown; leave resumes the remainder', async () => {
  FakeNotification.reset()
  const { ctx } = await bootV3(() => [item('a', 100)], { storage: makeStorage() })
  await flush()
  assert.deepEqual(toastIds(renderOverlay(ctx)), ['a'])
  const toastNode = () => firstNodes(renderOverlay(ctx), (n) => n.props && typeof n.props.className === 'string' && /^ntfy-toast( |$)/.test(n.props.className))[0]
  toastNode().props.onMouseEnter() // pause → dispose the 6s timer
  for (const cb of [...ctx.timeouts]) cb() // dead timer must NOT fire
  assert.deepEqual(toastIds(renderOverlay(ctx)), ['a'], 'paused toast survives its original deadline')
  const resumedTimers = ctx.timeoutMs.length
  toastNode().props.onMouseLeave() // resume → fresh timer with the remainder
  assert.ok(ctx.timeoutMs.length > resumedTimers, 'a new timer was scheduled')
  const ms = ctx.timeoutMs[ctx.timeoutMs.length - 1]
  assert.ok(ms <= 6000 && ms > 5500, 'resumed with the remaining time, not the full 6s: ' + ms)
  for (const cb of [...ctx.timeouts]) cb() // fade stage
  for (const cb of [...ctx.timeouts]) cb() // removal
  assert.deepEqual(toastIds(renderOverlay(ctx)), [], 'gone after the resumed countdown')
})

test('v0.3 mounted: failed toast gets ✕ + role=alert; ok gets ✓ + role=status', async () => {
  FakeNotification.reset()
  const failItem = { id: 'bad1', kind: 'task-end', subkind: 'job', label: 'l', detail: '', outcome: 'failed', at: 100, read: false }
  const okItem = item('good1', 50)
  const { ctx } = await bootV3(() => [okItem, failItem], { storage: makeStorage() })
  await flush()
  const titles = firstNodes(renderOverlay(ctx), (n) => n.props && n.props.className === 'ntfy-toast-title').map((n) => n.children[0])
  const roles = firstNodes(renderOverlay(ctx), (n) => n.props && typeof n.props.className === 'string' && /^ntfy-toast( |$)/.test(n.props.className)).map((n) => n.props.role)
  assert.ok(titles.some((x) => String(x).startsWith('✕ ')), 'failed mark: ' + titles.join('|'))
  assert.ok(titles.some((x) => String(x).startsWith('✓ ')), 'ok mark')
  assert.ok(roles.includes('alert') && roles.includes('status'), 'roles split by outcome')
})

test('v0.3 mounted: purge needs TWO clicks; first arms, second rpc-purges', async () => {
  FakeNotification.reset()
  const { ctx } = await bootV3(() => [item('a', 100)], { storage: makeStorage() })
  await flush()
  clickBell(ctx)
  const findPurge = () => firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-purge'] === true)[0]
  const findToggle = () => firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-diag-toggle'] === true)[0]
  findToggle().props.onClick() // expand diagnostics (purge lives there now)
  const armed = findPurge()
  armed.props.onClick() // first click: arm only
  assert.ok(!ctx.rpcMethods.includes('taskNotify/purge'), 'first click purges NOTHING')
  const armedNode = findPurge()
  assert.equal(String(armedNode.children[0]).includes('确认'), true, 'armed copy asks to confirm')
  armedNode.props.onClick() // second click: fire
  assert.ok(ctx.rpcMethods.includes('taskNotify/purge'), 'second click rpc-purges')
  const tree = renderOverlay(ctx)
  assert.equal(panelItems(tree).length, 0, 'panel emptied')
})

test('v0.3 mounted: diagnostics default folded; ⓘ expands settings, sub-fold reveals raw diagnostics', async () => {
  FakeNotification.reset()
  const { ctx } = await bootV3(() => [item('a', 100)], { storage: makeStorage() })
  await flush()
  clickBell(ctx)
  let tree = renderOverlay(ctx)
  assert.ok(firstNodes(tree, (n) => n.props && n.props['data-ntfy-diag-summary'] === true).length > 0, 'one-line summary present')
  assert.equal(firstNodes(tree, (n) => n.props && n.props['data-ntfy-diag-detail'] === true).length, 0, 'details hidden by default')
  assert.equal(firstNodes(tree, (n) => n.props && n.props['data-ntfy-audio'] === true).length, 0, 'audio settings hidden by default')
  firstNodes(tree, (n) => n.props && n.props['data-ntfy-diag-toggle'] === true)[0].props.onClick()
  tree = renderOverlay(ctx)
  // v0.7.0: the drawer shows the friendly sections immediately; the RAW
  // diagnostics are sub-folded behind 诊断详情.
  assert.ok(firstNodes(tree, (n) => n.props && n.props['data-ntfy-channels'] === true).length > 0, 'channel cards after ⓘ')
  assert.ok(firstNodes(tree, (n) => n.props && n.props['data-ntfy-audio'] === true).length > 0, 'audio settings after ⓘ')
  assert.equal(firstNodes(tree, (n) => n.props && n.props['data-ntfy-diag-detail'] === true).length, 0, 'raw diagnostics still sub-folded')
  firstNodes(tree, (n) => n.props && typeof n.props.className === 'string' && n.props.className.includes('ntfy-sec-toggle'))[0].props.onClick()
  tree = renderOverlay(ctx)
  assert.ok(firstNodes(tree, (n) => n.props && n.props['data-ntfy-diag-detail'] === true).length > 0, 'raw diagnostics after the sub-fold')
  assert.ok(firstNodes(tree, (n) => n.props && n.props['data-ntfy-audio-enabled'] === true).length > 0, 'enable switch')
  assert.ok(firstNodes(tree, (n) => n.props && n.props['data-ntfy-audio-volume'] === true).length > 0, 'volume slider')
  assert.ok(firstNodes(tree, (n) => n.props && n.props['data-ntfy-audio-mute-hidden'] === true).length > 0, 'mute-when-hidden checkbox')
})

test('v0.3 mounted: audio settings persist immediately', async () => {
  FakeNotification.reset()
  const storage = makeStorage()
  const { ctx } = await bootV3(() => [item('a', 100)], { storage })
  await flush()
  clickBell(ctx)
  const tree = renderOverlay(ctx)
  firstNodes(tree, (n) => n.props && n.props['data-ntfy-diag-toggle'] === true)[0].props.onClick()
  const expanded = renderOverlay(ctx)
  firstNodes(expanded, (n) => n.props && n.props['data-ntfy-audio-enabled'] === true)[0].props.onClick()
  firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-audio-volume'] === true)[0].props.onChange({ target: { value: '0.4' } })
  firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-audio-mute-hidden'] === true)[0].props.onChange({ target: { checked: false } })
  const saved = JSON.parse(storage.getItem('dsh-task-notify:audio'))
  assert.equal(saved.enabled, false)
  assert.equal(saved.volume, 0.4)
  assert.equal(saved.muteWhenHidden, false)
})

test('v0.3 mounted: two empty states differ (first-run guide vs all-caught-up)', async () => {
  FakeNotification.reset()
  // First run: never saw a non-empty list.
  const first = await bootV3(() => [], { storage: makeStorage() })
  await flush()
  const firstTree = clickBell(first.ctx)
  const firstEmpty = firstNodes(firstTree, (n) => n.props && n.props['data-ntfy-empty'] !== undefined)[0]
  assert.equal(firstEmpty.props['data-ntfy-empty'], 'first')
  assert.ok(firstNodes(firstTree, (n) => n.props && n.props.className === 'ntfy-empty-title').length > 0, 'guide title')
  assert.ok(firstNodes(firstTree, (n) => n.props && n.props['data-ntfy-empty-test'] === true).length > 0, 'test button in the guide')
  // Seen-and-cleared: same session, purge via the (confirmed) UI path.
  const second = await bootV3(() => [item('a', 100)], { storage: makeStorage() })
  await flush()
  clickBell(second.ctx)
  const t1 = renderOverlay(second.ctx)
  firstNodes(t1, (n) => n.props && n.props['data-ntfy-diag-toggle'] === true)[0].props.onClick()
  const purge = firstNodes(renderOverlay(second.ctx), (n) => n.props && n.props['data-ntfy-purge'] === true)[0]
  purge.props.onClick()
  firstNodes(renderOverlay(second.ctx), (n) => n.props && n.props['data-ntfy-purge'] === true)[0].props.onClick()
  const clearedTree = renderOverlay(second.ctx)
  const clearedEmpty = firstNodes(clearedTree, (n) => n.props && n.props['data-ntfy-empty'] !== undefined)[0]
  assert.equal(clearedEmpty.props['data-ntfy-empty'], 'cleared')
  assert.ok(String(clearedEmpty.children[0]).includes('都处理完了'), 'short copy')
  assert.equal(firstNodes(clearedTree, (n) => n.props && n.props['data-ntfy-empty-test'] === true).length, 0, 'no guide button once cleared')
})

test('v0.3 mounted: panel anchors to the bell and clamps into the viewport', async () => {
  FakeNotification.reset()
  const { ctx, doc } = await bootV3(() => [], { storage: makeStorage() })
  await flush()
  doc.__bellEl = { getBoundingClientRect: () => ({ right: 260, bottom: 780 }) }
  globalThis.window.innerWidth = 1440
  globalThis.window.innerHeight = 900
  const tree = clickBell(ctx)
  const panel = firstNodes(tree, (n) => n.props && n.props.className === 'ntfy-panel')[0]
  assert.equal(panel.props.style.left, '268px', 'bell right 260 + 8')
  assert.equal(panel.props.style.bottom, '120px', 'viewport 900 - bell bottom 780')
  // Narrow viewport: mobile geometry (centered card), no clamp math.
  globalThis.window.innerWidth = 390
  globalThis.window.innerHeight = 844
  const bell = firstNodes(ctx.injected['sidebar.footer.action']()({}), (n) => n.props && typeof n.props.className === 'string' && n.props.className.startsWith('ntfy-bell'))[0]
  bell.props.onClick() // close then reopen? state toggles — reopen via second click
  bell.props.onClick()
  const mobTree = renderOverlay(ctx)
  const mobPanel = firstNodes(mobTree, (n) => n.props && n.props.className === 'ntfy-panel')[0]
  assert.equal(mobPanel.props.style.left, '12px', 'mobile: left margin')
  assert.equal(mobPanel.props.style.right, '12px', 'mobile: right margin')
  assert.equal(mobPanel.props.style.width, 'auto')
  globalThis.window.innerWidth = 1440
  globalThis.window.innerHeight = 900
})

test('v0.3 mounted: outside pointerdown closes the panel', async () => {
  FakeNotification.reset()
  const { ctx, doc } = await bootV3(() => [], { storage: makeStorage() })
  await flush()
  clickBell(ctx)
  assert.ok(firstNodes(renderOverlay(ctx), (n) => n.props && n.props.className === 'ntfy-panel').length > 0, 'open')
  const onDown = doc.listeners.get('pointerdown')
  assert.ok(typeof onDown === 'function', 'backdrop listener armed while open')
  onDown({ target: { closest: () => null } }) // click nowhere near panel/bell
  assert.equal(firstNodes(renderOverlay(ctx), (n) => n.props && n.props.className === 'ntfy-panel').length, 0, 'closed by outside click')
})

// ── v0.3.1: OS notification polish + Apple-style in-app toasts ──────

test('v0.3.1: OS notifications carry the designed icon and stay silent (our chime owns sound)', async () => {
  FakeNotification.reset()
  await bootV3(() => [item('a', 100)], { storage: makeStorage() })
  await flush()
  assert.equal(FakeNotification.instances.length, 1)
  const n = FakeNotification.instances[0]
  assert.equal(n.options.silent, true, 'silent — the chime plays the sound')
  assert.ok(typeof n.options.icon === 'string' && n.options.icon.startsWith('data:image/svg+xml'), 'designed icon data URI')
})

test('v0.3.1: failed task-end toast carries a tinted icon chip (kind color + tint bg)', async () => {
  FakeNotification.reset()
  const failItem = { id: 'bad1', kind: 'task-end', subkind: 'job', label: 'l', detail: '', outcome: 'failed', at: 100, read: false }
  const { ctx } = await bootV3(() => [failItem], { storage: makeStorage() })
  await flush()
  const chips = firstNodes(renderOverlay(ctx), (n) => n.props && typeof n.props.className === 'string' && n.props.className.includes('ntfy-toast-icon'))
  assert.equal(chips.length, 1, 'icon chip on the toast')
  assert.ok(chips[0].props.className.includes('ntfy-kind-task-end'), 'kind color class on the chip')
})

test('v0.3.1: CSS contract — Apple-style toast + panel polish, tokens only', async () => {
  const { doc } = await bootV3(() => [], { storage: makeStorage() })
  const css = doc.styleTags.join('\n')
  assert.ok(css.includes('.ntfy-toast-icon {'), 'tinted icon chip styled')
  assert.ok(css.includes('border-radius: 16px'), 'toast 16px radius')
  assert.ok(css.includes('color-mix'), 'tint via color-mix (token-derived, no hex)')
  assert.ok(css.includes('border-radius: 14px'), 'panel 14px radius')
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'reduced motion honored')
})

// ── v0.4.0: independent theme override (auto = follow DSH) ──────────

test('v0.4 pure: parseTheme accepts only light/dark, everything else is auto', async () => {
  const mod = await applyReady
  const { parseTheme } = mod.__internals
  assert.equal(parseTheme('light'), 'light')
  assert.equal(parseTheme('dark'), 'dark')
  assert.equal(parseTheme('auto'), 'auto')
  assert.equal(parseTheme(null), 'auto')
  assert.equal(parseTheme('system'), 'auto')
  assert.equal(parseTheme('{"x":1}'), 'auto')
})

test('v0.4 mounted: theme row exists in the expanded settings; switching persists and tags the surfaces', async () => {
  FakeNotification.reset()
  const storage = makeStorage()
  const { ctx } = await bootV3(() => [], { storage })
  await flush()
  // auto (default): NO theme attr anywhere.
  let tree = clickBell(ctx)
  let panel = firstNodes(tree, (n) => n.props && n.props.className === 'ntfy-panel')[0]
  assert.equal(panel.props['data-ntfy-theme'], undefined, 'auto leaves the attribute off')
  // Open settings, click 深色.
  firstNodes(tree, (n) => n.props && n.props['data-ntfy-diag-toggle'] === true)[0].props.onClick()
  tree = renderOverlay(ctx)
  const darkBtn = firstNodes(tree, (n) => n.props && n.props['data-ntfy-theme-choice'] === 'dark')[0]
  assert.ok(darkBtn !== undefined, 'dark option exists')
  darkBtn.props.onClick()
  // Panel + bell + toasts carry the override attr; the choice persisted.
  tree = renderOverlay(ctx)
  panel = firstNodes(tree, (n) => n.props && n.props.className === 'ntfy-panel')[0]
  assert.equal(panel.props['data-ntfy-theme'], 'dark', 'panel carries the override')
  assert.equal(storage.getItem('dsh-task-notify:theme'), 'dark', 'persisted')
  const bellTree = ctx.injected['sidebar.footer.action']()({})
  const bell = firstNodes(bellTree, (n) => n.props && typeof n.props.className === 'string' && n.props.className.startsWith('ntfy-bell'))[0]
  assert.equal(bell.props['data-ntfy-theme'], 'dark', 'bell carries the override')
  // Back to auto: attribute disappears again.
  firstNodes(tree, (n) => n.props && n.props['data-ntfy-theme-choice'] === 'auto')[0].props.onClick()
  tree = renderOverlay(ctx)
  panel = firstNodes(tree, (n) => n.props && n.props.className === 'ntfy-panel')[0]
  assert.equal(panel.props['data-ntfy-theme'], undefined, 'auto restores host-following')
})

test('v0.4 mounted: corrupted theme storage falls back to auto', async () => {
  FakeNotification.reset()
  const storage = makeStorage()
  storage.setItem('dsh-task-notify:theme', 'banana')
  const { ctx } = await bootV3(() => [], { storage })
  await flush()
  const tree = clickBell(ctx)
  const panel = firstNodes(tree, (n) => n.props && n.props.className === 'ntfy-panel')[0]
  assert.equal(panel.props['data-ntfy-theme'], undefined, 'garbage value → auto (host-following)')
})

test('v0.4 CSS: both override blocks exist, attribute-scoped only', async () => {
  const { doc } = await bootV3(() => [], { storage: makeStorage() })
  const css = doc.styleTags.join('\n')
  assert.ok(css.includes('[data-ntfy-theme="light"]'), 'light override block')
  assert.ok(css.includes('[data-ntfy-theme="dark"]'), 'dark override block')
  // No global selector touched: overrides may only live under the attribute.
  const lines = css.split('\n').filter((l) => l.includes('--dsw-alias-bg-overlay:'))
  assert.ok(lines.every((l) => l.startsWith('[data-ntfy-theme=')), 'every override is attribute-scoped: ' + lines.join(' | '))
  assert.ok(css.includes('.ntfy-theme-row'), 'theme row styled')
})

// ── v0.5.0: incremental sync + adaptive backoff + persistence diag ────

// Full-control boot: roundFn(n, cursor) returns either a pullSince VALUE
// { items, cursor, reset } or an error envelope { ok:false, error:{code,
// message} }. opts.legacyList controls the legacy pull() answer (used by
// the pre-0.5-host fallback test); opts.pullFail makes pull() fail too.
async function bootV5(roundFn, opts = {}) {
  const doc = makeDocument()
  doc.visibilityState = opts.hidden === true ? 'hidden' : 'visible'
  globalThis.document = doc
  if (opts.storage !== undefined && opts.storage !== null) globalThis.localStorage = opts.storage
  else delete globalThis.localStorage
  const pullCount = { n: 0 }
  const calls = []
  const rpc = async (_channel, method, body) => {
    calls.push(method)
    if (method === 'taskNotify/pullSince') {
      pullCount.n++
      const v = roundFn(pullCount.n, (body && body.args && typeof body.args.cursor === 'number') ? body.args.cursor : 0)
      if (v !== null && typeof v === 'object' && v.ok === false) return v
      return { ok: true, value: v }
    }
    if (method === 'taskNotify/pull') {
      if (opts.pullFail === true) return { ok: false, error: { code: 'E_RPC', message: 'down' } }
      return { ok: true, value: opts.legacyList !== undefined ? opts.legacyList : [] }
    }
    if (method === 'taskNotify/diag') return { ok: true, value: opts.diagValue !== undefined ? opts.diagValue : { persist: 'ok' } }
    return { ok: true, value: null }
  }
  const ctx = makeCtx(rpc, doc)
  const mod = await applyReady
  await mod.apply(ctx)
  renderOverlay(ctx)
  return { ctx, doc, pullCount, calls }
}

test('v0.5: first round is pullSince(0)→reset+full; deltas append without re-pushing old items', async () => {
  FakeNotification.reset()
  const storage = makeStorage()
  const a = item('a', 100)
  const b = item('b', 200)
  const c = item('c', 300)
  const { ctx, calls } = await bootV5((n, cursor) => {
    if (n === 1) return { items: [b, a], cursor: 2, reset: cursor === 0 }
    return { items: [c], cursor: 3, reset: false }
  }, { storage })
  await flush()
  assert.ok(calls.includes('taskNotify/pullSince'), 'polls go through the incremental method')
  assert.equal(FakeNotification.instances.length, 2, 'reset round surfaces a+b')
  let tree = clickBell(ctx)
  assert.deepEqual(panelItems(tree).map((x) => x.id), ['b', 'a'])
  firePoll(ctx)
  await flush()
  assert.equal(FakeNotification.instances.length, 3, 'the delta surfaces ONLY c')
  tree = renderOverlay(ctx)
  assert.deepEqual(panelItems(tree).map((x) => x.id), ['c', 'b', 'a'], 'appended and re-sorted newest-first; old pair keeps its order')
})

test('v0.5: a re-sent record acked in another tab updates in place, never re-toasts', async () => {
  FakeNotification.reset()
  const storage = makeStorage()
  const { ctx } = await bootV5((n) => {
    if (n === 1) return { items: [item('a', 100), item('b', 200)], cursor: 2, reset: true }
    return { items: [item('a', 100, true)], cursor: 3, reset: false }
  }, { storage })
  await flush()
  assert.equal(FakeNotification.instances.length, 2)
  firePoll(ctx)
  await flush()
  assert.equal(FakeNotification.instances.length, 2, 'mutation round pushes nothing')
  const tree = clickBell(ctx)
  const its = panelItems(tree)
  assert.equal(its.find((x) => x.id === 'a').read, true, 'read state propagated through the delta')
  assert.deepEqual(toastIds(renderOverlay(ctx)), ['b', 'a'], 'toasts untouched')
})

test('v0.5: empty rounds back off 1.5→2.5→4→5s; a new record snaps back to 1.5s', async () => {
  FakeNotification.reset()
  let deliver = []
  const { ctx } = await bootV5((n) => {
    if (n === 1) return { items: [], cursor: 1, reset: true }
    return { items: deliver, cursor: deliver.length > 0 ? 2 : 1, reset: false }
  }, { storage: makeStorage() })
  await flush()
  const armed = () => ctx.timeoutMs[ctx.timeoutMs.length - 1]
  // Experienced inter-poll gaps as consecutive empty rounds accumulate:
  // the boot round is empty round #1. Cap reached on the 4th empty round
  // (acceptance: 空闲 4 轮后轮询间隔升至 5s); ladder 1.5→2.5→4→5.
  assert.equal(armed(), 1500, 'after empty round #1 (boot)')
  firePoll(ctx); await flush(); assert.equal(armed(), 2500, 'after empty round #2')
  firePoll(ctx); await flush(); assert.equal(armed(), 4000, 'after empty round #3')
  firePoll(ctx); await flush(); assert.equal(armed(), 5000, 'after empty round #4 → cap')
  firePoll(ctx); await flush(); assert.equal(armed(), 5000, 'stays capped at 5s')
  deliver = [item('n1', 999)]
  firePoll(ctx); await flush(); assert.equal(armed(), 1500, 'a new record resets the ladder')
})

test('v0.5: rpc failures hold the interval, never crash, and mark a ≥5 streak', async () => {
  FakeNotification.reset()
  let fail = false
  const { ctx } = await bootV5(() => (fail
    ? { ok: false, error: { code: 'E_RPC', message: 'down' } }
    : { items: [], cursor: 1, reset: false }), { storage: makeStorage(), pullFail: true })
  await flush()
  // boot (empty #1, delay→1500) + one empty fire (#2, delay→2500)
  firePoll(ctx); await flush()
  fail = true
  firePoll(ctx); await flush()
  firePoll(ctx); await flush()
  assert.equal(ctx.timeoutMs[ctx.timeoutMs.length - 1], 2500, 'failures hold the delay currently in force — no runaway backoff, no shortening')
  // Panel still renders — a dead rpc must never take the UI down.
  const tree = clickBell(ctx)
  assert.ok(firstNodes(tree, (n) => n.props && n.props.className === 'ntfy-panel').length > 0, 'panel renders during outage')
  // Drive to 5 consecutive failures → degraded marker in the drawer.
  firePoll(ctx); await flush()
  firePoll(ctx); await flush()
  firePoll(ctx); await flush()
  firstNodes(tree, (n) => n.props && n.props['data-ntfy-diag-toggle'] === true)[0].props.onClick()
  // v0.7.0: raw diagnostics are sub-folded behind 诊断详情.
  firstNodes(renderOverlay(ctx), (n) => n.props && typeof n.props.className === 'string' && n.props.className.includes('ntfy-sec-toggle'))[0].props.onClick()
  const line = firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-poll-line'] === true)[0]
  assert.ok(String(line.children[0]).includes('连续失败'), '5+ consecutive failures surface: ' + line.children[0])
})

test('v0.5: pre-0.5 host (pullSince unknown) degrades to full pull() transparently', async () => {
  FakeNotification.reset()
  const storage = makeStorage()
  // Host contract: pull() answers newest-first, like snapshotList().
  const list = [item('b', 200), item('a', 100)]
  const { ctx, calls } = await bootV5(
    () => ({ ok: false, error: { code: 'MethodNotFound', message: 'no invocation taskNotify/pullSince' } }),
    { storage, legacyList: list })
  await flush()
  assert.equal(FakeNotification.instances.length, 2, 'legacy pull data surfaces')
  const tree = clickBell(ctx)
  assert.deepEqual(panelItems(tree).map((x) => x.id), ['b', 'a'])
  firePoll(ctx)
  await flush()
  // Diag reports interleave asynchronously — assert on the POLL sequence.
  const polls = calls.filter((m) => m === 'taskNotify/pull' || m === 'taskNotify/pullSince')
  assert.equal(polls[polls.length - 1], 'taskNotify/pull', 'subsequent rounds stay on the legacy full pull')
  assert.equal(polls.filter((m) => m === 'taskNotify/pullSince').length, 1, 'pullSince tried exactly once, then abandoned')
  assert.ok(polls.filter((m) => m === 'taskNotify/pull').length >= 2, 'legacy mode engaged for the session')
})

test('v0.5: diagnostics drawer shows the host persistence status', async () => {
  FakeNotification.reset()
  const { ctx } = await bootV5((n) => ({ items: n === 1 ? [item('a', 100)] : [], cursor: 1, reset: n === 1 }), { storage: makeStorage(), diagValue: { persist: 'recovered' } })
  await flush()
  const tree = clickBell(ctx)
  firstNodes(tree, (n) => n.props && n.props['data-ntfy-diag-toggle'] === true)[0].props.onClick()
  // v0.7.0: the host persistence status lives in the sub-folded 诊断详情.
  firstNodes(renderOverlay(ctx), (n) => n.props && typeof n.props.className === 'string' && n.props.className.includes('ntfy-sec-toggle'))[0].props.onClick()
  await flush() // opening the drawer refreshes the diag round-trip
  const line = firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-persist'] !== undefined)[0]
  assert.ok(line !== undefined, 'persistence row exists in the expanded drawer')
  assert.equal(line.props['data-ntfy-persist'], 'recovered')
  assert.ok(String(line.children[0]).includes('已恢复'), 'localized copy: ' + line.children[0])
})

test('v0.5: purge is followed by a reset round that empties the panel', async () => {
  FakeNotification.reset()
  const storage = makeStorage()
  let purged = false
  const { ctx } = await bootV5(() => (purged
    ? { items: [], cursor: 0, reset: true }
    : { items: [item('a', 100)], cursor: 1, reset: true }), { storage })
  await flush()
  let tree = clickBell(ctx)
  assert.equal(panelItems(tree).length, 1)
  // purge through the confirmed UI path
  firstNodes(tree, (n) => n.props && n.props['data-ntfy-diag-toggle'] === true)[0].props.onClick()
  const purge = firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-purge'] === true)[0]
  purge.props.onClick()
  firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-purge'] === true)[0].props.onClick()
  purged = true
  firePoll(ctx)
  await flush()
  tree = renderOverlay(ctx)
  assert.equal(panelItems(tree).length, 0, 'reset round after purge empties the panel')
  assert.equal(panelItems(tree).length === 0 && firstNodes(tree, (n) => n.props && n.props['data-ntfy-empty'] === 'cleared').length, 1, 'seen-and-cleared empty state')
})

// ── v0.6.0: channel split (in-browser alerts vs host-direct OS) ─────

// Full-control boot: opts.getSettingsValue answers taskNotify/getSettings
// (undefined → the legacy {ok:true,value:null} shape = pre-0.6 host).
// opts.onSetSettings(os) computes the post-write view for setSettings.
async function bootV6(roundFn, opts = {}) {
  const doc = makeDocument()
  globalThis.document = doc
  if (opts.storage !== undefined && opts.storage !== null) globalThis.localStorage = opts.storage
  else delete globalThis.localStorage
  const pullCount = { n: 0 }
  const diagStates = []
  const setSettingsCalls = []
  const testOsCalls = []
  const rpc = async (_channel, method, body) => {
    if (method === 'taskNotify/pullSince') {
      pullCount.n++
      return { ok: true, value: roundFn(pullCount.n) }
    }
    if (method === 'taskNotify/getSettings') {
      return { ok: true, value: opts.getSettingsValue !== undefined ? opts.getSettingsValue : null }
    }
    if (method === 'taskNotify/setSettings') {
      setSettingsCalls.push(body && body.args ? body.args : null)
      const os = body && body.args ? body.args.os : undefined
      return { ok: true, value: typeof opts.onSetSettings === 'function' ? opts.onSetSettings(os) : (opts.getSettingsValue !== undefined ? opts.getSettingsValue : null) }
    }
    if (method === 'taskNotify/testOs') {
      testOsCalls.push(true)
      return { ok: true, value: opts.testOsValue !== undefined ? opts.testOsValue : { ok: true } }
    }
    if (method === 'taskNotify/diag') {
      diagStates.push(body && body.args && body.args.state ? body.args.state : null)
      return { ok: true, value: { persist: 'ok' } }
    }
    return { ok: true, value: null }
  }
  const ctx = makeCtx(rpc, doc)
  const mod = await applyReady
  await mod.apply(ctx)
  renderOverlay(ctx)
  return { ctx, doc, pullCount, diagStates, setSettingsCalls, testOsCalls }
}

const HOST_VIEW = (enabled, extra) => Object.assign(
  { os: { enabled: enabled === true }, locked: false, adapter: { available: true, platform: 'win32' }, settingsStatus: 'ok' },
  extra,
)

const expandDrawer = (ctx) => {
  clickBell(ctx)
  firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-diag-toggle'] === true)[0].props.onClick()
  return renderOverlay(ctx)
}

test('v0.6 pure: parseChannelsConfig defaults/corrupt/partial', async () => {
  const mod = await applyReady
  const { parseChannelsConfig, CHANNELS_DEFAULTS } = mod.__internals
  assert.deepEqual(parseChannelsConfig(''), CHANNELS_DEFAULTS)
  assert.deepEqual(parseChannelsConfig('not json'), CHANNELS_DEFAULTS)
  assert.deepEqual(parseChannelsConfig('{"inApp":false}'), { inApp: false, osBrowser: true })
  assert.deepEqual(parseChannelsConfig('{"osBrowser":false}'), { inApp: true, osBrowser: false })
  assert.deepEqual(parseChannelsConfig('{"inApp":"yes"}'), CHANNELS_DEFAULTS, 'non-boolean drops')
})

test('v0.6: host-direct OS channel on → the browser never double-notifies; toasts still show', async () => {
  FakeNotification.reset()
  const { ctx } = await bootV6(
    (n) => (n === 1 ? { items: [item('a', 100)], cursor: 1, reset: true } : { items: [], cursor: 1, reset: false }),
    { storage: makeStorage(), getSettingsValue: HOST_VIEW(true) })
  await flush()
  assert.equal(FakeNotification.instances.length, 0, 'the host owns the OS banner — the browser page stays silent')
  assert.deepEqual(toastIds(renderOverlay(ctx)), ['a'], 'in-app channel unaffected')
  const tree = clickBell(ctx)
  assert.deepEqual(panelItems(tree).map((x) => x.id), ['a'], 'bell records as usual')
})

test('v0.8: OS host off + browser channel ON → the browser delivers (explicit channels)', async () => {
  FakeNotification.reset()
  const { ctx } = await bootV6(
    (n) => (n === 1 ? { items: [item('a', 100)], cursor: 1, reset: true } : { items: [], cursor: 1, reset: false }),
    { storage: makeStorage(), getSettingsValue: HOST_VIEW(false) })
  await flush()
  // v0.8 semantics: host-off no longer silences the browser channel —
  // each switch governs exactly its own path (C off, B on → B delivers).
  assert.equal(FakeNotification.instances.length, 1, 'browser channel delivers with the host switch off')
  assert.equal(FakeNotification.instances[0].options.tag, 'ntfy-a')
  assert.deepEqual(toastIds(renderOverlay(ctx)), ['a'], 'in-app alerts continue independently')
})

test('v0.8: browser channel OFF → no browser banners even when the host cannot deliver', async () => {
  FakeNotification.reset()
  const storage = makeStorage()
  storage.setItem('dsh-task-notify:channels', JSON.stringify({ osBrowser: false }))
  const { ctx } = await bootV6(
    (n) => (n === 1 ? { items: [item('a', 100)], cursor: 1, reset: true } : { items: [], cursor: 1, reset: false }),
    { storage, getSettingsValue: HOST_VIEW(true, { adapter: { available: false, platform: 'none' } }) })
  await flush()
  assert.equal(FakeNotification.instances.length, 0, 'the explicit switch kills the old automatic fallback too')
  assert.deepEqual(toastIds(renderOverlay(ctx)), ['a'], 'in-app channel unaffected')
})

test('v0.6: host adapter missing → browser Notification fallback engages', async () => {
  FakeNotification.reset()
  const { ctx } = await bootV6(
    (n) => (n === 1 ? { items: [item('a', 100)], cursor: 1, reset: true } : { items: [], cursor: 1, reset: false }),
    { storage: makeStorage(), getSettingsValue: HOST_VIEW(true, { adapter: { available: false, platform: 'none' } }) })
  await flush()
  assert.equal(FakeNotification.instances.length, 1, 'fallback: the only OS path left is the browser')
  assert.equal(FakeNotification.instances[0].options.tag, 'ntfy-a')
})

test('v0.6: inApp off → silent page; flipping it on later never replays the backlog', async () => {
  FakeNotification.reset()
  FakeAudio.reset()
  globalThis.AudioContext = FakeAudio
  try {
    const storage = makeStorage()
    storage.setItem('dsh-task-notify:channels', JSON.stringify({ inApp: false }))
    const { ctx } = await bootV6(
      (n) => (n === 1 ? { items: [item('a', 100)], cursor: 1, reset: true } : { items: [item('a', 100)], cursor: 2, reset: false }),
      { storage, getSettingsValue: HOST_VIEW(true) })
    await flush()
    assert.deepEqual(toastIds(renderOverlay(ctx)), [], 'no toasts with inApp off')
    assert.equal(FakeAudio.instances.length, 0, 'no chime either')
    // flip in-app ON through the panel switch
    expandDrawer(ctx)
    firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-inapp'] === true)[0].props.onClick()
    assert.equal(JSON.parse(storage.getItem('dsh-task-notify:channels')).inApp, true, 'persisted immediately')
    firePoll(ctx) // the same record re-delivered
    await flush()
    // v0.8.1: flipping ON shows exactly ONE feedback toast — and still
    // no replayed backlog item ('a').
    const ids = toastIds(renderOverlay(ctx))
    assert.equal(ids.length, 1, 'one feedback toast, no backlog burst')
    assert.ok(String(ids[0]).startsWith('ntfy-test-'), 'the feedback toast is ephemeral: ' + ids[0])
  } finally {
    delete globalThis.AudioContext
  }
})

// ── v0.8.1: per-channel test buttons + ephemeral toasts ─────────────

test('v0.8.1: 测试浮层 shows an ephemeral toast with no server record and no OS banner', async () => {
  FakeNotification.reset()
  const { ctx } = await bootV6(
    () => ({ items: [], cursor: 1, reset: false }),
    { storage: makeStorage(), getSettingsValue: HOST_VIEW(true) })
  await flush()
  expandDrawer(ctx)
  firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-test-toast'] === true)[0].props.onClick()
  const ids = toastIds(renderOverlay(ctx))
  assert.equal(ids.length, 1, 'one preview toast')
  assert.ok(String(ids[0]).startsWith('ntfy-test-'), 'ephemeral id')
  const titles = firstNodes(renderOverlay(ctx), (n) => n.props && n.props.className === 'ntfy-toast-title').map((n) => String(n.children[0]))
  assert.ok(titles.includes('测试通知'), 'test toast title: ' + titles.join('|'))
  assert.equal(FakeNotification.instances.length, 0, 'purely in-page — no OS banner')
  for (const cb of [...ctx.timeouts]) cb() // expire the toast
  for (const cb of [...ctx.timeouts]) cb() // fade stage
  assert.deepEqual(toastIds(renderOverlay(ctx)), [], 'gone after its timer')
})

test('v0.8.1: the ephemeral toast survives a poll reconciliation round', async () => {
  FakeNotification.reset()
  const { ctx } = await bootV6(
    (n) => ({ items: n === 1 ? [] : [], cursor: 1, reset: true }),
    { storage: makeStorage(), getSettingsValue: HOST_VIEW(true) })
  await flush()
  expandDrawer(ctx)
  firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-test-toast'] === true)[0].props.onClick()
  assert.equal(toastIds(renderOverlay(ctx)).length, 1)
  firePoll(ctx) // a reset round rebuilds state.items — the toast is ghost-exempt
  await flush()
  assert.equal(toastIds(renderOverlay(ctx)).length, 1, 'still alive after reconciliation (6s lifetime owns it)')
})

test('v0.8.1: the browser-banner test button lives on the browser-OS card', async () => {
  FakeNotification.reset()
  const { ctx } = await bootV6(
    () => ({ items: [], cursor: 1, reset: false }),
    { storage: makeStorage(), getSettingsValue: HOST_VIEW(true) })
  await flush()
  expandDrawer(ctx)
  const cards = firstNodes(renderOverlay(ctx), (n) => n.props && typeof n.props.className === 'string' && n.props.className.split(' ').includes('ntfy-chcard'))
  assert.equal(cards.length, 3)
  // sendTest (browser banner) moved from card A to card B's footer
  const btns = firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-test'] === true)
  assert.equal(btns.length, 1, 'one browser-banner test button')
  btns[0].props.onClick()
  await flush()
  assert.equal(FakeNotification.instances.length, 1, 'it raises the browser banner (permission granted in harness)')
})

test('v0.6: legacy host keeps browser notifications; the OS switch shows unavailable', async () => {
  FakeNotification.reset()
  const { ctx } = await bootV6(
    (n) => (n === 1 ? { items: [item('a', 100)], cursor: 1, reset: true } : { items: [], cursor: 1, reset: false }),
    { storage: makeStorage() }) // getSettings → null → legacy
  await flush()
  assert.equal(FakeNotification.instances.length, 1, 'pre-0.6 host: browser notifications continue')
  expandDrawer(ctx)
  const state = firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-os-state'] !== undefined)[0]
  assert.equal(state.props['data-ntfy-os-state'], 'legacy')
})

test('v0.6: OS switch writes through setSettings and reconciles with the answer', async () => {
  FakeNotification.reset()
  const { ctx, setSettingsCalls } = await bootV6(
    () => ({ items: [], cursor: 1, reset: false }),
    { storage: makeStorage(), getSettingsValue: HOST_VIEW(true), onSetSettings: (os) => HOST_VIEW(os.enabled === true) })
  await flush()
  expandDrawer(ctx)
  const sw = firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-os'] === true)[0]
  assert.equal(sw.props['aria-checked'], 'true')
  sw.props.onClick()
  await flush()
  assert.equal(setSettingsCalls.length, 1)
  assert.deepEqual(setSettingsCalls[0], { os: { enabled: false } })
  const sw2 = firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-os'] === true)[0]
  assert.equal(sw2.props['aria-checked'], 'false', 'reconciled with the host answer')
})

test('v0.6: env-locked OS switch renders disabled with the env hint', async () => {
  FakeNotification.reset()
  const { ctx } = await bootV6(
    () => ({ items: [], cursor: 1, reset: false }),
    { storage: makeStorage(), getSettingsValue: HOST_VIEW(false, { locked: true }) })
  await flush()
  expandDrawer(ctx)
  const sw = firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-os'] === true)[0]
  assert.equal(sw.props.disabled, true, 'read-only while DSH_TASK_NOTIFY_OS overrides')
  assert.ok(String(sw.props.title).includes('DSH_TASK_NOTIFY_OS'))
})

test('v0.6: 测试系统通知 button fires the host-side testOs rpc', async () => {
  FakeNotification.reset()
  const { ctx, testOsCalls } = await bootV6(
    () => ({ items: [], cursor: 1, reset: false }),
    { storage: makeStorage(), getSettingsValue: HOST_VIEW(true) })
  await flush()
  expandDrawer(ctx)
  firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-test-os'] === true)[0].props.onClick()
  await flush()
  assert.equal(testOsCalls.length, 1)
  const line = firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-os-test'] === true)[0]
  assert.ok(String(line.children[0]).includes('已发送'), 'result line: ' + line.children[0])
})

test('v0.6: reportDiag carries inApp + osVia for the ntfy_status tool', async () => {
  FakeNotification.reset()
  const { ctx, diagStates } = await bootV6(
    () => ({ items: [], cursor: 1, reset: false }),
    { storage: makeStorage(), getSettingsValue: HOST_VIEW(true) })
  await flush()
  expandDrawer(ctx) // opening the drawer fires a fresh reportDiag
  await flush()
  const st = diagStates[diagStates.length - 1]
  assert.equal(st.inApp, true)
  assert.equal(st.osVia, 'host', 'the page reports which OS path is active')
})

// ── v0.7.0: premium panel redesign ───────────────────────────────────

test('v0.7: status strip carries a tone dot derived from the summary branch', async () => {
  FakeNotification.reset()
  const { ctx } = await bootV6(
    () => ({ items: [], cursor: 1, reset: false }),
    { storage: makeStorage(), getSettingsValue: HOST_VIEW(true) })
  await flush()
  clickBell(ctx)
  const dot = firstNodes(renderOverlay(ctx), (n) => n.props && typeof n.props.className === 'string' && n.props.className.includes('ntfy-status-dot'))[0]
  assert.ok(dot, 'status dot present')
  assert.ok(dot.props.className.includes('ntfy-status-ok'), 'host-direct healthy → ok tone: ' + dot.props.className)
})

test('v0.7: channel cards carry icons, chips and their own switches (v0.8: three cards)', async () => {
  FakeNotification.reset()
  const { ctx } = await bootV6(
    () => ({ items: [], cursor: 1, reset: false }),
    { storage: makeStorage(), getSettingsValue: HOST_VIEW(true) })
  await flush()
  expandDrawer(ctx)
  const tree = renderOverlay(ctx)
  const cards = firstNodes(tree, (n) => n.props && typeof n.props.className === 'string' && n.props.className.split(' ').includes('ntfy-chcard'))
  assert.equal(cards.length, 3, 'three channel cards: in-app · browser-OS · host-OS')
  const icons = firstNodes(tree, (n) => n.props && typeof n.props.className === 'string' && n.props.className.includes('ntfy-chcard-icon'))
  assert.equal(icons.length, 3, 'one icon per card')
  assert.ok(firstNodes(tree, (n) => n.props && n.props['data-ntfy-inapp'] === true).length > 0, 'in-app switch on its card')
  assert.ok(firstNodes(tree, (n) => n.props && n.props['data-ntfy-osbrowser'] === true).length > 0, 'browser-OS switch on its card')
  assert.ok(firstNodes(tree, (n) => n.props && n.props['data-ntfy-os'] === true).length > 0, 'host-OS switch on its card')
  const chips = firstNodes(tree, (n) => n.props && typeof n.props.className === 'string' && n.props.className.includes('ntfy-chip-on'))
  assert.equal(chips.length, 2, 'in-app + host-OS show 已启用; browser-OS is on standby while the host delivers')
  const descs = firstNodes(tree, (n) => n.props && n.props.className === 'ntfy-chcard-desc').map((n) => String(n.children[0]))
  assert.ok(descs.some((d) => d.includes('宿主直发系统通知中心')), 'OS card desc explains host-direct: ' + descs.join(' | '))
  const softChips = firstNodes(tree, (n) => n.props && typeof n.props.className === 'string' && n.props.className.includes('ntfy-chip-soft')).map((n) => String(n.children[0]))
  assert.ok(softChips.includes('win32'), 'platform chip on the OS card: ' + softChips.join(' | '))
})

test('v0.8: browser-OS card shows 待命 while host-direct delivers, flips active when it cannot', async () => {
  FakeNotification.reset()
  const { ctx } = await bootV6(
    () => ({ items: [], cursor: 1, reset: false }),
    { storage: makeStorage(), getSettingsValue: HOST_VIEW(true), onSetSettings: (os) => HOST_VIEW(os.enabled === true) })
  await flush()
  expandDrawer(ctx)
  let tree = renderOverlay(ctx)
  assert.ok(firstNodes(tree, (n) => n.props && typeof n.props.className === 'string' && n.props.className.includes('ntfy-chip-standby')).length === 1, 'standby chip while the host delivers')
  let descs = firstNodes(tree, (n) => n.props && n.props.className === 'ntfy-chcard-desc').map((n) => String(n.children[0]))
  assert.ok(descs.some((d) => d.includes('待命')), 'standby desc: ' + descs.join(' | '))
  // Kill the host channel through its switch → the browser card flips to active.
  firstNodes(tree, (n) => n.props && n.props['data-ntfy-os'] === true)[0].props.onClick()
  await flush()
  tree = renderOverlay(ctx)
  const standby = firstNodes(tree, (n) => n.props && typeof n.props.className === 'string' && n.props.className.includes('ntfy-chip-standby'))
  assert.equal(standby.length, 0, 'standby cleared once the host channel is off')
  const active = firstNodes(tree, (n) => n.props && typeof n.props.className === 'string' && n.props.className.split(' ').includes('ntfy-chip-on'))
  assert.equal(active.length, 2, 'in-app + browser-OS now live (permission granted in the harness)')
})

test('v0.8: browser-OS switch persists to localStorage channels.osBrowser', async () => {
  FakeNotification.reset()
  const storage = makeStorage()
  const { ctx } = await bootV6(
    () => ({ items: [], cursor: 1, reset: false }),
    { storage, getSettingsValue: HOST_VIEW(true) })
  await flush()
  expandDrawer(ctx)
  const sw = firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-osbrowser'] === true)[0]
  assert.equal(sw.props['aria-checked'], 'true')
  sw.props.onClick()
  assert.equal(JSON.parse(storage.getItem('dsh-task-notify:channels')).osBrowser, false, 'persisted immediately')
  const sw2 = firstNodes(renderOverlay(ctx), (n) => n.props && n.props['data-ntfy-osbrowser'] === true)[0]
  assert.equal(sw2.props['aria-checked'], 'false')
})

test('v0.7: an OS-off card is muted and shows the 关闭 chip', async () => {
  FakeNotification.reset()
  const { ctx } = await bootV6(
    () => ({ items: [], cursor: 1, reset: false }),
    { storage: makeStorage(), getSettingsValue: HOST_VIEW(false) })
  await flush()
  expandDrawer(ctx)
  const tree = renderOverlay(ctx)
  const muted = firstNodes(tree, (n) => n.props && typeof n.props.className === 'string' && n.props.className.includes('ntfy-chcard-muted'))
  assert.equal(muted.length, 1, 'exactly the host-OS card is muted (browser card went active)')
  assert.ok(firstNodes(tree, (n) => n.props && typeof n.props.className === 'string' && n.props.className.includes('ntfy-chip-off')).length >= 1, 'off chip visible')
})

test('v0.7: theme segmented control keeps the legacy choice hooks', async () => {
  FakeNotification.reset()
  const storage = makeStorage()
  const { ctx } = await bootV6(() => ({ items: [], cursor: 1, reset: false }), { storage })
  await flush()
  expandDrawer(ctx)
  const tree = renderOverlay(ctx)
  assert.ok(firstNodes(tree, (n) => n.props && n.props['data-ntfy-seg'] === true).length > 0, 'segmented control present')
  const choices = firstNodes(tree, (n) => n.props && typeof n.props['data-ntfy-theme-choice'] === 'string').map((n) => n.props['data-ntfy-theme-choice'])
  assert.deepEqual(choices, ['auto', 'light', 'dark'], 'same three choices, same hooks')
  firstNodes(tree, (n) => n.props && n.props['data-ntfy-theme-choice'] === 'dark')[0].props.onClick()
  assert.equal(storage.getItem('dsh-task-notify:theme'), 'dark', 'persisted through the new control')
})
