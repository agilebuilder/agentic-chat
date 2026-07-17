import { adaptAiSdkUIMessageChunks, type AiSdkUIMessageChunk } from '@agentic-chat/adapter-ai-sdk'
import { createRuntime } from '@agentic-chat/runtime'
import { checkAdapterConformance } from '@agentic-chat/testkit'

export function createAiSdkExampleHost(chunks: readonly AiSdkUIMessageChunk[]) {
  const adapted = adaptAiSdkUIMessageChunks(chunks, { threadId: 'example-thread', runId: 'example-run', startedAt: '2026-07-17T00:00:00Z' })
  const conformance = checkAdapterConformance(adapted.events, { sequence: 'synthesized-stream-order' })
  if (conformance.issues.length) throw new Error(conformance.issues.join('; '))
  const runtime = createRuntime()
  for (const event of adapted.events) runtime.dispatch(event)
  return { runtime, diagnostics: adapted.diagnostics }
}
