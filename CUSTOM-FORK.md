# Local development & install sync（本地开发与安装同步）

This repo is the source of truth. The DSH profile loads a COPY from
`node_modules`; keep them in sync with the script below after every edit.

## Layout

| Path | Role |
|---|---|
| `main` branch (local) | upstream 0.2.0 baseline — kept for diffing and future upstream merges |
| `v0.3.0-ui-audio` branch | **the custom mainline** — every version lands here |
| `github` remote | the public repository (bululuburuarua666/dsh-herald) |
| `origin` remote | upstream kaotusi/dsh-task-notify (baseline reference) |

## Install location & sync

DSH loads the plugin from
`<USERPROFILE>/.dsh/profiles/<name>/node_modules/dsh-herald/`.

After editing code (and after running the tests):

```sh
node scripts/sync-to-install.cjs            # default: web profile
node scripts/sync-to-install.cjs --target <path>   # or DSH_TASK_NOTIFY_INSTALL
```

The script copies `lib/`, `test/`, `package.json`, `CHANGELOG.md`,
`CUSTOM-FORK.md` into the install location and runs the full test suite
there to verify.

## Reinstall protection (important)

Any `pnpm install` / profile rebuild **overwrites the install copy**.
Recover with:

1. `node scripts/sync-to-install.cjs` (one command), or
2. replay the full diff: `git diff main..HEAD > herald.patch` and apply, or
3. minimal replay of the upstream inject fix only:
   `git apply patches/inject-fix.patch`

After any reinstall, first thing: `npm test` — the host contract tests are
the regression lock (the `inject` array must stay `['typert']`; `tools` is
registered through runtime `ctx.inject`).

## Data locations

`<profile>/data/task-notify/records.json` (history) and
`settings.json` (channel C switch) live OUTSIDE node_modules and survive
reinstalls and package renames. 「清空记录」 in the panel does delete the
history file (rebuilds it empty).

## Why the inject fix must never be lost

Upstream 0.2.0 declares `inject: ['tools', 'typert']` statically. In the
web composition the `tools` service never settles in time — the plugin
waits forever and the loader tree never settles (DSH appears to hang at
boot). The fix: `inject: ['typert']` + runtime `ctx.inject(['tools'], …)`.
See the comment block at the top of `lib/index.js` and the regression-lock
test in `test/host.test.mjs`.

## Merging upstream later

`git diff main..<upstream-new-tag>` on the baseline, evaluate, cherry-pick
into the custom mainline, re-run the full suite.
