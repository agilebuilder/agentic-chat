import type { Activity, AgentRun, AgenticState, ToolCall } from '@agentic-chat/core'

export const selectRun = (state: AgenticState, runId: string): AgentRun | undefined => state.runs[runId]

export const selectRunActivities = (state: AgenticState, runId: string): Activity[] => {
  const run = state.runs[runId]
  if (!run) return []
  return run.activityIds.map((id) => state.activities[id]).filter((item): item is Activity => item !== undefined)
}

export const selectToolCall = (state: AgenticState, toolCallId: string): ToolCall | undefined => state.toolCalls[toolCallId]

export const selectLatestRunId = (state: AgenticState, threadId?: string): string | undefined => {
  const runs = Object.values(state.runs).filter((run) => threadId === undefined || run.threadId === threadId)
  return runs.sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]?.id
}

export const selectRunNeedsAttention = (state: AgenticState, runId: string): boolean => {
  const run = state.runs[runId]
  return run?.status === 'awaiting_input' || Object.values(state.interventions).some((item) => item.runId === runId && item.status === 'pending')
}
