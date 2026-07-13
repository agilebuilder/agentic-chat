# P1 ChatBI MVP 验收报告

> 日期：2026-07-13  
> 结论：通过，可以进入 P2 可复用 Alpha。

## 1. 真实集成结果

ChatBI 前端已从本地 `timeline`、`runStatus` 和手写 SSE retry 切换到 Agentic Chat UI runtime。运行事实只由 canonical state 管理；ChatBI 保留 Session、数据源、上传和 QueryResult 领域布局。

本地集成使用 Vite alias 和 TypeScript paths 指向 `chat_ui` 源码，适合 P1 同机开发。它不是公开安装方式，P2 必须改成构建后的 npm/workspace package 接入。

## 2. 产品闭环

- HTTP 创建后立即 hydrate queued Run，不伪造事件 sequence；
- SSE `run.started` 将 queued Run 推进到 running；
- ToolCall 以 `tool_call_id` 合并并驱动线性 Activity；
- Result 进入 canonical runtime 后交给 ChatBI ResultInsights/Chart/Table/SQL；
- cancel 支持 running 和尚未 started 的 queued Run；
- Run failed/cancelled 时自动结束仍在运行的子 Activity/ToolCall；
- 断流最多重连三次，并从最后 sequence 续传；
- 页面刷新后重放最新 Run，已验证运行中和已完成两种恢复；
- adapter diagnostic 与领域 state 分离、有界保留且不含 raw payload。

## 3. UI 与包

- `@agentic-chat/react`：Provider、runtime hooks、entity selector hooks；
- `@agentic-chat/react-ui`：RunStatus、ActivityTimeline、Tool fallback、Result fallback、Composer、Cancel、ConnectionNotice；
- 状态使用文字和颜色共同表达；Run 状态通过 polite live region 公告；
- 支持深色主题、reduced motion、窄屏布局和 Ctrl/Cmd+Enter；
- Playground 可切换 completed、failed、cancelled fixture。

## 4. 自动化验证

### chat_ui

- package dependency boundary：通过；
- TypeScript project references：通过；
- 10 个测试文件、37 项测试：通过；
- 全 workspace build 和 Playground production build：通过。

### ChatBI

- 前端 6 个测试文件、13 项测试：通过；
- Vite production build：通过；
- Playwright：8 项通过、2 项按项目条件跳过；
- 覆盖上传查询、领域结果、取消、已完成恢复、运行中刷新恢复、移动布局和 PostgreSQL；
- generic-core audit 与 credential audit：通过。

## 5. 实测发现并修复

- 浏览器原生 fetch 作为类字段调用会丢失 Window receiver，已显式 bind；
- ChatBI 允许 queued Run 在 started 前取消，canonical reducer 已支持首事件直接 failed/cancelled；
- 历史 Run 和新 Run 同为 cancelled 时，React 终态回调曾按状态字符串误去重，已改为 runId + status；
- Run 取消/失败时 Tool Activity 曾停留在 running，现随 Run 进入对应终态。

## 6. 非 P1 阻塞项

- 公开 npm 包构建、exports 和样式发布；
- renderer registry 与复杂 Artifact/Task/Intervention UI；
- 1,000 Activity 性能预算和虚拟化；
- Storybook、视觉回归和完整屏幕阅读器审计；
- 远端 CI：仓库仍未配置 remote，当前只完成本地同等验证。
