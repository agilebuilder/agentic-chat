import type { CanonicalEvent } from '@agentic-chat/core'
import { AgenticChat } from '@agentic-chat/react-ui'
import '@agentic-chat/react-ui/styles.css'
import { createRuntime } from '@agentic-chat/runtime'
import { adaptCodingFixture, chatBiSuccessfulRun, codingAgentSourceFixture } from '@agentic-chat/testkit'
import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const terminalFixture = (status: 'failed' | 'cancelled'): CanonicalEvent[] => {
  const runId = `fixture-${status}`
  const base = { schemaVersion: '0.1' as const, threadId: 'fixture-thread', runId, timestamp: '2026-07-13T00:00:00Z' }
  if (status === 'cancelled') return [{ ...base, eventId: `${runId}:1`, type: 'run.cancelled', sequence: 1, data: {} }]
  return [
    { ...base, eventId: `${runId}:1`, type: 'run.started', sequence: 1, data: {} },
    { ...base, eventId: `${runId}:2`, type: 'run.failed', sequence: 2, data: { error: { code: 'fixture.timeout', message: '数据源响应超时' } } },
  ]
}

const fixtures = {
  successful: chatBiSuccessfulRun,
  failed: terminalFixture('failed'),
  cancelled: terminalFixture('cancelled'),
  coding: adaptCodingFixture(codingAgentSourceFixture),
} satisfies Record<string, readonly CanonicalEvent[]>

type FixtureName = keyof typeof fixtures

function App() {
  const [fixtureName, setFixtureName] = useState<FixtureName>('successful')
  const [cursor, setCursor] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [intervalMs, setIntervalMs] = useState(700)
  const [generation, setGeneration] = useState(0)
  const events = fixtures[fixtureName]
  const runtime = useMemo(() => createRuntime(), [fixtureName, generation])
  const runId = events[0]?.runId

  useEffect(() => {
    setCursor(0)
    setPlaying(false)
  }, [fixtureName])

  useEffect(() => {
    if (!playing || cursor >= events.length) return
    const timer = window.setTimeout(() => {
      const event = events[cursor]
      if (event) runtime.dispatch(event)
      setCursor((value) => value + 1)
    }, intervalMs)
    return () => window.clearTimeout(timer)
  }, [cursor, events, intervalMs, playing, runtime])

  useEffect(() => {
    if (cursor >= events.length) setPlaying(false)
  }, [cursor, events.length])

  const step = () => {
    const event = events[cursor]
    if (!event) return
    runtime.dispatch(event)
    setCursor((value) => value + 1)
  }

  return (
    <main>
      <header>
        <div><p>Developer tool</p><h1>Fixture Player</h1></div>
        <label>Fixture<select value={fixtureName} onChange={(event) => setFixtureName(event.target.value as FixtureName)}>{Object.keys(fixtures).map((name) => <option key={name}>{name}</option>)}</select></label>
      </header>
      <section className="player" aria-label="Fixture playback controls">
        <button type="button" onClick={() => setPlaying((value) => !value)} disabled={cursor >= events.length}>{playing ? '暂停' : '播放'}</button>
        <button type="button" onClick={step} disabled={playing || cursor >= events.length}>单步</button>
        <button type="button" onClick={() => { setCursor(0); setPlaying(false); setGeneration((value) => value + 1) }}>重置</button>
        <label>间隔<select value={intervalMs} onChange={(event) => setIntervalMs(Number(event.target.value))}><option value={1200}>慢速</option><option value={700}>正常</option><option value={250}>快速</option></select></label>
        <output>{cursor} / {events.length}</output>
      </section>
      <AgenticChat runtime={runtime} {...(runId ? { runId } : {})} onSend={async () => {}} />
      <details><summary>下一事件</summary><pre>{JSON.stringify(events[cursor] ?? null, null, 2)}</pre></details>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
