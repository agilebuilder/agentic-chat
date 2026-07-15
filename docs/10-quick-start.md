# Quick Start

本指南用于在一个全新的 React/Vite 应用中接入 Agentic Chat。示例完全运行在浏览器内，通过内存事件模拟 Agent，不需要 ChatBI、数据库、API、SSE、Zustand 或仓库源码 alias。

## 1. 发布状态

首批 npm Alpha 已于 2026-07-15 发布并完成空目录安装验收。发布前的 `npm publish --dry-run` 和仓库内 workspace 构建不能替代正式 npm 安装验收。

- 普通体验可以安装 `@alpha`；
- 正式验收必须使用发布方提供的确切版本，确保结果可复现；
- 若 `npm view @agentic-chat/core@alpha version` 返回 404，说明尚不能进行正式测试。

本轮 30 分钟独立验收固定使用以下版本：

```bash
pnpm add @agentic-chat/core@0.1.0-alpha.1 @agentic-chat/runtime@0.1.0-alpha.1 @agentic-chat/react-ui@0.1.0-alpha.1
```

## 2. 环境要求

- Node.js 20.19+ 或 22.12+；
- pnpm 10；
- React 18 或 19；
- 可访问 npm registry 的网络和现代浏览器。

检查环境：

```bash
node --version
pnpm --version
npm config get registry
```

## 3. 创建项目并安装

普通 Alpha 体验：

```bash
pnpm create vite my-agent-chat --template react-ts
cd my-agent-chat
pnpm install
pnpm add @agentic-chat/core@alpha @agentic-chat/runtime@alpha @agentic-chat/react-ui@alpha
```

正式 30 分钟验收时，不使用移动的 `alpha` 标签。把发布方给出的确切版本分别替换到下面命令中：

```bash
pnpm add @agentic-chat/core@<core-version> @agentic-chat/runtime@<runtime-version> @agentic-chat/react-ui@<react-ui-version>
```

尖括号只是占位符，不能原样复制。安装后确认 `package.json` 中不存在 `file:`、`workspace:` 或仓库源码路径。

## 4. 创建纯前端 Mock

用以下内容完整替换 `src/App.tsx`：

```tsx
import type { CanonicalEvent } from '@agentic-chat/core'
import { AgenticChat } from '@agentic-chat/react-ui'
import '@agentic-chat/react-ui/styles.css'
import { createRuntime } from '@agentic-chat/runtime'
import { useState } from 'react'

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

export default function App() {
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

  return <main>
    <h1>Agentic Chat Quick Start</h1>
    <p>纯前端内存事件，不需要后端。</p>
    <button type="button" onClick={() => setTheme((value) => value === 'light' ? 'dark' : 'light')}>
      切换为{theme === 'light' ? '深色' : '浅色'}主题
    </button>
    <AgenticChat runtime={runtime} {...(runId ? { runId } : {})} theme={theme} onSend={send} />
  </main>
}
```

用以下内容替换 `src/index.css`，避免 Vite 默认居中样式影响窄屏检查：

```css
:root { font: 16px/1.5 system-ui, sans-serif; color: #172033; background: #eef2f7; }
* { box-sizing: border-box; }
body { margin: 0; }
main { width: min(760px, calc(100% - 24px)); margin: 32px auto; }
main > button { margin-bottom: 12px; padding: 8px 12px; }
@media (max-width: 480px) { main { margin: 12px auto; } }
```

`src/main.tsx` 保持 Vite 默认内容即可。`src/App.css` 可以删除，也可以保留但不要导入。

## 5. 运行并观察

```bash
pnpm dev
```

打开终端显示的本地地址，输入任意问题并发送。约两秒内应依次看到：

1. Run 进入运行状态；
2. `mock.search` 工具出现并完成；
3. 工具详情中出现输入和 `{ "matches": 3 }`；
4. 最终结果出现；
5. Run 进入完成状态。

点击主题按钮应能在浅色和深色之间切换。打开浏览器开发者工具，将视口设为 390px，输入框和发送按钮不应横向溢出。

## 6. 构建验证

```bash
pnpm build
```

构建必须成功，并且浏览器控制台没有未处理错误。正式验收的完整证据与判定规则见 [30 分钟 Quick Start 独立验收](14-quick-start-acceptance.md)。

## 7. 这个 Mock 与后端的关系

本页只验证 npm 安装、runtime 公共 API、React UI、主题和构建。内存事件代替了真实 Agent transport：

```text
React 页面 → AgenticChat → Runtime → 内存 CanonicalEvent
```

生产接入时，保留 `AgenticChat` 和 runtime，把 `eventsFor()` 替换为后端 adapter 与 SSE/WebSocket/轮询：

```text
React 页面 → AgenticChat → Runtime ← Adapter ← Agent 后端
```

生产命令必须使用幂等键；每个 Run 的 sequence 严格递增，重连时复用稳定 eventId。非 canonical 后端事件应按 [Adapter 指南](12-adapter-guide.md) 转换，不要让 UI 直接解析源事件。

## 8. 仓库开发工具

以下命令只供仓库贡献者在发布前预演，不属于外部开发者的正式 npm 验收：

```bash
pnpm --filter "@agentic-chat/minimal^..." build
pnpm --filter @agentic-chat/minimal dev
pnpm --filter "@agentic-chat/fixture-player^..." build
pnpm --filter @agentic-chat/fixture-player dev
```

Fixture Player 覆盖成功、失败、取消和并行编码 Agent 夹具，可播放、暂停、单步、重置和调整速度。

## 9. SSR 与 hydration

服务端渲染时，把同一请求对应的 runtime snapshot 传给 UI，客户端首次 hydration 必须复用该快照：

```tsx
const serverSnapshot = runtime.getSnapshot()

return <AgenticChat runtime={runtime} serverSnapshot={serverSnapshot} onSend={send} />
```

不要跨请求共享可变 runtime 或 renderer registry。`serverSnapshot` 只负责服务端和首次 hydration 的一致视图，后续更新仍来自 runtime 的 `subscribe/getSnapshot` 契约。
