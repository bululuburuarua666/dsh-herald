window.__ModuleLoader__.load({
  id: 'dsh-herald',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')

    // Client→Host RPC via the raw connection rpc seam (bypasses the typert
    // namespace-face machinery, which requires inject-declared dotted services
    // that a self-mounted namespace cannot satisfy).
    const inject = ['slots', 'locale', 'timer', 'connection']

    const DICTS = {
      zh: {
        bellLabel: '任务通知', panelTitle: '任务通知',
        approvalTitle: '需要审批', replyTitle: '需要回复',
        endSubagentTitle: '子任务结束', endWorkflowTitle: '工作流结束', endJobTitle: '后台任务结束',
        markAllRead: '全部已读',
        emptyFirstTitle: '通知会出现在这里',
        emptyFirstDesc: '审批请求、等待回复、后台任务结束时，会在这里和系统通知中心提醒你',
        emptyCleared: '都处理完了',
        outcomeOk: '完成', outcomeFailed: '失败', outcomeKilled: '已终止',
        justNow: '刚刚', minAgo: '分钟前', hourAgo: '小时前', close: '关闭',
        permHint: '系统通知未开启 — 点击铃铛授权',
        testNotify: '发送测试通知',
        testNotifyReady: '提示音与系统通知都已就绪 ✓',
        diagLabel: '系统通知',
        diagOn: '系统通知：已开启 ✓', diagOff: '系统通知：未授权', diagErr: '推送异常：{why}',
        diagToggle: '诊断详情',
        pushOk: '上次推送:成功', pushSkip: '上次推送:跳过', pushErr: '上次推送:失败',
        lastPushAt: '上次推送时间',
        retry: '重发',
        purgeBtn: '清空记录', purgeConfirm: '确认清空？',
        mountLabel: '挂载', mountOk: '成功', mountFail: '失败',
        pollLabel: '轮询', pollOk: '成功', pollFail: '失败',
        audioSection: '提示音', audioEnabled: '启用提示音', audioVolume: '音量',
        audioMuteHidden: '页面隐藏时静音', audioPreview: '试听',
        themeLabel: '主题', 'theme.auto': '跟随 DSH', 'theme.light': '浅色', 'theme.dark': '深色',
        persistLabel: '持久化', 'persist.ok': '正常', 'persist.recovered': '已恢复', 'persist.disabled': '不可用',
        rpcFails: '连续失败',
        chSection: '通知通道',
        chInApp: '浏览器内通知', chInAppHint: 'Toast 浮层与提示音',
        chOs: '系统通知（浏览器外）', chOsHint: '宿主直发系统通知中心，浏览器关闭也送达',
        chOsPending: '正在读取宿主设置…', chOsLegacy: '宿主版本过旧，此开关不可用',
        chOsLocked: '由环境变量 DSH_TASK_NOTIFY_OS 控制',
        diagOnHost: '系统通知：宿主直发 ✓', diagOsOff: '系统通知：已关闭',
        testOsBtn: '测试宿主直发',
        osTestLine: '系统通知测试', osTestOk: '已发送', osTestFail: '失败',
        testToastBtn: '测试浮层', testOsBrowserBtn: '测试浏览器横幅',
        testToastTitle: '测试通知', testToastBody: '浮层工作正常 ✓ — 正式通知将出现在这里（右上角，6 秒）',
        chInAppOnFeedback: '已开启 — 新通知将以浮层提醒',
        chInAppDesc: 'Toast 浮层 · 提示音', chOsDescHost: '宿主直发系统通知中心',
        chOsDescBrowser: '浏览器代发（fallback）', chOsDescOff: '已关闭',
        chipLive: '已启用', chipOff: '关闭', chipMuted: '静音中',
        osViaHost: '宿主直发', osViaBrowser: '浏览器代发', osViaPending: '连接中…',
        chOsBrowser: '浏览器系统通知', chOsBrowserHint: '网页向系统发起的横幅；宿主直发不可用时自动接替',
        chOsBrowserActive: '由浏览器代发系统横幅', chOsBrowserStandby: '宿主直发生效中 · 浏览器通道待命',
        chipStandby: '待命', chipNoPerm: '未授权',
        diagOnBrowser: '系统通知：浏览器代发 ✓',
        secPrefs: '外观与提示音', secTools: '操作', secDiag: '诊断详情',
        stateOk: '正常', stateAttention: '需要注意', stateMuted: '部分关闭',
      },
      en: {
        bellLabel: 'Task Notifications', panelTitle: 'Task Notifications',
        approvalTitle: 'Approval required', replyTitle: 'Awaiting your reply',
        endSubagentTitle: 'Subagent finished', endWorkflowTitle: 'Workflow finished', endJobTitle: 'Background job finished',
        markAllRead: 'Mark all read',
        emptyFirstTitle: 'Notifications will appear here',
        emptyFirstDesc: 'Approval requests, awaited replies, and finished background jobs will alert you here and in the system notification center',
        emptyCleared: 'All caught up',
        outcomeOk: 'done', outcomeFailed: 'failed', outcomeKilled: 'killed',
        justNow: 'just now', minAgo: 'min ago', hourAgo: 'h ago', close: 'Close',
        permHint: 'System notifications off — click the bell to enable',
        testNotify: 'Send test notification',
        testNotifyReady: 'Chimes and system notifications are ready ✓',
        diagLabel: 'Notifications',
        diagOn: 'System notifications: on ✓', diagOff: 'System notifications: not authorized', diagErr: 'Push problem: {why}',
        diagToggle: 'Diagnostics',
        pushOk: 'last push: ok', pushSkip: 'last push: skipped', pushErr: 'last push: failed',
        lastPushAt: 'Last push at',
        retry: 'Re-send',
        purgeBtn: 'Clear all', purgeConfirm: 'Sure?',
        mountLabel: 'mount', mountOk: 'ok', mountFail: 'failed',
        pollLabel: 'poll', pollOk: 'ok', pollFail: 'failed',
        audioSection: 'Chimes', audioEnabled: 'Enable chimes', audioVolume: 'Volume',
        audioMuteHidden: 'Mute when tab hidden', audioPreview: 'Preview',
        themeLabel: 'Theme', 'theme.auto': 'Follow DSH', 'theme.light': 'Light', 'theme.dark': 'Dark',
        persistLabel: 'Persistence', 'persist.ok': 'ok', 'persist.recovered': 'recovered', 'persist.disabled': 'unavailable',
        rpcFails: 'failures',
        chSection: 'Channels',
        chInApp: 'In-browser alerts', chInAppHint: 'Toasts and chimes',
        chOs: 'System notifications (outside browser)', chOsHint: 'Pushed by the host to the OS center — works with the browser closed',
        chOsPending: 'reading host settings…', chOsLegacy: 'host too old — switch unavailable',
        chOsLocked: 'controlled by DSH_TASK_NOTIFY_OS',
        diagOnHost: 'System notifications: host-pushed ✓', diagOsOff: 'System notifications: off',
        testOsBtn: 'Test host toast',
        osTestLine: 'OS test', osTestOk: 'sent', osTestFail: 'failed',
        testToastBtn: 'Preview toast', testOsBrowserBtn: 'Test browser banner',
        testToastTitle: 'Test notification', testToastBody: 'Toasts work ✓ — real alerts appear here (top-right, 6s)',
        chInAppOnFeedback: 'On — new alerts will surface here',
        chInAppDesc: 'Toasts · chimes', chOsDescHost: 'Host-direct to the OS center',
        chOsDescBrowser: 'Via the browser (fallback)', chOsDescOff: 'Off',
        chipLive: 'Live', chipOff: 'Off', chipMuted: 'Muted',
        osViaHost: 'host-direct', osViaBrowser: 'browser', osViaPending: 'connecting…',
        chOsBrowser: 'Browser system notifications', chOsBrowserHint: 'Banners the browser raises with the OS; auto-backstop when host-direct is unavailable',
        chOsBrowserActive: 'Banners delivered by the browser', chOsBrowserStandby: 'Host-direct active · browser on standby',
        chipStandby: 'standby', chipNoPerm: 'not granted',
        diagOnBrowser: 'System notifications: via browser ✓',
        secPrefs: 'Appearance & chimes', secTools: 'Actions', secDiag: 'Diagnostics',
        stateOk: 'All good', stateAttention: 'Needs attention', stateMuted: 'Partially muted',
      },
    }

    // ── v0.3.0 pure helpers (factory scope → testable via exports.__internals) ──

    const AUDIO_KEY = 'dsh-task-notify:audio'
    const AUDIO_DEFAULTS = { enabled: true, volume: 0.7, muteWhenHidden: true }
    const THEME_KEY = 'dsh-task-notify:theme'
    const THEME_DEFAULT = 'auto' // auto = follow the host (DSH) theme

    // v0.6.0: the in-app channel switch is browser-local (each browser
    // surface owns its own presentation). The OS ("outside the browser")
    // switch lives on the HOST — see the hostOs block in apply().
    // v0.8.0: a second browser-local switch — the browser's own
    // Notification-API banners (osBrowser). Default ON so the pre-0.8
    // automatic-fallback behavior is preserved.
    const CHANNELS_KEY = 'dsh-task-notify:channels'
    const CHANNELS_DEFAULTS = { inApp: true, osBrowser: true }

    /** Parse a stored channels config string; corrupt input → defaults.
     * Unknown fields drop, booleans only. */
    const parseChannelsConfig = (raw) => {
      const out = { ...CHANNELS_DEFAULTS }
      if (typeof raw !== 'string' || raw === '') return out
      try {
        const parsed = JSON.parse(raw)
        if (parsed !== null && typeof parsed === 'object') {
          if (typeof parsed.inApp === 'boolean') out.inApp = parsed.inApp
          if (typeof parsed.osBrowser === 'boolean') out.osBrowser = parsed.osBrowser
        }
      } catch (e) { /* corrupt → defaults */ }
      return out
    }

    const clampVolume = (v) => {
      const n = Number(v)
      if (!(n >= 0)) return 0
      if (n > 1) return 1
      return n
    }

    /** Parse a stored audio config string; corrupt input → defaults.
     * Returns the config (volume always clamped, unknown fields dropped). */
    const parseAudioConfig = (raw) => {
      const out = { ...AUDIO_DEFAULTS }
      if (typeof raw !== 'string' || raw === '') return out
      try {
        const parsed = JSON.parse(raw)
        if (parsed !== null && typeof parsed === 'object') {
          if (typeof parsed.enabled === 'boolean') out.enabled = parsed.enabled
          // Non-numeric volume keeps the DEFAULT (clamping a NaN to 0 would
          // silently mute the user over one corrupted field).
          if (typeof parsed.volume === 'number' && isFinite(parsed.volume)) out.volume = clampVolume(parsed.volume)
          if (typeof parsed.muteWhenHidden === 'boolean') out.muteWhenHidden = parsed.muteWhenHidden
        }
      } catch (e) { /* corrupt → defaults */ }
      return out
    }

    /** One note of a chime plan. g is the BASE gain; the unified coefficient
     * (base × userVolume) is applied in effectiveGain — no branch may bypass it. */
    const effectiveGain = (base, userVolume) => {
      const v = clampVolume(userVolume)
      const g = Number(base)
      return (g >= 0 ? g : 0) * v
    }

    /**
     * Chime plan per (kind, outcome). Direction encoding:
     *   up = positive/done · down = failed · double-tap = action needed ·
     *   single low = neutral (killed).
     * Triangle/sine only — never sawtooth (harsh).
     */
    const chimePlan = (kind, outcome) => {
      if (kind === 'approval') return { notes: [
        { f: 880, w: 'triangle', s: 0, d: 0.15, g: 0.22 },
        { f: 880, w: 'triangle', s: 0.2, d: 0.15, g: 0.22 },
      ] }
      if (kind === 'reply') return { notes: [
        { f: 523, w: 'triangle', s: 0, d: 0.18, g: 0.2 },
        { f: 659, w: 'triangle', s: 0.18, d: 0.22, g: 0.2 },
      ] }
      if (kind === 'task-end') {
        if (outcome === 'failed') return { notes: [
          { f: 330, w: 'sine', s: 0, d: 0.2, g: 0.2 },
          { f: 262, w: 'sine', s: 0.22, d: 0.24, g: 0.2 },
        ] }
        if (outcome === 'killed') return { notes: [
          { f: 440, w: 'sine', s: 0, d: 0.15, g: 0.12 },
        ] }
        return { notes: [
          { f: 523, w: 'triangle', s: 0, d: 0.15, g: 0.2 },
          { f: 784, w: 'triangle', s: 0.15, d: 0.2, g: 0.2 },
        ] }
      }
      return null
    }

    /**
     * Panel anchor geometry (pure).
     * Desktop: panel's left edge hugs the bell's right edge + 8px, clamped
     * into [12, viewport - panelWidth - 12]; bottom edge aligns with the
     * bell's bottom. Mobile (<760px): centered with 12px margins, capped
     * at min(65vh, 560px) tall.
     */
    const computePanelPos = (bellRect, viewportW, viewportH, panelW) => {
      if (!(viewportW >= 760)) return { mobile: true, left: 12, bottom: 12, maxHeight: Math.min(Math.round(viewportH * 0.65), 560) }
      const r = (bellRect !== null && typeof bellRect === 'object') ? bellRect : { right: 0, bottom: 0 }
      const maxLeft = Math.max(12, viewportW - panelW - 12)
      const left = Math.min(Math.max(12, r.right + 8), maxLeft)
      const bottom = Math.max(12, viewportH - (typeof r.bottom === 'number' ? r.bottom : viewportH))
      return { mobile: false, left, bottom }
    }

    /** v0.4.0 theme value parser: anything that is not exactly
     * 'light'/'dark' falls back to 'auto' (follow the host theme). */
    const parseTheme = (raw) => (raw === 'light' || raw === 'dark' ? raw : 'auto')

    async function apply(ctx) {
      const mountState = { ok: null, why: '' }
      const slots = ctx.get('slots')
      if (slots === undefined) return

      // ── store ──
      // v0.3.0: UI state lives in this store (never React.useState) so the
      // manual re-render test harness stays valid and real React only needs
      // the useStore force-update.
      const state = { items: [], toasts: [], open: false, diagOpen: false, diagDetailOpen: false, purgeArm: false, panelPos: null }
      const listeners = new Set()
      const emit = () => { for (const fn of listeners) fn() }
      const subscribe = (fn) => { listeners.add(fn); return () => { listeners.delete(fn) } }
      // Toast lifecycle bookkeeping (hover pause needs the remaining time).
      const TOAST_MS = 6000
      const FADE_MS = 500
      const toastTimers = new Map() // id → { dispose, startedAt, duration }
      const fading = new Set()
      // First-run empty state: "ever saw a non-empty list" is process memory
      // only — restarting honestly returns to the first-run explainer.
      let seenNonEmpty = false

      // ── i18n ──
      let lang = 'zh'
      const locale = ctx.get('locale')
      const readLang = () => {
        try {
          if (locale !== undefined) {
            const snap = locale.getLocale()
            if (snap && typeof snap.active === 'string' && snap.active) lang = snap.active
          }
        } catch (e) { /* ignore */ }
      }
      readLang()
      if (locale !== undefined && typeof locale.subscribe === 'function') {
        ctx.effect(() => locale.subscribe(() => { readLang(); emit() }))
      }
      const t = (key) => (DICTS[lang] || DICTS.zh)[key] || DICTS.zh[key] || key
      const tfmt = (key, params) => {
        let s = t(key)
        for (const k of Object.keys(params || {})) s = s.split('{' + k + '}').join(String(params[k]))
        return s
      }

      // ── audio config (v0.3.0) ──
      let audioWarned = false
      const audioCfg = (() => {
        try {
          if (typeof localStorage !== 'undefined' && localStorage !== null) {
            const raw = localStorage.getItem(AUDIO_KEY)
            if (raw !== null) {
              if (raw !== '') {
                try { JSON.parse(raw) } catch (e) {
                  // Corrupt value: fall back to defaults, warn once.
                  if (audioWarned !== true) { audioWarned = true; try { console.warn('task-notify: audio config corrupt, using defaults') } catch (e2) { /* ignore */ } }
                }
              }
              return parseAudioConfig(raw)
            }
          }
        } catch (e) { /* storage unavailable → defaults */ }
        return { ...AUDIO_DEFAULTS }
      })()
      const saveAudioCfg = () => {
        try {
          if (typeof localStorage !== 'undefined' && localStorage !== null) {
            localStorage.setItem(AUDIO_KEY, JSON.stringify(audioCfg))
          }
        } catch (e) { /* private mode: silent */ }
      }

      // ── channels config (v0.6.0): the in-app switch, browser-local ──
      const channels = (() => {
        try {
          if (typeof localStorage !== 'undefined' && localStorage !== null) {
            return parseChannelsConfig(localStorage.getItem(CHANNELS_KEY))
          }
        } catch (e) { /* storage unavailable → defaults */ }
        return { ...CHANNELS_DEFAULTS }
      })()
      const saveChannelsCfg = () => {
        try {
          if (typeof localStorage !== 'undefined' && localStorage !== null) {
            localStorage.setItem(CHANNELS_KEY, JSON.stringify(channels))
          }
        } catch (e) { /* private mode: silent */ }
      }

      // ── theme override (v0.4.0): auto = follow DSH; light/dark override
      // the plugin's OWN surfaces via a token-shadowing attribute (the host
      // theme is never touched). Read the store once at boot.
      let theme = (() => {
        try {
          if (typeof localStorage !== 'undefined' && localStorage !== null) {
            return parseTheme(localStorage.getItem(THEME_KEY))
          }
        } catch (e) { /* storage unavailable → auto */ }
        return THEME_DEFAULT
      })()
      const themeAttr = () => (theme === 'auto' ? undefined : theme)
      const setTheme = (next) => {
        theme = parseTheme(next)
        try {
          if (typeof localStorage !== 'undefined' && localStorage !== null) {
            localStorage.setItem(THEME_KEY, theme)
          }
        } catch (e) { /* silent */ }
        emit()
      }

      // ── incremental sync cursor (v0.5.0) ──
      // 0 = first round → the host answers reset:true + the full history.
      // Afterwards only records changed after this cursor travel the wire.
      let cursor = 0
      // Host persistence status from the diag() round-trip: '' = unknown
      // (pre-0.5 host, or the answer has not arrived yet).
      let hostPersist = ''

      // ── helpers ──
      const kindClass = (item) =>
        item.kind === 'approval' ? 'ntfy-kind-approval' : item.kind === 'reply' ? 'ntfy-kind-reply' : 'ntfy-kind-task-end'

      // v0.3.1: OS-notification icon. OS toasts are NOT skinnable by a page
      // (font/radius/layout belong to the browser+OS) — but icon/body/silent
      // are ours. A blue rounded-square bell reads as a designed mark instead
      // of Chrome's default site placeholder. SVG data URI; a runtime that
      // rejects it degrades to no icon (the constructor never throws for it).
      const NOTIFY_ICON = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">'
        + '<rect width="24" height="24" rx="6" fill="#0066cc"/>'
        + '<path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 8-2.5 8h17S18 15 18 9" fill="#ffffff"/>'
        + '<path d="M13.6 20a2 2 0 0 1-3.2 0" fill="#ffffff"/>'
        + '</svg>')
      const textOf = (item) => {
        if (item.kind === 'test') return { title: item.label || '', body: item.detail || '' }
        if (item.kind === 'approval') return { title: t('approvalTitle'), body: item.detail || item.label || '' }
        if (item.kind === 'reply') return { title: t('replyTitle'), body: item.label || '' }
        const title = item.subkind === 'subagent' ? t('endSubagentTitle') : item.subkind === 'workflow' ? t('endWorkflowTitle') : t('endJobTitle')
        const parts = []
        if (item.label) parts.push(item.label)
        if (item.detail) parts.push(item.detail)
        if (item.outcome === 'ok') parts.push(t('outcomeOk'))
        else if (item.outcome === 'failed') parts.push(t('outcomeFailed'))
        else if (item.outcome === 'killed') parts.push(t('outcomeKilled'))
        return { title, body: parts.join(' · ') }
      }

      const relTime = (at) => {
        const diff = Date.now() - Number(at)
        if (!(diff >= 0)) return ''
        if (diff < 60000) return t('justNow')
        const min = Math.floor(diff / 60000)
        if (min < 60) return String(min) + ' ' + t('minAgo')
        return String(Math.floor(min / 60)) + ' ' + t('hourAgo')
      }

      // ── system notifications ──
      const canNativeNotify = () =>
        typeof Notification !== 'undefined' && typeof Notification.requestPermission === 'function'

      const lastPush = { ok: null, why: '', at: 0 }

      const reportDiag = () => {
        try {
          ctx.connection.rpc.call('/api', 'taskNotify/diag', { args: { state: {
            supported: canNativeNotify(),
            permission: typeof Notification !== 'undefined' ? String(Notification.permission) : 'unavailable',
            secure: typeof window !== 'undefined' && typeof window.isSecureContext === 'boolean' ? window.isSecureContext === true : false,
            at: Date.now(),
            // v0.6.0 channel diagnostics (DiagState is passthrough-tolerant):
            inApp: channels.inApp === true,
            osBrowser: channels.osBrowser !== false,
            osVia: osVia(),
          } } })
            .then((answered) => {
              // v0.5.0: the host answers with { persist } so the drawer can
              // show 正常/已恢复/不可用. A missing value (pre-0.5 host, which
              // returned null) simply leaves the row as '?'.
              if (answered && answered.ok === true && answered.value !== null && typeof answered.value === 'object' && typeof answered.value.persist === 'string') {
                if (hostPersist !== answered.value.persist) { hostPersist = answered.value.persist; emit() }
              }
            })
            .catch(() => {})
        } catch (e) { /* ignore */ }
      }

      // ── host OS settings (v0.6.0) ──────────────────────────────────
      // hostOsState: 'pending' (first answer not in yet) | 'ok' (host
      // answered getSettings) | 'legacy' (pre-0.6 host / rpc failed).
      // 'pending' deliberately BLOCKS the browser fallback: assuming the
      // host delivers avoids any double-banner race at boot (the fetch
      // resolves within one rpc round, before the first poll surfaces).
      let hostOs = null
      let hostOsState = 'pending'
      const fetchHostSettings = () => {
        try {
          ctx.connection.rpc.call('/api', 'taskNotify/getSettings', { args: {} })
            .then((answered) => {
              const v = answered && answered.ok === true ? answered.value : null
              if (v !== null && typeof v === 'object' && v.os !== null && typeof v.os === 'object' && typeof v.os.enabled === 'boolean') {
                hostOs = v
                hostOsState = 'ok'
              } else {
                hostOsState = 'legacy'
              }
              emit()
            })
            .catch(() => { hostOsState = 'legacy'; emit() })
        } catch (e) { hostOsState = 'legacy' }
      }
      const browserNotifyPermitted = () =>
        canNativeNotify() && typeof Notification !== 'undefined' && Notification.permission === 'granted'
      const hostOsUsable = () =>
        hostOsState === 'ok' && hostOs !== null && hostOs.os.enabled === true
        && hostOs.adapter !== null && typeof hostOs.adapter === 'object' && hostOs.adapter.available === true
      // v0.8.0 tri-channel model: the browser's Notification API is a
      // FIRST-CLASS, user-switchable channel (channels.osBrowser) — no
      // longer an unconditional automatic fallback. Semantics:
      //  - host-direct delivering  → the browser channel stands by
      //    (NEVER double banners on one machine);
      //  - host off / legacy host / no adapter → the browser channel
      //    delivers when its switch is ON and permission is granted;
      //  - the switch OFF kills the browser path absolutely — including
      //    the old automatic fallback.
      // 'pending' blocks delivery for the first rpc round so boot can
      // never race the host into a double push.
      const browserOsActive = () =>
        hostOsState !== 'pending'
        && channels.osBrowser !== false
        && !hostOsUsable()
        && browserNotifyPermitted()
      const osVia = () => {
        if (hostOsState === 'pending') return 'pending'
        if (hostOsUsable()) return 'host'
        return browserOsActive() ? 'browser' : 'off'
      }
      const setHostOsEnabled = (next) => {
        if (hostOsState !== 'ok' || hostOs === null || hostOs.locked === true) return
        hostOs.os.enabled = next // optimistic; reconciled by the answer
        emit()
        try {
          ctx.connection.rpc.call('/api', 'taskNotify/setSettings', { args: { os: { enabled: next } } })
            .then((answered) => {
              const v = answered && answered.ok === true ? answered.value : null
              if (v !== null && typeof v === 'object' && v.os !== null && typeof v.os === 'object') hostOs = v
              emit()
            })
            .catch(() => { emit() })
        } catch (e) { /* optimistic value stands */ }
      }
      const osTest = { ok: null, why: '', at: 0 }
      const testOs = () => {
        osTest.at = Date.now()
        osTest.ok = null
        try {
          ctx.connection.rpc.call('/api', 'taskNotify/testOs', { args: {} })
            .then((answered) => {
              const v = answered && answered.ok === true ? answered.value : null
              if (v !== null && typeof v === 'object' && typeof v.ok === 'boolean') {
                osTest.ok = v.ok
                osTest.why = v.ok === true ? '' : (typeof v.error === 'string' ? v.error : 'unknown')
              } else { osTest.ok = false; osTest.why = 'bad-envelope' }
              emit()
            })
            .catch((e) => { osTest.ok = false; osTest.why = e instanceof Error ? e.message : String(e); emit() })
        } catch (e) { osTest.ok = false; osTest.why = 'rpc' }
      }

      // ── audio (v0.3.0 rework) ──
      // Lazy context; created ONLY when chimes are enabled. A suspended
      // context is resumed in user-gesture contexts only (bell click, test
      // button); poll-driven playback never retries — it records the block
      // once through audioDiag.
      let audioCtx = null
      let audioDiag = '' // '', 'no-audio', 'suspended'
      const ensureAudio = (allowResume) => {
        if (audioCfg.enabled !== true) return null
        try {
          if (audioCtx === null) {
            if (typeof AudioContext !== 'undefined') audioCtx = new AudioContext()
            else if (typeof window !== 'undefined' && typeof window.webkitAudioContext === 'function') audioCtx = new window.webkitAudioContext()
            if (audioCtx === null) { if (audioDiag !== 'no-audio') audioDiag = 'no-audio'; return null }
          }
          if (audioCtx.state === 'suspended') {
            if (allowResume === true) { audioDiag = ''; audioCtx.resume().catch(() => { audioDiag = 'suspended' }) }
            else { if (audioDiag !== 'suspended') audioDiag = 'suspended'; return null }
          }
          return audioCtx
        } catch (e) { return null }
      }

      const playNote = (a, note) => {
        // Unified gain coefficient — the ONLY place base × userVolume meets
        // the graph. exponentialRamp needs a positive target, so silence is
        // approximated by the 0.0001 floor (computed gain stays exactly 0).
        const g = Math.max(effectiveGain(note.g, audioCfg.volume), 0.0001)
        try {
          const osc = a.createOscillator()
          const gain = a.createGain()
          osc.type = note.w
          osc.frequency.value = note.f
          const t0 = a.currentTime + note.s
          gain.gain.setValueAtTime(0.0001, t0)
          gain.gain.exponentialRampToValueAtTime(g, t0 + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.d)
          osc.connect(gain)
          gain.connect(a.destination)
          osc.start(t0)
          osc.stop(t0 + note.d + 0.05)
        } catch (e) { /* ignore one bad note */ }
      }

      const playChime = (kind, outcome) => {
        if (audioCfg.enabled !== true) return
        if (audioCfg.muteWhenHidden === true && pageHidden()) return
        const a = ensureAudio(false)
        if (a === null) return
        const plan = chimePlan(kind, outcome)
        if (plan === null) return
        for (const note of plan.notes) playNote(a, note)
      }

      const previewChime = () => {
        // User-gesture context (button click): may resume a suspended ctx.
        if (audioCfg.enabled !== true) return
        const a = ensureAudio(true)
        if (a === null) return
        const plan = chimePlan('reply', 'ok')
        for (const note of plan.notes) playNote(a, note)
      }

      const osNotify = (item) => {
        lastPush.at = Date.now()
        try {
          if (!canNativeNotify()) { lastPush.ok = false; lastPush.why = 'unsupported'; return }
          if (Notification.permission !== 'granted') { lastPush.ok = false; lastPush.why = 'permission'; return }
          const text = textOf(item)
          const body = (text.body || '').slice(0, 140)
          // silent: true — OUR chime is the sound; the OS default would be
          // a second, harsher beep stacked on top (double-sound bug class).
          const n = new Notification(text.title, { body: body || undefined, tag: 'ntfy-' + item.id, icon: NOTIFY_ICON, silent: true })
          n.onclick = () => { try { window.focus() } catch (e) { /* ignore */ } }
          lastPush.ok = true
          lastPush.why = ''
        } catch (e) { lastPush.ok = false; lastPush.why = e instanceof Error ? e.message : String(e) }
      }

      const ensurePermission = async () => {
        try {
          if (!canNativeNotify()) return 'unsupported'
          if (Notification.permission === 'granted') return 'granted'
          if (Notification.permission === 'denied') return 'denied'
          return await Notification.requestPermission()
        } catch (e) { return 'denied' }
      }

      const sendTest = async () => {
        const perm = await ensurePermission()
        if (perm === 'granted' && canNativeNotify()) {
          try {
            new Notification(t('panelTitle'), { body: t('testNotifyReady'), icon: NOTIFY_ICON, silent: true })
            lastPush.ok = true; lastPush.why = ''
          } catch (e) { lastPush.ok = false; lastPush.why = e instanceof Error ? e.message : String(e) }
        } else {
          lastPush.ok = false; lastPush.why = 'permission'
        }
        lastPush.at = Date.now()
        previewChime()
        reportDiag()
        emit()
      }

      // ── push dedupe ──
      // Ids we already surfaced as OS notifications persist in localStorage so
      // a refresh or a second tab does not re-bomb the user with every
      // historical unread item. Falls back to a session-local set when storage
      // is unavailable (private browsing / embed).
      const PUSHED_KEY = 'dsh-task-notify:pushed'
      const PUSHED_CAP = 500
      let pushed = null
      try {
        if (typeof localStorage !== 'undefined' && localStorage !== null) {
          const raw = localStorage.getItem(PUSHED_KEY)
          if (raw === null) {
            pushed = new Set()
          } else {
            const parsed = JSON.parse(raw)
            pushed = new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [])
          }
        }
      } catch (e) { /* fall back to memory */ }
      if (pushed === null) pushed = new Set()
      const savePushed = () => {
        try {
          if (typeof localStorage === 'undefined' || localStorage === null) return
          localStorage.setItem(PUSHED_KEY, JSON.stringify([...pushed].slice(-PUSHED_CAP)))
        } catch (e) { /* ignore */ }
      }

      const retryLast = async () => {
        const unread = state.items.find((x) => !x.read)
        const item = unread === undefined ? state.items[0] : unread
        if (item === undefined) return
        // v0.8.0: the manual re-send respects the channel switches — it
        // replays through whatever is currently delivering, not blindly.
        if (browserOsActive()) {
          const perm = await ensurePermission()
          if (perm !== 'granted') { lastPush.ok = false; lastPush.why = 'permission'; lastPush.at = Date.now(); emit(); return }
        }
        // Manual re-send counts as surfaced: prevents the poller from
        // auto-pushing the same item again once permission is granted.
        pushed.add(item.id)
        savePushed()
        if (browserOsActive()) osNotify(item)
        if (channels.inApp === true) playChime(item.kind, item.outcome)
        emit()
      }

      // ── toast lifecycle (v0.3.0: hover pause + fade) ──
      const cancelToastTimers = (id) => {
        const entry = toastTimers.get(id)
        if (entry !== undefined) {
          if (typeof entry.dispose === 'function') entry.dispose()
          toastTimers.delete(id)
        }
      }

      const removeToast = (id) => {
        cancelToastTimers(id)
        fading.delete(id)
        ephemeral.delete(id)
        const i = state.toasts.indexOf(id)
        if (i >= 0) { state.toasts.splice(i, 1); emit() }
      }

      // ── ephemeral test/feedback toasts (v0.8.1) ──────────────────────
      // Synthetic toasts for 测试浮层 and switch-on feedback: they never
      // touch the server, the pushed set, or the OS channels — a direct
      // visual demo of the in-page channel. The item rides state.items
      // only until the next poll reconciliation rebuilds it; the toast
      // itself survives via the `ephemeral` fallback lookup and its own
      // 6s timer (ghost-cleanup exempts ephemeral ids).
      const ephemeral = new Map() // id → item
      const pushEphemeralToast = (title, body) => {
        const id = 'ntfy-test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
        const it = { id, kind: 'test', subkind: 'test', label: title || '', detail: body || '', outcome: '', at: Date.now(), read: true, seq: 0 }
        ephemeral.set(id, it)
        state.items = [it, ...state.items.filter((x) => x.id !== id)]
        state.toasts.push(id)
        if (state.toasts.length > 3) state.toasts.shift()
        scheduleToast(id, TOAST_MS)
        emit()
      }
      const testToast = () => pushEphemeralToast(t('testToastTitle'), t('testToastBody'))

      const scheduleToast = (id, delay) => {
        cancelToastTimers(id)
        const entry = { dispose: null, startedAt: Date.now(), duration: delay, remaining: delay, paused: false }
        entry.dispose = ctx.timeout(() => {
          toastTimers.delete(id)
          // Last half second: fade, then remove (reduced-motion skips the
          // visual transition; the timer path is identical).
          fading.add(id)
          emit()
          entry.dispose = ctx.timeout(() => { removeToast(id) }, FADE_MS)
          entry.startedAt = Date.now()
          entry.duration = FADE_MS
          entry.remaining = FADE_MS
          toastTimers.set(id, entry)
        }, delay)
        toastTimers.set(id, entry)
      }

      const pauseToast = (id) => {
        const entry = toastTimers.get(id)
        if (entry === undefined || entry.paused === true) return
        const elapsed = Date.now() - entry.startedAt
        entry.remaining = Math.max(0, entry.duration - elapsed)
        entry.paused = true
        if (typeof entry.dispose === 'function') entry.dispose()
        entry.dispose = null
      }

      const resumeToast = (id) => {
        const entry = toastTimers.get(id)
        if (entry === undefined || entry.paused !== true) return
        if (entry.remaining <= 0) { removeToast(id); return }
        scheduleToast(id, entry.remaining)
      }

      const dismissToast = (id) => removeToast(id)

      // ── store operations ──
      // Budget: at most 3 surfaced arrivals per poll round, so a burst of
      // unpushed items (fresh storage, new tab) trickles in instead of
      // firing one banner per item. Callers pass candidates NEWEST-FIRST
      // (the full snapshot order; deltas are sorted here). Returns true if
      // anything was reacted to (→ caller emits).
      // v0.6.0 channel split: the OS banner (host-direct, or the browser
      // Notification fallback when the host cannot deliver) and the in-app
      // toast+chime are independently switchable and never imply each
      // other. The pushed set now marks the ARRIVAL reacted-to even with
      // every channel off, so flipping a switch on later never replays
      // the backlog as a burst.
      const surfaceNew = (candidates) => {
        const list = [...candidates].sort((a, b) => (b.at || 0) - (a.at || 0))
        let budget = 3
        let reacted = false
        for (const item of list) {
          if (budget <= 0) break
          if (item.read || pushed.has(item.id)) continue
          pushed.add(item.id)
          reacted = true
          budget--
          if (browserOsActive()) osNotify(item)
          if (channels.inApp === true) {
            playChime(item.kind, item.outcome)
            state.toasts.push(item.id)
            if (state.toasts.length > 3) state.toasts.shift()
            scheduleToast(item.id, TOAST_MS)
          }
        }
        if (reacted) savePushed()
        return reacted
      }

      const ingestFull = (list) => {
        if (!Array.isArray(list)) return
        // The host snapshot is the source of truth: rebuild in its order
        // (newest first) and drop ghosts that no longer exist server-side
        // (purged from another tab, host restart, host prune).
        const next = list.filter((x) => x && typeof x.id === 'string').slice(0, 300)
        if (next.length > 0) seenNonEmpty = true
        const prev = state.items
        let changed = false
        if (prev.length !== next.length) {
          changed = true
        } else {
          for (let i = 0; i < next.length; i++) {
            const a = prev[i]
            const b = next[i]
            if (a === undefined || a.id !== b.id || a.read !== b.read || a.at !== b.at) { changed = true; break }
          }
        }
        state.items = next
        const alive = new Set(next.map((x) => x.id))
        // Ephemeral (test/feedback) toasts are exempt from ghost-cleanup:
        // they are not on the server and live out their own 6s timer.
        if (state.toasts.some((id) => !alive.has(id) && !ephemeral.has(id))) {
          for (const id of [...state.toasts]) if (!alive.has(id) && !ephemeral.has(id)) removeToast(id)
          changed = true
        }
        const pushedNow = surfaceNew(next)
        if (changed || pushedNow) emit()
      }

      // v0.5.0: merge an incremental delta (records changed after our
      // cursor, seq-asc). A re-sent record (e.g. acked in ANOTHER tab)
      // updates in place — it must never re-toast or re-push. Only
      // genuinely NEW ids go through the OS-push budget path.
      const ingestDelta = (items) => {
        if (!Array.isArray(items) || items.length === 0) return false
        const byId = new Map(state.items.map((x) => [x.id, x]))
        const fresh = []
        let changed = false
        for (const it of items) {
          if (it === null || typeof it !== 'object' || typeof it.id !== 'string') continue
          const prev = byId.get(it.id)
          if (prev === undefined) {
            byId.set(it.id, it)
            fresh.push(it)
            changed = true
          } else if (prev.read !== (it.read === true) || prev.at !== it.at) {
            byId.set(it.id, it)
            changed = true
          }
          // identical re-send (seq bumped, nothing visible) → no-op
        }
        if (changed !== true) return false
        if (fresh.length > 0) seenNonEmpty = true
        state.items = [...byId.values()].sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 300)
        surfaceNew(fresh)
        emit()
        return true
      }

      const ack = async (id) => {
        const item = state.items.find((x) => x.id === id)
        if (item !== undefined && !item.read) { item.read = true; emit() }
        try { await ctx.connection.rpc.call('/api', 'taskNotify/ack', { args: { id } }) } catch (e) { /* ignore */ }
      }

      const clearAll = async () => {
        let changed = false
        for (const item of state.items) if (!item.read) { item.read = true; changed = true }
        if (changed) emit()
        try { await ctx.connection.rpc.call('/api', 'taskNotify/clear', { args: {} }) } catch (e) { /* ignore */ }
      }

      let purgeResetDispose = null
      const purgeAll = async () => {
        state.items = []
        state.toasts = []
        state.purgeArm = false
        for (const id of [...toastTimers.keys()]) cancelToastTimers(id)
        fading.clear()
        emit()
        try { await ctx.connection.rpc.call('/api', 'taskNotify/purge', { args: {} }) } catch (e) { /* ignore */ }
      }

      const onPurgeClick = () => {
        if (state.purgeArm === true) {
          if (purgeResetDispose !== null) { purgeResetDispose(); purgeResetDispose = null }
          purgeAll()
          return
        }
        state.purgeArm = true
        emit()
        // 3s without a second click disarms.
        if (purgeResetDispose !== null) purgeResetDispose()
        purgeResetDispose = ctx.timeout(() => { state.purgeArm = false; purgeResetDispose = null; emit() }, 3000)
      }

      const useStore = () => {
        const [, force] = React.useState(0)
        React.useEffect(() => subscribe(() => force((x) => x + 1)), [])
        return state
      }

      // ── panel anchoring (v0.3.0) ──
      const PANEL_W = 340
      const findBellEl = () => {
        try {
          if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return null
          return document.querySelector('.ntfy-bell')
        } catch (e) { return null }
      }
      const anchorPanel = () => {
        const w = typeof window !== 'undefined' && typeof window.innerWidth === 'number' ? window.innerWidth : 1280
        const h = typeof window !== 'undefined' && typeof window.innerHeight === 'number' ? window.innerHeight : 800
        const bell = findBellEl()
        const rect = bell !== null && typeof bell.getBoundingClientRect === 'function' ? bell.getBoundingClientRect() : null
        state.panelPos = computePanelPos(rect, w, h, PANEL_W)
        return state.panelPos
      }

      // ── components ──
      const BellIcon = () => React.createElement('svg', { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' },
        React.createElement('path', { d: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9' }),
        React.createElement('path', { d: 'M13.73 21a2 2 0 0 1-3.46 0' }))

      const KindIcon = ({ kind }) => {
        const props = { viewBox: '0 0 24 24', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flex: 'none', marginTop: 1 } }
        if (kind === 'approval') return React.createElement('svg', props,
          React.createElement('path', { d: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' }),
          React.createElement('line', { x1: '12', y1: '9', x2: '12', y2: '13' }),
          React.createElement('line', { x1: '12', y1: '17', x2: '12.01', y2: '17' }))
        if (kind === 'reply') return React.createElement('svg', props,
          React.createElement('path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' }))
        return React.createElement('svg', props,
          React.createElement('path', { d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' }),
          React.createElement('polyline', { points: '22 4 12 14.01 9 11.01' }))
      }

      // ── v0.7.0 panel redesign: channel card icons ──
      const BrowserIcon = ({ size }) => {
        const p = { viewBox: '0 0 24 24', width: size || 16, height: size || 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
        return React.createElement('svg', p,
          React.createElement('rect', { x: 3, y: 4, width: 18, height: 16, rx: 3 }),
          React.createElement('path', { d: 'M3 9h18' }),
          React.createElement('circle', { cx: 6.5, cy: 6.5, r: 0.6, fill: 'currentColor', stroke: 'none' }),
          React.createElement('circle', { cx: 9.5, cy: 6.5, r: 0.6, fill: 'currentColor', stroke: 'none' }))
      }
      const MonitorIcon = ({ size }) => {
        const p = { viewBox: '0 0 24 24', width: size || 16, height: size || 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
        return React.createElement('svg', p,
          React.createElement('rect', { x: 2.5, y: 4, width: 19, height: 13, rx: 2.5 }),
          React.createElement('path', { d: 'M12 17v3' }),
          React.createElement('path', { d: 'M8 20.5h8' }),
          React.createElement('path', { d: 'M17.5 8.5a2.5 2.5 0 1 0-5 0c0 2.5-1.5 3.5-1.5 3.5h8s-1.5-1-1.5-3.5' }))
      }
      // v0.8.0: browser window + filled notification badge — the browser's
      // own Notification-API channel (the page ASKING the OS for a banner).
      const WebNotifyIcon = ({ size }) => {
        const p = { viewBox: '0 0 24 24', width: size || 16, height: size || 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
        return React.createElement('svg', p,
          React.createElement('rect', { x: 3, y: 4, width: 18, height: 16, rx: 3 }),
          React.createElement('path', { d: 'M3 9h18' }),
          React.createElement('circle', { cx: 6.5, cy: 6.5, r: 0.6, fill: 'currentColor', stroke: 'none' }),
          React.createElement('circle', { cx: 9.5, cy: 6.5, r: 0.6, fill: 'currentColor', stroke: 'none' }),
          React.createElement('circle', { cx: 16.5, cy: 14.5, r: 2.6, fill: 'currentColor', stroke: 'none' }))
      }

      // v0.7.0: one styled status dot for the health strip and section chips.
      const StatusDot = ({ tone }) =>
        React.createElement('span', { className: 'ntfy-status-dot ntfy-status-' + tone, 'aria-hidden': 'true' })

      const Bell = ({ wide }) => {
        const s = useStore()
        const unread = s.items.reduce((n, x) => n + (x.read ? 0 : 1), 0)
        const onClick = () => {
          s.open = !s.open
          if (s.open) {
            anchorPanel()
            ensureAudio(true) // user gesture: legal resume point
          }
          emit()
          ensurePermission().then(reportDiag)
        }
        return React.createElement('button', {
          className: 'ntfy-bell' + (s.open ? ' ntfy-bell-on' : ''),
          'data-ntfy-theme': themeAttr(),
          onClick, title: t('bellLabel'), 'aria-label': t('bellLabel'), type: 'button',
        },
          React.createElement(BellIcon, null),
          wide ? React.createElement('span', { className: 'ntfy-bell-label' }, t('bellLabel')) : null,
          unread > 0 ? React.createElement('span', { className: 'ntfy-bell-badge' }, unread > 99 ? '99+' : String(unread)) : null)
      }

      const Toast = ({ item }) => {
        const text = textOf(item)
        const failed = item.kind === 'task-end' && item.outcome === 'failed'
        const done = item.kind === 'task-end' && item.outcome !== 'failed' && item.outcome !== 'killed'
        const mark = failed ? '✕ ' : done ? '✓ ' : ''
        const onClick = () => {
          dismissToast(item.id)
          state.open = true
          emit()
          ack(item.id)
        }
        return React.createElement('div', {
          className: 'ntfy-toast' + (fading.has(item.id) ? ' ntfy-toast-out' : ''),
          onClick, role: failed ? 'alert' : 'status',
          onMouseEnter: () => { pauseToast(item.id) },
          onMouseLeave: () => { resumeToast(item.id) },
        },
          // v0.3.1: tinted icon chip (kind color = icon color + 12% tint bg).
          React.createElement('span', { className: 'ntfy-toast-icon ' + kindClass(item), 'aria-hidden': 'true' },
            React.createElement(KindIcon, { kind: item.kind })),
          React.createElement('div', { style: { minWidth: 0, flex: 1 } },
            React.createElement('div', { className: 'ntfy-toast-title' }, mark + text.title),
            text.body ? React.createElement('div', { className: 'ntfy-toast-body' }, text.body) : null),
          React.createElement('button', { className: 'ntfy-toast-x', type: 'button', 'aria-label': t('close'), onClick: (e) => { e.stopPropagation(); dismissToast(item.id) } }, '✕'))
      }

      const Item = ({ item }) => {
        const text = textOf(item)
        const onClick = () => { ack(item.id); state.open = false; emit() }
        return React.createElement('div', { className: 'ntfy-item' + (item.read ? ' ntfy-item-read' : ''), onClick },
          item.read ? null : React.createElement('span', { className: 'ntfy-item-dot', 'aria-hidden': 'true' }),
          React.createElement(KindIcon, { kind: item.kind }),
          React.createElement('div', { style: { minWidth: 0, flex: 1 } },
            React.createElement('div', { className: 'ntfy-item-title' }, text.title),
            text.body ? React.createElement('div', { className: 'ntfy-item-body' }, text.body) : null),
          React.createElement('span', { className: 'ntfy-item-time' }, relTime(item.at)))
      }

      const EmptyState = () => {
        if (seenNonEmpty) {
          return React.createElement('div', { className: 'ntfy-empty', 'data-ntfy-empty': 'cleared' }, t('emptyCleared'))
        }
        return React.createElement('div', { className: 'ntfy-empty ntfy-empty-first', 'data-ntfy-empty': 'first' },
          React.createElement(BellIcon, null),
          React.createElement('div', { className: 'ntfy-empty-title' }, t('emptyFirstTitle')),
          React.createElement('div', { className: 'ntfy-empty-desc' }, t('emptyFirstDesc')),
          React.createElement('button', { className: 'ntfy-panel-test', type: 'button', 'data-ntfy-empty-test': true, onClick: testToast }, t('testNotify')))
      }

      const DiagBlock = () => {
        // Summary: one line, highest-need-first. v0.8.0 tri-channel: the
        // ACTIVE OS path leads (host-direct, then browser), then the
        // per-channel off/unpermissioned states, then legacy permission
        // states. Push errors keep their slot after the path states.
        const osWantedButUngranted = () =>
          channels.osBrowser !== false && canNativeNotify() && Notification.permission !== 'granted'
        let summary
        if (osVia() === 'host') summary = t('diagOnHost')
        else if (osVia() === 'browser') summary = t('diagOnBrowser')
        else if (lastPush.ok === false) summary = tfmt('diagErr', { why: lastPush.why || '?' })
        else if (osWantedButUngranted()) summary = t('diagOff')
        else if (osVia() === 'off') summary = t('diagOsOff')
        else summary = t('diagOn')
        // v0.7.0: the strip gets a colored status dot derived from the
        // same branch that produced the summary.
        const summaryTone =
          osVia() === 'host' || osVia() === 'browser' ? 'ok'
            : lastPush.ok === false ? 'err'
            : osWantedButUngranted() ? 'warn'
            : osVia() === 'off' ? 'off' : 'ok'
        const head = React.createElement('div', { className: 'ntfy-diag', role: 'note' },
          StatusDot({ tone: summaryTone }),
          React.createElement('span', { className: 'ntfy-diag-summary', 'data-ntfy-diag-summary': true }, summary),
          React.createElement('button', {
            className: 'ntfy-diag-toggle', type: 'button', 'data-ntfy-diag-toggle': true,
            'aria-expanded': String(state.diagOpen === true), 'aria-label': t('diagToggle'),
            onClick: () => { state.diagOpen = !state.diagOpen; emit(); if (state.diagOpen === true) { reportDiag(); fetchHostSettings() } },
          }, state.diagOpen === true ? '▾' : '▸'))
        if (state.diagOpen !== true) return head

        const mountTxt = mountState.ok === null ? '?' : mountState.ok === true ? t('mountOk') : t('mountFail') + ': ' + mountState.why
        const pollTxt = lastPoll.ok === null ? '?' : lastPoll.ok === true ? t('pollOk') + ' (' + String(lastPoll.count) + ')' : t('pollFail') + ': ' + lastPoll.why
        const pushTxt = lastPush.ok === null
          ? (canNativeNotify() ? String(Notification.permission) : 'unsupported')
          : lastPush.ok === true ? t('pushOk') : lastPush.why === 'permission' ? t('pushSkip') : t('pushErr') + ': ' + lastPush.why
        const atTxt = lastPush.at > 0 ? t('lastPushAt') + ': ' + relTime(lastPush.at) : ''
        const audioPct = String(Math.round(audioCfg.volume * 100)) + '%'

        // ── v0.7.0 channel cards (v0.8.0: three of them) ──
        const via = osVia()
        const hostDelivering = hostOsUsable()
        const osDesc = hostDelivering ? t('chOsHint')
          : (hostOsState === 'ok' && hostOs !== null && hostOs.os.enabled !== true ? t('chOsDescOff') : t('chOsDescHost'))
        const osPlatform = hostOsState === 'ok' && hostOs !== null && hostOs.adapter !== null && typeof hostOs.adapter === 'object' && typeof hostOs.adapter.platform === 'string' && hostOs.adapter.platform !== '' ? hostOs.adapter.platform : ''
        const inAppMuted = channels.inApp !== true
        const osMuted = hostOsState === 'ok' && hostOs !== null && hostOs.os.enabled !== true
        const osTestResult = osTest.ok === null ? '' : t('osTestLine') + ': ' + (osTest.ok === true ? t('osTestOk') : t('osTestFail') + (osTest.why ? ' — ' + osTest.why : ''))

        const channelCard = (opts) => React.createElement('div', { className: 'ntfy-chcard' + (opts.muted === true ? ' ntfy-chcard-muted' : '') },
          React.createElement('span', { className: 'ntfy-chcard-icon' + (opts.muted === true ? ' muted' : '') }, opts.icon),
          React.createElement('div', { className: 'ntfy-chcard-text' },
            React.createElement('div', { className: 'ntfy-chcard-title' },
              opts.title,
              opts.chipNode !== undefined ? opts.chipNode
                : React.createElement('span', { className: 'ntfy-chip ' + (opts.muted === true ? 'ntfy-chip-off' : 'ntfy-chip-on') }, opts.muted === true ? t('chipOff') : t('chipLive')),
              opts.chip !== undefined && opts.chip !== '' ? React.createElement('span', { className: 'ntfy-chip ntfy-chip-soft' }, opts.chip) : null),
            React.createElement('div', { className: 'ntfy-chcard-desc' }, opts.desc)),
          opts.switchNode,
          opts.footer || null)

        const inAppCard = channelCard({
          icon: React.createElement(BrowserIcon, null),
          title: t('chInApp'),
          desc: t('chInAppDesc') + (inAppMuted ? '' : (audioCfg.enabled !== true ? ' · ' + t('chipMuted') : '')),
          chip: '',
          muted: inAppMuted,
          switchNode: React.createElement('button', {
            className: 'ntfy-switch' + (channels.inApp === true ? ' ntfy-switch-on' : ''), type: 'button', role: 'switch',
            'aria-checked': String(channels.inApp === true), 'aria-label': t('chInApp'), 'data-ntfy-inapp': true,
            onClick: () => {
              channels.inApp = channels.inApp !== true
              saveChannelsCfg()
              // v0.8.1: instant feedback — turning the channel ON demos
              // itself with one ephemeral toast (the exact pain point:
              // "did the switch do anything?").
              if (channels.inApp === true) pushEphemeralToast(t('chInApp'), t('chInAppOnFeedback'))
              emit()
            },
          }, React.createElement('span', { className: 'ntfy-switch-knob' })),
          footer: React.createElement('div', { className: 'ntfy-chcard-foot' },
            React.createElement('button', { className: 'ntfy-panel-test', type: 'button', 'data-ntfy-audio-preview': true, onClick: previewChime }, t('audioPreview')),
            React.createElement('button', { className: 'ntfy-panel-test', type: 'button', 'data-ntfy-test-toast': true, onClick: testToast }, t('testToastBtn'))),
        })

        // ── v0.8.0 card B: the browser's own Notification-API channel ──
        // States: delivering (host cannot) · standby (host delivering —
        // never double banners) · not-granted (wanted, permission missing)
        // · off (switch killed, including the old automatic fallback).
        const osBrowserMuted = channels.osBrowser === false
        const osBrowserDelivering = browserOsActive()
        const osBrowserStandby = channels.osBrowser !== false && hostDelivering
        const osBrowserUngranted = channels.osBrowser !== false && !hostDelivering && hostOsState !== 'pending' && !browserNotifyPermitted()
        const osBrowserDesc = osBrowserStandby ? t('chOsBrowserStandby')
          : osBrowserDelivering ? t('chOsBrowserActive')
          : osBrowserUngranted ? t('permHint')
          : t('chOsBrowserActive')
        const osBrowserChipNode = osBrowserMuted ? undefined
          : osBrowserStandby ? React.createElement('span', { className: 'ntfy-chip ntfy-chip-standby' }, t('chipStandby'))
          : osBrowserUngranted ? React.createElement('span', { className: 'ntfy-chip ntfy-chip-warn' }, t('chipNoPerm'))
          : undefined

        const osBrowserCard = channelCard({
          icon: React.createElement(WebNotifyIcon, null),
          title: t('chOsBrowser'),
          desc: osBrowserDesc,
          chipNode: osBrowserChipNode,
          muted: osBrowserMuted,
          switchNode: React.createElement('button', {
            className: 'ntfy-switch' + (channels.osBrowser !== false ? ' ntfy-switch-on' : ''), type: 'button', role: 'switch',
            'aria-checked': String(channels.osBrowser !== false), 'aria-label': t('chOsBrowser'), 'data-ntfy-osbrowser': true,
            title: t('chOsBrowserHint'),
            onClick: () => { channels.osBrowser = channels.osBrowser !== true; saveChannelsCfg(); emit() },
          }, React.createElement('span', { className: 'ntfy-switch-knob' })),
          // v0.8.1: the browser-banner test lives on ITS channel's card —
          // it requests permission (user gesture) and raises one banner.
          footer: React.createElement('div', { className: 'ntfy-chcard-foot' },
            React.createElement('button', { className: 'ntfy-panel-test', type: 'button', 'data-ntfy-test': true, onClick: sendTest }, t('testOsBrowserBtn')),
            React.createElement('span', { className: 'ntfy-os-test-result' })),
        })

        const osSwitchNode = hostOsState === 'ok' && hostOs !== null
          ? React.createElement('button', {
              className: 'ntfy-switch' + (hostOs.os.enabled === true ? ' ntfy-switch-on' : ''), type: 'button', role: 'switch',
              'aria-checked': String(hostOs.os.enabled === true), 'aria-label': t('chOs'), 'data-ntfy-os': true,
              disabled: hostOs.locked === true ? true : undefined,
              title: hostOs.locked === true ? t('chOsLocked') : undefined,
              onClick: () => { setHostOsEnabled(hostOs.os.enabled !== true) },
            }, React.createElement('span', { className: 'ntfy-switch-knob' }))
          : React.createElement('span', { className: 'ntfy-os-state', 'data-ntfy-os-state': hostOsState }, hostOsState === 'legacy' ? t('chOsLegacy') : t('chOsPending'))

        const osCard = channelCard({
          icon: React.createElement(MonitorIcon, null),
          title: t('chOs'),
          desc: osDesc,
          chip: osPlatform,
          muted: osMuted,
          switchNode: osSwitchNode,
          footer: React.createElement('div', { className: 'ntfy-chcard-foot' },
            React.createElement('button', { className: 'ntfy-panel-test', type: 'button', 'data-ntfy-test-os': true, onClick: testOs }, t('testOsBtn')),
            React.createElement('span', { className: 'ntfy-os-test-result', 'data-ntfy-os-test': true }, osTestResult)),
        })

        return React.createElement('div', { className: 'ntfy-diag-full' },
          head,
          React.createElement('div', { className: 'ntfy-body' },
            // ── channels ──
            React.createElement('section', { className: 'ntfy-sec' },
              React.createElement('div', { className: 'ntfy-sec-title' }, t('chSection')),
              React.createElement('div', { className: 'ntfy-chgrid', 'data-ntfy-channels': true }, inAppCard, osBrowserCard, osCard)),
            // ── appearance & chimes ──
            React.createElement('section', { className: 'ntfy-sec' },
              React.createElement('div', { className: 'ntfy-sec-title' }, t('secPrefs')),
              React.createElement('div', { className: 'ntfy-prefs', 'data-ntfy-audio': true },
                React.createElement('div', { className: 'ntfy-pref-row ntfy-pref-col' },
                  React.createElement('span', null, t('themeLabel')),
                  React.createElement('div', { className: 'ntfy-seg', 'data-ntfy-seg': true },
                    ['auto', 'light', 'dark'].map(function (id) {
                      return React.createElement('button', {
                        key: id, type: 'button',
                        className: theme === id ? 'ntfy-seg-btn ntfy-seg-btn-on' : 'ntfy-seg-btn',
                        'data-ntfy-theme-choice': id, 'aria-pressed': String(theme === id),
                        onClick: function () { setTheme(id) },
                      }, t('theme.' + id))
                    }))),
                React.createElement('div', { className: 'ntfy-pref-row' },
                  React.createElement('span', null, t('audioEnabled')),
                  React.createElement('button', {
                    className: 'ntfy-switch' + (audioCfg.enabled === true ? ' ntfy-switch-on' : ''), type: 'button', role: 'switch',
                    'aria-checked': String(audioCfg.enabled === true), 'aria-label': t('audioEnabled'), 'data-ntfy-audio-enabled': true,
                    onClick: () => { audioCfg.enabled = audioCfg.enabled !== true; saveAudioCfg(); emit() },
                  }, React.createElement('span', { className: 'ntfy-switch-knob' }))),
                React.createElement('div', { className: 'ntfy-pref-row ntfy-pref-col' + (audioCfg.enabled === true ? '' : ' ntfy-pref-off') },
                  React.createElement('span', null, t('audioVolume') + ' · ' + audioPct),
                  React.createElement('input', {
                    type: 'range', min: 0, max: 1, step: 0.05, value: audioCfg.volume, className: 'ntfy-range',
                    'data-ntfy-audio-volume': true, 'aria-label': t('audioVolume'),
                    onChange: (e) => { audioCfg.volume = clampVolume(e.target.value); saveAudioCfg(); emit() },
                  })),
                React.createElement('label', { className: 'ntfy-pref-row ntfy-pref-check' + (audioCfg.enabled === true ? '' : ' ntfy-pref-off') },
                  React.createElement('input', {
                    type: 'checkbox', checked: audioCfg.muteWhenHidden === true,
                    'data-ntfy-audio-mute-hidden': true, 'aria-label': t('audioMuteHidden'),
                    onChange: (e) => { audioCfg.muteWhenHidden = e.target.checked === true; saveAudioCfg(); emit() },
                  }),
                  React.createElement('span', null, t('audioMuteHidden'))))),
            // ── actions ──
            React.createElement('section', { className: 'ntfy-sec' },
              React.createElement('div', { className: 'ntfy-sec-title' }, t('secTools')),
              React.createElement('div', { className: 'ntfy-tools' },
                React.createElement('button', { className: 'ntfy-panel-test', type: 'button', 'data-ntfy-retry': true, onClick: retryLast }, t('retry')),
                React.createElement('span', { className: 'ntfy-tools-spacer' }),
                React.createElement('button', {
                  className: 'ntfy-panel-purge' + (state.purgeArm === true ? ' ntfy-purge-armed' : ''), type: 'button',
                  'data-ntfy-purge': true, 'data-armed': String(state.purgeArm === true),
                  onClick: onPurgeClick,
                }, state.purgeArm === true ? t('purgeConfirm') : t('purgeBtn')))),
            // ── raw diagnostics (sub-folded) ──
            React.createElement('section', { className: 'ntfy-sec ntfy-sec-diag' },
              React.createElement('button', {
                className: 'ntfy-sec-title ntfy-sec-toggle', type: 'button',
                'aria-expanded': String(state.diagDetailOpen === true),
                onClick: () => { state.diagDetailOpen = state.diagDetailOpen !== true; emit(); if (state.diagDetailOpen === true) reportDiag() },
              }, t('secDiag'), React.createElement('span', { className: 'ntfy-sec-caret' }, state.diagDetailOpen === true ? '▾' : '▸')),
              state.diagDetailOpen === true
                ? React.createElement('div', { className: 'ntfy-diag-detail', 'data-ntfy-diag-detail': true },
                    React.createElement('div', { className: 'ntfy-diag-line' }, t('diagLabel') + ': ' + pushTxt + (atTxt ? ' · ' + atTxt : '')),
                    React.createElement('div', { className: 'ntfy-diag-line', 'data-ntfy-poll-line': true },
                      t('mountLabel') + ': ' + mountTxt + ' · ' + t('pollLabel') + ': ' + pollTxt
                      + (lastPoll.fails >= 5 ? ' · ' + t('rpcFails') + ' ×' + String(lastPoll.fails) : '')),
                    React.createElement('div', { className: 'ntfy-diag-line', 'data-ntfy-persist': hostPersist === '' ? 'unknown' : hostPersist },
                      t('persistLabel') + ': ' + (hostPersist === '' ? '?' : t('persist.' + hostPersist))),
                    React.createElement('div', { className: 'ntfy-diag-line', 'data-ntfy-osvia-line': true },
                      t('chOs') + ': ' + via + (hostOsState === 'ok' && hostOs.settingsStatus === 'disabled' ? ' · ' + t('persist.disabled') : '')),
                    React.createElement('div', { className: 'ntfy-diag-line' }, t('audioSection') + ': ' + (audioCfg.enabled === true ? audioDiag : t('audioSection') + ' ✕')))
                : null)))
      }

      const Panel = () => {
        const s = useStore()
        React.useEffect(() => {
          if (s.open !== true) return undefined
          // While open: re-anchor on resize; close on outside pointerdown.
          const onResize = () => { anchorPanel(); emit() }
          const onDown = (ev) => {
            const target = ev && ev.target
            if (target !== null && target !== undefined && typeof target.closest === 'function') {
              if (target.closest('.ntfy-panel, .ntfy-bell, .ntfy-toasts')) return
            }
            state.open = false
            emit()
          }
          try {
            window.addEventListener('resize', onResize)
            document.addEventListener('pointerdown', onDown)
          } catch (e) { /* ignore */ }
          return () => {
            try {
              window.removeEventListener('resize', onResize)
              document.removeEventListener('pointerdown', onDown)
            } catch (e) { /* ignore */ }
          }
        }, [])
        if (!s.open) return null
        const unread = s.items.reduce((n, x) => n + (x.read ? 0 : 1), 0)
        // v0.8.0: the grant hint matters only when the BROWSER system-
        // notification channel is in play: its switch is on, the host is
        // not delivering (or unknown-but-settled), and the permission is
        // missing. Host-direct delivery or a deliberately killed browser
        // channel must never nag about a grant the page doesn't need.
        const permOff = channels.osBrowser !== false
          && canNativeNotify() && Notification.permission !== 'granted'
          && hostOsUsable() !== true
          && hostOsState !== 'pending'
        const pos = s.panelPos !== null ? s.panelPos : anchorPanel()
        const posStyle = pos === null ? {} : pos.mobile === true
          ? { left: '12px', right: '12px', bottom: '12px', width: 'auto', maxHeight: (typeof pos.maxHeight === 'number' ? pos.maxHeight : 480) + 'px' }
          : { left: pos.left + 'px', bottom: pos.bottom + 'px', maxHeight: 'min(65vh, 560px)' }
        return React.createElement('div', { className: 'ntfy-panel', role: 'dialog', 'aria-label': t('panelTitle'), style: posStyle, 'data-ntfy-theme': themeAttr() },
          React.createElement('div', { className: 'ntfy-panel-head' },
            React.createElement('span', { className: 'ntfy-panel-title' }, t('panelTitle') + (unread > 0 ? ' (' + String(unread) + ')' : '')),
            React.createElement('div', { className: 'ntfy-panel-actions' },
              unread > 0 ? React.createElement('button', { className: 'ntfy-panel-clear', type: 'button', onClick: clearAll }, t('markAllRead')) : null)),
          React.createElement(DiagBlock, null),
          permOff ? React.createElement('div', { className: 'ntfy-perm-hint', role: 'note' }, t('permHint')) : null,
          s.items.length === 0
            ? React.createElement(EmptyState, null)
            : React.createElement('div', { className: 'ntfy-list' }, s.items.map((item) => React.createElement(Item, { key: item.id, item }))))
      }

      const Toasts = () => {
        const s = useStore()
        if (s.toasts.length === 0) return null
        return React.createElement('div', { className: 'ntfy-toasts', 'data-ntfy-theme': themeAttr() },
          s.toasts.map((id) => {
            // Ephemeral (test/feedback) toasts outlive the items rebuild.
            const item = s.items.find((x) => x.id === id) || ephemeral.get(id)
            return item === undefined ? null : React.createElement(Toast, { key: id, item })
          }))
      }

      const lastPoll = { ok: null, why: '', count: 0, at: 0, fails: 0 }
      const pageHidden = () => {
        try { return typeof document !== 'undefined' && document.visibilityState === 'hidden' } catch (e) { return false }
      }
      // v0.5.0: incremental polling with an idle backoff ladder. The poll
      // timer is a self-rescheduling ctx.timeout chain (NOT a fixed interval)
      // so the delay can step 1.5s → 2.5s → 4s → 5s (cap) as rounds come
      // back empty, and snap back to 1.5s on any new record or on returning
      // to the foreground. RPC failures keep the CURRENT delay — the poller
      // never backs off into silence — and 5 consecutive failures surface in
      // the diagnostics drawer.
      const POLL_LADDER = [1500, 2500, 4000, 5000]
      let pollIdle = 0
      let pollDelay = POLL_LADDER[0] // the delay currently in force
      let legacyFullPoll = false // pre-0.5 host (no pullSince) → full pull()
      let pollerArmed = false    // effect-once guard (real React: [] deps)
      const Poller = () => {
        React.useEffect(() => {
          if (pollerArmed) return undefined
          pollerArmed = true
          let alive = true
          let timer = null
          let inFlight = false
          // Delay semantics: an empty round steps the ladder; a round with
          // records snaps back to base; failures and hidden skips HOLD the
          // delay currently in force (never back off into silence, never
          // re-shorten mid-outage).
          const arm = () => { timer = ctx.timeout(() => { tick() }, pollDelay) }
          // Apply a successful round; returns true if it carried records.
          const applyRound = (value) => {
            lastPoll.fails = 0
            lastPoll.ok = true
            lastPoll.why = ''
            lastPoll.at = Date.now()
            lastPoll.count = Array.isArray(value.items) ? value.items.length : 0
            cursor = typeof value.cursor === 'number' ? value.cursor : cursor
            if (value.reset === true || legacyFullPoll === true) ingestFull(value.items)
            else ingestDelta(value.items)
            return Array.isArray(value.items) && value.items.length > 0
          }
          // Returns true (records arrived), false (empty success) or
          // undefined (failure — ladder untouched, interval held).
          const round = async () => {
            let why = ''
            try {
              if (legacyFullPoll === true) {
                const answered = await ctx.connection.rpc.call('/api', 'taskNotify/pull', { args: {} })
                if (!alive) return undefined
                if (answered && answered.ok === true && Array.isArray(answered.value)) {
                  return applyRound({ items: answered.value, cursor: 0, reset: true })
                }
                why = answered && answered.error ? answered.error.code + ': ' + (answered.error.message || '') : 'bad-envelope'
              } else {
                const answered = await ctx.connection.rpc.call('/api', 'taskNotify/pullSince', { args: { cursor } })
                if (!alive) return undefined
                if (answered && answered.ok === true && answered.value !== null && typeof answered.value === 'object' && Array.isArray(answered.value.items) && typeof answered.value.cursor === 'number') {
                  return applyRound(answered.value)
                }
                why = answered && answered.error ? answered.error.code + ': ' + (answered.error.message || '') : 'bad-envelope'
                // Pre-0.5 host: pullSince is not a registered invocation.
                // Probe the legacy full pull ONCE per session; if it answers,
                // this page degrades to full polling so an F5 that lands
                // before the host restart keeps the bell alive.
                const legacy = await ctx.connection.rpc.call('/api', 'taskNotify/pull', { args: {} }).catch(() => null)
                if (alive && legacy && legacy.ok === true && Array.isArray(legacy.value)) {
                  legacyFullPoll = true
                  return applyRound({ items: legacy.value, cursor: 0, reset: true })
                }
              }
            } catch (e) { why = e instanceof Error ? e.message : String(e) }
            lastPoll.ok = false
            lastPoll.why = why || 'bad-envelope'
            lastPoll.at = Date.now()
            lastPoll.fails++
            return undefined
          }
          const tick = async () => {
            if (!alive || inFlight) return
            inFlight = true
            let had = null
            try {
              if (!pageHidden()) had = await round()
            } finally { inFlight = false }
            if (!alive) return
            if (had === true) {
              pollIdle = 0
              pollDelay = POLL_LADDER[0]
            } else if (had === false) {
              pollDelay = POLL_LADDER[Math.min(pollIdle, POLL_LADDER.length - 1)]
              pollIdle = Math.min(pollIdle + 1, POLL_LADDER.length - 1)
            }
            // had === null: skipped (hidden) or failed → hold pollDelay
            arm()
          }
          tick()
          // Background tabs skip the poll churn; returning to the foreground
          // polls immediately AND resets the ladder instead of waiting out
          // the backed-off delay.
          const onVis = () => {
            if (!alive || pageHidden()) return
            if (timer !== null) { timer(); timer = null }
            pollIdle = 0
            pollDelay = POLL_LADDER[0]
            tick()
          }
          let removeVis = null
          try {
            document.addEventListener('visibilitychange', onVis)
            removeVis = () => document.removeEventListener('visibilitychange', onVis)
          } catch (e) { /* ignore */ }
          return () => { alive = false; if (timer !== null) { timer(); timer = null } if (removeVis !== null) removeVis(); pollerArmed = false }
        }, [])
        return null
      }

      // ── slots ──
      try {
        slots.inject('sidebar.footer.action', () => slots.register(
          { name: 'sidebar.footer.action', id: 'task-notify-bell', order: 30, label: () => t('bellLabel') },
          (props) => React.createElement(Bell, { wide: !!props.wide }),
        ))

        slots.inject('shell.overlay', () => slots.register(
          { name: 'shell.overlay', id: 'task-notify-layer', order: 10 },
          () => React.createElement('div', { className: 'ntfy-layer' },
            React.createElement(Poller, null),
            React.createElement(Toasts, null),
            React.createElement(Panel, null)),
        ))
        mountState.ok = true
      } catch (e) {
        mountState.ok = false
        mountState.why = e instanceof Error ? e.message : String(e)
      }

      // ── styles ──
      // v0.7.0 visual system (premium redesign):
      //  - layered surfaces: blurred overlay panel, hairline borders,
      //    soft deep shadows, section cards instead of dashed separators
      //  - hierarchy: 11px tracked section titles, 12px card desc, 13px body
      //  - controls: 34×20 brand-filled switches, segmented theme control,
      //    custom range slider, checkbox with brand accent
      //  - motion: spring-ish entrance for panel/toasts (reduced-motion off)
      // CSS contract preserved: toast radius 16px, panel radius 14px,
      // color-mix tints, .ntfy-theme-row, theme override blocks,
      // @media (prefers-reduced-motion: reduce).
      ctx.effect(() => {
        const tag = document.createElement('style')
        tag.textContent = `
.ntfy-layer { position: fixed; inset: 0; pointer-events: none; z-index: 50; }

/* ── toasts ── */
.ntfy-toasts { position: fixed; top: 12px; right: 12px; display: flex; flex-direction: column; gap: 10px; z-index: 60; pointer-events: auto; }
.ntfy-toast { display: flex; align-items: flex-start; gap: 10px; width: 324px; max-width: calc(100vw - 24px); padding: 12px 14px; border-radius: 16px; background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l1); box-shadow: 0 16px 40px rgba(0,0,0,.18), 0 2px 6px rgba(0,0,0,.08); color: var(--dsw-alias-label-primary); cursor: pointer; transition: opacity .5s ease, transform .18s cubic-bezier(.2,.9,.3,1.2); animation: ntfy-in .22s cubic-bezier(.2,.9,.3,1.2); }
.ntfy-toast:hover { transform: translateX(-3px); }
.ntfy-toast-out { opacity: 0; }
@keyframes ntfy-in { from { opacity: 0; transform: translateX(14px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes ntfy-pop { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .ntfy-toast, .ntfy-panel, .ntfy-switch-knob, .ntfy-seg-btn, .ntfy-item { transition: none; animation: none; } }
.ntfy-toast-icon { flex: none; width: 30px; height: 30px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; background: color-mix(in srgb, currentColor 12%, transparent); }
.ntfy-toast-title { font-size: 13px; font-weight: 600; line-height: 18px; letter-spacing: .01em; }
.ntfy-toast-body { font-size: 12px; color: var(--dsw-alias-label-secondary); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.ntfy-toast-x { border: none; background: none; color: var(--dsw-alias-label-secondary); cursor: pointer; font-size: 12px; padding: 0 2px; border-radius: 6px; }
.ntfy-toast-x:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-1); }
.ntfy-kind-approval { color: var(--dsw-alias-state-warn-primary); }
.ntfy-kind-reply { color: var(--dsw-alias-brand-primary); }
.ntfy-kind-task-end { color: var(--dsw-alias-state-success-primary); }

/* ── panel shell ── */
.ntfy-panel { position: fixed; width: 352px; max-width: calc(100vw - 24px); display: flex; flex-direction: column; border-radius: 14px; background: var(--dsw-alias-bg-overlay); border: 1px solid var(--dsw-alias-border-l1); box-shadow: 0 18px 48px rgba(0,0,0,.20), 0 4px 12px rgba(0,0,0,.08); z-index: 55; pointer-events: auto; overflow: hidden; animation: ntfy-pop .18s cubic-bezier(.2,.9,.3,1.1); }
.ntfy-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.ntfy-panel-title { font-size: 13px; font-weight: 650; letter-spacing: .02em; color: var(--dsw-alias-label-primary); }
.ntfy-panel-actions { display: flex; align-items: center; gap: 6px; flex: none; }
.ntfy-panel-test, .ntfy-panel-clear { font-size: 12px; background: none; border: 1px solid transparent; border-radius: 8px; cursor: pointer; padding: 3px 8px; transition: background .12s ease, color .12s ease; }
.ntfy-panel-test { color: var(--dsw-alias-label-secondary); }
.ntfy-panel-test:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-1); }
.ntfy-panel-clear { color: var(--dsw-alias-brand-primary); }
.ntfy-panel-clear:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }

/* ── status strip (always visible above the drawer) ── */
.ntfy-diag-full { display: flex; flex-direction: column; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.ntfy-diag { display: flex; align-items: center; gap: 8px; padding: 7px 14px; font-size: 11px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-1); }
.ntfy-status-dot { flex: none; width: 7px; height: 7px; border-radius: 999px; background: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 12%, transparent); }
.ntfy-status-ok { background: var(--dsw-alias-state-success-primary); color: var(--dsw-alias-state-success-primary); }
.ntfy-status-warn { background: var(--dsw-alias-state-warn-primary); color: var(--dsw-alias-state-warn-primary); }
.ntfy-status-err { background: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.ntfy-status-off { background: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); }
.ntfy-diag-summary { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ntfy-diag-toggle { border: none; background: none; cursor: pointer; color: var(--dsw-alias-label-secondary); font-size: 10px; padding: 2px 4px; flex: none; border-radius: 6px; transition: background .12s ease, color .12s ease; }
.ntfy-diag-toggle:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-layer-1)); }

/* ── drawer body: card sections ── */
.ntfy-body { display: flex; flex-direction: column; gap: 14px; padding: 12px 14px 14px; max-height: 46vh; overflow-y: auto; }
.ntfy-sec { display: flex; flex-direction: column; gap: 8px; }
.ntfy-sec-title { font-size: 10.5px; font-weight: 650; letter-spacing: .09em; text-transform: uppercase; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); }
.ntfy-sec-toggle { display: flex; align-items: center; justify-content: space-between; gap: 8px; border: none; background: none; padding: 0; cursor: pointer; color: inherit; font: inherit; letter-spacing: inherit; text-transform: inherit; }
.ntfy-sec-toggle:hover { color: var(--dsw-alias-label-primary); }
.ntfy-sec-caret { font-size: 9px; }
.ntfy-chgrid { display: flex; flex-direction: column; gap: 8px; }
.ntfy-chcard { position: relative; display: flex; flex-wrap: wrap; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); transition: border-color .15s ease, box-shadow .15s ease; }
.ntfy-chcard:hover { border-color: var(--dsw-alias-label-tertiary, var(--dsw-alias-border-l1)); box-shadow: 0 4px 14px rgba(0,0,0,.06); }
.ntfy-chcard-muted .ntfy-chcard-title, .ntfy-chcard-muted .ntfy-chcard-desc { opacity: .62; }
.ntfy-chcard-icon { flex: none; width: 30px; height: 30px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent); }
.ntfy-chcard-icon.muted { color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); background: var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-layer-1)); }
.ntfy-chcard-text { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
.ntfy-chcard-title { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.ntfy-chcard-desc { font-size: 11px; color: var(--dsw-alias-label-secondary); }
.ntfy-chcard-foot { flex-basis: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-left: 40px; }
.ntfy-chip { font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 999px; letter-spacing: .02em; }
.ntfy-chip-on { color: var(--dsw-alias-state-success-primary); background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent); }
.ntfy-chip-off { color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); background: var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-layer-1)); }
.ntfy-chip-soft { color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-layer-1)); font-weight: 500; }
.ntfy-chip-standby { color: var(--dsw-alias-brand-primary); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }
.ntfy-chip-warn { color: var(--dsw-alias-state-warn-primary); background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent); }
.ntfy-os-state, .ntfy-os-test-result { font-size: 10px; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); text-align: right; max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── prefs rows ── */
.ntfy-prefs { display: flex; flex-direction: column; gap: 10px; font-size: 12px; color: var(--dsw-alias-label-primary); }
.ntfy-pref-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.ntfy-pref-col { flex-direction: column; align-items: stretch; }
.ntfy-pref-check { justify-content: flex-start; gap: 8px; cursor: pointer; }
.ntfy-pref-off { opacity: .45; }
.ntfy-pref-check input[type="checkbox"] { accent-color: var(--dsw-alias-brand-primary); width: 14px; height: 14px; margin: 0; cursor: pointer; }

/* ── controls ── */
.ntfy-switch { width: 34px; height: 20px; border-radius: 999px; border: none; background: var(--dsw-alias-bg-layer-2, var(--dsw-alias-border-l1)); position: relative; cursor: pointer; padding: 0; flex: none; transition: background .18s ease; }
.ntfy-switch:hover { filter: brightness(.97); }
.ntfy-switch-knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 999px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.22); transition: left .18s cubic-bezier(.2,.9,.3,1.2); }
.ntfy-switch-on { background: var(--dsw-alias-brand-primary); }
/* brand-primary is LIGHT in DSH's dark theme — the on-knob takes the
   panel surface color so the pair always contrasts (white-on-brand in
   light themes, dark-on-light in dark themes). */
.ntfy-switch-on .ntfy-switch-knob { left: 16px; background: var(--dsw-alias-bg-overlay); }
.ntfy-switch:disabled { opacity: .45; cursor: default; }
.ntfy-seg { display: inline-flex; gap: 2px; padding: 2px; border-radius: 10px; background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); }
.ntfy-seg-btn { border: none; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 11.5px; padding: 4px 12px; border-radius: 8px; cursor: pointer; transition: background .14s ease, color .14s ease, box-shadow .14s ease; }
.ntfy-seg-btn:hover { color: var(--dsw-alias-label-primary); }
.ntfy-seg-btn-on { background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
.ntfy-range { -webkit-appearance: none; appearance: none; width: 100%; height: 4px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2, var(--dsw-alias-border-l1)); outline: none; cursor: pointer; }
.ntfy-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 999px; background: var(--dsw-alias-brand-primary); box-shadow: 0 1px 3px rgba(0,0,0,.25); }
.ntfy-range::-moz-range-thumb { width: 14px; height: 14px; border: none; border-radius: 999px; background: var(--dsw-alias-brand-primary); box-shadow: 0 1px 3px rgba(0,0,0,.25); }
.ntfy-tools { display: flex; align-items: center; gap: 6px; }
.ntfy-tools-spacer { flex: 1; }
.ntfy-panel-purge { font-size: 12px; background: none; border: 1px solid transparent; border-radius: 8px; cursor: pointer; padding: 3px 8px; color: var(--dsw-alias-state-error-primary); transition: background .12s ease; }
.ntfy-panel-purge:hover { background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent); }
.ntfy-purge-armed { border-color: var(--dsw-alias-state-error-primary); font-weight: 600; }

/* ── raw diagnostics (sub-folded) ── */
.ntfy-diag-detail { display: flex; flex-direction: column; gap: 5px; padding: 9px 12px; font-size: 11px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; font-variant-numeric: tabular-nums; }
.ntfy-diag-line { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ntfy-sec-diag { border-top: 1px solid var(--dsw-alias-border-l1); padding-top: 10px; }

/* ── list / items / empty / bell ── */
.ntfy-perm-hint { padding: 9px 14px; font-size: 12px; color: var(--dsw-alias-state-warn-primary); border-bottom: 1px solid var(--dsw-alias-border-l1); background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 7%, var(--dsw-alias-bg-layer-1)); }
.ntfy-list { overflow-y: auto; padding: 6px; }
.ntfy-item { display: flex; align-items: flex-start; gap: 10px; padding: 9px 10px; border-radius: 10px; cursor: pointer; transition: background .12s ease; }
.ntfy-item:hover { background: var(--dsw-alias-bg-layer-1); }
.ntfy-item-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--dsw-alias-brand-primary); flex: none; margin-top: 7px; box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 15%, transparent); }
.ntfy-item-read .ntfy-item-title { color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); }
.ntfy-item-read svg { opacity: .4; }
.ntfy-item-title { font-size: 13px; color: var(--dsw-alias-label-primary); font-weight: 500; }
.ntfy-item-body { font-size: 12px; color: var(--dsw-alias-label-secondary); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ntfy-item-time { font-size: 11px; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); flex: none; margin-left: auto; padding-top: 2px; font-variant-numeric: tabular-nums; }
.ntfy-empty { padding: 26px 14px; text-align: center; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.ntfy-empty-first { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px 18px; }
.ntfy-empty-first svg { color: var(--dsw-alias-label-secondary); }
.ntfy-empty-title { font-size: 13px; font-weight: 650; letter-spacing: .01em; color: var(--dsw-alias-label-primary); }
.ntfy-empty-desc { font-size: 12px; color: var(--dsw-alias-label-secondary); max-width: 260px; }
.ntfy-bell { display: inline-flex; align-items: center; gap: 6px; position: relative; border: none; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; padding: 6px; border-radius: 8px; transition: background .12s ease, color .12s ease; }
.ntfy-bell:hover, .ntfy-bell-on { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-1); }
.ntfy-bell-label { font-size: 12px; }
.ntfy-bell-badge { position: absolute; top: -2px; right: -2px; min-width: 15px; height: 15px; padding: 0 4px; border-radius: 8px; background: var(--dsw-alias-state-error-primary); color: #fff; font-size: 10px; font-weight: 600; line-height: 15px; text-align: center; box-shadow: 0 0 0 2px var(--dsw-alias-bg-overlay); }

/* theme segmented control keeps its legacy class names for compat */
.ntfy-theme-row { display: flex; gap: 4px; }
.ntfy-theme-btn { border: 1px solid var(--dsw-alias-border-l1); background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 11px; padding: 2px 8px; border-radius: 999px; cursor: pointer; }
.ntfy-theme-btn:hover { background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); }
.ntfy-theme-btn-on { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary); font-weight: 600; }

/* v0.4.0 theme override: ATTRIBUTE-SCOPED token shadowing. The plugin's own
   surfaces (bell/panel/toasts carry data-ntfy-theme when an explicit theme
   is chosen) redefine ONLY the tokens this plugin consumes — the host theme
   and every other plugin are untouched. Values mirror DSH's light/dark feel
   but are owned by this plugin (explicit hex is deliberate here: these ARE
   the override palette, not the host palette). */
[data-ntfy-theme="light"] { --dsw-alias-bg-overlay: #ffffff; --dsw-alias-bg-layer-1: #f4f4f6; --dsw-alias-bg-layer-2: #ececef; --dsw-alias-border-l1: #d8d8dd; --dsw-alias-label-primary: #1d1d1f; --dsw-alias-label-secondary: #55555c; --dsw-alias-label-tertiary: #85858c; --dsw-alias-brand-primary: #0066cc; --dsw-alias-state-warn-primary: #b25e09; --dsw-alias-state-error-primary: #c2373a; --dsw-alias-state-success-primary: #22763c; }
[data-ntfy-theme="dark"] { --dsw-alias-bg-overlay: #1f2128; --dsw-alias-bg-layer-1: #191b21; --dsw-alias-bg-layer-2: #242730; --dsw-alias-border-l1: #33363f; --dsw-alias-label-primary: #f2f3f6; --dsw-alias-label-secondary: #b6bac3; --dsw-alias-label-tertiary: #6d7280; --dsw-alias-brand-primary: #5c9dff; --dsw-alias-state-warn-primary: #e0a34e; --dsw-alias-state-error-primary: #ff6b6f; --dsw-alias-state-success-primary: #5cb87c; }
`
        document.head.appendChild(tag)
        return () => { tag.remove() }
      })

      // ── initial diagnostic report ──
      reportDiag()
      // v0.6.0: resolve the host OS channel state before the first poll
      // can surface anything (the fetch is one rpc round; 'pending'
      // blocks the browser fallback meanwhile — no double-banner window).
      fetchHostSettings()
    }

    exports.apply = apply
    exports.inject = inject
    // Pure logic surface for tests (nothing here touches the DOM or audio).
    exports.__internals = { chimePlan, clampVolume, parseAudioConfig, computePanelPos, effectiveGain, AUDIO_DEFAULTS, parseTheme, THEME_KEY, THEME_DEFAULT, parseChannelsConfig, CHANNELS_DEFAULTS, CHANNELS_KEY }
    return module.exports
  },
})
