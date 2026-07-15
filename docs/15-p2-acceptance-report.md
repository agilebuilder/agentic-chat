# P2 可复用 Alpha 验收报告

> 验收日期：2026-07-15
> 结论：通过
> 成熟度：D2 公开 Alpha

## 1. 验收范围

P2 的目标是把 ChatBI 内部实现收敛为可公开安装、框架边界清晰、可定制并具备基本质量保障的 Alpha 产品。本报告覆盖公共包发布、独立开发者接入、ChatBI 真实消费、可靠性、安全、性能、可访问性和发布流程，不承诺 Alpha API 已稳定。

## 2. 发布物

已公开发布：

- `@agentic-chat/core@0.1.0-alpha.1`；
- `@agentic-chat/runtime@0.1.0-alpha.1`；
- `@agentic-chat/react@0.1.0-alpha.1`；
- `@agentic-chat/react-ui@0.1.0-alpha.1`；
- `@agentic-chat/adapter-chatbi@0.1.0-alpha.0`；
- `@agentic-chat/testkit@0.1.0-alpha.0`。

`@agentic-chat/adapter-ag-ui` 保持 private，不作为 P2 能力发布。六个公共包均为 MIT License、public access，并带 ESM、类型声明、source map 和受控 package exports。

## 3. 验收结果

| 领域 | 结果 | 主要证据 |
| --- | --- | --- |
| npm 发布 | 通过 | 六个确切版本可从公共 registry 安装；空目录安装审计为 0 vulnerabilities |
| 包边界 | 通过 | boundary check、纯 Node harness、六个 tarball 隔离安装；core/runtime/adapter 不依赖 React DOM |
| React 接入 | 通过 | `AgenticChat`、headless bindings、CSS 子路径 export、React SSR 与 `serverSnapshot` 契约测试 |
| 默认 UI | 通过 | workspace primitives、renderer fallback、主题、窄屏、错误边界、composer 与 tool details |
| 可访问性 | 通过 | 6 项 axe、键盘 details/intervention/composer 流程与独立 Edge Tab/Ctrl+Enter 验证 |
| 安全默认值 | 通过 | Markdown 不执行 raw HTML、不使用 `dangerouslySetInnerHTML`、链接 scheme 白名单、Artifact URI 默认不激活 |
| 长 Run | 通过 | 1,000 activities / 2,001 events 基准、event ID 水位线、终态回收、显式 compaction、diagnostic 上限 |
| 可靠性 | 通过 | 重入守卫、sequence/replay、断流恢复、取消、刷新恢复与有界 completion 记录 |
| 端到端幂等 | 通过 | Idempotency-Key 透传、SQLite 持久化、同请求复用、冲突 409、并发只创建一个 Run |
| 独立 Quick Start | 通过 | 未参与核心开发的 React 开发者在 25 分钟内完成，仅使用 npm 与公开文档 |
| ChatBI npm 消费 | 通过 | 精确 registry 版本、lockfile integrity、无本地路径、全仓门禁与真实浏览器流程通过 |
| CI 与发布 | 通过 | GitHub Actions Node 20、Node 22、Browser quality 全绿；Changesets Alpha 流程可复用 |

## 4. 独立 Quick Start 证据

独立开发者使用 Windows 11、Node 22、pnpm 10 和 Microsoft Edge，从新的 React/Vite 项目开始，仅依据 `docs/10-quick-start.md` 和 `docs/14-quick-start-acceptance.md` 完成接入。

- 总耗时 25 分钟；
- 使用 `core/runtime/react-ui@0.1.0-alpha.1` 精确版本；
- 无 `file:`、`workspace:`、ChatBI、Zustand 或内部路径；
- 两次消息均完成，第二次由 Ctrl+Enter 发送；
- Tab 焦点、Tool 输入输出、最终结果、深浅主题和 390px 视口可用；
- TypeScript 和 production build 通过；
- 发布方复核 frozen install、lockfile integrity、ESM 入口与 build 均通过。

验收压缩包 SHA-256：`9B32E261BEC0F55B8C034B45AD14594CC3DF11C6F72CF7E3D9C01B67C7541A59`。

## 5. ChatBI 最终集成证据

ChatBI 不再消费 `../../chat_ui/packages/*`：

- `adapter-chatbi@0.1.0-alpha.0`；
- `react@0.1.0-alpha.1`；
- `react-ui@0.1.0-alpha.1`；
- 传递依赖 `core/runtime@0.1.0-alpha.1`。

重新生成的 npm lockfile 中所有 Agentic Chat 包均解析到 `https://registry.npmjs.org/` tarball 并带 integrity，不含 `file:`、`workspace:`、`link:` 或本地仓库路径。

最终验证结果：

- Ruff check 与 format check 通过；
- 后端 96 项 pytest 通过；
- 前端 14 项 Vitest 通过；
- TypeScript 与 Vite production build 通过；
- 通用内核、凭据泄漏和评测基线门禁通过；
- Playwright 10 项通过，2 项按项目条件跳过，0 项失败。

## 6. 已知限制

- 当前为 `0.1.0-alpha.*`，公共 API 仍可能按 changeset 演进；生产采用方必须固定确切版本；
- npm 首次建包同时初始化了 `alpha` 与 `latest`，无版本安装不代表稳定版承诺；
- P2 浏览器验证范围为 Playwright Chromium 与 Microsoft Edge；Firefox 和 Safari 尚未纳入正式兼容矩阵；
- `adapter-ag-ui`、多 Agent 正式交互和第二种真实后端属于 P3；
- 默认 result fallback 对结构化或长内容使用内部可滚动的 `pre`，宿主可通过 renderer registry 替换；
- SSR 采用方必须为同一请求复用稳定 `serverSnapshot`，不能跨请求共享可变 runtime。

## 7. 结论

P2 的全部验收项与退出条件已经满足：公共 Alpha 可以安装，独立开发者能在 30 分钟内接入，ChatBI 只通过公开 npm API 完成真实集成，核心质量与安全门禁均有自动化证据。项目可以结束 P2，下一阶段应按 P3 路线图验证非 ChatBI 后端与多 Agent 能力，不应把尚未实现的 P3 能力计入当前 Alpha 承诺。
