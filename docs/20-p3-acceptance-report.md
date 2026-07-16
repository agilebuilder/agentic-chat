# P3 工程验收报告

> 结论：P3 功能与工程实现完成，可以启动 P4。NVDA + Edge 由独立测试人员执行；npm beta 尚未发布，作为 P4.0 的显式发布操作。

## 1. 验收范围

P3 验收覆盖三种事件源 conformance、snapshot/replay、并行和父子 Activity、retry/attempt、Human-in-the-loop、Artifact、安全预览、Runtime Inspector、性能预算、安全门、公共 API 基线和发布演练。

不把以下持续或外部动作伪装成已经完成：

- 独立测试人员的 NVDA + Edge 人工结果；
- alpha → beta 版本切换、npm publish 和 beta 使用期；
- “整个 Beta/RC 周期无重大重构”的长期观察结论。

## 2. 工程验收结果

| 范围 | 结果 | 证据 |
|---|---|---|
| 三种来源 | 通过 | ChatBI、AG-UI、AI SDK fixture 通过公共 conformance；同一默认 UI 可切换播放 |
| 高级运行模型 | 通过 | Task revision、snapshot/delta、并行/父子 Activity、retry/attempt、终态生命周期均有 reducer/runtime/testkit 测试 |
| HITL | 通过 | confirm/approval/choice/text/form、失败重提、幂等、恢复和 expired 状态均覆盖 |
| Artifact | 通过 | 版本、provenance、状态、双向导航、拒绝默认的懒加载 sandbox preview 均覆盖 |
| Inspector | 通过 | 明确 opt-in、有界 envelope、payload-free、脱敏 diagnostic 和性能预算均覆盖 |
| 公共 API | 通过 | API Extractor 报告与 React UI CSS contract 纳入 `pnpm verify`；experimental API 明确排除稳定承诺 |
| 自动化质量 | 通过 | 本地 `pnpm verify` 128/128 单测通过；`pnpm quality:browser` 23/23 通过 |
| 远端门禁 | 通过 | Node 20、Node 22、Browser quality 和 OSV dependency scan 已完成全绿运行 |
| 代码复核 | 通过 | 两个独立子 Agent 复核未发现 blocker/high；Task 畸形 ID、parentId/activityId 类型边角已在当前提交修复 |

基线提交：`a90182a feat: harden P3 beta contracts and release gates`。

远端证据：

- CI：https://github.com/agilebuilder/agentic-chat/actions/runs/29422948401
- Dependency Security：https://github.com/agilebuilder/agentic-chat/actions/runs/29422949216

## 3. 保留项与阶段判定

| 项目 | 状态 | 处理方式 |
|---|---|---|
| NVDA + Edge 人工抽查 | 外部待执行 | 使用 `docs/19-nvda-edge-manual-acceptance.md`；不阻塞 P4 开发，1.0 前归档结论 |
| npm beta 发布 | 未执行 | P4.0 在维护者明确批准后切换 Changesets pre-mode、验证并发布 |
| Beta/RC 兼容观察 | 持续项 | P4 期间所有公共 API 差异必须经过基线评审、changeset 和迁移判断 |
| core/react-ui 包体余量 | 风险受控 | 当前 core 约 5%、react-ui 约 9% 余量；P4 新增能力优先拆分可选入口，不继续无界扩张默认包 |
| AG-UI transport | 实验边界 | `adapter-ag-ui` 保持 private；P4 真实非 ChatBI 宿主优先使用已公开 AI SDK adapter |

因此阶段结论为：**P3 工程完成，P4 Ready**。这不等价于“beta 已发布”或“外部 NVDA 已通过”。

## 4. P4 输入

P4 继承以下强制约束：

- 已纳入 Beta 基线的根导出不得无迁移说明地破坏；
- `Experimental` / `experimental` 可演进，但必须记录 changelog；
- 所有发布包继续通过 tarball consumer、API、包体、Node 和浏览器门；
- 真实 ChatBI RC、至少一个非 ChatBI 宿主、外部无障碍结论和 RC 稳定期必须在 1.0 前完成。
