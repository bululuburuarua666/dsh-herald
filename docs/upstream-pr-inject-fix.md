# Upstream PR draft — fix the web-composition inject deadlock in `dsh-task-notify`

> 状态：草稿（本地）。个人定制主线按约定不推送；待 GitHub 账号就绪后，可将
> `patches/inject-fix.patch` 与本描述作为 PR 提交到 `kaotusi/dsh-task-notify`。
> 提交前先 `git fetch` 确认上游未自行修复。

## Title

fix(host): replace static `inject: ['tools', 'typert']` with runtime tools injection — the plugin never mounts in the web composition

## Problem

On a standard `dsh web` profile, the plugin as shipped in 0.2.0 **never mounts**:

- the sidebar bell never appears, no `taskNotify` service is registered, and
  `ntfy_status` is never available;
- the web composition loader tree never settles around this plugin row.

## Root cause

`lib/index.js` declares

```js
const inject = ['tools', 'typert']
```

In the web composition, the `tools` service is defined at a point that does not
line up with the static-inject waiting mechanism: the plugin fiber parks waiting
for `tools`, the loader keeps the row pending, and neither side ever wakes the
other. `typert`, by contrast, is a genuine hard dependency used on the first
line of `apply()` (`ctx.typert.register(TYPERT)`) and must stay static.

## Fix

Keep `typert` static; move `tools` to a **runtime** injection so mounting is
never blocked and the diagnostic tool registers whenever the service is ready:

```js
const inject = ['typert']
// ...
ctx.inject(['tools'], (toolsCtx) => {
  toolsCtx.tools.register(defineTool({ name: 'ntfy_status', /* ... */ }))
})
```

The exact minimal diff is `patches/inject-fix.patch`
(`git diff main <fix-commit> -- lib/index.js`).

## Test evidence

- `test/host.test.mjs` gains a REGRESSION LOCK asserting
  `assert.deepEqual(inject, ['typert'])` — the static `tools` entry can never
  silently return — plus a test that `ntfy_status` registers through the
  runtime `ctx.inject(['tools'], …)` path.
- Full local suite: **green** (60/60 at the time of writing; the upstream-only
  subset covering this fix is the two host tests above).
- Verified live on a `dsh web` profile: after the fix the plugin mounts, the
  bell appears, polling works, and `ntfy_status` answers.

## Notes for reviewers

- `pull/ack/clear/purge/diag` semantics are untouched by this change.
- The client RPC seam (`ctx.connection.rpc.call('/api', 'taskNotify/…')`) is
  unchanged; it intentionally bypasses the typert namespace-face machinery,
  which requires inject-declared dotted services a self-mounted namespace
  cannot satisfy.
