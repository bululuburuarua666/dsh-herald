// Unit tests for lib/settings.js — the host-owned channel switch store.
// Same discipline as the store tests: fresh tmp dirs, real fs, corrupt
// inputs degrade to defaults and never throw.
//
// Run: node --test test/settings.test.mjs

import assert from 'node:assert/strict'
import { test } from 'node:test'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const settings = await import(pathToFileURL(path.resolve('lib/settings.js')).href)

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ntfy-settings-'))

test('defaults: os enabled (migration continuity — behavior does not regress on upgrade)', () => {
  assert.deepEqual(settings.DEFAULT_SETTINGS, { os: { enabled: true } })
  assert.deepEqual(settings.normalizeSettings(null), settings.DEFAULT_SETTINGS)
  assert.deepEqual(settings.normalizeSettings({}), settings.DEFAULT_SETTINGS)
  assert.deepEqual(settings.normalizeSettings({ os: {} }), settings.DEFAULT_SETTINGS)
  assert.deepEqual(settings.normalizeSettings([1, 2]), settings.DEFAULT_SETTINGS)
})

test('load: missing file → new; roundtrip persists; corrupt → recovered', () => {
  const dir = tmpDir()
  assert.equal(settings.loadSettings(dir).status, 'new')
  assert.equal(settings.loadSettings(dir).settings.os.enabled, true)
  assert.equal(settings.saveSettings(dir, { os: { enabled: false } }), true)
  const loaded = settings.loadSettings(dir)
  assert.equal(loaded.status, 'ok')
  assert.equal(loaded.settings.os.enabled, false)
  const head = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'))
  assert.equal(head.version, settings.SETTINGS_VERSION)
  assert.equal(typeof head.savedAt, 'number')
  fs.writeFileSync(path.join(dir, 'settings.json'), '{oops', 'utf8')
  const rec = settings.loadSettings(dir)
  assert.equal(rec.status, 'recovered')
  assert.equal(rec.settings.os.enabled, true, 'corrupt → defaults, never a throw')
  fs.rmSync(dir, { recursive: true, force: true })
})

test('env override: DSH_TASK_NOTIFY_OS=0/1 wins; garbage/absent → undefined', () => {
  assert.equal(settings.envOsEnabled({ DSH_TASK_NOTIFY_OS: '1' }), true)
  assert.equal(settings.envOsEnabled({ DSH_TASK_NOTIFY_OS: 'true' }), true)
  assert.equal(settings.envOsEnabled({ DSH_TASK_NOTIFY_OS: '0' }), false)
  assert.equal(settings.envOsEnabled({ DSH_TASK_NOTIFY_OS: 'false' }), false)
  assert.equal(settings.envOsEnabled({ DSH_TASK_NOTIFY_OS: 'banana' }), undefined)
  assert.equal(settings.envOsEnabled({}), undefined)
  assert.equal(settings.envOsEnabled(undefined), undefined, 'no env injected and no process leak-in assumption')
})

test('serialize: exact shape, boolean coercion', () => {
  const text = settings.serializeSettings({ os: { enabled: false } }, 123)
  assert.deepEqual(JSON.parse(text), { version: 1, savedAt: 123, os: { enabled: false } })
  assert.equal(JSON.parse(settings.serializeSettings(null, 1)).os.enabled, true, 'null settings serialize to the default')
})

test('atomic write: tmp file then rename', () => {
  const dir = tmpDir()
  const events = []
  const real = { ...fs }
  const fsx = {
    mkdirSync: real.mkdirSync,
    writeFileSync: (p, data, enc) => { events.push(['write', path.basename(p)]); real.writeFileSync(p, data, enc) },
    renameSync: (a, b) => { events.push(['rename', path.basename(a), path.basename(b)]); real.renameSync(a, b) },
    unlinkSync: real.unlinkSync,
  }
  settings.saveSettings(dir, { os: { enabled: true } }, fsx)
  assert.deepEqual(events, [['write', 'settings.json.tmp'], ['rename', 'settings.json.tmp', 'settings.json']])
  fs.rmSync(dir, { recursive: true, force: true })
})
