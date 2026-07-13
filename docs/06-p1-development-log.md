# P1 ChatBI MVP 开发记录

> 更新时间：2026-07-13  
> 状态：已完成并通过 P1 验收。

## 已完成

- Runtime snapshot 增加 connection 和 command 状态；
- Runtime 构造时校验 capabilities 与 commands 一致；
- 提供 Run、Activity、ToolCall、attention 等 selectors；
- 实现 ChatBI create Run、cancel 和 SSE client；
- 实现最多三次断线重连，并使用最后 canonical sequence 续传；
- 实现 ChatBI controller，将 raw event 经 adapter 分发到 runtime；
- 创建 `@agentic-chat/react` Provider 和 selector hooks；
- 创建 `@agentic-chat/react-ui` 第一版 Run status、线性 Activity、Tool fallback、Result、Composer、Cancel 和 connection notice；
- 默认 UI 支持 CSS variables、深色模式、窄依赖和 reduced motion；
- Node/SSR 静态渲染测试通过。
- 已接入真实 ChatBI 前端，替换旧 timeline/SSE 本地状态；
- ChatBI QueryResult 继续使用原有洞察、图表、表格和 SQL renderer；
- 已完成历史 Run、运行中刷新恢复和 queued cancel；
- 新增可构建 Playground，覆盖 completed、failed、cancelled 状态；
- Playwright 覆盖桌面、移动、取消、已完成恢复、运行中刷新恢复和 PostgreSQL 领域结果。

## 最小接入草案

```tsx
const controller = createChatBiController({
  sessionId,
  target: { source_id: sourceId },
})

const [runId, setRunId] = useState<string>()

<AgenticChat
  runtime={controller.runtime}
  runId={runId}
  onSend={async (message) => setRunId(await controller.start(message))}
  onCancel={(id) => controller.cancel(id)}
/>
```

`controller.start` 在 Run 创建成功后立即返回 runId，SSE 在后台继续；宿主可以用 `waitForRun(runId)` 等待终态。

## P2 后续

- 将本地 Vite/TypeScript alias 集成替换为可安装、可发布 packages；
- 增加 renderer registry、完整 headless primitives 和 Storybook 状态矩阵；
- 完善虚拟化、视觉回归和系统化 accessibility 审计；
- 将 runtime validation、command receipt 和 cancel 409 竞态策略稳定为公共 API。

完整验收结果见 `07-p1-acceptance-report.md`。
