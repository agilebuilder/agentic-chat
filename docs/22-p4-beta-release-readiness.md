# P4.0 Beta 发布准备与回滚清单

> 状态：发布前准备进行中；npm beta 未发布；Changesets 仍处于 `alpha` pre-mode。
> 基线：`a90182a feat: harden P3 beta contracts and release gates`。
> 审查日期：2026-07-16。

## 1. 结论

P3 工程基线可以进入 P4.0 准备，但当前不得执行 Beta 发布。代码、包元数据和本地消费链可以继续加固；真正发布前必须由维护者批准 Changesets 状态切换和 npm 发布，并先关闭以下外部门：

1. 建立或确认 npm trusted publishing、GitHub OIDC `id-token: write`、受保护 environment 与 provenance；当前本地 `release:beta` 不能证明 provenance；
2. 确认首次创建 `@agentic-chat/adapter-ai-sdk` 的组织权限、trusted publisher 绑定和初始 dist-tag 行为。

NVDA + Edge 由维护者团队并行执行、结果后补，不属于 P4.0 或 Beta 发布前置条件。

## 2. Changesets 状态与预计版本

当前 `.changeset/pre.json`：`mode = pre`、`tag = alpha`。已消费 `calm-runs-smile` 与 `tall-walls-punch`；P3 其余 changeset 与 P4.0 的未知事件修复仍待消费。

经隔离演算，批准后执行 `pre exit → pre enter beta → version` 将得到：

| Package | 当前版本 | 预计 Beta | npm 发布 |
|---|---:|---:|---|
| `@agentic-chat/core` | `0.1.0-alpha.1` | `0.1.0-beta.2` | 是 |
| `@agentic-chat/runtime` | `0.1.0-alpha.1` | `0.1.0-beta.2` | 是 |
| `@agentic-chat/react` | `0.1.0-alpha.1` | `0.1.0-beta.2` | 是 |
| `@agentic-chat/react-ui` | `0.1.0-alpha.1` | `0.1.0-beta.2` | 是 |
| `@agentic-chat/testkit` | `0.1.0-alpha.0` | `0.1.0-beta.1` | 是 |
| `@agentic-chat/adapter-chatbi` | `0.1.0-alpha.0` | `0.1.0-beta.1` | 是 |
| `@agentic-chat/adapter-ai-sdk` | `0.1.0-alpha.0` | `0.1.0-beta.1` | 是，首次创建 |
| `@agentic-chat/adapter-ag-ui` | `0.1.0-alpha.0` | 不变 | 否，保持 private |

Beta 序号延续各包既有 prerelease 计数，不是统一的 `beta.0`。新增 core patch changeset 不会把这次合并后的首个 Beta 再提升为 `beta.3`。

## 3. Package manifest 审查

七个公开包均满足：

- scope/name 与目录一致；
- `license: MIT`；
- repository 指向 `agilebuilder/agentic-chat` 并带 package directory；
- `files: ["dist"]`；
- 根入口同时导出 ESM 与 TypeScript declaration，且导出 `./package.json`；
- `publishConfig.access: public`；
- 内部发布依赖使用 `workspace:*`，pack 后由门禁验证为精确版本；
- React 包只通过 peerDependencies 声明 React 18/19，`react-ui` 同时声明 React DOM 18/19；
- tarball 必须包含 package 根 README 与 `dist/LICENSE`。

`react-ui` 额外导出 `./styles.css`。`adapter-ag-ui` 明确 `private: true`，位于 Changesets `ignore`，`privatePackages.version/tag` 均为 false；它没有公开包元数据要求，也不得出现在七个归档中。

## 4. Registry、权限与 GitHub 只读检查

- `npm whoami` 返回当前维护身份；`npm org ls agentic-chat` 显示该身份为 owner；
- 已发布的 core、runtime、react、react-ui、testkit、adapter-chatbi 均为 public，并且 `alpha`/`latest` 当前仍指向已发布 Alpha；
- `adapter-ai-sdk` 在 registry 中不存在，`npm access get status` 的默认结果不能替代首次建包权限与 trusted publisher 检查；
- `adapter-ag-ui` registry 返回已于 2026-07-14 unpublished；本地 private/Changesets 配置继续阻止再次发布；
- 通用 `npm access list packages` 返回 403，因此未能从该端点证明逐包写权限；正式发布前应以 trusted publisher 配置和逐包 dry-run 再确认；
- Git remote 为 `agilebuilder/agentic-chat`，当前分支跟踪同名远端分支；基线提交的 CI 与 Dependency Security 运行全绿。

## 5. 本地发布前验证

准备阶段必须在 alpha 工作区完成：

```bash
pnpm verify
pnpm quality:browser
pnpm verify:packages
```

