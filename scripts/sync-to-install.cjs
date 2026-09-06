#!/usr/bin/env node
// Sync the repo to a DSH install location and verify there.
//
// Usage:  node scripts/sync-to-install.cjs [--target <path>]
// Default target: <USERPROFILE>/.dsh/profiles/web/node_modules/dsh-herald
// Override with --target or DSH_TASK_NOTIFY_INSTALL for any other
// profile/machine.
//
// Idempotent: safe to run after every edit; REQUIRED after any
// pnpm install / profile rebuild that would have overwritten the install.

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const args = process.argv.slice(2)
const targetArgIdx = args.indexOf('--target')
const DEFAULT_TARGET = path.join(process.env.USERPROFILE || process.env.HOME || '.', '.dsh', 'profiles', 'web', 'node_modules', 'dsh-herald')
const target = targetArgIdx !== -1 && args[targetArgIdx + 1]
  ? path.resolve(args[targetArgIdx + 1])
  : (process.env.DSH_TASK_NOTIFY_INSTALL ? path.resolve(process.env.DSH_TASK_NOTIFY_INSTALL) : DEFAULT_TARGET)

const repo = path.resolve(__dirname, '..')

if (!fs.existsSync(path.join(repo, 'lib', 'client.js'))) {
  console.error('[sync] run from the fork repo (lib/client.js not found):', repo)
  process.exit(1)
}
if (!fs.existsSync(path.join(target, 'package.json'))) {
  console.error('[sync] install target not found (is the profile installed?):', target)
  process.exit(1)
}

const copyFile = (rel) => {
  const from = path.join(repo, rel)
  const to = path.join(target, rel)
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
  console.log('[sync] copied', rel)
}

// cordis.patch.yml MUST be in this list: the composition row (id/name) lives
// there, so a rename or row change that skips it leaves the install composing
// a stale plugin row — exactly the desync this once caused.
for (const rel of ['lib/client.js', 'lib/index.js', 'lib/typert.js', 'lib/store.js', 'lib/settings.js', 'lib/osnotify.js', 'cordis.patch.yml', 'package.json', 'CHANGELOG.md', 'CUSTOM-FORK.md', 'test/client.test.mjs', 'test/host.test.mjs', 'test/osnotify.test.mjs', 'test/settings.test.mjs']) {
  if (fs.existsSync(path.join(repo, rel))) copyFile(rel)
}

// Verify in place: the inject regression lock lives in the host tests.
// (BOM-tolerant version read — Windows PowerShell edits may add one.)
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''))
const installed = readJson(path.join(target, 'package.json')).version
const fork = readJson(path.join(repo, 'package.json')).version
console.log('[sync] fork ' + fork + ' -> install ' + installed)

// Verify in place: the inject regression lock lives in the host tests.
const run = spawnSync(process.execPath, ['--test', 'test/client.test.mjs', 'test/host.test.mjs', 'test/osnotify.test.mjs', 'test/settings.test.mjs'], {
  cwd: target, encoding: 'utf8', shell: false,
})
const out = run.stdout + run.stderr
const pass = /# pass (\d+)/.exec(out) || /ℹ pass (\d+)/.exec(out)
const fail = /# fail (\d+)/.exec(out) || /ℹ fail (\d+)/.exec(out)
console.log('[sync] install-site tests: pass=' + (pass ? pass[1] : '?') + ' fail=' + (fail ? fail[1] : '?'))
if (!fail || Number(fail[1]) !== 0) {
  console.error(out.split('\n').filter((l) => l.includes('✖') || l.includes('not ok')).slice(0, 10).join('\n'))
  process.exit(1)
}
console.log('[sync] OK — install verified.')
