import type { Activity, AgentRun, AgentTask, AgenticState, Artifact, Intervention, Message, RenderableContent, Thread, ToolCall } from './model.js'
import { createInitialState } from './model.js'

export interface CanonicalStreamCheckpoint {
  runId: string
  lastSequence: number
}

export interface CanonicalSnapshotEntities {
  threads: Thread[]
  messages: Message[]
  runs: AgentRun[]
  activities: Activity[]
  toolCalls: ToolCall[]
  results: Array<{ runId: string; content: RenderableContent }>
  interventions: Intervention[]
  tasks: AgentTask[]
  artifacts: Artifact[]
}

/** Stable persistence schema. It intentionally does not expose AgenticState. */
export interface CanonicalSnapshot {
  schemaVersion: '0.2'
  revision: number
  entities: CanonicalSnapshotEntities
  taskRevisionByRunId: Record<string, number>
  streams: CanonicalStreamCheckpoint[]
}

/** @deprecated Read-only migration shape produced before P3. */
export interface LegacyCanonicalSnapshot {
  schemaVersion: '0.1'
  revision: number
  state: Omit<AgenticState, 'taskRevisionByRunId'> & { taskRevisionByRunId?: Record<string, number> }
}

const values = <T>(table: Record<string, T>): T[] => structuredClone(Object.values(table))

const assertRevision = (revision: number, label: string): void => {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error(`${label} must be a non-negative safe integer`)
}

export function createSnapshot(state: AgenticState, revision: number): CanonicalSnapshot {
  assertRevision(revision, 'Snapshot revision')
  if (Object.values(state.streams).some((stream) => stream.blocked)) throw new Error('Cannot create an authoritative snapshot from a blocked stream')
  return {
    schemaVersion: '0.2',
    revision,
    entities: {
      threads: values(state.threads),
      messages: values(state.messages),
      runs: values(state.runs),
      activities: values(state.activities),
      toolCalls: values(state.toolCalls),
      results: Object.entries(state.results).map(([runId, content]) => ({ runId, content: structuredClone(content) })),
      interventions: values(state.interventions),
      tasks: values(state.tasks),
      artifacts: values(state.artifacts),
    },
    taskRevisionByRunId: structuredClone(state.taskRevisionByRunId),
    streams: Object.entries(state.streams).map(([runId, stream]) => ({ runId, lastSequence: stream.lastSequence })),
  }
}

const tableFrom = <T extends { id: string }>(entities: readonly T[], label: string): Record<string, T> => {
  const table: Record<string, T> = {}
  for (const entity of entities) {
    if (!entity.id || table[entity.id]) throw new Error(`${label} contains duplicate or empty ID ${entity.id}`)
    table[entity.id] = structuredClone(entity)
  }
  return table
}

