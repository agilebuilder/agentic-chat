# P2 可复用 Alpha 开发记录

> 开始日期：2026-07-13  
> 当前状态：第二片——真实包消费边界已完成。

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

## 下一片

1. 建立 renderer registry、fallback 与 custom renderer 示例；
2. 设计并实现 ChatBI 创建 Run 的持久化 idempotency key；
3. 完善 SSR server snapshot、selector 性能和长 Run 状态回收；
4. 增加 React/Vite minimal consumer 和 Storybook 状态矩阵。

## 发布前外部依赖

- 配置 GitHub 本地鉴权并首次推送；
- 配置 GitHub Actions；
- 配置 npm 登录和组织发布权限；
- 安排 Quick Start 独立验收人员。
