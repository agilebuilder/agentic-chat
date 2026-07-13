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
  | EventEnvelope<'run.status.changed', { status: 'running' | 'awaiting_input' | 'paused' }>
  | EventEnvelope<'status.delta', { activityId: string; content: string }>
  | EventEnvelope<'activity.started', { activityId: string; kind: 'workflow' | 'subagent' | 'custom'; title?: string; parentActivityId?: string }>
  | EventEnvelope<'activity.completed', { activityId: string }>
  | EventEnvelope<'tool.started', { activityId: string; toolCallId: string; name: string; input?: unknown; parentActivityId?: string }>
  | EventEnvelope<'tool.args.delta', { toolCallId: string; delta: string }>
  | EventEnvelope<'tool.completed', { toolCallId: string; output?: unknown }>
  | EventEnvelope<'tool.failed', { toolCallId: string; error: AgentError }>
  | EventEnvelope<'result.available', { result: unknown }>
  | EventEnvelope<'result.delta', { delta: string }>
  | EventEnvelope<'intervention.requested', { interventionId: string; kind: 'confirm' | 'approval' | 'choice' | 'text' | 'form'; prompt: string; activityId?: string }>
  | EventEnvelope<'intervention.resolved', { interventionId: string; response: unknown }>
  | EventEnvelope<'source.observed', { sourceType: string }>
  | EventEnvelope<'run.completed', Record<string, never>>
  | EventEnvelope<'run.failed', { error: AgentError }>
  | EventEnvelope<'run.cancelled', Record<string, never>>
