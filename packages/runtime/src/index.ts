import { compactRunStream, createInitialState, importSnapshot, reduceEvent, type AgentRun, type AgenticState, type CanonicalEvent, type CanonicalSnapshot, type LegacyCanonicalSnapshot } from '@agentic-chat/core'
import { assertCommandCapabilities, noCapabilities, type AdapterCapabilities, type AgentCommands, type CommandState, type ConnectionState, type ExperimentalInspectionOptions, type ExperimentalInspectionSnapshot, type ExperimentalInspectedEvent, type RuntimeDiagnostic } from './contracts.js'
export * from './contracts.js'
export * from './selectors.js'

export interface RuntimeSnapshot {
  state: AgenticState
  connection: ConnectionState
  commands: Record<string, CommandState>
  diagnostics: RuntimeDiagnostic[]
  /** Opt-in, bounded, payload-free development diagnostics. */
  experimentalInspection?: ExperimentalInspectionSnapshot
}

export interface AgenticRuntime {
  readonly capabilities: AdapterCapabilities
  readonly commands: AgentCommands
  getSnapshot(): RuntimeSnapshot
  getState(): AgenticState
  dispatch(event: CanonicalEvent): void
  hydrateRun(run: AgentRun): void
  compactRun(runId: string): void
  setConnection(connection: ConnectionState): void
  executeCommand<T>(key: string, operation: () => Promise<T>): Promise<T>
  respondToIntervention(interventionId: string, value: unknown, idempotencyKey: string): Promise<void>
  reportDiagnostic(diagnostic: RuntimeDiagnostic): void
  subscribe(listener: () => void): () => void
}

export interface CreateRuntimeOptions {
  initialState?: AgenticState
  initialSnapshot?: CanonicalSnapshot | LegacyCanonicalSnapshot
  capabilities?: AdapterCapabilities
  commands?: AgentCommands
  experimentalInspection?: ExperimentalInspectionOptions
}

