# Agentic Chat UI 技术架构文档

> 状态：Draft v0.2
> 目标：定义项目边界、内部模型、包组织、技术栈和关键工程约束

## 1. 架构目标

系统需要同时满足四类需求：

1. **异构后端接入**：不同 Agent runtime 的事件和传输方式不同；
2. **可靠状态重建**：流中断、刷新或历史加载后能恢复相同 UI；
3. **多层消费方式**：既能开箱即用，也能被深度定制；
4. **长期演进**：协议、React UI 和领域 renderer 可以独立升级。

框架策略采用 **framework-agnostic core + React-first delivery**：核心运行能力使用纯 TypeScript，对 React、Vue 和宿主环境保持无知；React 是首个官方 bindings/UI，而不是核心模型的组成部分。

因此架构的中心不是 SSE 或某组 React 组件，而是稳定的 canonical domain model 和单向数据流。

## 2. 总体架构

```text
┌──────────────── Agent backends / runtimes ────────────────┐
│ ChatBI │ AG-UI │ AI SDK │ Claude/Codex │ Custom backend  │
└──────────────────────────┬─────────────────────────────────┘
                           │ 原始事件/快照/命令
┌──────────────────────────▼─────────────────────────────────┐
│ Adapters                                                    │
│ 解析、校验、ID 对齐、语义映射、能力声明                     │
└──────────────────────────┬─────────────────────────────────┘
                           │ CanonicalEvent / Snapshot
┌──────────────────────────▼─────────────────────────────────┐
│ Core runtime                                                │
│ reducer │ normalized store │ selectors │ commands │ registry│
└──────────────────────────┬─────────────────────────────────┘
                           │ View models / actions
┌──────────────────────────▼─────────────────────────────────┐
│ React bindings                                              │
│ Provider │ hooks │ headless primitives │ error boundaries  │
└──────────────────────────┬─────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────┐
│ Default UI / Domain renderers                               │
│ theme │ timeline │ tools │ tasks │ artifacts │ composer    │
└────────────────────────────────────────────────────────────┘

未来增加 Vue 时，仅在 React bindings 的同级增加 Vue bindings 和 Vue UI：

```text
Core runtime ─┬─ React bindings ─ React UI
              ├─ Vue bindings   ─ Vue UI（按真实需求新增）
              └─ Native/DOM host integration
```
```

关键规则：

- Adapter 之前的数据不是公共 UI 模型；
- Transport 不直接修改 React state；
- reducer 必须是纯函数且可重放；
- styled components 只能依赖 React bindings 和 core 类型；
- 业务 renderer 不进入通用核心包。

## 3. 分层职责

### 3.1 Canonical domain layer

定义 Thread、Message、Run、Activity、Task、Intervention、Artifact、Notice 等对象及其状态机。

该层：

- 使用纯 TypeScript；
- 不依赖 React、DOM、fetch 或状态管理框架；
- 为对象使用稳定 ID；
- 明确定义实体关系与允许的状态转换；
- 提供事件 schema、类型守卫和可选 runtime validation；
- 保留 `extensions`/metadata 扩展点，但核心语义不能依赖任意字段。

### 3.2 Adapter layer

每个 adapter 负责：

- 将外部事件、消息或快照转换成 canonical events；
- 把用户 command 转换成后端调用；
- 维护必要的外部 ID 到 canonical ID 映射；
- 声明能力，例如 cancel、resume、approval、artifact preview；
- 把无法映射的数据放入受命名空间保护的 extensions；
- 输出可诊断的适配错误。

Adapter 不负责渲染，也不应把业务 React 组件注入 core。

### 3.3 Transport layer

Transport 只负责连接和字节/帧级语义：

- fetch streaming/SSE；
- WebSocket；
- 本地 async iterable；
- 事件 replay；
- abort、backoff 和连接状态。

传输层与事件层分开。同一 adapter 可以在不同 transport 上工作。

### 3.4 Runtime/store layer

Runtime 负责：

- 接收 canonical event；
- 校验序列、去重和应用 reducer；
- 管理连接、运行和命令状态；
- 暴露 snapshot、subscribe、getState、dispatch/commands；
- 调用 adapter 执行 send、cancel、respond、retry 等命令；
- 提供调试和错误通道。

