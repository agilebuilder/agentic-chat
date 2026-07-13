import type { Activity, AgentRun, ToolCall } from '@agentic-chat/core'
import type { AgenticRuntime, RuntimeSnapshot } from '@agentic-chat/runtime'
import { createContext, useContext, useSyncExternalStore, type PropsWithChildren } from 'react'

const RuntimeContext = createContext<AgenticRuntime | null>(null)

export function AgenticChatProvider({ runtime, children }: PropsWithChildren<{ runtime: AgenticRuntime }>) {
  return <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>
}

export function useAgenticRuntime(): AgenticRuntime {
  const runtime = useContext(RuntimeContext)
  if (!runtime) throw new Error('AgenticChatProvider is missing')
  return runtime
}

export function useRuntimeSelector<T>(selector: (snapshot: RuntimeSnapshot) => T): T {
  const runtime = useAgenticRuntime()
  return useSyncExternalStore(runtime.subscribe, () => selector(runtime.getSnapshot()), () => selector(runtime.getSnapshot()))
}

export const useRun = (runId: string): AgentRun | undefined => useRuntimeSelector((snapshot) => snapshot.state.runs[runId])
export const useActivity = (activityId: string): Activity | undefined => useRuntimeSelector((snapshot) => snapshot.state.activities[activityId])
export const useToolCall = (toolCallId: string): ToolCall | undefined => useRuntimeSelector((snapshot) => snapshot.state.toolCalls[toolCallId])
export const useRunActivityIds = (runId: string): string[] => useRuntimeSelector((snapshot) => snapshot.state.runs[runId]?.activityIds ?? emptyIds)
export const useRunResult = (runId: string): unknown => useRuntimeSelector((snapshot) => snapshot.state.results[runId])
export const useConnection = () => useRuntimeSelector((snapshot) => snapshot.connection)
export const useCommandState = (key: string) => useRuntimeSelector((snapshot) => snapshot.commands[key] ?? idleCommand)

const emptyIds: string[] = []
const idleCommand = { status: 'idle' as const }