`verify:packages` 应创建七个 tarball，在全新临时 consumer 中执行 pnpm install、根入口 ESM/SSR import 和 TypeScript typecheck，并检查精确内部依赖、README 与 LICENSE。另需用 Vite production build 覆盖真实 bundler 入口；所有验证必须使用 tarball，不能依赖 workspace alias。

本轮结果（2026-07-16）：

- `pnpm verify`：通过，19 个测试文件、130/130 单元测试；边界、CSS、安全、TypeScript、构建、API Extractor、包体、Node harness 均通过；
- `pnpm quality:browser`：23/23 通过；
- 七包 tarball consumer：通过，每包 README/LICENSE、精确内部依赖、pnpm install、根入口 ESM/SSR import 与 TypeScript typecheck 均通过；
- 全新 Vite production build：通过，消费 tarball 而非 workspace alias；
- 包体：core 125,593/131,072 bytes（96%），react-ui 103,810/114,688（91%），runtime 82%，testkit 77%，adapter-ai-sdk 45%，adapter-chatbi 52%。

core 只剩约 4% 预算；P4 新能力不得继续无界进入默认 core，优先使用文档、可选入口或独立包。

## 6. 获批后的准确操作顺序

以下每个正式状态变更均要求维护者明确批准。建议把“版本切换批准”和“发布批准”分开：

1. 确认工作区只包含已评审、已提交的 P4.0 改动，远端 CI 全绿；
2. 确认 npm trusted publisher、允许的 publish action、GitHub workflow 文件名、environment、OIDC 和 provenance；
3. 记录 `adapter-ai-sdk` 首次建包/初始 `latest` 预期；NVDA 结果由外部团队完成后另行归档；
4. 获得 Changesets 切换批准；
5. 执行：

   ```bash
   pnpm changeset:pre-exit
   pnpm changeset:pre-enter-beta
   pnpm version:packages
   pnpm install --lockfile-only
   ```

6. 审核全部版本、changelog、删除/消费的 changeset、lockfile 与内部精确依赖；
7. 再次运行完整 verify、browser、tarball、clean Vite consumer 和 publish dry-run；
8. 提交版本化结果并等待远端发布门全绿；
9. 获得 npm Beta 发布批准；
10. 通过受保护 trusted-publishing workflow 发布，使用 Changesets pre-mode 推导的 `beta` dist-tag，不额外传 `--tag beta`；
11. 逐包验证 `npm view` 的版本、`beta`、integrity、README、LICENSE、repository 和 provenance；
12. 从公共 npm `@beta`/精确版本在全新目录重复 install、typecheck、production build 与 smoke；
13. Git tag、GitHub Release 或任何 `latest` 调整继续单独申请批准。

对于六个已有包，发布不得移动现有 `latest`。`adapter-ai-sdk` 是首次建包，npm 可能初始化 `latest`；这是新包例外，必须在发布批准中明确接受并在发布后核验，不能悄然当作稳定承诺。

## 7. 回滚与失败处理

### 发布前

- 若版本化或验证失败，不执行 publish；用普通审阅提交恢复 alpha pre-mode/版本文件，保留问题证据；
- 不复用已生成但未评审的 changelog/lockfile；修复后重新完整演练；
- 不使用 `git reset --hard`、`git checkout --` 或删除维护者已有改动。

### 发布后

- npm 版本不可覆盖。发现缺陷时创建 patch changeset，发布递增的下一 Beta；
- 默认不 unpublish。只有安全或法律紧急情况且维护者明确批准时才考虑撤回；
- 错误 dist-tag 只能在维护者批准后修正，优先把 `beta` 指回最后已知良好 Beta；保留 `alpha` 与已有包的 `latest`；
- 若 `adapter-ai-sdk` 首次发布初始化 `latest`，记录该 registry 限制并在文档中要求显式 `@beta`/精确版本，除非维护者另行批准 dist-tag 方案；
- Git tag/GitHub Release 已创建后不得静默重写，使用新版本和更正说明。

## 8. P4.0 完成门

发布准备完成不等于 Beta 已发布。P4.0 只有在维护者批准并完成 npm 发布后，才能勾选以下最终项：

- [ ] 七个公开包均存在精确 Beta 版本与 `beta` dist-tag；
- [ ] provenance、README、LICENSE、repository 与内部依赖全部可从 registry/tarball 验证；
- [ ] 公共 npm clean consumer 的 install/typecheck/production build/smoke 全绿；
- [ ] 仓库提交、npm 版本、changelog 和获批 tag/release（若创建）一致；
- [ ] 已有包的 `latest` 未移动；首次 adapter 的初始 `latest` 行为已记录；
- [ ] 无未处理 blocker/high，或残余风险有维护者书面批准。
