import type { Activity, AgentRun, AgenticState, ToolCall } from '@agentic-chat/core'

export const selectRun = (state: AgenticState, runId: string): AgentRun | undefined => state.runs[runId]

export const selectRunActivities = (state: AgenticState, runId: string): Activity[] => {
  const run = state.runs[runId]
  if (!run) return []
  return run.activityIds.map((id) => state.activities[id]).filter((item): item is Activity => item !== undefined)
}

export const selectRootActivityIds = (state: AgenticState, runId: string): readonly string[] => state.rootActivityIdsByRunId[runId] ?? emptyIds

export const selectChildActivityIds = (state: AgenticState, activityId: string): readonly string[] => state.childActivityIdsByParentId[activityId] ?? emptyIds

export interface ActivityTreeNode {
  activity: Activity
  children: ActivityTreeNode[]
}

export function selectRunActivityTree(state: AgenticState, runId: string): ActivityTreeNode[] {
  const build = (activityId: string): ActivityTreeNode | undefined => {
    const activity = state.activities[activityId]
    if (!activity) return undefined
    return { activity, children: selectChildActivityIds(state, activityId).map(build).filter((item): item is ActivityTreeNode => item !== undefined) }
  }
  return selectRootActivityIds(state, runId).map(build).filter((item): item is ActivityTreeNode => item !== undefined)
}

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

export const selectToolCall = (state: AgenticState, toolCallId: string): ToolCall | undefined => state.toolCalls[toolCallId]

export const selectLatestRunId = (state: AgenticState, threadId?: string): string | undefined => {
  let latest: AgentRun | undefined
  for (const run of Object.values(state.runs)) {
    if (threadId !== undefined && run.threadId !== threadId) continue
    if (!latest || run.createdAt > latest.createdAt) latest = run
  }
  return latest?.id
}

export const selectRunNeedsAttention = (state: AgenticState, runId: string): boolean => {
  const run = state.runs[runId]
  return run?.status === 'awaiting_input' || Object.values(state.interventions).some((item) => item.runId === runId && item.status === 'pending')
}

const emptyIds: readonly string[] = []
