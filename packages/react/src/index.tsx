import type { Activity, AgentRun, Artifact, Message, RenderableContent, ToolCall } from '@agentic-chat/core'
import type { AgenticRuntime, RuntimeSnapshot } from '@agentic-chat/runtime'
import { createContext, useContext, useRef, useSyncExternalStore, type PropsWithChildren } from 'react'
import { createRendererRegistry, type RendererRegistry } from './renderers.js'

export * from './renderers.js'

interface RuntimeProviderValue {
  runtime: AgenticRuntime
  serverSnapshot?: RuntimeSnapshot
}

const RuntimeContext = createContext<RuntimeProviderValue | null>(null)
const RendererContext = createContext<RendererRegistry | null>(null)

export interface AgenticChatProviderProps extends PropsWithChildren {
  runtime: AgenticRuntime
  renderers?: RendererRegistry
  /** Snapshot serialized by the server and reused for the first hydration render. */
  serverSnapshot?: RuntimeSnapshot
}

export function AgenticChatProvider({ runtime, renderers, serverSnapshot, children }: AgenticChatProviderProps) {
  const defaultRenderers = useRef<RendererRegistry | null>(null)
  if (!defaultRenderers.current) defaultRenderers.current = createRendererRegistry()
  const runtimeValue = useRef<RuntimeProviderValue>({ runtime, ...(serverSnapshot ? { serverSnapshot } : {}) })
  if (runtimeValue.current.runtime !== runtime || runtimeValue.current.serverSnapshot !== serverSnapshot) {
    runtimeValue.current = { runtime, ...(serverSnapshot ? { serverSnapshot } : {}) }
  }
  return <RuntimeContext.Provider value={runtimeValue.current}><RendererContext.Provider value={renderers ?? defaultRenderers.current}>{children}</RendererContext.Provider></RuntimeContext.Provider>
}

export function useAgenticRuntime(): AgenticRuntime {
  const runtime = useContext(RuntimeContext)
  if (!runtime) throw new Error('AgenticChatProvider is missing')
  return runtime.runtime
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
  const context = useContext(RuntimeContext)
  if (!context) throw new Error('AgenticChatProvider is missing')
  const { runtime, serverSnapshot } = context
  return useSyncExternalStore(
    runtime.subscribe,
    () => selector(runtime.getSnapshot()),
    () => selector(serverSnapshot ?? runtime.getSnapshot()),
  )
}

export const useRun = (runId: string): AgentRun | undefined => useRuntimeSelector((snapshot) => snapshot.state.runs[runId])
export const useActivity = (activityId: string): Activity | undefined => useRuntimeSelector((snapshot) => snapshot.state.activities[activityId])
export const useToolCall = (toolCallId: string): ToolCall | undefined => useRuntimeSelector((snapshot) => snapshot.state.toolCalls[toolCallId])
export const useMessage = (messageId: string): Message | undefined => useRuntimeSelector((snapshot) => snapshot.state.messages[messageId])
export const useArtifact = (artifactId: string): Artifact | undefined => useRuntimeSelector((snapshot) => snapshot.state.artifacts[artifactId])
export const useRunActivityIds = (runId: string): string[] => useRuntimeSelector((snapshot) => snapshot.state.runs[runId]?.activityIds ?? emptyIds)
export const useRootActivityIds = (runId: string): readonly string[] => useRuntimeSelector((snapshot) => snapshot.state.rootActivityIdsByRunId[runId] ?? emptyIds)
export const useChildActivityIds = (activityId: string): readonly string[] => useRuntimeSelector((snapshot) => snapshot.state.childActivityIdsByParentId[activityId] ?? emptyIds)
export const useRunResult = (runId: string): RenderableContent | undefined => useRuntimeSelector((snapshot) => snapshot.state.results[runId])
export const useConnection = () => useRuntimeSelector((snapshot) => snapshot.connection)
export const useCommandState = (key: string) => useRuntimeSelector((snapshot) => snapshot.commands[key] ?? idleCommand)

const emptyIds: string[] = []
const idleCommand = { status: 'idle' as const }
