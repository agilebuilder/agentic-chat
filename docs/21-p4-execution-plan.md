# P4 执行计划：开源 1.0

> 状态：P4.0 npm Beta 已发布并通过公共 consumer 验收，进入 P4.1 契约冻结。目标是把 P3 工程基线转化为可公开采用、可持续维护并可发布为 `1.0.0 latest` 的产品。

## 1. 范围与原则

P4 解决稳定性、文档、真实采用、开源治理和发布可信度，不继续堆叠新的 Agent 功能面。新增 adapter、renderer 市场、Vue、移动端和 Obsidian 深度集成属于 P5，除非它们成为 1.0 的真实阻塞项。

稳定边界：

- `@agentic-chat/core`、`runtime`、`react`、`react-ui`、`testkit`、`adapter-chatbi`、`adapter-ai-sdk` 的既有根导出进入兼容性治理；
- 明确命名为 `Experimental` / `experimental` 的入口不作 1.0 稳定承诺；
- `adapter-ag-ui` 在具备真实 transport、版本协商和宿主验收前继续 private；
- canonical schema 1.0 只接受被至少两个真实来源证明的字段。

## 2. 工作包

### P4.0 阶段过渡与 Beta 发布门

目标：把当前 alpha pre-mode 安全切换为 beta，并验证外部安装链。

任务：

- 冻结并记录 P3 基线提交、API 报告、包体和性能数字；
- 经维护者批准后执行 `pre exit → pre enter beta → version → verify → publish`；
- 校验 npm `beta` dist-tag、provenance、README、LICENSE、repository 和精确内部依赖；
- Beta 发布前先建立或确认 npm trusted publishing/OIDC、受保护 GitHub environment 与 provenance；当前本地 `changeset publish` 脚本不满足该门；
- 在全新目录从 npm 安装 beta，完成 TypeScript build、Quick Start 和三个 adapter fixture smoke；
- 建立 Beta issue 标签、回归模板和兼容性变更台账。

发布前版本、权限、验证、dist-tag 与回滚细则见 [P4.0 Beta 发布准备](./22-p4-beta-release-readiness.md)。NVDA + Edge 由外部团队并行执行、结果后补，不阻塞 P4.0 或 Beta。

完成门（已通过）：beta 可从公共 npm 安装；仓库、npm 版本和 changelog 一致；本次未创建 Git tag/GitHub Release；六个既有包的 `latest` 未移动，首次 adapter 的 registry 初始 `latest` 例外已记录。

### P4.1 Canonical Schema 与公共 API 1.0

目标：形成可执行而非口头的稳定契约。

任务：

- 发布 canonical schema 1.0 文档，明确 envelope、sequence、snapshot、extension 和未知事件规则；
- 审核所有根导出，决定 stable、deprecated、experimental 和 internal；
- 制定 SemVer、弃用周期、迁移指南和兼容矩阵；
- API diff 对 breaking change 失败，对 additive change 要求 changeset；
- 补充 0.1 alpha/beta → 1.0 的迁移测试和文档；
- 明确 Node、React、TypeScript、浏览器和 SSR 支持范围。

完成门：没有已知必须在 1.0 后立即破坏的 stable API；schema、类型、运行时行为和 testkit 断言一致。

### P4.2 文档站、示例与开发者体验

目标：外部开发者不阅读仓库源码即可完成接入。

任务：

- 建立版本化文档站和可在线体验的静态 demo；
- 完成概念模型、Quick Start、adapter、renderer、主题、HITL、Artifact、snapshot、安全、性能和故障排查指南；
- 生成或整理 API reference，并链接到对应概念和示例；
- 提供 ChatBI 案例与一个非 ChatBI 案例；
- 把文档代码块抽成可编译示例，在 CI 执行 install/typecheck/build；
- 安排未参与核心开发的人员分别完成 adapter 和 renderer 文档验收。

完成门：新用户能仅依据公开文档完成 adapter 与自定义 renderer；所有可执行示例由 CI 验证。

### P4.3 开源治理与可信发布

目标：仓库具备接受外部用户和贡献的最低治理能力。

任务：

- 增加 `CONTRIBUTING.md`、`CODE_OF_CONDUCT.md`、`SECURITY.md`、维护范围和支持政策；
- 增加 issue form、PR 模板、changeset/测试要求和 triage 标签；
- 建立 GitHub Actions 发布工作流，优先使用 npm trusted publishing/OIDC 与 provenance；
- 对生产依赖、开发依赖、许可证和发布 tarball 做审计；
- 自动生成 changelog 和 GitHub Release，发布操作使用受保护 environment；
- 记录撤回、弃用、紧急安全修复和密钥轮换流程。

完成门：贡献、安全报告和发布流程公开可执行；发布无需个人长期 npm token；产物带 provenance。

### P4.4 质量与兼容性加固

目标：把 P3 的单浏览器工程门扩展为公开支持矩阵。

任务：

- 确定 Chromium/Edge、Firefox、WebKit/Safari 的支持或明确排除策略，并在 CI 落实；
- 保留 axe、键盘、窄屏、深色和 reduced-motion 门；归档外部 NVDA 结论；
- 增加断线、重复、乱序、snapshot 恢复、取消/重试竞争和慢消费者混沌测试；
- 扩充 Markdown、URL、iframe、renderer 异常和不可信内容安全测试；
- 固化 1,000 Activity、Inspector、bundle 和初次渲染预算；
- 检查 SSR/hydration、React 18/19 和支持的 TypeScript 版本。

