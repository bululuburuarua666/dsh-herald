import { z } from 'zod'

const ID = 'dsh-herald#taskNotify'

// v0.5.0: `seq` is the host's monotonic change counter (assigned at
// creation, bumped on ack/clear/key-touch). It is the incremental-sync
// cursor ‚Ä?additive on the wire; pull() keeps its legacy full-array shape.
const TaskNotifyRecord = z.object({
  id: z.string(),
  kind: z.string(),
  subkind: z.string(),
  label: z.string(),
  detail: z.string(),
  outcome: z.string(),
  at: z.number(),
  read: z.boolean(),
  seq: z.number(),
})

// v0.5.0: the host answers diag() with its persistence status so the client
// drawer can show Ê≠£Â∏∏/Â∑≤ÊÅ¢Â§?‰∏çÂèØÁî? (Previously the result was always null.)
const TaskNotifyHostDiag = z.object({
  persist: z.string(),
})

const DiagState = z.object({
  supported: z.boolean(),
  permission: z.string(),
  secure: z.boolean(),
  at: z.number(),
}).passthrough()

// v0.6.0 channel settings: the host-owned OS switch + adapter capability.
// `locked` is true while DSH_TASK_NOTIFY_OS overrides the file ‚Ä?RPC
// writes are refused and the panel renders the switch read-only.
const OsSwitch = z.object({ enabled: z.boolean() })
const TaskNotifySettingsView = z.object({
  os: OsSwitch,
  locked: z.boolean(),
  adapter: z.object({ available: z.boolean(), platform: z.string() }),
  settingsStatus: z.string(),
})
const TaskNotifyOsTestResult = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
})

export const TYPERT = {
  package: 'dsh-herald',
  face: 'host',
  schemas: [],
  model: { services: [], events: [], objects: [] },
  invocations: [
    {
      id: ID + '/pull',
      service: 'taskNotify',
      namespace: 'taskNotify',
      method: 'pull',
      invocation: { kind: 'direct' },
      parameters: [],
      result: {
        mode: 'strict',
        typeSymbol: 'dsh-herald/types#TaskNotifyRecordList',
        schema: z.array(TaskNotifyRecord),
      },
    },
    {
      id: ID + '/pullSince',
      service: 'taskNotify',
      namespace: 'taskNotify',
      method: 'pullSince',
      invocation: { kind: 'direct' },
      parameters: [
        { name: 'cursor', wire: 'cursor', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-herald/types#TaskNotifyCursor', schema: z.number() } },
      ],
      result: {
        mode: 'strict',
        typeSymbol: 'dsh-herald/types#TaskNotifyDelta',
        schema: z.object({
          items: z.array(TaskNotifyRecord),
          cursor: z.number(),
          reset: z.boolean(),
        }),
      },
    },
    {
      id: ID + '/ack',
      service: 'taskNotify',
      namespace: 'taskNotify',
      method: 'ack',
      invocation: { kind: 'direct' },
      parameters: [
        { name: 'id', wire: 'id', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-herald/types#TaskNotifyId', schema: z.string() } },
      ],
      result: { mode: 'strict', typeSymbol: 'dsh-herald/types#Null', schema: z.null() },
    },
    {
      id: ID + '/clear',
      service: 'taskNotify',
      namespace: 'taskNotify',
      method: 'clear',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'strict', typeSymbol: 'dsh-herald/types#Null', schema: z.null() },
    },
    {
      id: ID + '/purge',
      service: 'taskNotify',
      namespace: 'taskNotify',
      method: 'purge',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'strict', typeSymbol: 'dsh-herald/types#Null', schema: z.null() },
    },
    {
      id: ID + '/diag',
      service: 'taskNotify',
      namespace: 'taskNotify',
      method: 'diag',
      invocation: { kind: 'direct' },
      parameters: [
        { name: 'state', wire: 'state', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-herald/types#TaskNotifyDiagState', schema: DiagState } },
      ],
      result: { mode: 'strict', typeSymbol: 'dsh-herald/types#TaskNotifyHostDiag', schema: TaskNotifyHostDiag },
    },
    {
      id: ID + '/getSettings',
      service: 'taskNotify',
      namespace: 'taskNotify',
      method: 'getSettings',
      invocation: { kind: 'direct' },
      parameters: [],
      result: {
        mode: 'strict',
        typeSymbol: 'dsh-herald/types#TaskNotifySettingsView',
        schema: TaskNotifySettingsView,
      },
    },
    {
      id: ID + '/setSettings',
      service: 'taskNotify',
      namespace: 'taskNotify',
      method: 'setSettings',
      invocation: { kind: 'direct' },
      parameters: [
        { name: 'os', wire: 'os', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-herald/types#TaskNotifyOsSwitch', schema: OsSwitch } },
      ],
      result: {
        mode: 'strict',
        typeSymbol: 'dsh-herald/types#TaskNotifySettingsView',
        schema: TaskNotifySettingsView,
      },
    },
    {
      id: ID + '/testOs',
      service: 'taskNotify',
      namespace: 'taskNotify',
      method: 'testOs',
      invocation: { kind: 'direct' },
      parameters: [],
      result: {
        mode: 'strict',
        typeSymbol: 'dsh-herald/types#TaskNotifyOsTestResult',
        schema: TaskNotifyOsTestResult,
      },
    },
  ],
}
