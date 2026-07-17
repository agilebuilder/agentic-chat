import type { CanonicalEvent } from '@agentic-chat/core'
export * from './conformance.js'
export * from './coding-fixture.js'

/** @public */
export interface RawChatBiEvent {
  protocol_version: '1.0'
  event_id: string
  event_type: string
  session_id: string
  run_id: string
  sequence: number
  created_at: string
  tool_call_id: string | null
  payload: Record<string, unknown>
}

const raw = (runId: string, sequence: number, eventType: string, payload: Record<string, unknown> = {}, toolCallId: string | null = null): RawChatBiEvent => ({
  protocol_version: '1.0', event_id: `${runId}-event-${sequence}`, event_type: eventType, session_id: 'session-fixture', run_id: runId, sequence, created_at: `2026-07-13T00:00:0${sequence}Z`, tool_call_id: toolCallId, payload,
})

/** @public */
export const rawChatBiSuccessfulRun = [
  raw('run-success', 1, 'run.started', { message: 'Run started' }),
  raw('run-success', 2, 'tool.started', { tool_name: 'query_data_source' }, 'call-success'),
  raw('run-success', 3, 'tool.finished', { tool_name: 'query_data_source', ok: true }, 'call-success'),
  raw('run-success', 4, 'result', { columns: ['region', 'amount'], rows: [['east', 42]], row_count: 1 }),
  raw('run-success', 5, 'run.completed', { row_count: 1 }),
] as const

/** @public */
export const rawChatBiFailedRun = [
  raw('run-failed', 1, 'run.started', { message: 'Run started' }),
  raw('run-failed', 2, 'tool.started', { tool_name: 'query_data_source' }, 'call-failed'),
  raw('run-failed', 3, 'tool.finished', { tool_name: 'query_data_source', ok: false, message: 'query timeout' }, 'call-failed'),
  raw('run-failed', 4, 'run.failed', { message: 'query timeout' }),
] as const

/** @public */
export const rawChatBiCancelledRun = [
  raw('run-cancelled', 1, 'run.cancelled', { message: 'Run cancelled' }),
] as const

/** @public */
export const chatBiSuccessfulRun: CanonicalEvent[] = [
  { schemaVersion: '0.1', eventId: 'evt-1', type: 'run.started', threadId: 'thread-1', runId: 'run-1', sequence: 1, timestamp: '2026-07-13T00:00:00Z', data: {}, source: 'chatbi' },
  { schemaVersion: '0.1', eventId: 'evt-2', type: 'tool.started', threadId: 'thread-1', runId: 'run-1', sequence: 2, timestamp: '2026-07-13T00:00:01Z', data: { activityId: 'tool-activity-1', toolCallId: 'tool-call-1', name: 'query_data_source' }, source: 'chatbi' },
  { schemaVersion: '0.1', eventId: 'evt-3', type: 'tool.completed', threadId: 'thread-1', runId: 'run-1', sequence: 3, timestamp: '2026-07-13T00:00:02Z', data: { toolCallId: 'tool-call-1', output: { ok: true } }, source: 'chatbi' },
  { schemaVersion: '0.1', eventId: 'evt-4', type: 'result.available', threadId: 'thread-1', runId: 'run-1', sequence: 4, timestamp: '2026-07-13T00:00:03Z', data: { kind: 'chatbi.query-result', result: { row_count: 3, columns: ['region', 'amount'] } }, source: 'chatbi' },
  { schemaVersion: '0.1', eventId: 'evt-5', type: 'run.completed', threadId: 'thread-1', runId: 'run-1', sequence: 5, timestamp: '2026-07-13T00:00:04Z', data: {}, source: 'chatbi' },
]
