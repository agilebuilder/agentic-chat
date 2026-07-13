import type { CanonicalEvent } from '@agentic-chat/core'

export const chatBiSuccessfulRun: CanonicalEvent[] = [
  { schemaVersion: '0.1', eventId: 'evt-1', type: 'run.started', threadId: 'thread-1', runId: 'run-1', sequence: 1, timestamp: '2026-07-13T00:00:00Z', data: {}, source: 'chatbi' },
  { schemaVersion: '0.1', eventId: 'evt-2', type: 'tool.started', threadId: 'thread-1', runId: 'run-1', sequence: 2, timestamp: '2026-07-13T00:00:01Z', data: { activityId: 'tool-activity-1', toolCallId: 'tool-call-1', name: 'query_data_source' }, source: 'chatbi' },
  { schemaVersion: '0.1', eventId: 'evt-3', type: 'tool.completed', threadId: 'thread-1', runId: 'run-1', sequence: 3, timestamp: '2026-07-13T00:00:02Z', data: { toolCallId: 'tool-call-1', output: { ok: true } }, source: 'chatbi' },
  { schemaVersion: '0.1', eventId: 'evt-4', type: 'result.available', threadId: 'thread-1', runId: 'run-1', sequence: 4, timestamp: '2026-07-13T00:00:03Z', data: { result: { row_count: 3, columns: ['region', 'amount'] } }, source: 'chatbi' },
  { schemaVersion: '0.1', eventId: 'evt-5', type: 'run.completed', threadId: 'thread-1', runId: 'run-1', sequence: 5, timestamp: '2026-07-13T00:00:04Z', data: {}, source: 'chatbi' },
]
