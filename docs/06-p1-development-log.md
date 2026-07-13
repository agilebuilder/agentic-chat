# P1 ChatBI MVP 开发记录

> 更新时间：2026-07-13  
> 状态：进行中，已完成第一条独立垂直切片。

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

## 下一步

- 将 packages 接入真实 ChatBI 前端并复用 QueryResult renderer；
- 增加历史 Run 初始化与刷新恢复；
- 增加 runtime/adapter diagnostic side channel；
- 增加浏览器 E2E、键盘与基础无障碍测试；
- 完善运行中 Composer 策略、错误状态和 cancel 409 处理；
- 建立 Playground/Story 状态矩阵。

当前切片不代表 P1 已验收完成。
