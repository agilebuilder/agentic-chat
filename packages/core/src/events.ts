import type { AgentError, TaskStatus } from './model.js'

export interface CanonicalTaskValue {
  id: string
  parentId?: string
  activityId?: string
  title: string
  status: TaskStatus
}

export type CanonicalTaskPatch =
  | { operation: 'upsert'; value: Omit<CanonicalTaskValue, 'id'> }
  | { operation: 'update'; changes: { parentId?: string | null; activityId?: string | null; title?: string; status?: TaskStatus } }
  | { operation: 'remove' }

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
  | EventEnvelope<'run.started', { attempt?: number; retryOfRunId?: string }>
  | EventEnvelope<'run.status.changed', { status: 'running' | 'awaiting_input' | 'paused' }>
  | EventEnvelope<'status.delta', { activityId: string; content: string }>
  | EventEnvelope<'activity.started', { activityId: string; kind: 'workflow' | 'subagent' | 'custom'; title?: string; parentActivityId?: string }>
  | EventEnvelope<'activity.completed', { activityId: string }>
  | EventEnvelope<'tool.started', { activityId: string; toolCallId: string; name: string; input?: unknown; parentActivityId?: string }>
  | EventEnvelope<'tool.args.delta', { toolCallId: string; delta: string }>
  | EventEnvelope<'tool.completed', { toolCallId: string; output?: unknown }>
  | EventEnvelope<'tool.failed', { toolCallId: string; error: AgentError }>
  | EventEnvelope<'result.available', { kind: string; result: unknown }>
  | EventEnvelope<'result.delta', { delta: string }>
  | EventEnvelope<'intervention.requested', { interventionId: string; kind: 'confirm' | 'approval' | 'choice' | 'text' | 'form'; prompt: string; activityId?: string }>
  | EventEnvelope<'intervention.resolved', { interventionId: string; response: unknown }>
  | EventEnvelope<'tasks.snapshot', { revision: number; tasks: CanonicalTaskValue[] }>
  | EventEnvelope<'task.patched', { baseRevision: number; revision: number; taskId: string; patch: CanonicalTaskPatch }>
  | EventEnvelope<'source.observed', { sourceType: string }>
  | EventEnvelope<'run.completed', Record<string, never>>
  | EventEnvelope<'run.failed', { error: AgentError }>
  | EventEnvelope<'run.cancelled', Record<string, never>>
