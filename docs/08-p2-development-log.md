# P2 可复用 Alpha 开发记录

> 开始日期：2026-07-13  
> 当前状态：P2.5–P2.8 已完成；等待 P2.9 发布环境与独立 Quick Start 验收。

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

## P2.5：SSR、性能与长 Run 已完成

- React Provider 支持注入稳定 `serverSnapshot`，服务端渲染和首次 hydration 使用同一快照；
- `selectLatestRunId` 从每次排序改为 O(n) 单次扫描；
- stream cursor 增加压缩水位线，活跃 Run 只保留最近 256 个 event ID，终态自动回收；
- 提供 `compactRunStream` 与 runtime `compactRun` 显式回收入口，blocked stream 不允许压缩；
- diagnostics 保持最多 200 条；
- 1,000 activities / 2,001 events 性能测试纳入 `pnpm test`：摄取预算 4,000ms、selector 预算 50ms，当前机器实测约 551ms。

## P2.6：可复用默认 UI 已完成

- 新增 ThreadList、MessageList、TaskPanel、ArtifactPanel 和基础 InterventionPanel；
- 新增 Notice、LoadingState、EmptyState、ErrorState、RecoveryNotice 与公开 ErrorBoundary；
- Tool fallback 支持参数、结果、错误、耗时、折叠和复制；
- Composer 支持前后 slots、附件入口以及 disable/queue/intervene 运行中策略；
- 默认 Markdown 使用保守 React element renderer，不执行 raw HTML，不使用 `dangerouslySetInnerHTML`，链接只允许 `http`、`https`、`mailto`；
- Artifact fallback 继续只展示 URI，不默认打开或下载不可信地址；
- 支持 `system/light/dark` 显式主题、窄屏布局和 reduced-motion；
- 修复派生 selector 返回新数组可能导致的重复渲染，以及 axe 发现的非法 `header role=status` 组合。

## P2.7：开发者体验已完成

- 新增独立 React/Vite `apps/minimal`，只消费公共包 exports；
- 新增 fixture player，覆盖成功、失败、取消与并行编码 fixture，支持播放、暂停、单步、重置和调速；
- 新增 Quick Start、主题、Adapter 与 Alpha 发布流程文档；
- 配置 Changesets `alpha` 预发布模式、版本与发布脚本；private workspace 不参与版本和 tag；
- 为 core/runtime/react/react-ui 的本批公共变化增加 patch changeset。

## P2.8：质量门禁已完成

- Storybook 覆盖 Empty、Running、Completed、Failed、Cancelled、Workspace Primitives 六类状态；
- Playwright 质量矩阵 11/11：6 项 axe、3 项视觉回归、2 项键盘流程；
- CSS scope 检查覆盖 95 个 selector，只允许 `.ac-*` 与组件自有 `@keyframes ac-*`；
- 公共包建立原始 dist 体积预算，`react-ui` 当前 63,158 / 73,728 bytes；
- `pnpm verify` 全绿：13 个测试文件 54 项测试、12 个 workspace 构建、Node harness、6 个 tarball 隔离安装；
- ChatBI 消费端 13 项前端测试与 production build 回归通过。

## P2.9 下一步

1. 配置 GitHub 鉴权并推送分支，启用 GitHub Actions 后验证远端 CI；
2. 配置 npm 登录、`@agentic-chat` 组织发布权限与 2FA，先执行 dry-run/tarball 审查，再发布 alpha tag；
3. 由未参与核心开发的人员依据 `docs/10-quick-start.md` 在 30 分钟内完成独立接入，并记录阻塞与耗时；
4. 使用发布后的 npm 版本替换 ChatBI 当前本地 `file:` 依赖，执行最终集成验收。

## 发布前外部依赖

- 配置 GitHub 本地鉴权并首次推送；
- 配置 GitHub Actions；
- 配置 npm 登录和组织发布权限；
- 安排 Quick Start 独立验收人员。