export function createRuntime(options: CreateRuntimeOptions = {}): AgenticRuntime {
  if (options.initialState && options.initialSnapshot) throw new Error('Provide either initialState or initialSnapshot, not both')
  const inspectionLimits = options.experimentalInspection ? {
    events: inspectionLimit(options.experimentalInspection.maxEvents, 200, 'maxEvents'),
    connections: inspectionLimit(options.experimentalInspection.maxConnections, 50, 'maxConnections'),
  } : undefined
  let snapshot: RuntimeSnapshot = {
    state: options.initialSnapshot ? importSnapshot(options.initialSnapshot) : options.initialState ?? createInitialState(),
    connection: { status: 'idle', attempt: 0 },
    commands: {},
    diagnostics: [],
    ...(inspectionLimits ? { experimentalInspection: { events: [], connections: [{ status: 'idle', attempt: 0 }] } } : {}),
  }
  const capabilities = options.capabilities ?? noCapabilities
  const commands = options.commands ?? {}
  assertCommandCapabilities(capabilities, commands)
  const listeners = new Set<() => void>()
  const interventionSubmissions = new Map<string, { idempotencyKey: string; responseFingerprint: string; promise?: Promise<void> }>()
  const notify = () => listeners.forEach((listener) => listener())
  const executeCommand = async <T>(key: string, operation: () => Promise<T>): Promise<T> => {
    snapshot = { ...snapshot, commands: { ...snapshot.commands, [key]: { status: 'pending' } } }
    notify()
    try {
      const result = await operation()
      snapshot = { ...snapshot, commands: { ...snapshot.commands, [key]: { status: 'succeeded' } } }
      notify()
      return result
    } catch (error) {
      snapshot = { ...snapshot, commands: { ...snapshot.commands, [key]: { status: 'failed', error: error instanceof Error ? error.message : String(error) } } }
      notify()
      throw error
    }
  }
  return {
    capabilities,
    commands,
    getSnapshot: () => snapshot,
    getState: () => snapshot.state,
    dispatch(event) {
      const previous = snapshot.state
      const next = reduceEvent(previous, event)
      const inspected = inspectEvent(snapshot.experimentalInspection, event, eventOutcome(previous, next, event), inspectionLimits?.events)
      if (next === previous && inspected === snapshot.experimentalInspection) return
      snapshot = { ...snapshot, state: next, ...(inspected ? { experimentalInspection: inspected } : {}) }
      if ((event.type === 'intervention.resolved' || event.type === 'intervention.expired') && next.interventions[event.data.interventionId]?.status !== 'pending') {
        interventionSubmissions.delete(event.data.interventionId)
        const commandKey = `respond:${event.data.interventionId}`
        const { [commandKey]: _, ...commandsWithoutIntervention } = snapshot.commands
        snapshot = { ...snapshot, commands: commandsWithoutIntervention }
      }
      notify()
    },
    hydrateRun(run) {
      const existing = snapshot.state.runs[run.id]
      if (existing) return
      if (!Number.isSafeInteger(run.attempt) || run.attempt < 1) throw new Error(`Run attempt ${run.attempt} is invalid`)
      if (!run.retryOfRunId && run.attempt !== 1) throw new Error('An initial Run must use attempt 1')
      if (run.retryOfRunId && run.attempt < 2) throw new Error('A retry Run must use attempt 2 or greater')
      if (run.retryOfRunId === run.id) throw new Error('A Run cannot retry itself')
      const predecessor = run.retryOfRunId ? snapshot.state.runs[run.retryOfRunId] : undefined
      if (run.retryOfRunId && !predecessor) throw new Error(`Retry predecessor ${run.retryOfRunId} does not exist`)
      if (predecessor && (predecessor.threadId !== run.threadId || !['completed', 'failed', 'cancelled'].includes(predecessor.status) || run.attempt !== predecessor.attempt + 1)) throw new Error(`Retry predecessor ${run.retryOfRunId} is incompatible with attempt ${run.attempt}`)
      snapshot = { ...snapshot, state: { ...snapshot.state, runs: { ...snapshot.state.runs, [run.id]: run } } }
      notify()
    },
    compactRun(runId) {
      const state = compactRunStream(snapshot.state, runId)
      if (state === snapshot.state) return
      snapshot = { ...snapshot, state }
      notify()
    },
    setConnection(connection) {
      const inspection = snapshot.experimentalInspection
      const experimentalInspection = inspection && inspectionLimits ? {
        ...inspection,
        connections: [...inspection.connections, { status: connection.status, attempt: connection.attempt }].slice(-inspectionLimits.connections),
      } : undefined
      snapshot = { ...snapshot, connection, ...(experimentalInspection ? { experimentalInspection } : {}) }
      notify()
    },
    executeCommand,
    respondToIntervention(interventionId, value, idempotencyKey) {
      if (!idempotencyKey.trim()) return Promise.reject(new Error('Intervention response requires an idempotency key'))
      const intervention = snapshot.state.interventions[interventionId]
      if (!intervention || intervention.status !== 'pending') return Promise.reject(new Error(`Intervention ${interventionId} is not pending`))
      if (!capabilities.intervention || !commands.respond) return Promise.reject(new Error('Intervention responses are not supported by this runtime'))
      const existing = interventionSubmissions.get(interventionId)
      let responseFingerprint: string
      try { responseFingerprint = fingerprint(value) } catch (error) { return Promise.reject(error) }
      if (existing) {
        if (existing.idempotencyKey !== idempotencyKey) return Promise.reject(new Error(`Intervention ${interventionId} already has a submitted response`))
        if (existing.responseFingerprint !== responseFingerprint) return Promise.reject(new Error(`Idempotency key for ${interventionId} is already bound to a different response`))
        if (existing.promise) return existing.promise
      }
      const operation = executeCommand(`respond:${interventionId}`, () => commands.respond!(interventionId, value, idempotencyKey))
      let tracked: Promise<void>
      tracked = operation.catch((error: unknown) => {
        const submission = interventionSubmissions.get(interventionId)
        if (submission?.promise === tracked) {
          // Retain the idempotency binding after a transport failure. Only the
          // exact same logical response may be retried for this intervention.
          interventionSubmissions.set(interventionId, { idempotencyKey: submission.idempotencyKey, responseFingerprint: submission.responseFingerprint })
        }
        throw error
      }).finally(() => {
        if (snapshot.state.interventions[interventionId]?.status === 'pending') return
        interventionSubmissions.delete(interventionId)
        const commandKey = `respond:${interventionId}`
        const { [commandKey]: _, ...commandsWithoutIntervention } = snapshot.commands
        snapshot = { ...snapshot, commands: commandsWithoutIntervention }
        notify()
      })
      interventionSubmissions.set(interventionId, { idempotencyKey, responseFingerprint, promise: tracked })
      return tracked
    },
    reportDiagnostic(diagnostic) {
      snapshot = { ...snapshot, diagnostics: [...snapshot.diagnostics, diagnostic].slice(-200) }
      notify()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function fingerprint(value: unknown): string {
  const canonical = canonicalValue(value, new WeakSet<object>())
  return `${canonical.length}:${fnv1a(canonical, 0x811c9dc5)}:${fnv1a(canonical, 0x9e3779b9)}`
}

function canonicalValue(value: unknown, ancestors: WeakSet<object>): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return `string:${JSON.stringify(value)}`
  if (typeof value === 'boolean') return `boolean:${value}`
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'number:NaN'
    if (value === Infinity) return 'number:Infinity'
    if (value === -Infinity) return 'number:-Infinity'
    if (Object.is(value, -0)) return 'number:-0'
    return `number:${String(value)}`
  }
  if (typeof value === 'bigint') return `bigint:${String(value)}`
  if (typeof value === 'function' || typeof value === 'symbol') throw new Error(`Intervention response contains unsupported ${typeof value} value`)
  if (ancestors.has(value)) throw new Error('Intervention response must not contain cyclic references')
  ancestors.add(value)
  try {
    if (Array.isArray(value)) return `array:[${value.map((item) => canonicalValue(item, ancestors)).join(',')}]`
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) throw new Error('Intervention response must contain only plain objects and arrays')
    return `object:{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalValue((value as Record<string, unknown>)[key], ancestors)}`).join(',')}}`
  } finally {
    ancestors.delete(value)
  }
}

function fnv1a(value: string, seed: number): string {
  let hash = seed >>> 0
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function inspectionLimit(value: number | undefined, fallback: number, name: string): number {
  const resolved = value ?? fallback
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > 1_000) throw new Error(`experimentalInspection.${name} must be an integer from 1 to 1000`)
  return resolved
}

function eventOutcome(previous: AgenticState, next: AgenticState, event: CanonicalEvent): ExperimentalInspectedEvent['outcome'] {
  if (next === previous) return 'ignored'
  const before = previous.diagnostics.at(-1)
  const after = next.diagnostics.at(-1)
  return after?.eventId === event.eventId && after !== before ? 'diagnostic' : 'applied'
}

function inspectEvent(inspection: ExperimentalInspectionSnapshot | undefined, event: CanonicalEvent, outcome: ExperimentalInspectedEvent['outcome'], maxEvents: number | undefined): ExperimentalInspectionSnapshot | undefined {
  if (!inspection || !maxEvents) return inspection
  const item: ExperimentalInspectedEvent = {
    eventId: event.eventId,
    type: event.type,
    threadId: event.threadId,
    runId: event.runId,
    sequence: event.sequence,
    timestamp: event.timestamp,
    ...(event.source ? { source: event.source } : {}),
    outcome,
  }
  return { ...inspection, events: [...inspection.events, item].slice(-maxEvents) }
}
