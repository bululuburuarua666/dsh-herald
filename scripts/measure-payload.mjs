// Payload measurement: full pull() vs incremental pullSince() over a
// realistic seeded history. Read-only evidence tool for the v0.5.0 report.
//
//   node scripts/measure-payload.mjs [recordCount]
//
// Seeds a temp-dir store through the REAL host plugin (createPlugin), then
// prints byte sizes of what would travel the wire per poll round.

import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { createPlugin } = await import(pathToFileURL(path.join(root, 'lib', 'index.js')).href)

const COUNT = Number(process.argv[2] || 300)

const makeCtx = () => {
  const listeners = {}
  const host = { provided: {} }
  return {
    listeners, host,
    get: () => undefined,
    on: (evt, cb) => { listeners[evt] = cb; return () => {} },
    effect: (fn) => fn(),
    typert: { register: () => () => {} },
    inject: (_n, cb) => cb({ tools: { register: () => {} } }),
    reflect: { provide: (n, svc) => { host.provided[n] = svc; return () => {} } },
  }
}

const bytes = (v) => Buffer.byteLength(JSON.stringify(v), 'utf8')

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntfy-measure-'))
const ctx = makeCtx()
const P = createPlugin({ dataDir: dir })
await P.apply(ctx)
const service = ctx.host.provided.taskNotify

// Realistic payloads: agent titles + tool reasons / job summaries.
const details = [
  'pwsh · Run full test suite — 60/60 green in 672ms',
  'completed — all files audited, no findings',
  'failed: exit code 1, see log tail',
  'killed by user',
  'approval requested: sandbox escalation for D:\\work write',
]
let i = 0
const push = () => {
  ctx.listeners['approval/request']({ agent: { id: 'agent-' + (i % 7) }, callId: 'c' + i, toolName: 'bash', reason: details[i % details.length] }, () => {})
  i++
}
for (let k = 0; k < COUNT; k++) push()

const first = service.pullSince({ cursor: 0 })
const full = service.pull()
const steady = service.pullSince({ cursor: first.cursor })
push()
const oneDelta = service.pullSince({ cursor: steady.cursor })

console.log('records seeded         :', full.length)
console.log('v0.4 full pull() bytes :', bytes(full), ' (sent every 1.5s per open tab)')
console.log('v0.5 empty round bytes :', bytes(steady), ' (items:' + steady.items.length + ' reset:' + steady.reset + ')')
console.log('v0.5 1-record delta    :', bytes(oneDelta), ' (items:' + oneDelta.items.length + ')')
console.log('empty-round reduction  :', (100 - Math.round(100 * bytes(steady) / bytes(full))) + '%')
ctx.listeners['dispose']()
fs.rmSync(dir, { recursive: true, force: true })
