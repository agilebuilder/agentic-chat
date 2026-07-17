import type { CanonicalEvent } from '@agentic-chat/core'
import { AgenticChatProvider } from '@agentic-chat/react'
import { RunStatus } from '@agentic-chat/react-ui'
import { createRuntime } from '@agentic-chat/runtime'
import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'

declare global {
  interface Window { __agenticHydration: { errors: string[]; hydrated: boolean } }
}

const event: CanonicalEvent = { schemaVersion: '0.1', eventId: 'hydrate:1', type: 'run.started', threadId: 'hydrate-thread', runId: 'hydrate-run', sequence: 1, timestamp: '2026-07-17T00:00:00Z', data: {} }
const runtime = createRuntime()
runtime.dispatch(event)
const serverSnapshot = runtime.getSnapshot()
const tree = createElement(AgenticChatProvider, { runtime, serverSnapshot }, createElement(RunStatus, { runId: 'hydrate-run' }))
const root = document.getElementById('root')!
root.innerHTML = renderToString(tree)
window.__agenticHydration = { errors: [], hydrated: false }
hydrateRoot(root, tree, {
  onRecoverableError(error) { window.__agenticHydration.errors.push(error instanceof Error ? error.message : String(error)) },
})
requestAnimationFrame(() => { window.__agenticHydration.hydrated = true; root.dataset.hydrated = 'true' })
