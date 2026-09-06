## 1.0.1 — bilingual docs, official dsh manifests, real screenshots, npm packaging

- **Bilingual READMEs**: `README.md` (EN) + `README.zh.md` (ZH) with the
  cross-linked language bar, following the official dsh documentation
  convention. Discoverability-focused feature summaries in both languages.
- **Official dsh branding**: the official `powered by dsh` badge
  (shields.io URL from the dsh-skill-badge assets, placed per the brand
  guidelines), plus npm-version / tests / license shields.
- **Official community-plugin manifests**: `dsh.inventory` bilingual hover
  card (title + description, zh/en) and `dsh.origin`
  (`opensource` + `customized` + upstream/fork/note) — the plugin now
  classifies itself correctly in DSH's plugin inventory UI.
- **Notification showcase images**: the host-direct OS toast and the
  in-page toasts rendered with real payloads and real styling on a
  privacy-clean backdrop (no desktop/workspace content), alongside the
  dark/light panel pair.
- **npm packaging**: npm documented as the recommended install route
  (`dsh plugin add dsh-herald`), `prepublishOnly` test gate,
  `README.zh.md` shipped in the files list.
## 1.0.0 — Herald: independent release as dsh-herald

The custom line graduates into its own project with its own name and
identity. Herald — the messenger who crosses the walls — because that is
literally what the host-direct channel does: notifications cross the
browser boundary whether it is open, hidden, or closed.

