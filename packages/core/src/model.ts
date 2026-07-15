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

export interface Thread {
  id: string
  title?: string
  messageIds: string[]
  runIds: string[]
}

export interface RenderableContent {
  kind: string
  value: unknown
}

export interface Message {
  id: string
  threadId: string
  runId?: string
  role: 'user' | 'assistant' | 'system'
  content: RenderableContent
  createdAt: string
}

export interface AgentRun {
  id: string
  threadId: string
  status: RunStatus
  attempt: number
  retryOfRunId?: string
  activityIds: string[]
  createdAt: string
  startedAt?: string
  endedAt?: string
  error?: AgentError
}

export interface Activity {
  id: string
  runId: string
  kind: 'status' | 'reasoning_summary' | 'tool' | 'workflow' | 'subagent' | 'custom'
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
  activityId: string
  name: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  input?: unknown
  inputText?: string
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
  /** Events at or below this sequence were deliberately compacted. */
  compactedThroughSequence: number
  seenEventIds: Record<string, true>
  blocked: boolean
}

export interface Diagnostic {
  code: 'duplicate_event' | 'sequence_gap' | 'invalid_transition' | 'revision_conflict' | 'unknown_event'
  message: string
  eventId: string
  runId: string
}

export interface Intervention {
  id: string
  runId: string
  activityId?: string
  kind: 'confirm' | 'approval' | 'choice' | 'text' | 'form'
  status: 'pending' | 'resolved' | 'expired'
  prompt: string
  description?: string
  risk?: string
  impact?: string
  options?: InterventionOption[]
  fields?: InterventionField[]
  requestedAt: string
  expiresAt?: string
  resolvedAt?: string
  expiredAt?: string
  response?: unknown
}

export interface InterventionOption {
  value: string
  label: string
  description?: string
}

export interface InterventionField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox'
  required?: boolean
  placeholder?: string
  options?: InterventionOption[]
}

export interface AgentTask {
  id: string
  runId: string
  parentId?: string
  activityId?: string
  title: string
  status: TaskStatus
}

export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled'

export interface Artifact {
  id: string
  runId: string
  sourceActivityId?: string
  name: string
  kind: string
  status: 'generating' | 'available' | 'failed' | 'expired'
  uri?: string
}

export interface AgenticState {
  threads: Record<string, Thread>
  messages: Record<string, Message>
  runs: Record<string, AgentRun>
  activities: Record<string, Activity>
  rootActivityIdsByRunId: Record<string, string[]>
  childActivityIdsByParentId: Record<string, string[]>
  toolCalls: Record<string, ToolCall>
  activityByToolCallId: Record<string, string>
  results: Record<string, RenderableContent>
  interventions: Record<string, Intervention>
  tasks: Record<string, AgentTask>
  taskRevisionByRunId: Record<string, number>
  artifacts: Record<string, Artifact>
  streams: Record<string, StreamCursor>
  diagnostics: Diagnostic[]
}

export function createInitialState(): AgenticState {
  return { threads: {}, messages: {}, runs: {}, activities: {}, rootActivityIdsByRunId: {}, childActivityIdsByParentId: {}, toolCalls: {}, activityByToolCallId: {}, results: {}, interventions: {}, tasks: {}, taskRevisionByRunId: {}, artifacts: {}, streams: {}, diagnostics: [] }
}