公共 API 使用最小 external store contract，不向消费者暴露某个具体状态库。

### 3.5 React binding layer

负责：

- Provider 与 runtime 生命周期；
- selector hooks 与细粒度订阅；
- headless primitives 的可访问性交互；
- renderer registry context；
- suspense/error boundary 的集成策略；
- SSR 安全的模块加载。

### 3.6 Presentation layer

提供默认设计系统和完整组件：

- Thread、Message、Run status；
- Activity tree/timeline；
- reasoning/status block；
- tool、task、notice、intervention、artifact；
- composer、空状态、错误和恢复状态。

默认层不内置 ECharts、Monaco 等重依赖。它提供插槽和轻量 fallback。

### 3.7 跨框架边界

框架无关层包括：

- canonical types、events、schemas；
- reducer、state machine、normalized state 和 selectors；
- runtime/store contract、commands 和 capabilities；
- transport、adapter、diagnostics、fixtures 和 conformance testkit。

框架相关层包括：

- Provider/plugin、hooks/composables 和 context/inject；
- headless UI primitives 的框架实现；
- renderer component registry 的框架绑定；
- error boundary、SSR 集成以及最终组件。

不得通过 Web Components、跨框架 JSX 或 imperative DOM 强行复用复杂组件。跨框架共享的主体是领域逻辑、view model、design tokens、fixtures 和行为规范，最终组件允许分别实现。

## 4. Canonical 数据模型建议

以下为概念结构，最终字段应通过 ADR 和 fixtures 稳定：

```ts
type RunStatus =
  | 'queued'
  | 'running'
  | 'awaiting_input'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

interface AgentRun {
  id: string
  threadId: string
  status: RunStatus
  rootActivityIds: string[]
  createdAt: string
  startedAt?: string
  endedAt?: string
  attempt: number
  error?: AgentError
  extensions?: Extensions
}

type ActivityKind =
  | 'status'
  | 'reasoning'
  | 'tool'
  | 'workflow'
  | 'subagent'
  | 'message'
  | 'custom'

interface Activity {
  id: string
  runId: string
  parentId?: string
  kind: ActivityKind
  status: 'pending' | 'running' | 'awaiting_input' |
          'completed' | 'failed' | 'cancelled' | 'skipped'
  order: number
  title?: string
  summary?: string
  startedAt?: string
  endedAt?: string
  content?: ActivityContent
  extensions?: Extensions
}
```

Store 建议 normalized：

```ts
interface AgenticState {
  threads: EntityTable<Thread>
  messages: EntityTable<Message>
  runs: EntityTable<AgentRun>
  activities: EntityTable<Activity>
  toolCalls: EntityTable<ToolCall>
  tasks: EntityTable<AgentTask>
  interventions: EntityTable<Intervention>
  artifacts: EntityTable<Artifact>
  notices: EntityTable<Notice>
  streams: Record<string, StreamCursor>
}
```

Normalized store 可避免每个流式 token 复制整棵嵌套树，并便于细粒度 selector。

### 4.1 实体关系与单一事实源

P0 必须通过 ADR 固化以下关系，避免同一内容在 Message、Activity 和 Artifact 中各自维护一份状态：

- Thread 是 Message 和 Run 的会话容器；
- Run 表示一次执行，retry 默认产生同一目标下的新 attempt，是否创建新 Run 由协议 ADR 明确；
- Activity 表示执行过程节点，父子关系只由 `parentId` 表达，展示顺序不由 timestamp 推断；
- ToolCall 是工具执行的事实源，tool Activity 只引用 `toolCallId`，不复制工具状态；
- Task 表示计划，不等同于 Activity；二者只能通过显式关联 ID 建立关系；
- Artifact 是独立可交付实体，通过来源引用关联 Run/Activity；Message 只引用 Artifact；
- 最终回答以 Message 为可见内容事实源，Activity 可以引用它，但不得复制正文。

具体基数、删除策略、attempt 语义和分支运行关系必须在实现 reducer 前由 fixtures 验证并记录，不允许由 UI 组件临时推断。

## 5. 事件模型与状态重建

### 5.1 Event envelope

Canonical event 至少包含：