- **Rename**: package `dsh-herald` (was `@deepseek-ai/dsh-task-notify`,
  upstream's scope); composition row `id: herald`; module/typert
  identifiers aligned. **Data survives**: the data leaf stays
  `data/task-notify` and localStorage keys are unchanged from upstream, so
  existing history, channel settings, and per-browser preferences carry
  over — `resolveDataDir` now walks out of `node_modules` robustly
  (scoped AND unscoped package layouts).
- **Publishing**: MIT with dual attribution (upstream © kaotusi +
  contributors); public repository, screenshots (dark/light), full README,
  release zip for manual installs.
- Everything below is the 0.x line this release ships.
## 0.8.1 — fix: per-channel test buttons + instant switch feedback (the "toasts don't work" report)

Investigated a user report that top-right toasts "don't work" and the
in-app switch "has problems". Live reproduction with real background-job
events + 300ms DOM sampling showed the toast pipeline is HEALTHY (toasts
fire and live their full 6s; the initial "failure" was an observation
timed after the toast had already expired). The real defect was UX:

- The only in-page test affordance, 发送测试通知, never tested the
  in-page channel — it fires a browser Notification-API banner (channel
  B) + chime. With the browser permission DENIED (this user's state) it
  produced ZERO visible feedback, reading exactly as "toasts broken".
- Toggling the in-app switch gave no feedback, and the anti-backlog
  semantics (correctly) never replays old arrivals — so nothing ever
  proved the channel came back.

Fixes:

- **测试浮层** on the in-app card: shows an EPHEMERAL test toast
  immediately (synthetic item, no server record, no pushed-set mark, no
  OS banner) — a direct demo of the doubted surface. Ephemeral toasts
  are ghost-cleanup-exempt and survive poll reconciliation for their
  full 6s (`ephemeral` fallback lookup in Toasts).
- **测试浏览器横幅** on the browser-OS card: the old sendTest moved to
  ITS channel's card (permission flow + one browser banner).
- **测试宿主直发** (renamed from 测试系统通知) on the host card.
- Turning the in-app switch ON immediately demos itself with one
  feedback toast (「浏览器内通知已开启 — 新通知将以浮层提醒」).
- The first-run empty-state button now previews the in-page toast
  (permission-free) instead of the browser banner.

Tests 105 → 108 (ephemeral toast lifecycle incl. timer expiry +
reconciliation survival; switch-on feedback; browser-banner test button
lives on card B).
## 0.8.0 — tri-channel model: the browser's own OS banners become a first-class switchable channel

The user's mental model split "browser notifications" into two different
paths, and they were right: the page's own toasts (rendered in-page) and
the banners the page REQUESTS from the OS through the browser
Notification API are distinct channels. 0.6/0.7 modeled the second one
as an automatic, unswitchable fallback. 0.8.0 makes it explicit:

- **A 浏览器内通知** — in-page toasts + chimes (per-browser switch,
  unchanged)
- **B 浏览器系统通知** — NEW per-browser switch (default ON,
  preserving the old fallback behavior). The browser raises OS banners
  through the Notification API when its switch is on AND the host is
  NOT delivering. While host-direct is active the card shows a 待命
  (standby) chip — never double banners on one machine. Turning it off
  kills the browser path absolutely, including the old automatic
  fallback.
- **C 系统通知（宿主直发）** — host-direct OS toasts (host switch,
  unchanged)

Semantic change vs 0.6: host-OFF no longer silences the browser channel
("关 OS 就是真关 OS" applied to the AUTOMATIC fallback, which must not
second-guess the user). Each switch now governs exactly its own path —
C off + B on expresses "browser banners while I'm browsing, nothing
when the browser is closed" (e.g. remote access to the GUI, or a
preference for browser-branded banners), a combination 0.6 could not
represent. The cards flip 待命 ↔ 生效 live as C toggles, so the
causality stays visible.

Also: the manual 重发 replays through whichever channels are currently
active; the summary strip gains 浏览器代发 ✓ and per-state tones
(off/warn refined); the grant hint shows only when channel B is in
play (on + host not delivering + permission missing);
`ntfy_status` gains `channels.clientOsBrowser` (host-side additive).
Tests 102 → 105 (browser delivers with host off, explicit kill,
standby chip + live flip, switch persistence, parse defaults).
## 0.7.1 — fix: gateway invokes declared parameters POSITIONALLY

Root cause found while verifying the 0.7.0 panel against the live host:
the typert gateway dispatches each invocation with
`Reflect.apply(method, receiver, [paramValues])` — one positional value
per DECLARED parameter — never a named args object. Every
parameterized method that read `input.<field>` off its first argument
silently degraded in production (direct-call tests bypass the gateway,
so the suite never saw it):

- **setSettings** (0.6.0): received `{ enabled }` but read
  `input.os.enabled` → the panel's OS switch reconciled straight back;
  `settings.json` was never written. Now accepts both shapes.
- **pullSince** (0.5.0, upstream): received the cursor SCALAR but read
  `input.cursor` → every round degraded to `reset:true` + full-history
  pull. The incremental protocol never actually ran in production (the
  client tolerates reset rounds, so it went unnoticed). Now the scalar
  cursor is respected — steady-state rounds are true empty deltas.
- **ack** (0.2.0, upstream): received the id SCALAR but read
  `input.id` → production acks were silent no-ops, so cross-tab
  read-state never propagated and re-polled records stayed unread.
  Now both shapes mark read.

Verified against the live gateway by replaying raw HTTP envelopes:
pre-fix `pullSince {cursor:26}` answered `reset:true` with all 13
records; post-fix it answers a true delta. Tests 99 → 102 (wire-shape
scalar + direct-shape object pinned for every parameterized method).
Host-side change — a DSH restart is required.
## 0.7.0 — premium panel redesign (visual system overhaul)

- **Structure**: the drawer is now a sectioned card layout — 通知通道 as
  icon cards (icon chip + title + live/off chip + platform chip + desc +
  own switch + card-level test buttons), 外观与提示音 as pref rows
  (segmented theme control, bigger switch, custom range slider, branded
  checkbox), 操作 as a button row (重发 / 清空记录), and the raw
  technical lines sub-folded behind 诊断详情.
- **Status strip**: the always-visible summary line gains a colored
  status dot (ok / warn / err / off) derived from the same branch that
  produces the summary text; the ⓘ toggle becomes a ▸/▾ caret.
- **Visual system**: layered surfaces with deeper soft shadows and
  hairline borders, tracked uppercase section titles, 34×20 brand-filled
  switches with white knobs, segmented control with raised selection,
  custom webkit/moz slider thumbs, enter animations (panel pop, toast
  slide) with prefers-reduced-motion off, hover lift on cards and toasts.
- **Semantics preserved**: every `data-ntfy-*` hook and CSS contract
  (toast 16px / panel 14px radius, color-mix tints, theme attribute
  blocks, reduced-motion guard, legacy `.ntfy-theme-row` classes) is
  kept; two-fold drawer behavior is intentional (ⓘ → sections →
  诊断详情 → raw lines).
- **Tests**: 95 → 99 (status-dot tone, channel cards structure, muted
  OS-off card, segmented control + persistence); the drawer tests now
  open the sub-fold for raw diagnostics.
## 0.6.0 — dual channels: in-browser alerts vs host-direct OS toasts

- **Architecture**: `push()` now raises the system toast from the HOST
  process itself (`lib/osnotify.js` — PowerShell + WinRT on win32,
  osascript on darwin, notify-send on linux). Out-of-browser delivery no
  longer depends on the browser in ANY state — open, backgrounded,
  hidden (poll-pause), or fully closed. This also removes the old
  failure mode where hidden-tab timer clamping delayed OS banners.
- **Independent switches**: 通知通道 section in the diagnostics drawer.
  In-browser alerts (toasts + chimes) persist per-browser in
  `dsh-task-notify:channels`; the OS switch persists host-side in
  `<profile>/data/task-notify/settings.json` (cross-browser, effective
  headless). `DSH_TASK_NOTIFY_OS=0|1` overrides and LOCKS the file
  switch (panel renders it read-only with a hint).
- **No double banners**: the browser `Notification` API is demoted to a
  FALLBACK — used only when the host cannot deliver (pre-0.6 host or a
  platform without an adapter) AND permission is already granted. A
  user-turned-OFF is honored absolutely; the fallback stays off too.
  The 'pending' fetch state blocks the fallback so boot can never race
  into a double push.
- **Anti-bombardment (host side)**: serialized spawns (concurrency 1)
  with a 1.2s minimum gap; arrivals beyond 5 per 10s window fold into
  ONE summary toast (「新增 N 条：审批 ×1、任务结束 ×7」); approval and
  manual-test kinds are exempt and always fire individually; 5s timeout
  kill + a single retry per payload.
- **Injection safety**: user text reaches the platform tool as
  base64(UTF-16LE) decoded inside PowerShell (never raw interpolation);
  toast tags are sanitized to `[A-Za-z0-9_-]`; spawns run without a
  shell, `windowsHide`, `stdio: 'ignore'`.
- **Protocol**: three new typert invocations — `getSettings`,
  `setSettings`, `testOs` (strict zod codecs). `ntfy_status` gains an
  additive `channels` block (osEnabled / osAdapter / osAvailable /
  osSent / osLastError / osVia / clientInApp). `pull`/`pullSince`/
  `ack`/`clear`/`purge`/`diag` shapes unchanged — old clients keep
  working (they simply keep browser-notifying until refreshed).
- **Client pushed-set semantics**: an arrival is marked reacted-to even
  with every channel off, so flipping a switch on later never replays
  the backlog as a burst (plus the existing 3-per-round budget).
- **Tests**: 60 → 95 (channel four-quadrant gating, fallback matrix,
  OS-switch RPC + reconcile, env lock, host-direct spawn with fake
  spawn recorder incl. base64 round-trip and injection checks,
  coalescing/approval-exemption/retry/timeout via a virtual clock,
  settings persistence roundtrip + atomic write order).
## 0.5.0 — architecture: persistence + incremental pull + adaptive polling (Phase 2)

- **Persistent history**: records survive DSH restarts as ONE JSON file at
  `<profileRoot>/data/task-notify/records.json` (never inside node_modules).
  Atomic writes (tmp + rename), 2s max-latency debounce, dispose-time final
  flush. A corrupt file recovers to empty (diag `persist: 'recovered'`);
  read-only storage degrades to memory-only (`persist: 'disabled'`) — the
  plugin NEVER fails to mount over storage.
- **Incremental sync**: a monotonic `seq` change counter rides every record;
  new `pullSince({ cursor })` returns only records changed after the cursor
  (creations AND ack/clear mutations, so cross-tab read state still
  propagates). `pull()` keeps its legacy full-array shape for old clients.
  Purge resets the generation: stale cursors get `reset: true` + empty.
- **Adaptive polling**: the client Poller is a self-rescheduling timeout
  chain — 1.5s → 2.5s → 4s → 5s (cap) as rounds come back empty; any new
  record or foreground return snaps back to 1.5s. RPC failures hold the
  current interval (never silent) and 5 consecutive failures surface in the
  diagnostics drawer. A pre-0.5 host (no pullSince) transparently degrades
  the page session to legacy full pulls.
- **Diagnostics**: `diag()` now answers `{ persist }`; the drawer shows
  持久化: 正常/已恢复/不可用; `ntfy_status` gains the additive `persist` field.
- **Tests**: 41 → 60 (store roundtrip/recovery, restart seq monotonicity,
  pullSince delta correctness, backoff ladder, failure-hold, legacy
  fallback, purge generation reset, atomic flush order).
## 0.4.0 — independent theme override (personal fork)

- The plugin now has its own theme switch (auto / light / dark) in the
  diagnostics drawer: `dsh-task-notify:theme` persisted per user.
- Implementation: attribute-scoped token shadowing — bell/panel/toasts carry
  `data-ntfy-theme` when light/dark is chosen, and two override blocks
  redefine ONLY the tokens this plugin consumes. `auto` (default) leaves
  zero footprint and follows the DSH host theme.
## 0.3.1 — notification look & sound polish (personal fork)

- OS notifications: designed bell icon (data URI), `silent: true` so our
  chime owns the sound (no double-beep), friendlier test-notify body.
- In-app toasts: Apple-style card — 16px radius, softer shadow, tinted
  icon chip per kind (token-derived via color-mix), tighter type scale.
- Panel: 14px radius + softer shadow.
## 0.3.0 — UI & chime optimization (Phase 1)

**UI**: panel anchored to the bell (viewport-clamped, resize-aware, outside-click close); toast hover-pause + 0.5s fade + ✓/✕ outcome marks; unread dot + tertiary read styling; first-run vs all-caught-up empty states; diagnostics folded behind ⓘ with two-click purge confirm.

**Chimes**: `playChime(kind, outcome)` with direction encoding — ok ascends, failed descends, approval double-taps, killed single low note. Per-user audio config (`dsh-task-notify:audio`: enabled / volume / muteWhenHidden) with in-panel settings + preview. AudioContext stays lazy and resumes only in user-gesture contexts.

**Fix upstreamed**: the web-composition inject deadlock — `inject` is now `['typert']` with `tools` injected at runtime via `ctx.inject`. Previously a local-only patch on the installed copy.
# Changelog

## 0.2.0 — 2026-08-16

- feat: dedupe OS notification pushes via localStorage (refresh / extra tabs no longer re-bomb historical unread items)
- feat: reconcile panel against the host snapshot (ghosts vanish after another tab clears or the host restarts)
- feat: skip polling while the tab is hidden; poll immediately on returning to the foreground
- feat: budget at most 3 new OS pushes per poll round
- feat: `ntfy_status` reports staleness (older than two minutes)
- feat: `subagent/end` notifications carry the child session id and an output summary
- fix: panel keeps server order (newest first)
- fix: mount diagnostic failure path is now reachable
- fix: widen `zod` peer range to `^3.0.0 || ^4.0.0` (DSH rc.6 installs zod 4.4.3)
- fix: declare `sideEffects` for the client entry
- test: node:test suites for client and host (19 tests), `npm test`

## 0.1.0 — 2026-08-14

- Initial release: approval requests, awaited replies, and finished background jobs / subagents / workflows pushed to the OS notification center with chimes, plus an in-app bell panel, toasts, and a clear button.