export function importSnapshot(snapshot: CanonicalSnapshot | LegacyCanonicalSnapshot): AgenticState {
  assertRevision(snapshot.revision, 'Snapshot revision')
  if (snapshot.schemaVersion === '0.1') {
    const legacy = structuredClone(snapshot.state)
    return { ...createInitialState(), ...legacy, taskRevisionByRunId: legacy.taskRevisionByRunId ?? {} }
  }
  if (snapshot.schemaVersion !== '0.2') throw new Error(`Unsupported snapshot schema ${String((snapshot as { schemaVersion?: unknown }).schemaVersion)}`)

  const state = createInitialState()
  state.threads = tableFrom(snapshot.entities.threads, 'threads')
  state.messages = tableFrom(snapshot.entities.messages, 'messages')
  state.runs = tableFrom(snapshot.entities.runs, 'runs')
  state.activities = tableFrom(snapshot.entities.activities, 'activities')
  state.toolCalls = tableFrom(snapshot.entities.toolCalls, 'toolCalls')
  state.interventions = tableFrom(snapshot.entities.interventions, 'interventions')
  state.tasks = tableFrom(snapshot.entities.tasks, 'tasks')
  state.artifacts = tableFrom(snapshot.entities.artifacts, 'artifacts')
  for (const { runId, content } of snapshot.entities.results) {
    if (!runId || state.results[runId]) throw new Error(`results contains duplicate or empty run ID ${runId}`)
    state.results[runId] = structuredClone(content)
  }
  for (const [runId, revision] of Object.entries(snapshot.taskRevisionByRunId)) {
    assertRevision(revision, `Task revision for ${runId}`)
    if (!state.runs[runId]) throw new Error(`Task revision references missing run ${runId}`)
    state.taskRevisionByRunId[runId] = revision
  }
  for (const checkpoint of snapshot.streams) {
    if (!checkpoint.runId || state.streams[checkpoint.runId]) throw new Error(`streams contains duplicate or empty run ID ${checkpoint.runId}`)
    if (!state.runs[checkpoint.runId]) throw new Error(`Stream checkpoint references missing run ${checkpoint.runId}`)
    assertRevision(checkpoint.lastSequence, `Stream sequence for ${checkpoint.runId}`)
    state.streams[checkpoint.runId] = {
      scope: 'run',
      lastSequence: checkpoint.lastSequence,
      compactedThroughSequence: checkpoint.lastSequence,
      seenEventIds: {},
      blocked: false,
    }
  }
  for (const tool of Object.values(state.toolCalls)) {
    if (!state.activities[tool.activityId]) throw new Error(`Tool call ${tool.id} references missing activity ${tool.activityId}`)
    if (!state.runs[tool.runId]) throw new Error(`Tool call ${tool.id} references missing run ${tool.runId}`)
    state.activityByToolCallId[tool.id] = tool.activityId
  }
  for (const activity of Object.values(state.activities)) {
    if (!state.runs[activity.runId]) throw new Error(`Activity ${activity.id} references missing run ${activity.runId}`)
    if (activity.parentId && (!state.activities[activity.parentId] || state.activities[activity.parentId]?.runId !== activity.runId)) throw new Error(`Activity ${activity.id} references invalid parent ${activity.parentId}`)
    const visited = new Set([activity.id])
    let parentId = activity.parentId
    while (parentId) {
      if (visited.has(parentId)) throw new Error(`Activity ${activity.id} contains a parent cycle`)
      visited.add(parentId)
      parentId = state.activities[parentId]?.parentId
    }
  }
  for (const run of Object.values(state.runs)) {
    for (const activityId of run.activityIds) {
      if (!state.activities[activityId]) throw new Error(`Run ${run.id} references missing activity ${activityId}`)
      if (state.activities[activityId]?.runId !== run.id) throw new Error(`Run ${run.id} references activity ${activityId} from another run`)
    }
  }
  for (const task of Object.values(state.tasks)) {
    if (!state.runs[task.runId]) throw new Error(`Task ${task.id} references missing run ${task.runId}`)
    if (task.parentId && (!state.tasks[task.parentId] || state.tasks[task.parentId]?.runId !== task.runId)) throw new Error(`Task ${task.id} references invalid parent ${task.parentId}`)
    const visited = new Set([task.id])
    let parentId = task.parentId
    while (parentId) {
      if (visited.has(parentId)) throw new Error(`Task ${task.id} contains a parent cycle`)
      visited.add(parentId)
      parentId = state.tasks[parentId]?.parentId
    }
  }
  for (const resultRunId of Object.keys(state.results)) {
    if (!state.runs[resultRunId]) throw new Error(`Result references missing run ${resultRunId}`)
  }
  for (const intervention of Object.values(state.interventions)) {
    if (!state.runs[intervention.runId]) throw new Error(`Intervention ${intervention.id} references missing run ${intervention.runId}`)
  }
  for (const artifact of Object.values(state.artifacts)) {
    if (!state.runs[artifact.runId]) throw new Error(`Artifact ${artifact.id} references missing run ${artifact.runId}`)
  }
  return state
}
