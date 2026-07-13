import { createRuntime } from '@agentic-chat/runtime'
import type { CanonicalEvent } from '@agentic-chat/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AgenticChat } from './index.js'

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
})
