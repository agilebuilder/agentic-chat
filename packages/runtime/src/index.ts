import { createInitialState, reduceEvent, type AgenticState, type CanonicalEvent } from '@agentic-chat/core'
export * from './contracts.js'

export interface AgenticRuntime {
  getSnapshot(): AgenticState
  dispatch(event: CanonicalEvent): void
  subscribe(listener: () => void): () => void
}

export function createRuntime(initialState: AgenticState = createInitialState()): AgenticRuntime {
  let state = initialState
  const listeners = new Set<() => void>()
  return {
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
