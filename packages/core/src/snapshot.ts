import type { Activity, AgentRun, AgentTask, AgenticState, Artifact, Intervention, Message, RenderableContent, TaskStatus, Thread, ToolCall } from './model.js'
import { createInitialState } from './model.js'

/** @public */
export interface CanonicalStreamCheckpoint {
  runId: string
  lastSequence: number
}

/** @public */
export interface CanonicalSnapshotEntities {
  threads: Thread[]
  messages: Message[]
  runs: AgentRun[]
  activities: Activity[]
  toolCalls: ToolCall[]
  results: Array<{ runId: string; content: RenderableContent }>
  interventions: SnapshotIntervention[]
  tasks: AgentTask[]
  artifacts: SnapshotArtifact[]
}

/** Schema 0.2 existed before requestedAt was added; imports accept the old omission. @public */
export type SnapshotIntervention = Omit<Intervention, 'requestedAt'> & { requestedAt?: string }
/** Schema 0.2 existed before Artifact version/provenance timestamps. @public */
export type SnapshotArtifact = Omit<Artifact, 'version' | 'provenance' | 'createdAt'> & { version?: number; provenance?: Artifact['provenance']; createdAt?: string; sourceActivityId?: string }

/** Stable persistence schema. It intentionally does not expose AgenticState. @public */
export interface CanonicalSnapshot {
  schemaVersion: '0.2'
  revision: number
  entities: CanonicalSnapshotEntities
  taskRevisionByRunId: Record<string, number>
  streams: CanonicalStreamCheckpoint[]
}

/** @deprecated Read-only migration shape produced before P3. @public */
export interface LegacyCanonicalSnapshot {
  schemaVersion: '0.1'
  revision: number
  state: Omit<AgenticState, 'runs' | 'interventions' | 'artifacts' | 'taskRevisionByRunId' | 'rootActivityIdsByRunId' | 'childActivityIdsByParentId'> & {
    runs: Record<string, Omit<AgentRun, 'attempt'> & { attempt?: number }>
    interventions: Record<string, SnapshotIntervention>
    artifacts: Record<string, SnapshotArtifact>
    taskRevisionByRunId?: Record<string, number>
    rootActivityIdsByRunId?: Record<string, string[]>
    childActivityIdsByParentId?: Record<string, string[]>
  }
}

const values = <T>(table: Record<string, T>): T[] => structuredClone(Object.values(table))

const assertRevision = (revision: number, label: string): void => {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error(`${label} must be a non-negative safe integer`)
}

const validOptions = (options: readonly { value: string; label: string }[] | undefined, minimum: number): boolean => !!options && options.length >= minimum && new Set(options.map((option) => option.value)).size === options.length && options.every((option) => !!option.value.trim() && !!option.label.trim())
const validTaskStatuses = new Set<TaskStatus>(['pending', 'in_progress', 'blocked', 'completed', 'cancelled'])

/** @public */
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

function rebuildDerivedIndexes(state: AgenticState): AgenticState {
  state.activityByToolCallId = {}
  state.rootActivityIdsByRunId = {}
  state.childActivityIdsByParentId = {}
  for (const run of Object.values(state.runs)) {
    if (!Number.isSafeInteger(run.attempt) || run.attempt < 1) run.attempt = 1
  }
  for (const artifact of Object.values(state.artifacts)) {
    migrateArtifactDefaults(artifact, state.runs[artifact.runId]?.createdAt)
  }
  const activities = Object.values(state.activities).sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
  for (const activity of activities) {
    if (activity.parentId) state.childActivityIdsByParentId[activity.parentId] = [...(state.childActivityIdsByParentId[activity.parentId] ?? []), activity.id]
    else state.rootActivityIdsByRunId[activity.runId] = [...(state.rootActivityIdsByRunId[activity.runId] ?? []), activity.id]
  }
  for (const tool of Object.values(state.toolCalls)) state.activityByToolCallId[tool.id] = tool.activityId
  return state
}

