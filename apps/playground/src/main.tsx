import type { CanonicalEvent } from '@agentic-chat/core'
import { createRuntime } from '@agentic-chat/runtime'
import { createRendererRegistry } from '@agentic-chat/react'
import { AgenticChat } from '@agentic-chat/react-ui'
import '@agentic-chat/react-ui/styles.css'
import { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './playground.css'

const fixture = (terminal: 'completed' | 'failed' | 'cancelled'): CanonicalEvent[] => {
  const events: CanonicalEvent[] = [
    { schemaVersion: '0.1', eventId: 'p1', type: 'run.started', threadId: 'playground', runId: 'demo-run', sequence: 1, timestamp: '2026-07-13T00:00:00Z', data: {} },
    { schemaVersion: '0.1', eventId: 'p2', type: 'tool.started', threadId: 'playground', runId: 'demo-run', sequence: 2, timestamp: '2026-07-13T00:00:01Z', data: { activityId: 'tool-activity', toolCallId: 'tool-call', name: 'query_data_source' } },
  ]
  if (terminal === 'completed') events.push(
    { schemaVersion: '0.1', eventId: 'p3', type: 'tool.completed', threadId: 'playground', runId: 'demo-run', sequence: 3, timestamp: '2026-07-13T00:00:02Z', data: { toolCallId: 'tool-call', output: { rowCount: 3 } } },
    { schemaVersion: '0.1', eventId: 'p4', type: 'result.available', threadId: 'playground', runId: 'demo-run', sequence: 4, timestamp: '2026-07-13T00:00:03Z', data: { kind: 'demo.summary', result: { summary: '华东区域销售额最高' } } },
    { schemaVersion: '0.1', eventId: 'p5', type: 'run.completed', threadId: 'playground', runId: 'demo-run', sequence: 5, timestamp: '2026-07-13T00:00:04Z', data: {} },
  )
  else if (terminal === 'failed') events.push({ schemaVersion: '0.1', eventId: 'p3', type: 'run.failed', threadId: 'playground', runId: 'demo-run', sequence: 3, timestamp: '2026-07-13T00:00:02Z', data: { error: { code: 'demo.failure', message: '查询超时' } } })
  else events.push({ schemaVersion: '0.1', eventId: 'p3', type: 'run.cancelled', threadId: 'playground', runId: 'demo-run', sequence: 3, timestamp: '2026-07-13T00:00:02Z', data: {} })
  return events
}

function App() {
  const [state, setState] = useState<'completed' | 'failed' | 'cancelled'>('completed')
  const runtime = useMemo(() => {
    const next = createRuntime()
    fixture(state).forEach((event) => next.dispatch(event))
    return next
  }, [state])
  const renderers = useMemo(() => {
    const registry = createRendererRegistry()
    registry.tool('query_data_source', ({ tool }) => <div><strong>Data query</strong><span> · {tool.status}</span></div>)
    registry.result('demo.summary', ({ content }) => <section className="ac-result"><h3>Custom summary renderer</h3><p>{(content.value as { summary: string }).summary}</p></section>)
    return registry
  }, [])
  return <main><h1>Agentic Chat UI Playground</h1><nav>{(['completed', 'failed', 'cancelled'] as const).map((item) => <button key={item} onClick={() => setState(item)} aria-pressed={state === item}>{item}</button>)}</nav><AgenticChat runtime={runtime} renderers={renderers} runId="demo-run" onSend={async () => {}} /></main>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
