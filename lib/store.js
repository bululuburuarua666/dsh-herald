// v0.5.0 persistence layer — pure, fs-injectable, never throws upward.
//
// The record history (≤300 items, ~60KB as JSON) persists as ONE file under
// <profileRoot>/data/task-notify/records.json. A JSON file with debounced
// atomic writes beats any database dependency at this scale. A corrupt file
// degrades to an empty history (diag reports 'recovered') — it must NEVER
// block the plugin from mounting.
//
// File shape (versioned for future migrations):
//   { version: 1, seq: <counter>, savedAt: <ms>, records: [...], keys: {k: id} }
//
// `seq` is the monotonic change counter: every record carries the seq of its
// LAST change (creation, ack/clear, key-touch), so a cursor "give me
// seq > cursor" is a change feed, not just an append log.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const STORE_VERSION = 1
const FILE_NAME = 'records.json'

/** Data dir for a plugin module URL:
 *   <profile>/node_modules/dsh-herald/lib/index.js   (unscoped)
 *   <profile>/node_modules/@scope/dsh-herald/lib/index.js (scoped)
 *     → <profile>/data/task-notify  (both)
 * Walk up from the package root until we LEAVE node_modules, so scoped and
 * unscoped package layouts resolve identically. The data leaf stays
 * 'task-notify' regardless of the package name — the same history and
 * channel settings survive a package rename or upgrade.
 * NEVER store inside the package dir itself — a reinstall would destroy it. */
const resolveDataDir = (metaUrl) => {
  let dir = path.dirname(path.dirname(fileURLToPath(metaUrl))) // lib/.. = package root
  let guard = 0
  while (guard++ < 8 && path.basename(dir) !== 'node_modules') {
    const parent = path.dirname(dir)
    if (parent === dir) break // drive root — bail out (dev checkout; callers should pass dataDir)
    dir = parent
  }
  return path.resolve(path.dirname(dir), 'data', 'task-notify')
}

const clampSeq = (n) => (typeof n === 'number' && isFinite(n) && n >= 0 ? Math.floor(n) : 0)

/** Pure serialize: records sorted by seq asc (stable file layout); the keys
 * Map (dedupe index) becomes a plain object. Does not mutate its inputs. */
const serialize = (records, seq, keys, now) => JSON.stringify({
  version: STORE_VERSION,
  seq: clampSeq(seq),
  savedAt: typeof now === 'number' ? now : Date.now(),
  records: [...records].sort((a, b) => clampSeq(a.seq) - clampSeq(b.seq)),
  keys: keys instanceof Map ? Object.fromEntries(keys) : { ...(keys || {}) },
})

/** Pure parse: ANY structural violation → null (the caller decides whether
 * that means 'recovered' or 'new'). Records are normalized field by field. */
const parseStore = (text) => {
  let data = null
  try { data = JSON.parse(text) } catch (e) { return null }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return null
  if (!Array.isArray(data.records)) return null
  const records = []
  for (const r of data.records) {
    if (r === null || typeof r !== 'object') return null
    if (typeof r.id !== 'string' || r.id === '') return null
    if (typeof r.kind !== 'string') return null
    if (typeof r.at !== 'number' || !isFinite(r.at)) return null
    if (typeof r.seq !== 'number' || !isFinite(r.seq)) return null
    records.push({
      id: r.id,
      kind: r.kind,
      subkind: typeof r.subkind === 'string' ? r.subkind : '',
      label: typeof r.label === 'string' ? r.label : '',
      detail: typeof r.detail === 'string' ? r.detail : '',
      outcome: typeof r.outcome === 'string' ? r.outcome : '',
      at: r.at,
      read: r.read === true,
      seq: Math.floor(r.seq),
    })
  }
  const keys = (data.keys !== null && typeof data.keys === 'object' && !Array.isArray(data.keys)) ? data.keys : {}
  const seq = Math.max(clampSeq(data.seq), records.reduce((m, r) => Math.max(m, r.seq), 0))
  return { records, seq, keys }
}

/** Load from dir. Status:
 *   'new'       — no file yet (fresh install; NOT an error)
 *   'ok'        — parsed
 *   'recovered' — file exists but unparseable → empty history
 *   'disabled'  — storage error (permissions etc.) → memory-only
 * Never throws. */
const loadStore = (dir, fsx = fs) => {
  let text = null
  try {
    text = fsx.readFileSync(path.join(dir, FILE_NAME), 'utf8')
  } catch (e) {
    if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return { status: 'new', records: [], seq: 0, keys: {} }
    return { status: 'disabled', records: [], seq: 0, keys: {} }
  }
  const parsed = parseStore(text)
  if (parsed === null) return { status: 'recovered', records: [], seq: 0, keys: {} }
  return { status: 'ok', records: parsed.records, seq: parsed.seq, keys: parsed.keys }
}

/** Atomic save: write <file>.tmp then rename over <file>. Returns false on
 * ANY failure (caller flips to 'disabled' and keeps serving from memory). */
const saveStore = (dir, text, fsx = fs) => {
  const tmp = path.join(dir, FILE_NAME + '.tmp')
  try {
    fsx.mkdirSync(dir, { recursive: true })
    fsx.writeFileSync(tmp, text, 'utf8')
    fsx.renameSync(tmp, path.join(dir, FILE_NAME))
    return true
  } catch (e) {
    try { fsx.unlinkSync(tmp) } catch (e2) { /* best effort */ }
    return false
  }
}

/** Writability probe (mkdir + W_OK access). Read-only storage → false,
 * which the caller maps to persist 'disabled'. */
const probeWritable = (dir, fsx = fs) => {
  try {
    fsx.mkdirSync(dir, { recursive: true })
    fsx.accessSync(dir, fsx.constants ? fsx.constants.W_OK : 2)
    return true
  } catch (e) { return false }
}

export { STORE_VERSION, FILE_NAME, resolveDataDir, serialize, parseStore, loadStore, saveStore, probeWritable }
