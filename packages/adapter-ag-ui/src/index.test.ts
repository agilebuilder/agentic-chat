import { createInitialState, replayEvents } from '@agentic-chat/core'
import { checkAdapterConformance, checkSnapshotReplayConformance } from '@agentic-chat/testkit'
import { describe, expect, it } from 'vitest'
import { adaptAgUiEvents, agUiCapabilities, type AgUiEvent } from './index.js'

const fixture: AgUiEvent[] = [
  { type: 'RUN_STARTED', threadId: 'thread-ag', runId: 'run-ag', timestamp: 0 },
  { type: 'STEP_STARTED', stepName: 'research' },
  { type: 'TOOL_CALL_START', toolCallId: 'call-ag', toolCallName: 'web_search' },
  { type: 'TOOL_CALL_ARGS', toolCallId: 'call-ag', delta: '{"query":' },
  { type: 'TOOL_CALL_ARGS', toolCallId: 'call-ag', delta: '"agent UI"}' },
  { type: 'TOOL_CALL_END', toolCallId: 'call-ag' },
  { type: 'TOOL_CALL_RESULT', messageId: 'tool-message', toolCallId: 'call-ag', content: '3 sources' },
  { type: 'STEP_FINISHED', stepName: 'research' },
  { type: 'TEXT_MESSAGE_START', messageId: 'answer', role: 'assistant' },
  { type: 'TEXT_MESSAGE_CONTENT', messageId: 'answer', delta: '研究' },
  { type: 'TEXT_MESSAGE_CONTENT', messageId: 'answer', delta: '完成' },
  { type: 'TEXT_MESSAGE_END', messageId: 'answer' },
  { type: 'RUN_FINISHED', threadId: 'thread-ag', runId: 'run-ag' },
]

