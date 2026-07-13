# ADR-0003：Alpha 包与发布身份

- 状态：接受
- 日期：2026-07-13

## 背景

P1 通过源码 alias 将 ChatBI 接入仓库，尚不能证明包能够被外部项目安装。P2 需要建立真实的 npm 包边界，并在公开发布前固定仓库、许可证、scope 和预发布策略。

## 决策

1. 代码仓库使用 `https://github.com/agilebuilder/agentic-chat.git`；本地配置 `origin`，鉴权完成前不推送。
2. 项目使用 MIT License。
3. 公共包使用 npm scope `@agentic-chat/*`，首个 Alpha 版本为 `0.1.0-alpha.0`，正式发布使用 `alpha` dist-tag。
4. `core`、`runtime`、`react`、`react-ui`、`adapter-chatbi` 和 `testkit` 作为 P2 公共包；尚未达到 P3 语义的 `adapter-ag-ui` 保持 private。
5. 包只发布 `dist` 和必要资产，exports 不再指向 TypeScript 源码；构建产出 ESM、类型声明、声明映射和 source map。
6. 发布前必须从 tarball 在隔离消费者中完成安装和运行验证，不能只依赖 workspace 源码链接。
7. ChatBI 创建 Run 的端到端幂等纳入 P2。只有客户端传 key、后端持久化 key 并返回原 Run 时，才能声明该能力成立。

## 影响

- ChatBI 下一片需要移除 Vite/TypeScript 源码 alias，改为消费构建后的公开包。
- AG-UI adapter 在 P3 完成协议覆盖和 conformance 前不会误发为 Alpha。
- npm 发布和 GitHub 推送仍需要本地鉴权，但不阻塞 P2 开发和 tarball 验证。
