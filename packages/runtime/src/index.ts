import { compactRunStream, createInitialState, reduceEvent, type AgentRun, type AgenticState, type CanonicalEvent } from '@agentic-chat/core'
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
  capabilities?: AdapterCapabilities
  commands?: AgentCommands
}

export function createRuntime(options: CreateRuntimeOptions = {}): AgenticRuntime {
  let snapshot: RuntimeSnapshot = {
    state: options.initialState ?? createInitialState(),
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
