import { createInitialState, replayEvents } from '@agentic-chat/core'
import { checkRunConformance } from '@agentic-chat/testkit'
import { describe, expect, it } from 'vitest'
import { adaptAgUiEvents, type AgUiEvent } from './index.js'

const fixture: AgUiEvent[] = [
  { type: 'RUN_STARTED', threadId: 'thread-ag', runId: 'run-ag' },
  { type: 'TOOL_CALL_START', toolCallId: 'call-ag', toolCallName: 'web_search' },
  { type: 'TOOL_CALL_ARGS', toolCallId: 'call-ag', delta: '{"query":' },
  { type: 'TOOL_CALL_ARGS', toolCallId: 'call-ag', delta: '"agent UI"}' },
  { type: 'TOOL_CALL_END', toolCallId: 'call-ag' },
  { type: 'TOOL_CALL_RESULT', messageId: 'tool-message', toolCallId: 'call-ag', content: '3 sources' },
  { type: 'TEXT_MESSAGE_START', messageId: 'answer', role: 'assistant' },
  { type: 'TEXT_MESSAGE_CONTENT', messageId: 'answer', delta: '研究' },
  { type: 'TEXT_MESSAGE_CONTENT', messageId: 'answer', delta: '完成' },
  { type: 'TEXT_MESSAGE_END', messageId: 'answer' },
  { type: 'STATE_SNAPSHOT', snapshot: { progress: 1 } },
  { type: 'RUN_FINISHED', threadId: 'thread-ag', runId: 'run-ag' },
]

describe('AG-UI adapter fixture', () => {
  it('maps chunked tools and text while preserving source order', () => {
    const adapted = adaptAgUiEvents(fixture)
    const state = replayEvents(adapted.events, createInitialState())
    expect(adapted.diagnostics).toEqual([])
    expect(checkRunConformance(adapted.events).issues).toEqual([])
    expect(state.runs['run-ag']?.status).toBe('completed')
    expect(state.toolCalls['call-ag']?.inputText).toBe('{"query":"agent UI"}')
    expect(state.toolCalls['call-ag']?.output).toBe('3 sources')
    expect(state.results['run-ag']).toBe('研究完成')
    expect(state.streams['run-ag']?.lastSequence).toBe(fixture.length)
  })

  it('diagnoses an event before run context exists', () => {
    expect(adaptAgUiEvents([{ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'orphan' }]).diagnostics[0]?.code).toBe('missing_run_context')
  })
})
