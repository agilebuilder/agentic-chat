import type { AgentError } from './model.js'

export interface EventEnvelope<TType extends string, TData> {
  schemaVersion: '0.1'
  eventId: string
  type: TType
  threadId: string
  runId: string
  sequence: number
  timestamp: string
  data: TData
  source?: string
}

export type CanonicalEvent =
  | EventEnvelope<'run.started', Record<string, never>>
  | EventEnvelope<'status.delta', { activityId: string; content: string }>
  | EventEnvelope<'tool.started', { activityId: string; toolCallId: string; name: string; input?: unknown }>
  | EventEnvelope<'tool.completed', { toolCallId: string; output?: unknown }>
  | EventEnvelope<'tool.failed', { toolCallId: string; error: AgentError }>
  | EventEnvelope<'result.available', { result: unknown }>
  | EventEnvelope<'run.completed', Record<string, never>>
  | EventEnvelope<'run.failed', { error: AgentError }>
  | EventEnvelope<'run.cancelled', Record<string, never>>
