import { createRuntime } from '@agentic-chat/runtime'
import { createInitialState, type CanonicalEvent } from '@agentic-chat/core'
import { AgenticChatProvider, createRendererRegistry } from '@agentic-chat/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AgenticChat, ArtifactCard, MessageView } from './index.js'

const events: CanonicalEvent[] = [
  { schemaVersion: '0.1', eventId: 'ui-1', type: 'run.started', threadId: 'thread-1', runId: 'run-1', sequence: 1, timestamp: '2026-07-13T00:00:00Z', data: {} },
  { schemaVersion: '0.1', eventId: 'ui-2', type: 'tool.started', threadId: 'thread-1', runId: 'run-1', sequence: 2, timestamp: '2026-07-13T00:00:01Z', data: { activityId: 'activity-1', toolCallId: 'call-1', name: 'query_data_source' } },
  { schemaVersion: '0.1', eventId: 'ui-3', type: 'tool.completed', threadId: 'thread-1', runId: 'run-1', sequence: 3, timestamp: '2026-07-13T00:00:02Z', data: { toolCallId: 'call-1', output: { rows: 1 } } },
]

describe('React default UI', () => {
  it('renders run status and a tool activity from runtime state', () => {
    const runtime = createRuntime()
    events.forEach((event) => runtime.dispatch(event))
    const html = renderToStaticMarkup(<AgenticChat runtime={runtime} runId="run-1" onSend={async () => {}} />)
    expect(html).toContain('运行中')
    expect(html).toContain('query_data_source')
    expect(html).toContain('&quot;rows&quot;: 1')
  })

  it('uses registered tool and result renderers', () => {
    const runtime = createRuntime()
    ;[...events,
      { schemaVersion: '0.1', eventId: 'ui-4', type: 'result.available', threadId: 'thread-1', runId: 'run-1', sequence: 4, timestamp: '2026-07-13T00:00:03Z', data: { kind: 'demo.result', result: { answer: 42 } } } satisfies CanonicalEvent,
    ].forEach((event) => runtime.dispatch(event))
    const renderers = createRendererRegistry()
    renderers.tool('query_data_source', ({ tool }) => <strong>custom tool: {tool.name}</strong>)
    renderers.result('demo.result', ({ content }) => <section>custom result: {(content.value as { answer: number }).answer}</section>)

    const html = renderToStaticMarkup(<AgenticChat runtime={runtime} renderers={renderers} runId="run-1" onSend={async () => {}} />)

    expect(html).toContain('custom tool: query_data_source')
    expect(html).toContain('custom result: 42')
  })

  it('renders registered message and artifact components with stable fallbacks available', () => {
    const initialState = createInitialState()
    initialState.messages.message = { id: 'message', threadId: 'thread-1', role: 'assistant', content: { kind: 'markdown', value: '# answer' }, createdAt: '2026-07-13T00:00:00Z' }
    initialState.artifacts.artifact = { id: 'artifact', runId: 'run-1', name: 'sales.csv', kind: 'text/csv', status: 'available' }
    const runtime = createRuntime({ initialState })
    const renderers = createRendererRegistry()
    renderers.message('markdown', ({ message }) => <p>message: {String(message.content.value)}</p>)
    renderers.artifact('text/csv', ({ artifact }) => <p>artifact: {artifact.name}</p>)

    const html = renderToStaticMarkup(<AgenticChatProvider runtime={runtime} renderers={renderers}><MessageView messageId="message" /><ArtifactCard artifactId="artifact" /></AgenticChatProvider>)

    expect(html).toContain('message: # answer')
    expect(html).toContain('artifact: sales.csv')
  })
})
