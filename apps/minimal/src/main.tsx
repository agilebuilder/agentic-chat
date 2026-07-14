import type { CanonicalEvent } from '@agentic-chat/core'
import { AgenticChat } from '@agentic-chat/react-ui'
import '@agentic-chat/react-ui/styles.css'
import { createRuntime } from '@agentic-chat/runtime'
import { StrictMode, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const threadId = 'quick-start'

function eventsFor(runId: string, prompt: string): CanonicalEvent[] {
  const now = new Date().toISOString()
  return [
    { schemaVersion: '0.1', eventId: `${runId}:1`, type: 'run.started', threadId, runId, sequence: 1, timestamp: now, data: {} },
    { schemaVersion: '0.1', eventId: `${runId}:2`, type: 'status.delta', threadId, runId, sequence: 2, timestamp: now, data: { activityId: `${runId}:status`, content: `正在处理：${prompt}` } },
    { schemaVersion: '0.1', eventId: `${runId}:3`, type: 'result.available', threadId, runId, sequence: 3, timestamp: now, data: { kind: 'text', result: `已收到“${prompt}”。请在 onSend 中连接您的 Agent API。` } },
    { schemaVersion: '0.1', eventId: `${runId}:4`, type: 'run.completed', threadId, runId, sequence: 4, timestamp: now, data: {} },
  ]
}

function App() {
  const runtimeRef = useRef(createRuntime())
  const [runId, setRunId] = useState<string>()

  const send = async (message: string) => {
    const nextRunId = crypto.randomUUID()
    setRunId(nextRunId)
    await runtimeRef.current.executeCommand('send', async () => {
      for (const event of eventsFor(nextRunId, message)) runtimeRef.current.dispatch(event)
    })
  }

  return (
    <main>
      <header>
        <p>Quick Start</p>
        <h1>Agentic Chat</h1>
        <span>一个不依赖 ChatBI 或状态管理框架的最小 React/Vite 接入。</span>
      </header>
      <AgenticChat runtime={runtimeRef.current} {...(runId ? { runId } : {})} onSend={send} />
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
