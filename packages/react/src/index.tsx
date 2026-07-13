import type { Activity, AgentRun, Artifact, Message, RenderableContent, ToolCall } from '@agentic-chat/core'
import type { AgenticRuntime, RuntimeSnapshot } from '@agentic-chat/runtime'
import { createContext, useContext, useRef, useSyncExternalStore, type PropsWithChildren } from 'react'
import { createRendererRegistry, type RendererRegistry } from './renderers.js'

export * from './renderers.js'

const RuntimeContext = createContext<AgenticRuntime | null>(null)
const RendererContext = createContext<RendererRegistry | null>(null)

export function AgenticChatProvider({ runtime, renderers, children }: PropsWithChildren<{ runtime: AgenticRuntime; renderers?: RendererRegistry }>) {
  const defaultRenderers = useRef<RendererRegistry | null>(null)
  if (!defaultRenderers.current) defaultRenderers.current = createRendererRegistry()
  return <RuntimeContext.Provider value={runtime}><RendererContext.Provider value={renderers ?? defaultRenderers.current}>{children}</RendererContext.Provider></RuntimeContext.Provider>
}

export function useAgenticRuntime(): AgenticRuntime {
  const runtime = useContext(RuntimeContext)
  if (!runtime) throw new Error('AgenticChatProvider is missing')
  return runtime
}

export function useRendererRegistry(): RendererRegistry {
  const registry = useContext(RendererContext)
  if (!registry) throw new Error('AgenticChatProvider is missing')
  return registry
}

export function useRendererVersion(): number {
  const registry = useRendererRegistry()
  return useSyncExternalStore(registry.subscribe, registry.getVersion, registry.getVersion)
}

export function useRuntimeSelector<T>(selector: (snapshot: RuntimeSnapshot) => T): T {
  const runtime = useAgenticRuntime()
  return useSyncExternalStore(runtime.subscribe, () => selector(runtime.getSnapshot()), () => selector(runtime.getSnapshot()))
}

export const useRun = (runId: string): AgentRun | undefined => useRuntimeSelector((snapshot) => snapshot.state.runs[runId])
export const useActivity = (activityId: string): Activity | undefined => useRuntimeSelector((snapshot) => snapshot.state.activities[activityId])
export const useToolCall = (toolCallId: string): ToolCall | undefined => useRuntimeSelector((snapshot) => snapshot.state.toolCalls[toolCallId])
export const useMessage = (messageId: string): Message | undefined => useRuntimeSelector((snapshot) => snapshot.state.messages[messageId])
export const useArtifact = (artifactId: string): Artifact | undefined => useRuntimeSelector((snapshot) => snapshot.state.artifacts[artifactId])
export const useRunActivityIds = (runId: string): string[] => useRuntimeSelector((snapshot) => snapshot.state.runs[runId]?.activityIds ?? emptyIds)
export const useRunResult = (runId: string): RenderableContent | undefined => useRuntimeSelector((snapshot) => snapshot.state.results[runId])
export const useConnection = () => useRuntimeSelector((snapshot) => snapshot.connection)
export const useCommandState = (key: string) => useRuntimeSelector((snapshot) => snapshot.commands[key] ?? idleCommand)

const emptyIds: string[] = []
const idleCommand = { status: 'idle' as const }
