import { createInitialState, reduceEvent, type AgenticState, type CanonicalEvent } from '@agentic-chat/core'
import { assertCommandCapabilities, noCapabilities, type AdapterCapabilities, type AgentCommands } from './contracts.js'
export * from './contracts.js'

export interface AgenticRuntime {
  readonly capabilities: AdapterCapabilities
  readonly commands: AgentCommands
  getSnapshot(): AgenticState
  dispatch(event: CanonicalEvent): void
  subscribe(listener: () => void): () => void
}

export interface CreateRuntimeOptions {
  initialState?: AgenticState
  capabilities?: AdapterCapabilities
  commands?: AgentCommands
}

export function createRuntime(options: CreateRuntimeOptions = {}): AgenticRuntime {
  let state = options.initialState ?? createInitialState()
  const capabilities = options.capabilities ?? noCapabilities
  const commands = options.commands ?? {}
  assertCommandCapabilities(capabilities, commands)
  const listeners = new Set<() => void>()
  return {
    capabilities,
    commands,
    getSnapshot: () => state,
    dispatch(event) {
      const next = reduceEvent(state, event)
      if (next === state) return
      state = next
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
