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
  return {
    capabilities,
    commands,
    getSnapshot: () => snapshot,
    getState: () => snapshot.state,
    dispatch(event) {
      const next = reduceEvent(snapshot.state, event)
      if (next === snapshot.state) return
      snapshot = { ...snapshot, state: next }
      listeners.forEach((listener) => listener())
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
      listeners.forEach((listener) => listener())
    },
    compactRun(runId) {
      const state = compactRunStream(snapshot.state, runId)
      if (state === snapshot.state) return
      snapshot = { ...snapshot, state }
      listeners.forEach((listener) => listener())
    },
    setConnection(connection) {
      snapshot = { ...snapshot, connection }
      listeners.forEach((listener) => listener())
    },
    async executeCommand(key, operation) {
      snapshot = { ...snapshot, commands: { ...snapshot.commands, [key]: { status: 'pending' } } }
      listeners.forEach((listener) => listener())
      try {
        const result = await operation()
        snapshot = { ...snapshot, commands: { ...snapshot.commands, [key]: { status: 'succeeded' } } }
        listeners.forEach((listener) => listener())
        return result
      } catch (error) {
        snapshot = { ...snapshot, commands: { ...snapshot.commands, [key]: { status: 'failed', error: error instanceof Error ? error.message : String(error) } } }
        listeners.forEach((listener) => listener())
        throw error
      }
    },
    reportDiagnostic(diagnostic) {
      snapshot = { ...snapshot, diagnostics: [...snapshot.diagnostics, diagnostic].slice(-200) }
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
