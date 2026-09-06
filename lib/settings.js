// v0.6.0 channel-settings persistence — same discipline as store.js:
// one small versioned JSON file, atomic writes (tmp + rename), never
// throws upward. Lives NEXT TO records.json under
// <profileRoot>/data/task-notify/ — never inside node_modules.
//
// File shape: { version: 1, savedAt: <ms>, os: { enabled: <bool> } }
//
// The OS switch is HOST-owned on purpose: out-of-browser delivery must
// keep working — and stay configurable — with no browser attached at
// all. DSH_TASK_NOTIFY_OS=0|1 in the environment overrides the file
// (headless ops); while it is set, RPC writes are refused (`locked`) so
// the panel never shows a switch that lies.

import fs from 'node:fs'
import path from 'node:path'

const SETTINGS_VERSION = 1
const FILE_NAME = 'settings.json'
const DEFAULT_SETTINGS = Object.freeze({ os: { enabled: true } })

/** Coerce anything into a valid settings object; unknown fields drop. */
const normalizeSettings = (raw) => {
  const out = { os: { enabled: DEFAULT_SETTINGS.os.enabled } }
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    if (raw.os !== null && typeof raw.os === 'object' && !Array.isArray(raw.os) && typeof raw.os.enabled === 'boolean') {
      out.os.enabled = raw.os.enabled
    }
  }
  return out
}

const serializeSettings = (settings, nowMs) => JSON.stringify({
  version: SETTINGS_VERSION,
  savedAt: typeof nowMs === 'number' ? nowMs : Date.now(),
  os: { enabled: (settings && settings.os ? settings.os.enabled : true) === true },
})

/** DSH_TASK_NOTIFY_OS: '1'/'true' → true, '0'/'false' → false, else
 * undefined (absent). `env` is injectable for tests. */
const envOsEnabled = (env) => {
  const e = env !== undefined ? env : (typeof process !== 'undefined' && process.env ? process.env : {})
  const v = e.DSH_TASK_NOTIFY_OS
  if (v === '1' || v === 'true') return true
  if (v === '0' || v === 'false') return false
  return undefined
}

/** Load from dir. Status:
 *  'new'       — no file yet (fresh install; NOT an error)
 *  'ok'        — parsed
 *  'recovered' — file exists but unparseable → defaults
 *  'disabled'  — storage error → defaults, memory-only
 * Never throws. */
const loadSettings = (dir, fsx = fs) => {
  let text = null
  try {
    text = fsx.readFileSync(path.join(dir, FILE_NAME), 'utf8')
  } catch (e) {
    if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return { status: 'new', settings: normalizeSettings(null) }
    return { status: 'disabled', settings: normalizeSettings(null) }
  }
  let data = null
  try { data = JSON.parse(text) } catch (e) { return { status: 'recovered', settings: normalizeSettings(null) } }
  return { status: 'ok', settings: normalizeSettings(data) }
}

/** Atomic save (tmp + rename). Returns false on ANY failure. */
const saveSettings = (dir, settings, fsx = fs) => {
  const tmp = path.join(dir, FILE_NAME + '.tmp')
  try {
    fsx.mkdirSync(dir, { recursive: true })
    fsx.writeFileSync(tmp, serializeSettings(settings), 'utf8')
    fsx.renameSync(tmp, path.join(dir, FILE_NAME))
    return true
  } catch (e) {
    try { fsx.unlinkSync(tmp) } catch (e2) { /* best effort */ }
    return false
  }
}

export { SETTINGS_VERSION, FILE_NAME, DEFAULT_SETTINGS, normalizeSettings, serializeSettings, envOsEnabled, loadSettings, saveSettings }
