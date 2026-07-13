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

export interface Message {
  id: string
  threadId: string
  runId?: string
  role: 'user' | 'assistant' | 'system'
  content: unknown
  createdAt: string
}

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
  seenEventIds: Record<string, true>
  blocked: boolean
}

export interface Diagnostic {
  code: 'duplicate_event' | 'sequence_gap' | 'invalid_transition' | 'unknown_event'
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
  response?: unknown
}

export interface AgentTask {
  id: string
  runId: string
  parentId?: string
  activityId?: string
  title: string
  status: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled'
}

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
  toolCalls: Record<string, ToolCall>
  results: Record<string, unknown>
  interventions: Record<string, Intervention>
  tasks: Record<string, AgentTask>
  artifacts: Record<string, Artifact>
  streams: Record<string, StreamCursor>
  diagnostics: Diagnostic[]
}

export function createInitialState(): AgenticState {
  return { threads: {}, messages: {}, runs: {}, activities: {}, toolCalls: {}, results: {}, interventions: {}, tasks: {}, artifacts: {}, streams: {}, diagnostics: [] }
}
