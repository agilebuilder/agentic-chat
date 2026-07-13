import type { AgenticState } from './model.js'

export interface CanonicalSnapshot {
  schemaVersion: '0.1'
  revision: number
  state: AgenticState
}

export function createSnapshot(state: AgenticState, revision: number): CanonicalSnapshot {
  return { schemaVersion: '0.1', revision, state: structuredClone(state) }
}

export function importSnapshot(snapshot: CanonicalSnapshot): AgenticState {
  if (snapshot.schemaVersion !== '0.1') throw new Error(`Unsupported snapshot schema ${String(snapshot.schemaVersion)}`)
  return structuredClone(snapshot.state)
}
