import type { CanonicalEvent } from '@agentic-chat/core'
import { AgenticChat } from '@agentic-chat/react-ui'
import '@agentic-chat/react-ui/styles.css'
import { createRuntime } from '@agentic-chat/runtime'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const threadId = 'quick-start'

function eventsFor(runId: string, prompt: string): CanonicalEvent[] {
  const now = new Date().toISOString()
  return [
    { schemaVersion: '0.1', eventId: `${runId}:1`, type: 'run.started', threadId, runId, sequence: 1, timestamp: now, data: {} },
    { schemaVersion: '0.1', eventId: `${runId}:2`, type: 'status.delta', threadId, runId, sequence: 2, timestamp: now, data: { activityId: `${runId}:status`, content: `正在处理：${prompt}` } },
    { schemaVersion: '0.1', eventId: `${runId}:3`, type: 'tool.started', threadId, runId, sequence: 3, timestamp: now, data: { activityId: `${runId}:tool`, toolCallId: `${runId}:call`, name: 'mock.search', input: { prompt } } },
    { schemaVersion: '0.1', eventId: `${runId}:4`, type: 'tool.completed', threadId, runId, sequence: 4, timestamp: now, data: { toolCallId: `${runId}:call`, output: { matches: 3 } } },
    { schemaVersion: '0.1', eventId: `${runId}:5`, type: 'result.available', threadId, runId, sequence: 5, timestamp: now, data: { kind: 'text', result: `Mock 已处理“${prompt}”，共找到 3 条结果。` } },
    { schemaVersion: '0.1', eventId: `${runId}:6`, type: 'run.completed', threadId, runId, sequence: 6, timestamp: now, data: {} },
  ]
}

function App() {
  const [runtime] = useState(createRuntime)
  const [runId, setRunId] = useState<string>()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  const send = async (message: string) => {
    const nextRunId = crypto.randomUUID()
    setRunId(nextRunId)
    await runtime.executeCommand('send', async () => {
      for (const event of eventsFor(nextRunId, message)) {
        runtime.dispatch(event)
        await new Promise((resolve) => window.setTimeout(resolve, 300))
      }
    })
  }

  return (
    <main>
      <header>
        <p>Quick Start</p>
        <h1>Agentic Chat</h1>
        <span>一个不依赖 ChatBI 或状态管理框架的最小 React/Vite 接入。</span>
      </header>
      <button type="button" onClick={() => setTheme((value) => value === 'light' ? 'dark' : 'light')}>切换为{theme === 'light' ? '深色' : '浅色'}主题</button>
      <AgenticChat runtime={runtime} {...(runId ? { runId } : {})} theme={theme} onSend={send} />
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
