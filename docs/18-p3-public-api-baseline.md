# P3 公共 API 基线评审

> 结论：当前已发布包的根导出、类型签名、主题变量和默认 UI class hooks 作为 Beta 基线管理。名称中明确包含 `Experimental` / `experimental` 的 API 不进入兼容性承诺。

## 1. 基线范围

- `@agentic-chat/core`：canonical event、状态模型、snapshot 与 reducer；
- `@agentic-chat/runtime`：runtime、commands、capabilities 与 selectors；
- `@agentic-chat/react`：Provider、hooks、renderer registry；
- `@agentic-chat/react-ui`：默认组件、renderer fallback、主题变量与 CSS class hooks；
- `@agentic-chat/testkit`：adapter、snapshot、HITL、Artifact 与 retry conformance helper；
- `@agentic-chat/adapter-chatbi`、`@agentic-chat/adapter-ai-sdk`：公开 adapter 输入、能力和诊断结果。

Task、Artifact、复杂 Intervention 和 subagent 已经由上述包的根入口导出，因此从 Beta 起按公开 API 处理，不能再仅以“仍在演进”为由无迁移说明地破坏。`experimentalInspection`、`ExperimentalRuntimeInspector` 及其他明确实验命名仍可演进，但变更必须写入 changelog。

`@agentic-chat/adapter-ag-ui` 继续为 private 实验包，不纳入 npm/API 基线。

## 2. 自动化门

```bash
pnpm build
pnpm api:check
```

API Extractor 的审阅报告位于 `etc/api/*.api.md`；React UI CSS 契约位于 `etc/api/react-ui.css.md`。任何差异必须先人工确认兼容性和 changeset，再执行：

```bash
pnpm api:update
```

禁止为了让 CI 通过而无评审覆盖基线。

## 3. 版本与内部依赖

发布包之间使用 `workspace:*`。pnpm pack/publish 会把它转换为当前工作区的精确版本，避免旧 prerelease 自动加载较新的内部包。内部包变更应由 Changesets 同步提升受影响的消费者包，并通过 tarball consumer 验证。

## 4. Alpha → Beta 演练结论

已在隔离 worktree 中验证以下顺序会从当前 alpha pre-mode 进入 beta pre-mode，且 `changeset version` 生成 `0.1.0-beta.*`，不会产生或发布中间稳定版：

```bash
pnpm changeset pre exit
pnpm changeset:pre-enter-beta
pnpm version:packages
pnpm verify
pnpm release:beta
```

`release:beta` 内部只执行构建与 `changeset publish`，不要追加 `--tag beta`。Changesets 会使用 pre-mode 中记录的 `beta` 同时生成版本后缀和 npm dist-tag。

正式切换属于发布状态变更，只能在工作区干净、P4.0 发布门通过且维护者确认后单独执行和提交。NVDA + Edge 由外部团队并行执行、结果后补，不作为 P4.0 或 Beta 的切换前置条件。
