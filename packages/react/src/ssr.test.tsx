import { createRuntime, type RuntimeSnapshot } from '@agentic-chat/runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AgenticChatProvider, useRuntimeSelector } from './index.js'

function RunStatus() {
  const status = useRuntimeSelector((snapshot) => snapshot.state.runs['run-1']?.status ?? 'missing')
  return <span>{status}</span>
}

describe('SSR snapshot contract', () => {
  it('renders the injected server snapshot even if the client runtime has advanced', () => {
    const runtime = createRuntime()
    runtime.hydrateRun({ id: 'run-1', threadId: 'thread-1', status: 'queued', activityIds: [], createdAt: '2026-07-14T00:00:00Z' })
    const serverSnapshot: RuntimeSnapshot = structuredClone(runtime.getSnapshot())
    runtime.dispatch({ schemaVersion: '0.1', eventId: 'started', type: 'run.started', threadId: 'thread-1', runId: 'run-1', sequence: 1, timestamp: '2026-07-14T00:00:01Z', data: {} })

    const markup = renderToStaticMarkup(
      <AgenticChatProvider runtime={runtime} serverSnapshot={serverSnapshot}>
        <RunStatus />
      </AgenticChatProvider>,
    )

    expect(markup).toBe('<span>queued</span>')
    expect(runtime.getState().runs['run-1']?.status).toBe('running')
  })
})