function migrateArtifactDefaults(artifact: Artifact, fallbackCreatedAt?: string): void {
  const legacyArtifact = artifact as Artifact & { sourceActivityId?: string }
  if (!artifact.version) artifact.version = 1
  if (!artifact.createdAt) artifact.createdAt = fallbackCreatedAt ?? '1970-01-01T00:00:00.000Z'
  if (!artifact.provenance) artifact.provenance = legacyArtifact.sourceActivityId ? { type: 'agent', activityId: legacyArtifact.sourceActivityId } : { type: 'agent' }
  delete legacyArtifact.sourceActivityId
}

/** @public */
export function importSnapshot(snapshot: CanonicalSnapshot | LegacyCanonicalSnapshot): AgenticState {
  assertRevision(snapshot.revision, 'Snapshot revision')
  if (snapshot.schemaVersion === '0.1') {
    const legacy = structuredClone(snapshot.state)
    const migrated = {
      ...createInitialState(),
      ...legacy,
      taskRevisionByRunId: legacy.taskRevisionByRunId ?? {},
      rootActivityIdsByRunId: legacy.rootActivityIdsByRunId ?? {},
      childActivityIdsByParentId: legacy.childActivityIdsByParentId ?? {},
    } as AgenticState
    return importSnapshot({
      schemaVersion: '0.2',
      revision: snapshot.revision,
      entities: {
        threads: values(migrated.threads), messages: values(migrated.messages), runs: values(migrated.runs),
        activities: values(migrated.activities), toolCalls: values(migrated.toolCalls),
        results: Object.entries(migrated.results).map(([runId, content]) => ({ runId, content: structuredClone(content) })),
        interventions: values(migrated.interventions), tasks: values(migrated.tasks), artifacts: values(migrated.artifacts),
      },
      taskRevisionByRunId: structuredClone(migrated.taskRevisionByRunId),
      streams: Object.entries(migrated.streams).map(([runId, stream]) => ({ runId, lastSequence: stream.lastSequence })),
    })
  }
  if (snapshot.schemaVersion !== '0.2') throw new Error(`Unsupported snapshot schema ${String((snapshot as { schemaVersion?: unknown }).schemaVersion)}`)

  const state = createInitialState()
  state.threads = tableFrom(snapshot.entities.threads, 'threads')
  state.messages = tableFrom(snapshot.entities.messages, 'messages')
  state.runs = tableFrom(snapshot.entities.runs, 'runs')
  // P2 snapshots already used schema 0.2 before Run attempts were introduced.
  // Treat only an absent value as legacy; malformed explicit values still fail validation below.
  for (const run of Object.values(state.runs)) {
    if (run.attempt === undefined) run.attempt = 1
  }
  state.activities = tableFrom(snapshot.entities.activities, 'activities')
  state.toolCalls = tableFrom(snapshot.entities.toolCalls, 'toolCalls')
  state.interventions = tableFrom(snapshot.entities.interventions, 'interventions') as Record<string, Intervention>
  state.tasks = tableFrom(snapshot.entities.tasks, 'tasks')
  state.artifacts = tableFrom(snapshot.entities.artifacts, 'artifacts') as Record<string, Artifact>
  for (const artifact of Object.values(state.artifacts)) migrateArtifactDefaults(artifact, state.runs[artifact.runId]?.createdAt)
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
    if (!Number.isSafeInteger(run.attempt) || run.attempt < 1) throw new Error(`Run ${run.id} has invalid attempt ${run.attempt}`)
    if (!run.retryOfRunId && run.attempt !== 1) throw new Error(`Initial Run ${run.id} must use attempt 1`)
    if (run.retryOfRunId && run.attempt < 2) throw new Error(`Retry Run ${run.id} must use attempt 2 or greater`)
    if (run.retryOfRunId === run.id) throw new Error(`Run ${run.id} cannot retry itself`)
    const predecessor = run.retryOfRunId ? state.runs[run.retryOfRunId] : undefined
    if (run.retryOfRunId && !predecessor) throw new Error(`Run ${run.id} references missing retry predecessor ${run.retryOfRunId}`)
    if (predecessor && (predecessor.threadId !== run.threadId || !['completed', 'failed', 'cancelled'].includes(predecessor.status) || run.attempt !== predecessor.attempt + 1)) throw new Error(`Run ${run.id} has invalid retry predecessor ${run.retryOfRunId}`)
    const visited = new Set([run.id])
    let retryOfRunId = run.retryOfRunId
    while (retryOfRunId) {
      if (visited.has(retryOfRunId)) throw new Error(`Run ${run.id} contains a retry cycle`)
      visited.add(retryOfRunId)
      retryOfRunId = state.runs[retryOfRunId]?.retryOfRunId
    }
    for (const activityId of run.activityIds) {
      if (!state.activities[activityId]) throw new Error(`Run ${run.id} references missing activity ${activityId}`)
      if (state.activities[activityId]?.runId !== run.id) throw new Error(`Run ${run.id} references activity ${activityId} from another run`)
    }
    for (const activity of Object.values(state.activities)) {
      if (activity.runId === run.id && !run.activityIds.includes(activity.id)) throw new Error(`Activity ${activity.id} is missing from Run ${run.id} activityIds`)
    }
  }
  for (const task of Object.values(state.tasks)) {
    if (typeof task.id !== 'string' || !task.id.trim()) throw new Error('Task contains an empty or invalid ID')
    if (!state.runs[task.runId]) throw new Error(`Task ${task.id} references missing run ${task.runId}`)
    if (typeof task.title !== 'string' || !task.title.trim()) throw new Error(`Task ${task.id} has an empty title`)
    if (typeof task.status !== 'string' || !validTaskStatuses.has(task.status)) throw new Error(`Task ${task.id} has invalid status ${String(task.status)}`)
    if (task.activityId !== undefined && (typeof task.activityId !== 'string' || !task.activityId.trim() || !state.activities[task.activityId] || state.activities[task.activityId]?.runId !== task.runId)) throw new Error(`Task ${task.id} references invalid activity ${String(task.activityId)}`)
    if (task.parentId !== undefined && (typeof task.parentId !== 'string' || !task.parentId.trim())) throw new Error(`Task ${task.id} has an empty parentId`)
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
    if (!intervention.requestedAt) intervention.requestedAt = state.runs[intervention.runId]!.createdAt
    if (!Number.isFinite(Date.parse(intervention.requestedAt))) throw new Error(`Intervention ${intervention.id} has invalid requestedAt`)
    if (intervention.activityId && (!state.activities[intervention.activityId] || state.activities[intervention.activityId]?.runId !== intervention.runId)) throw new Error(`Intervention ${intervention.id} references invalid activity ${intervention.activityId}`)
    if (!['pending', 'resolved', 'expired'].includes(intervention.status)) throw new Error(`Intervention ${intervention.id} has invalid status ${intervention.status}`)
    if (intervention.kind === 'choice' && !validOptions(intervention.options, 2)) throw new Error(`Choice intervention ${intervention.id} has invalid options`)
    if (intervention.kind === 'form' && (!intervention.fields?.length || new Set(intervention.fields.map((field) => field.name)).size !== intervention.fields.length || intervention.fields.some((field) => !field.name.trim() || !field.label.trim() || (field.type === 'select' && !validOptions(field.options, 1))))) throw new Error(`Form intervention ${intervention.id} has invalid fields`)
    if (intervention.expiresAt && !Number.isFinite(Date.parse(intervention.expiresAt))) throw new Error(`Intervention ${intervention.id} has invalid expiresAt`)
    if (intervention.status === 'resolved' && !intervention.resolvedAt) intervention.resolvedAt = intervention.requestedAt
    if (intervention.status === 'expired' && !intervention.expiredAt) intervention.expiredAt = intervention.expiresAt ?? intervention.requestedAt
  }
  for (const artifact of Object.values(state.artifacts)) {
    if (!state.runs[artifact.runId]) throw new Error(`Artifact ${artifact.id} references missing run ${artifact.runId}`)
    if (!Number.isSafeInteger(artifact.version) || artifact.version < 1) throw new Error(`Artifact ${artifact.id} has invalid version ${artifact.version}`)
    if (!Number.isFinite(Date.parse(artifact.createdAt))) throw new Error(`Artifact ${artifact.id} has invalid createdAt`)
    if (!['generating', 'available', 'failed', 'expired'].includes(artifact.status)) throw new Error(`Artifact ${artifact.id} has invalid status ${artifact.status}`)
    if (!['agent', 'tool', 'user', 'external'].includes(artifact.provenance.type) || (artifact.provenance.label !== undefined && !artifact.provenance.label.trim())) throw new Error(`Artifact ${artifact.id} has invalid provenance`)
    if (artifact.provenance.activityId && (!state.activities[artifact.provenance.activityId] || state.activities[artifact.provenance.activityId]?.runId !== artifact.runId)) throw new Error(`Artifact ${artifact.id} references invalid source activity ${artifact.provenance.activityId}`)
    if (artifact.provenance.toolCallId && (!state.toolCalls[artifact.provenance.toolCallId] || state.toolCalls[artifact.provenance.toolCallId]?.runId !== artifact.runId)) throw new Error(`Artifact ${artifact.id} references invalid source tool ${artifact.provenance.toolCallId}`)
    if (artifact.provenance.type === 'tool' && !artifact.provenance.toolCallId) throw new Error(`Artifact ${artifact.id} tool provenance requires toolCallId`)
    if (artifact.provenance.activityId && artifact.provenance.toolCallId && state.toolCalls[artifact.provenance.toolCallId]?.activityId !== artifact.provenance.activityId) throw new Error(`Artifact ${artifact.id} source activity and tool do not match`)
    if (!artifact.previousArtifactId && artifact.version !== 1) throw new Error(`Initial Artifact ${artifact.id} must use version 1`)
    const predecessor = artifact.previousArtifactId ? state.artifacts[artifact.previousArtifactId] : undefined
    if (artifact.previousArtifactId && (!predecessor || predecessor.runId !== artifact.runId || predecessor.status === 'generating' || artifact.version !== predecessor.version + 1)) throw new Error(`Artifact ${artifact.id} has invalid predecessor ${artifact.previousArtifactId}`)
    if (artifact.previousArtifactId && Object.values(state.artifacts).filter((candidate) => candidate.previousArtifactId === artifact.previousArtifactId).length > 1) throw new Error(`Artifact predecessor ${artifact.previousArtifactId} has multiple successors`)
    if (artifact.previousArtifactId === artifact.id) throw new Error(`Artifact ${artifact.id} cannot version itself`)
    const visited = new Set([artifact.id])
    let previousArtifactId = artifact.previousArtifactId
    while (previousArtifactId) {
      if (visited.has(previousArtifactId)) throw new Error(`Artifact ${artifact.id} contains a version cycle`)
      visited.add(previousArtifactId)
      previousArtifactId = state.artifacts[previousArtifactId]?.previousArtifactId
    }
    if (artifact.sizeBytes !== undefined && (!Number.isSafeInteger(artifact.sizeBytes) || artifact.sizeBytes < 0)) throw new Error(`Artifact ${artifact.id} has invalid size`)
    if (artifact.checksum && (!artifact.checksum.value.trim() || !['sha256', 'sha384', 'sha512', 'other'].includes(artifact.checksum.algorithm))) throw new Error(`Artifact ${artifact.id} has invalid checksum`)
    if (artifact.expiresAt && !Number.isFinite(Date.parse(artifact.expiresAt))) throw new Error(`Artifact ${artifact.id} has invalid expiresAt`)
  }
  for (const run of Object.values(state.runs)) {
    if (!['completed', 'failed', 'cancelled'].includes(run.status)) continue
    if (Object.values(state.activities).some((item) => item.runId === run.id && ['pending', 'running', 'awaiting_input'].includes(item.status))) throw new Error(`Terminal Run ${run.id} contains an open activity`)
    if (Object.values(state.toolCalls).some((item) => item.runId === run.id && item.status === 'running')) throw new Error(`Terminal Run ${run.id} contains a running tool call`)
    if (Object.values(state.interventions).some((item) => item.runId === run.id && item.status === 'pending')) throw new Error(`Terminal Run ${run.id} contains a pending intervention`)
    if (Object.values(state.artifacts).some((item) => item.runId === run.id && item.status === 'generating')) throw new Error(`Terminal Run ${run.id} contains a generating Artifact`)
  }
  return rebuildDerivedIndexes(state)
}
