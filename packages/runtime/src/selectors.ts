import type { Activity, AgentRun, AgenticState, Artifact, ToolCall } from '@agentic-chat/core'

/** @public */
export const selectRun = (state: AgenticState, runId: string): AgentRun | undefined => state.runs[runId]

/** @public */
export const selectRunActivities = (state: AgenticState, runId: string): Activity[] => {
  const run = state.runs[runId]
  if (!run) return []
  return run.activityIds.map((id) => state.activities[id]).filter((item): item is Activity => item !== undefined)
}

/** @public */
export const selectRootActivityIds = (state: AgenticState, runId: string): readonly string[] => state.rootActivityIdsByRunId[runId] ?? emptyIds

/** @public */
export const selectChildActivityIds = (state: AgenticState, activityId: string): readonly string[] => state.childActivityIdsByParentId[activityId] ?? emptyIds

/** @public */
export interface ActivityTreeNode {
  activity: Activity
  children: ActivityTreeNode[]
}

/** @public */
export function selectRunActivityTree(state: AgenticState, runId: string): ActivityTreeNode[] {
  const build = (activityId: string): ActivityTreeNode | undefined => {
    const activity = state.activities[activityId]
    if (!activity) return undefined
    return { activity, children: selectChildActivityIds(state, activityId).map(build).filter((item): item is ActivityTreeNode => item !== undefined) }
  }
  return selectRootActivityIds(state, runId).map(build).filter((item): item is ActivityTreeNode => item !== undefined)
}

/** @public */
export function selectRunAttemptHistory(state: AgenticState, runId: string): AgentRun[] {
  const target = state.runs[runId]
  if (!target) return []
  const rootOf = (run: AgentRun): string => {
    const visited = new Set([run.id])
    let current = run
    while (current.retryOfRunId) {
      if (visited.has(current.retryOfRunId)) break
      const predecessor = state.runs[current.retryOfRunId]
      if (!predecessor) break
      visited.add(predecessor.id)
      current = predecessor
    }
    return current.id
  }
  const rootId = rootOf(target)
  return Object.values(state.runs)
    .filter((run) => run.threadId === target.threadId && rootOf(run) === rootId)
    .sort((left, right) => left.attempt - right.attempt || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
}

/** @public */
export const selectToolCall = (state: AgenticState, toolCallId: string): ToolCall | undefined => state.toolCalls[toolCallId]

/** @public */
export const selectLatestRunId = (state: AgenticState, threadId?: string): string | undefined => {
  let latest: AgentRun | undefined
  for (const run of Object.values(state.runs)) {
    if (threadId !== undefined && run.threadId !== threadId) continue
    if (!latest || run.createdAt > latest.createdAt) latest = run
  }
  return latest?.id
}

/** @public */
export const selectRunNeedsAttention = (state: AgenticState, runId: string): boolean => {
  const run = state.runs[runId]
  return run?.status === 'awaiting_input' || Object.values(state.interventions).some((item) => item.runId === runId && item.status === 'pending')
}

/** @public */
export const selectRunArtifacts = (state: AgenticState, runId: string): Artifact[] => Object.values(state.artifacts)
  .filter((artifact) => artifact.runId === runId)
  .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.version - right.version || left.id.localeCompare(right.id))

/** @public */
export const selectArtifactsForActivity = (state: AgenticState, activityId: string): Artifact[] => Object.values(state.artifacts)
  .filter((artifact) => artifact.provenance.activityId === activityId)
  .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))

/** @public */
export function selectArtifactVersionHistory(state: AgenticState, artifactId: string): Artifact[] {
  const target = state.artifacts[artifactId]
  if (!target) return []
  const rootOf = (artifact: Artifact): string => {
    const visited = new Set([artifact.id])
    let current = artifact
    while (current.previousArtifactId) {
      if (visited.has(current.previousArtifactId)) break
      const predecessor = state.artifacts[current.previousArtifactId]
      if (!predecessor) break
      visited.add(predecessor.id)
      current = predecessor
    }
    return current.id
  }
  const rootId = rootOf(target)
  return Object.values(state.artifacts)
    .filter((artifact) => artifact.runId === target.runId && rootOf(artifact) === rootId)
    .sort((left, right) => left.version - right.version || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
}

const emptyIds: readonly string[] = []