```ts
interface EventEnvelope<TType extends string, TData> {
  schemaVersion: string
  eventId: string
  type: TType
  threadId: string
  runId?: string
  sequence?: number
  timestamp: string
  data: TData
  source?: string
}
```

`sequence` 的作用域必须由 adapter 明确，例如 per-run 或 per-thread。不能假设所有外部协议都有全局严格序列。

### 5.2 Event 与 snapshot

同时支持：

- **event**：表达增量变化；
- **snapshot**：表达某个 revision 的完整权威状态；
- **patch**：仅在具备明确 base revision 时使用。

恢复流程建议：

```text
加载最近 snapshot → replay snapshot 之后的 events → 订阅 live events
```

Snapshot 使用独立、带版本的 `CanonicalSnapshot` schema，不直接序列化内部 store 或状态库结构。内部 normalized state 可以重构而不改变持久化格式。

### 5.3 Cursor、sequence 与 revision

三种概念必须分离：

- transport cursor：用于重连和向服务端请求续传；
- canonical sequence：用于诊断某个明确作用域内的事件顺序；
- entity/snapshot revision：用于判断 patch 或 snapshot 的基线。

Adapter 必须声明 sequence 作用域。Timestamp 只用于展示，不作为事件排序依据。首版对无法安全应用的 gap/out-of-order 事件应暂停对应 stream、产生 typed diagnostic 并请求 replay/snapshot；不得静默按到达顺序修补权威状态。没有顺序保证的协议只能声明降级能力。

### 5.4 Reducer 不变量

- 相同 `eventId` 幂等；
- 实体 ID 在生命周期内稳定；
- 非法状态转换产生 typed diagnostic；
- 终态 Run 不接受普通进度事件；
- tool result 通过 `toolCallId` 关联，不通过工具名；
- intervention response 只接受一次，除非协议声明新 revision；
- unknown event 可记录并忽略，但不得令整个流崩溃；
- adapter-specific extensions 使用命名空间，例如 `chatbi.queryResult`。

## 6. Command 与双向交互

不能只定义后端到前端的事件。Runtime 应提供统一 command：

```ts
interface AgentCommands {
  send(input: UserInput): Promise<CommandReceipt>
  cancelRun(runId: string): Promise<void>
  retryRun(runId: string): Promise<CommandReceipt>
  respond(interventionId: string, value: unknown): Promise<void>
  loadHistory(cursor?: string): Promise<void>
  resumeRun?(runId: string): Promise<void>
}
```

Adapter 通过 capability declaration 表明支持项。UI 根据 capability 显示或隐藏动作，不能调用不存在的后端能力。

命令使用 idempotency key，尤其是 send、approval 和 retry，防止网络重试造成重复执行。

职责边界如下：Adapter 负责协议语义转换，Transport/client 负责连接和 API 调用，Runtime 负责命令 pending/receipt/diagnostic，Host 负责鉴权和业务权限。Adapter 不应逐步吸收路由、凭据、文件存储或业务状态。

前端 idempotency key 只提供关联手段；只有后端持久化并执行去重时，才能宣称端到端幂等。ChatBI CreateRun 已在 P2 按 ADR-0004 实现持久化去重、请求指纹冲突检测和并发创建保护。

## 7. Renderer 扩展体系

Renderer registry 按语义而不是外部事件名注册：

```ts
interface RendererRegistry {
  tool(name: string, renderer: ToolRenderer): Unsubscribe
  result(kind: string, renderer: ResultRenderer): Unsubscribe
  artifact(mimeOrKind: string, renderer: ArtifactRenderer): Unsubscribe
  message(kind: string, renderer: MessageRenderer): Unsubscribe
}
```

设计约束：

- 每类内容必须有 fallback；
- renderer 接收稳定 view model 和 actions，不直接访问 transport；
- renderer error 由局部 error boundary 隔离；
- renderer 可声明 compact/full/panel 等展示模式；
- 不可信 iframe 或 HTML 由独立 sandbox renderer 处理；
- ChatBI 的 SQL、图表、结果表放在 ChatBI integration package 或 ChatBI 仓库。
- registry 必须是 runtime/provider 实例级对象，不得使用进程级可变单例，以保证多实例、SSR 和测试隔离。
- P2 的 `result` 与 `message.content` 使用 `{ kind, value }` 信封选择 renderer；adapter 必须给领域内容提供稳定的语义 kind，不能由 UI 猜测 payload 结构。

