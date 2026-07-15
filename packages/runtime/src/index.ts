import { compactRunStream, createInitialState, importSnapshot, reduceEvent, type AgentRun, type AgenticState, type CanonicalEvent, type CanonicalSnapshot, type LegacyCanonicalSnapshot } from '@agentic-chat/core'
import { assertCommandCapabilities, noCapabilities, type AdapterCapabilities, type AgentCommands, type CommandState, type ConnectionState, type RuntimeDiagnostic } from './contracts.js'
export * from './contracts.js'
export * from './selectors.js'

export interface RuntimeSnapshot {
  state: AgenticState
  connection: ConnectionState
  commands: Record<string, CommandState>
  diagnostics: RuntimeDiagnostic[]
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
}

export function createRuntime(options: CreateRuntimeOptions = {}): AgenticRuntime {
  if (options.initialState && options.initialSnapshot) throw new Error('Provide either initialState or initialSnapshot, not both')
  let snapshot: RuntimeSnapshot = {
    state: options.initialSnapshot ? importSnapshot(options.initialSnapshot) : options.initialState ?? createInitialState(),
    connection: { status: 'idle', attempt: 0 },
    commands: {},
    diagnostics: [],
  }
  const capabilities = options.capabilities ?? noCapabilities
  const commands = options.commands ?? {}
  assertCommandCapabilities(capabilities, commands)
  const listeners = new Set<() => void>()
  const interventionSubmissions = new Map<string, { idempotencyKey: string; responseFingerprint: string; promise: Promise<void> }>()
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
      const next = reduceEvent(snapshot.state, event)
      if (next === snapshot.state) return
      snapshot = { ...snapshot, state: next }
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
      snapshot = { ...snapshot, connection }
      notify()
    },
    executeCommand,
    respondToIntervention(interventionId, value, idempotencyKey) {
      if (!idempotencyKey.trim()) return Promise.reject(new Error('Intervention response requires an idempotency key'))
      const intervention = snapshot.state.interventions[interventionId]
      if (!intervention || intervention.status !== 'pending') return Promise.reject(new Error(`Intervention ${interventionId} is not pending`))
      if (!capabilities.intervention || !commands.respond) return Promise.reject(new Error('Intervention responses are not supported by this runtime'))
      const existing = interventionSubmissions.get(interventionId)
      const responseFingerprint = fingerprint(value)
      if (existing) {
        if (existing.idempotencyKey !== idempotencyKey) return Promise.reject(new Error(`Intervention ${interventionId} already has a submitted response`))
        if (existing.responseFingerprint !== responseFingerprint) return Promise.reject(new Error(`Idempotency key for ${interventionId} is already bound to a different response`))
        return existing.promise
      }
      const operation = executeCommand(`respond:${interventionId}`, () => commands.respond!(interventionId, value, idempotencyKey))
      let tracked: Promise<void>
      tracked = operation.catch((error: unknown) => {
        if (interventionSubmissions.get(interventionId)?.promise === tracked) interventionSubmissions.delete(interventionId)
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
  try { return JSON.stringify(value) ?? String(value) } catch { return Object.prototype.toString.call(value) }
}
