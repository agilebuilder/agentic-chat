/** @public */
export type RunStatus =
  | 'queued'
  | 'running'
  | 'awaiting_input'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

/** @public */
export type ActivityStatus =
  | 'pending'
  | 'running'
  | 'awaiting_input'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped'

/** @public */
export interface Thread {
  id: string
  title?: string
  messageIds: string[]
  runIds: string[]
}

/** @public */
export interface RenderableContent {
  kind: string
  value: unknown
}

/** @public */
export interface Message {
  id: string
  threadId: string
  runId?: string
  role: 'user' | 'assistant' | 'system'
  content: RenderableContent
  createdAt: string
}

/** @public */
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

/** @public */
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

/** @public */
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

/** @public */
export interface AgentError {
  code: string
  message: string
  details?: unknown
}

/** @public */
export interface StreamCursor {
  scope: 'run'
  lastSequence: number
  /** Events at or below this sequence were deliberately compacted. */
  compactedThroughSequence: number
  seenEventIds: Record<string, true>
  blocked: boolean
}

/** @public */
export interface Diagnostic {
  code: 'duplicate_event' | 'sequence_gap' | 'invalid_transition' | 'revision_conflict' | 'unknown_event' | 'unsupported_schema'
  message: string
  eventId: string
  runId: string
}

/** @public */
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

/** @public */
export interface InterventionOption {
  value: string
  label: string
  description?: string
}

/** @public */
export interface InterventionField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox'
  required?: boolean
  placeholder?: string
  options?: InterventionOption[]
}

/** @public */
export interface AgentTask {
  id: string
  runId: string
  parentId?: string
  activityId?: string
  title: string
  status: TaskStatus
}

/** @public */
export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled'

/** @public */
export type ArtifactStatus = 'generating' | 'available' | 'failed' | 'expired'

/** @public */
export interface ArtifactProvenance {
  type: 'agent' | 'tool' | 'user' | 'external'
  activityId?: string
  toolCallId?: string
  label?: string
}

/** @public */
export interface ArtifactChecksum {
  algorithm: 'sha256' | 'sha384' | 'sha512' | 'other'
  value: string
}

/** @public */
export interface Artifact {
  id: string
  runId: string
  name: string
  kind: string
  status: ArtifactStatus
  version: number
  previousArtifactId?: string
  provenance: ArtifactProvenance
  createdAt: string
  availableAt?: string
  endedAt?: string
  uri?: string
  sizeBytes?: number
  checksum?: ArtifactChecksum
  expiresAt?: string
  error?: AgentError
}

/** @public */
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

/** @public */
export function createInitialState(): AgenticState {
  return { threads: {}, messages: {}, runs: {}, activities: {}, rootActivityIdsByRunId: {}, childActivityIdsByParentId: {}, toolCalls: {}, activityByToolCallId: {}, results: {}, interventions: {}, tasks: {}, taskRevisionByRunId: {}, artifacts: {}, streams: {}, diagnostics: [] }
}