### 7.1 可见内容分级

Canonical model 明确区分 `status_update`、`reasoning_summary`、`debug_log` 和不可进入前端协议的内部 trace。Adapter 不得仅根据字段名或文本内容猜测可见级别；无法确定时按 debug/hidden 降级，而不是作为 reasoning 展示。

## 8. 建议 Monorepo 组织

```text
agentic-chat-ui/
├─ apps/
│  ├─ playground/                # 开发、调试和协议实验台
│  └─ docs/                      # 文档与交互示例站
├─ packages/
│  ├─ core/                      # canonical model、events、reducer、selectors
│  ├─ runtime/                   # store、commands、adapter/transport contracts
│  ├─ react/                     # Provider、hooks、headless primitives
│  ├─ react-ui/                  # 默认 React 主题和开箱即用组件
│  ├─ transport-fetch-stream/    # fetch streaming/SSE
│  ├─ adapter-chatbi/            # ChatBI 映射
│  ├─ adapter-ag-ui/             # AG-UI 映射
│  └─ testkit/                   # fixtures、harness、adapter conformance
├─ examples/
│  ├─ minimal/
│  ├─ custom-renderers/
│  └─ durable-run/
├─ docs/                         # 产品与技术决策文档
├─ fixtures/                     # 经脱敏的真实事件流
├─ .changeset/
├─ package.json
├─ pnpm-workspace.yaml
└─ turbo.json                    # 项目增大后再引入也可以
```

未来在出现真实 Vue 消费者与维护者后，可以增加：

```text
packages/
├─ vue/                          # plugin、composables、headless primitives
└─ vue-ui/                       # 默认 Vue 组件
```

包拆分应服从真实发布边界。最初可以先使用 `core`、`runtime`、`react`、`react-ui`、`adapter-chatbi`、`testkit`；transport 可在 API 稳定或出现第二种实现后独立。首期不创建空壳 Vue 包，也不让 Vue 交付阻塞 React。

### 8.1 强制依赖方向

```text
core                → 只依赖通用 TypeScript 库
runtime             → core
transport-*         → core/runtime contracts
adapter-*           → core/runtime contracts，可选 transport contract
react               → core/runtime + React peer dependency
react-ui            → react + core/runtime
vue（未来）         → core/runtime + Vue peer dependency
vue-ui（未来）      → vue + core/runtime
```

禁止：

- core/runtime/adapter 导入 `react`、`react-dom`、`vue` 或框架组件；
- core 在模块初始化时访问 `window`、`document`、`localStorage` 或全局 `fetch`；
- adapter 返回 React/Vue element；
- React/Vue bindings 绕过 runtime 直接解释原始后端事件；
- 领域 renderer 反向进入 core。

使用 ESLint import boundaries、workspace dependency constraints 和 CI 脚本执行这些规则。core/runtime/adapter 测试在 Node 环境运行，以防隐式 DOM 依赖。

## 9. 技术栈建议

### 9.1 基础工具链

| 领域 | 建议 | 理由 |
|---|---|---|
| 语言 | TypeScript strict | 公共库需要强类型和 discriminated union |
| 包管理 | pnpm workspace | monorepo 快、依赖边界清晰 |
| 构建 | Vite（apps）+ tsup 或 Vite library mode（packages） | 开发体验成熟，库输出简单 |
| 任务编排 | 初期 pnpm scripts，规模增长后 Turborepo | 避免过早增加复杂度 |
| 单元/组件测试 | Vitest + React Testing Library | 与 Vite/React 协同良好 |
| 浏览器测试 | Playwright | 流式、重连、键盘和视觉流程需要真实浏览器 |
| 组件展示 | Storybook | 状态矩阵、视觉回归、文档和无障碍检查 |
| Schema | TypeBox 或 Zod（边界使用） | 运行时验证；core 内避免无处不在的重依赖 |
| 发布 | Changesets + npm provenance | monorepo 版本与 changelog |
| 代码质量 | ESLint + Prettier | 生态兼容和贡献者熟悉度高 |