完成门：支持矩阵全部全绿或有公开限制；无未处理 blocker/high；性能和包体不突破预算。

### P4.5 真实宿主与独立验收

目标：证明 1.0 不只在 fixture 和本仓库 demo 中成立。

任务：

- ChatBI 使用精确 RC 版本完成发送、流式、工具、取消、重连、幂等和恢复验收；
- 至少一个非 ChatBI React 宿主优先使用公开 AI SDK adapter 完成真实接入；
- 采集两类宿主的 adapter diagnostics、性能 trace、失败恢复和升级反馈；
- 独立开发者完成 30 分钟 Quick Start、adapter 指南和 renderer 指南验收；
- 外部 NVDA 如果发现 blocker/high，修复后由同一测试路径复验。

完成门：两个真实宿主均无本地源码 alias，使用 registry RC tarball；没有必须修改 core 才能接入的宿主特例。

### P4.6 Release Candidate 稳定期

目标：用真实反馈证明 API 和运行模型可以冻结。

任务：

- 发布 `1.0.0-rc.0` 到 `next`/`rc`，不移动 `latest`；
- 建议至少 7～14 天稳定期，记录所有 issue、API 请求和迁移影响；
- blocker/high 立即修复并发布新 RC；任何 breaking change 重新开始稳定观察；
- 每次 RC 运行完整 CI、tarball consumer、ChatBI smoke 和非 ChatBI smoke；
- 完成 1.0 release notes、迁移说明和已知限制。

完成门：稳定期内无未解决 blocker/high，无已知必须破坏 stable API 的问题。

### P4.7 1.0 发布与发布后验证

目标：发布可安装、可追溯、可维护的稳定版本。

任务：

- 维护者批准版本和 dist-tag 后发布 `1.0.0 latest`；
- 创建 Git tag、GitHub Release、changelog 和 provenance 证据；
- 在空项目从 npm `latest` 安装并执行 Quick Start、类型检查和 production build；
- 验证文档站、示例链接、npm README 和安全报告入口；
- 建立发布后 72 小时观察和问题响应安排。

完成门：npm、GitHub、文档和支持渠道版本一致；安装 smoke 全绿；无高风险安全问题。

## 3. 建议顺序与并行关系

关键路径：

```text
P4.0 Beta → P4.1 契约冻结 → P4.5 真实接入 → P4.6 RC 稳定期 → P4.7 1.0
                 ├─ P4.2 文档与示例 ─┤
                 ├─ P4.3 治理与发布 ─┤
                 └─ P4.4 质量加固 ───┘
```

- P4.2、P4.3、P4.4 可在 P4.1 确定支持范围后并行；
- P4.5 可以尽早用 beta 开始，但最终必须用 RC 复验；
- 文档和真实接入反馈可能发现 API 问题，必须在 RC 前解决；
- RC 稳定期不能被文档补写或新功能开发挤占。

## 4. 里程碑与建议工期

| 里程碑 | 主要工作包 | 建议工期 | 退出条件 |
|---|---|---:|---|
| M4.0 Beta 可消费 | P4.0 | 1～2 个工作日 | npm beta + clean consumer 全绿 |
| M4.1 契约候选冻结 | P4.1 | 3～5 个工作日 | schema/API/support matrix 评审通过 |
| M4.2 1.0 候选完整 | P4.2～P4.5 | 8～15 个工作日，可并行 | 文档、治理、质量和两个真实宿主通过 |
| M4.3 RC 稳定 | P4.6 | 7～14 个自然日 | 无 blocker/high，无 breaking 需求 |
| M4.4 1.0 发布 | P4.7 | 1 个工作日 + 72 小时观察 | `latest` 与全链路 smoke 通过 |

工期不包含外部团队排期；真实接入和无障碍反馈应尽早安排，避免集中到 RC 末尾。

## 5. 需要维护者/外部人员提供的输入

- P4.0、P4.6、P4.7 每次 npm dist-tag 变更的明确批准；
- npm trusted publishing 与 GitHub protected environment 的组织权限；
- ChatBI RC 接入测试人员及可复现的非敏感测试环境；
- 一个非 ChatBI React 宿主，建议优先选择 AI SDK 流；
- NVDA + Edge 独立测试结果；
- 1.0 支持窗口、漏洞响应联系人和维护承诺。

## 6. P4 总体验收

- [ ] ChatBI 使用 registry RC 完成真实验收；
- [ ] 至少一个非 ChatBI 宿主使用公开 adapter 完成真实集成；
- [ ] canonical schema 1.0、SemVer、弃用和迁移政策公开；
- [ ] stable API 在 RC 周期内无必须破坏的问题；
- [ ] 文档代码、Quick Start、adapter 和 renderer 示例全部由 CI 验证；
- [ ] 支持矩阵、无障碍、性能、安全和混沌门通过；
- [ ] 开源贡献、安全报告、许可证和发布流程完整；
- [ ] RC 稳定期无未解决 blocker/high；
- [ ] `1.0.0 latest` 的 npm、GitHub、文档和 clean consumer 验证一致。
