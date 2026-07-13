# P2 可复用 Alpha 开发记录

> 开始日期：2026-07-13  
> 当前状态：第四片——ChatBI CreateRun 端到端幂等已完成。

## 已确认决策

- MIT License；
- GitHub 仓库：`agilebuilder/agentic-chat`；
- npm scope：`@agentic-chat/*`；
- Alpha 起始版本：`0.1.0-alpha.0`；
- ChatBI 端到端幂等纳入 P2；
- P2 后期由项目方安排未参与核心开发的人员执行 30 分钟 Quick Start 验收。

## 第一片已完成

- 本地 `origin` 已指向 GitHub 仓库，未进行推送；
- 公共包 exports 从 `src` 切换到 `dist`；
- 输出 ESM、类型声明、声明映射和 source map；
- 发布包排除测试文件并包含 MIT License；
- `react-ui` 将默认 CSS 作为明确的子路径 export；
- `adapter-ag-ui` 保持 private，避免提前发布 P3 能力；
- 新增纯 Node harness，覆盖 runtime 创建、fixture replay、selector 和 command mock；
- 新增 tarball 安装烟雾测试，隔离安装六个公共包并执行 React SSR；
- `pnpm verify` 纳入 clean build、Node harness 和 package smoke。

## 第二片已完成

- ChatBI frontend 使用本地 `file:` 依赖消费 `@agentic-chat/adapter-chatbi`、`react` 和 `react-ui`；
- 删除 ChatBI Vite alias 和 TypeScript paths，不再导入 `chat_ui/packages/*/src`；
- 本地依赖只通过 package exports 访问构建后的 `dist`；npm Alpha 发布后只需将 `file:` 改为版本号；
- ChatBI 增加 `npm run agentic-chat:build`，用于 npm 发布前刷新本地 Alpha 包产物；
- SSE 只有在响应成功且 body 可读后才进入 `connected`，连接请求失败不再产生乐观状态闪烁；
- 运行中的 completion 在结束后立即移出活动 Map；最近 100 条 settled 结果有界保留，使迟到的 `waitForRun` 仍能观察失败；
- 新增连接状态和迟到 waiter 回归测试，`chat_ui` 当前 39 项测试通过；
- ChatBI 13 项前端测试和 production build 通过；Playwright Agentic Chat 相关路径通过，原有移动端非法上传用例首轮偶发超时、单独复跑通过。

## 第三片已完成

- canonical result 与 message content 使用框架无关的 `{ kind, value }` 信封；
- `@agentic-chat/react` 提供实例级 `createRendererRegistry`，支持 Tool、Result、Artifact 和 Message；
- registry 支持精确键、`*` fallback、动态注册/注销和安全替换，不使用全局可变单例；
- `@agentic-chat/react-ui` 提供四类稳定 fallback，领域 renderer 异常时由局部 error boundary 回退；
- 默认 Artifact fallback 不直接创建不可信 URI 链接，只显示地址文本；
- Playground 注册自定义 Tool 与 Result renderer；
- ChatBI adapter 将结果标记为 `chatbi.query-result`，ChatBI 通过公开 registry 注册现有洞察、图表、表格和 SQL renderer；
- registry/fallback/领域接入测试完成，`chat_ui` 当前 11 个文件、43 项测试通过；
- ChatBI 13 项测试和 production build 通过；桌面/移动主查询与 PostgreSQL 领域结果 Playwright 3 项通过、1 项按项目条件跳过。

## 第四片已完成

- ChatBI client 将 runtime command 的 `Idempotency-Key` 原样发送到 CreateRun API；
- Controller 默认生成 UUID，并允许显式传入 key 供逻辑重试复用；
- CreateRun API 强制校验 key，完整请求 body 使用稳定 SHA-256 指纹；
- SQLite migration 4 新增持久化幂等表，Run、用户消息和 key 在同一事务写入；
- 同 key 同请求返回原 Run，不重复写消息或启动 coordinator；同 key 不同请求返回 409；
- `BEGIN IMMEDIATE` 并发测试验证三个同时创建请求只生成一个 Run 和一条用户消息；
- ChatBI 后端 Ruff 及 96 项测试通过，`chat_ui` 43 项、ChatBI 前端 13 项测试通过；
- 浏览器创建、查询、恢复和取消关键路径通过；同时将依赖 LLM 规划的主流程行数断言改为验证至少一行，精确领域结果继续由确定性后端测试负责。

## 下一片

1. 完善 SSR server snapshot、selector 性能和长 Run 状态回收；
2. 增加 React/Vite minimal consumer 和 Storybook 状态矩阵。

## 发布前外部依赖

- 配置 GitHub 本地鉴权并首次推送；
- 配置 GitHub Actions；
- 配置 npm 登录和组织发布权限；
- 安排 Quick Start 独立验收人员。