最终依赖版本在初始化时锁定，不在架构文档中写死易过时的小版本。

### 9.2 React 与状态

- 公共组件使用 React 18+ 兼容 API，是否将 React 19 设为最低版本应由用户覆盖范围决定；
- `react`、`react-dom` 必须是 peer dependency；
- 对外暴露 `useSyncExternalStore` 风格 store contract；
- 内部可自行实现小型 store，或使用 Zustand vanilla store，但不能泄露 Zustand 类型到公共 API；
- 使用 selector 细化订阅，避免 token delta 导致全树刷新；
- 不建议首版引入 Redux 等强宿主约束。

### 9.3 Vue 与其他框架策略

- 首期不承诺 Vue 正式包，先保证 runtime/store contract 可被任意响应式框架订阅；
- Vue bindings 使用 `provide/inject`、composables 和 Vue 自己的组件/slot 语义，不模拟 React hooks；
- Vue 直接消费同一 runtime snapshot、selectors、commands 和 capabilities；
- Vue 不复制 reducer、adapter 或 transport；
- 启动 Vue 实现的条件是 canonical model 已稳定、存在真实 Vue 宿主和持续维护者；
- 各框架版本独立成熟和发布，React 1.0 不等待 Vue。

### 9.4 样式与 Design System

建议：

- 默认 UI 使用 CSS Modules 或稳定前缀的普通 CSS；
- 主题使用 CSS custom properties；
- 不要求消费者安装 Tailwind；
- className、data-state 和 slots 可扩展；
- 图标作为小型可替换层；
- 动画尊重 `prefers-reduced-motion`；
- Headless primitives 遵循 WAI-ARIA 模式。

可提供 shadcn 风格示例，但不应把复制源码作为唯一消费方式。

### 9.5 Markdown、代码和富内容

- Markdown renderer 可插拔；默认使用成熟的 AST 管线；
- 默认禁止 raw HTML；
- 语法高亮按需加载；
- 大型 JSON、日志、表格采用摘要和延迟渲染；
- Mermaid、iframe、可执行 HTML 不进入安全默认值。

### 9.6 文档站

首版可以使用 Storybook 承担组件文档，再使用 VitePress、Astro Starlight 或同类静态站承载概念、教程和 API。不要让文档框架进入发布包依赖。

## 10. ChatBI 集成架构

### 10.1 本地参考项目

开发环境中的 ChatBI 仓库位于：

```text
D:\Products\agentic\chatbi
```

该仓库是 P0/P1 的首要参考宿主，可用于核对真实事件、恢复接口、取消语义、现有领域组件和集成边界。此绝对路径仅是当前本地工作区约定，不得写入发布代码、测试 fixture、构建配置或运行时默认值；CI 和其他开发环境应通过环境变量、workspace 配置或独立脱敏 fixture 工作。

ChatBI 当前事件可通过 `adapter-chatbi` 映射：

| ChatBI event | Canonical 目标 |
|---|---|
| `run.started` | Run status → running |
| `thinking.delta` | reasoning/status Activity delta |
| `tool.started` | ToolCall + tool Activity |
| `tool.finished` | ToolCall terminal state |
| `result` | ChatBI 自定义 message part / artifact-like result |
| `artifact.created` | Artifact |
| `run.completed/failed/cancelled` | Run terminal state |
| `heartbeat` | transport concern，不进入可见时间线 |

需要保留 ChatBI 已有的：

- per-run sequence；
- event ID 幂等；
- `tool_call_id`；
- `after_sequence` 和历史重放；
- 取消能力。

建议集成边界：

```text
@agentic-chat/adapter-chatbi
  只映射协议和命令

ChatBI frontend integration
  注册 QueryResult、SQL、Chart、DataTable renderer
  管理数据源、上传和业务布局
```

## 11. Claudian/Obsidian 集成考虑

Claudian 属于非标准 Web 宿主，可能使用 DOM API 和 Obsidian 生命周期。为了保留未来兼容性：

