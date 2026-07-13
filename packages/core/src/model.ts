export type RunStatus =
  | 'queued'
  | 'running'
  | 'awaiting_input'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type ActivityStatus =
  | 'pending'
  | 'running'
  | 'awaiting_input'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped'

export interface AgentRun {
  id: string
  threadId: string
  status: RunStatus
  activityIds: string[]
  createdAt: string
  startedAt?: string
  endedAt?: string
  error?: AgentError
}

export interface Activity {
  id: string
  runId: string
  kind: 'status' | 'reasoning_summary' | 'tool' | 'custom'
  status: ActivityStatus
  order: number
  parentId?: string
  toolCallId?: string
  text?: string
  startedAt?: string
  endedAt?: string
}

export interface ToolCall {
  id: string
  runId: string
  name: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  input?: unknown
  output?: unknown
  error?: AgentError
  startedAt: string
  endedAt?: string
}

export interface AgentError {
  code: string
  message: string
  details?: unknown
}

export interface StreamCursor {
  scope: 'run'
  lastSequence: number
  seenEventIds: Record<string, true>
  blocked: boolean
}

export interface Diagnostic {
  code: 'duplicate_event' | 'sequence_gap' | 'invalid_transition' | 'unknown_event'
  message: string
  eventId: string
  runId: string
}

export interface AgenticState {
  runs: Record<string, AgentRun>
  activities: Record<string, Activity>
  toolCalls: Record<string, ToolCall>
  results: Record<string, unknown>
  streams: Record<string, StreamCursor>
  diagnostics: Diagnostic[]
}

export function createInitialState(): AgenticState {
  return { runs: {}, activities: {}, toolCalls: {}, results: {}, streams: {}, diagnostics: [] }
}