describe('AG-UI adapter fixture', () => {
  it('passes the shared conformance suite with chunked tools, steps, and text', () => {
    const adapted = adaptAgUiEvents(fixture)
    const result = checkAdapterConformance(adapted.events, {
      expectedStatus: 'completed',
      sequence: agUiCapabilities.sequence,
    })
    expect(adapted.diagnostics).toEqual([])
    expect(result.issues).toEqual([])
    expect(result.state.toolCalls['call-ag']?.inputText).toBe('{"query":"agent UI"}')
    expect(result.state.toolCalls['call-ag']?.output).toBe('3 sources')
    expect(result.state.results['run-ag']).toEqual({ kind: 'text', value: '研究完成' })
    expect(result.state.activities['step:1:research']?.status).toBe('completed')
    expect(result.state.streams['run-ag']?.lastSequence).toBe(fixture.length)
    expect(adapted.events[0]?.timestamp).toBe('1970-01-01T00:00:00.000Z')
    expect(checkSnapshotReplayConformance(adapted.events, 6).issues).toEqual([])
  })

  it('keeps a tool running after TOOL_CALL_END until its result arrives', () => {
    const throughArgs = adaptAgUiEvents(fixture.slice(0, 6))
    const state = replayEvents(throughArgs.events, createInitialState())
    expect(state.toolCalls['call-ag']?.status).toBe('running')
  })

  it('rejects argument chunks after TOOL_CALL_END without breaking sequence', () => {
    const adapted = adaptAgUiEvents([
      { type: 'RUN_STARTED', threadId: 'thread-ag', runId: 'run-ag' },
      { type: 'TOOL_CALL_START', toolCallId: 'call-ag', toolCallName: 'search' },
      { type: 'TOOL_CALL_END', toolCallId: 'call-ag' },
      { type: 'TOOL_CALL_ARGS', toolCallId: 'call-ag', delta: '{}' },
      { type: 'TOOL_CALL_RESULT', messageId: 'tool-message', toolCallId: 'call-ag', content: 'done' },
      { type: 'RUN_FINISHED', threadId: 'thread-ag', runId: 'run-ag' },
    ])
    expect(adapted.diagnostics[0]?.message).toContain('outside the argument phase')
    expect(adapted.events.map((event) => event.sequence)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('emits a run result before the terminal event when RUN_FINISHED carries one', () => {
    const adapted = adaptAgUiEvents([
      { type: 'RUN_STARTED', threadId: 'thread-ag', runId: 'run-ag' },
      { type: 'RUN_FINISHED', threadId: 'thread-ag', runId: 'run-ag', result: { answer: 42 } },
    ])
    expect(adapted.events.map((event) => event.type)).toEqual(['run.started', 'result.available', 'run.completed'])
    expect(checkAdapterConformance(adapted.events).issues).toEqual([])
  })

  it('preserves stable but unmodeled events and reports them', () => {
    const adapted = adaptAgUiEvents([
      { type: 'RUN_STARTED', threadId: 'thread-ag', runId: 'run-ag' },
      { type: 'STATE_SNAPSHOT', snapshot: { progress: 1 } },
      { type: 'RUN_FINISHED', threadId: 'thread-ag', runId: 'run-ag' },
    ])
    expect(adapted.events[1]?.type).toBe('source.observed')
    expect(adapted.diagnostics).toEqual([
      { code: 'unsupported_event', message: 'STATE_SNAPSHOT is preserved but not yet modeled', sourceIndex: 1 },
    ])
  })

  it('maps only revisioned tasks in the explicit agenticChat state namespace', () => {
    const adapted = adaptAgUiEvents([
      { type: 'RUN_STARTED', threadId: 'thread-ag', runId: 'run-ag' },
      { type: 'STATE_SNAPSHOT', snapshot: { agenticChat: { tasks: { revision: 1, items: [
        { id: 'research', title: 'Research', status: 'in_progress' },
      ] } } } },
      { type: 'STATE_DELTA', delta: [{ op: 'replace', path: '/agenticChat/tasks', value: { revision: 2, items: [
        { id: 'research', title: 'Research', status: 'completed' },
        { id: 'write', parentId: 'research', title: 'Write', status: 'in_progress' },
      ] } }] },
      { type: 'RUN_FINISHED', threadId: 'thread-ag', runId: 'run-ag' },
    ])
    const result = checkAdapterConformance(adapted.events, { sequence: agUiCapabilities.sequence })
    expect(adapted.diagnostics).toEqual([])
    expect(result.issues).toEqual([])
    expect(result.state.taskRevisionByRunId['run-ag']).toBe(2)
    expect(result.state.tasks.research?.status).toBe('completed')
    expect(result.state.tasks.write?.parentId).toBe('research')
    expect(checkSnapshotReplayConformance(adapted.events, 2).issues).toEqual([])
  })

  it('does not trust malformed data inside the agenticChat namespace', () => {
    const adapted = adaptAgUiEvents([
      { type: 'RUN_STARTED', threadId: 'thread-ag', runId: 'run-ag' },
      { type: 'STATE_SNAPSHOT', snapshot: { agenticChat: { tasks: { revision: 1, items: [{ id: 'task', title: 'Unsafe', status: 'invented' }] } } } },
      { type: 'RUN_FINISHED', threadId: 'thread-ag', runId: 'run-ag' },
    ])
    expect(adapted.events[1]?.type).toBe('source.observed')
    expect(adapted.diagnostics[0]?.code).toBe('invalid_event')
  })

  it('diagnoses malformed lifecycle events without breaking canonical sequence', () => {
    const adapted = adaptAgUiEvents([
      { type: 'RUN_STARTED', threadId: 'thread-ag', runId: 'run-ag' },
      { type: 'STEP_FINISHED', stepName: 'missing' },
      { type: 'RUN_FINISHED', threadId: 'thread-ag', runId: 'run-ag' },
    ])
    expect(adapted.diagnostics[0]?.code).toBe('invalid_event')
    expect(adapted.events.map((event) => event.sequence)).toEqual([1, 2, 3])
    expect(checkAdapterConformance(adapted.events).issues).toEqual([])
  })

  it('diagnoses an event before run context exists', () => {
    expect(adaptAgUiEvents([{ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'orphan' }]).diagnostics[0]?.code).toBe('missing_run_context')
  })

  it('falls back deterministically when an untrusted timestamp is invalid', () => {
    const adapted = adaptAgUiEvents([
      { type: 'RUN_STARTED', threadId: 'thread-ag', runId: 'run-ag', timestamp: Number.NaN },
      { type: 'RUN_FINISHED', threadId: 'thread-ag', runId: 'run-ag' },
    ])
    expect(adapted.diagnostics[0]?.message).toContain('invalid timestamp')
    expect(adapted.events[0]?.timestamp).toBe('2026-07-13T00:00:00.000Z')
  })
})