- core/runtime 不依赖 DOM；
- React UI 支持由宿主提供 mount/unmount；
- CSS token 可映射 Obsidian 主题变量；
- 文件链接、菜单、命令和 vault 操作通过宿主 adapter；
- 不把浏览器路由、localStorage 或 window 单例写入核心；
- 首先实现事件 adapter 和独立 demo，再评估替换整个插件 UI。

## 12. 测试策略

### 12.1 Core reducer

- 表驱动状态转换测试；
- property-based 测试验证幂等和不变量；
- snapshot + replay 等价测试；
- 重复、缺失、乱序、未知事件测试；
- 并行活动、重试和终态测试。

### 12.2 Adapter conformance

每个 adapter 运行同一套测试：

- 能处理最小成功 Run；
- 工具开始/结束正确关联；
- 失败与取消语义正确；
- 不支持能力有明确声明；
- 未知外部事件不会破坏运行；
- fixtures 转换结果可快照审查。

### 12.3 React 与 UI

- hooks 订阅和渲染隔离；
- 键盘操作、焦点和 aria；
- renderer fallback 和 error boundary；
- Storybook 状态矩阵；
- 关键组件视觉回归。

### 12.4 E2E

- 新建 Run 到完成；
- 工具并行和失败；
- 人工审批并继续；
- 取消；
- 断流重连和刷新恢复；
- artifact 预览/下载入口；
- 长历史性能烟测。

## 13. 性能设计

- canonical state normalized；
- delta 仅更新目标 entity；
- selector 以 entity ID 为粒度；
- 流式文本按 frame 或短窗口批处理，避免每 token commit；
- 大结果不完整放入 React element tree；
- 历史列表支持窗口化；
- 建立 1,000 activities、100,000 文本字符等固定 benchmark；
- 默认组件避免昂贵的深比较和全局 context value 抖动。

## 14. 安全设计

- Adapter 输入视为不可信数据，在边界校验；
- renderer 对 URL scheme、HTML、iframe 和下载进行策略控制；
- 工具参数支持 redaction policy；
- 日志默认不显示 secret、token 和 credential；
- intervention command 由宿主鉴权，前端状态不作为授权依据；
- artifact 使用短期签名 URL 时不缓存敏感地址；
- 发布前进行依赖审计和 XSS 测试。

## 15. 可观测性与诊断

Runtime 提供可选 diagnostic channel：

- adapter parse error；
- unsupported event；
- duplicate/gap/out-of-order；
- connection/retry；
- reducer invariant violation；
- renderer error；
- command latency/failure。

开发模式可以展示事件检查器；生产默认不收集数据。若未来提供 telemetry，必须 opt-in 且不上传消息正文和工具敏感数据。

## 16. 版本与兼容策略

- 包遵循 semantic versioning；
- canonical schema 使用独立 `schemaVersion`；
- adapter 声明其支持的外部协议版本范围；
- 1.0 前允许基于真实 fixtures 调整事件和实体语义，但必须提供变更记录和 fixture 迁移；
- 1.0 后新增 union member 也视为需要 unknown fallback 的兼容变化，破坏性语义通过 major version；
- experimental API 使用明确前缀或单独入口；
- fixtures 和 conformance suite 是协议升级的回归基线；
- 使用 Changesets 维护变更记录和迁移说明。

## 17. 关键 ADR 清单

项目启动后应依次记录：

1. Canonical model 与外部 wire protocol 分离；
2. sequence 作用域和 snapshot/replay 语义；
3. runtime store contract；
4. renderer registry；
5. styled/headless 包边界；
6. React 最低版本；
7. runtime validation 库；
8. CSS/theme 策略；
9. artifact 安全策略；
10. 是否以及何时发布独立 wire protocol/Python SDK。
11. framework-agnostic core 与 React/Vue bindings 边界；
12. 新增官方框架实现的启动条件和维护责任。

## 18. 暂不建议首版实现

- 自研完整 Agent 编排框架；
- Python/Go/Rust 全套 SDK；
- 自动执行任意生成式 HTML；
- 内置完整图表、代码编辑器和 office 预览；
- 强制统一所有后端为自有 SSE 格式；
- 多人实时协作；
- 离线优先同步；
- 原生移动端组件。

这些能力应由真实用户需求和稳定核心模型驱动，而不是为了显得完整提前建设。
