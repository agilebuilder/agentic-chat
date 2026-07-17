# P4.0 Beta 发布准备与回滚清单

> 状态：七个公开包的 npm Beta 已发布并完成公共 registry/consumer 验收；Changesets 继续处于 `beta` pre-mode。
> 发布基线：`3aa758e Merge pull request #2 from agilebuilder/codex/p4-beta-versioning`。
> 审查日期：2026-07-17。

## 1. 结论

P3 工程基线、P4.0 Changesets Beta 版本和发布 workflow 均已合入 `main`。维护者明确批准 npm Beta 发布后，七个公开包已从 `main@3aa758e` 发布并通过 registry 与 clean consumer 验收；`adapter-ag-ui` 继续保持 private。Beta 发布没有创建 Git tag 或 GitHub Release，也没有移动六个既有包的 `latest`。

NVDA + Edge 由维护者团队并行执行、结果后补，不属于 P4.0 或 Beta 发布前置条件。

## 2. Changesets 状态与预计版本

当前 `.changeset/pre.json`：`mode = pre`、`tag = beta`。维护者已批准并执行 `pre exit → pre enter beta → version`；12 个 changeset 已记录到新的 pre-state 与 changelog。

隔离演算与正式生成结果一致：

| Package | 切换前版本 | 当前 Beta | npm 发布 |
|---|---:|---:|---|
| `@agentic-chat/core` | `0.1.0-alpha.1` | `0.1.0-beta.2` | 是 |
| `@agentic-chat/runtime` | `0.1.0-alpha.1` | `0.1.0-beta.2` | 是 |
| `@agentic-chat/react` | `0.1.0-alpha.1` | `0.1.0-beta.2` | 是 |
| `@agentic-chat/react-ui` | `0.1.0-alpha.1` | `0.1.0-beta.2` | 是 |
| `@agentic-chat/testkit` | `0.1.0-alpha.0` | `0.1.0-beta.1` | 是 |
| `@agentic-chat/adapter-chatbi` | `0.1.0-alpha.0` | `0.1.0-beta.1` | 是 |
| `@agentic-chat/adapter-ai-sdk` | `0.1.0-alpha.0` | `0.1.0-beta.1` | 是，首次创建 |
| `@agentic-chat/adapter-ag-ui` | `0.1.0-alpha.0` | 不变 | 否，保持 private |

Beta 序号延续各包既有 prerelease 计数，不是统一的 `beta.0`。版本、changelog 与 pre-state 已生成；registry 已确认七个精确 Beta 版本全部公开可见且 manifest 与审定内容一致。

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
- Git remote 为 `agilebuilder/agentic-chat`；当前 `codex/p4-beta-readiness` 仍是本地分支，P4 提交尚未获得远端 CI 结果；基线提交的 CI 与 Dependency Security 运行全绿。
- GitHub API 已确认 `npm-beta` environment 存在，required reviewer 为 `agilebuilder`，`prevent_self_review = false`；这符合当前单维护者审批方式。
- `npm-beta` 当前没有 environment 级 deployment branch policy，管理员也可以 bypass。发布 workflow 因此必须同时用触发条件和 job guard 限制 `refs/heads/main`；main branch protection/ruleset 作为 P4.3 高优先级加固项。
- 当前 npm CLI 身份读取 trusted publisher 返回 403，无法从本机独立复述六包后台字段；维护者已确认配置完成，首次 GitHub OIDC run 仍是最终端到端证明。

## 5. 本地发布前验证

准备阶段必须在 alpha 工作区完成：

```bash
pnpm verify
pnpm quality:browser
pnpm verify:packages
```

`verify:packages` 应创建七个 tarball，在全新临时 consumer 中执行 pnpm install、根入口 ESM/SSR import 和 TypeScript typecheck，并检查精确内部依赖、README 与 LICENSE。另需用 Vite production build 覆盖真实 bundler 入口；所有验证必须使用 tarball，不能依赖 workspace alias。

本轮结果（2026-07-17）：

- `pnpm verify`：通过，19 个测试文件、130/130 单元测试；边界、CSS、安全、TypeScript、构建、API Extractor、包体、Node harness 均通过；
- `pnpm quality:browser`：23/23 通过；
- 七包 tarball consumer：通过，每包 README/LICENSE、精确内部依赖、pnpm install、根入口 ESM/SSR import 与 TypeScript typecheck 均通过；
- 全新 Vite production build：通过，消费 tarball 而非 workspace alias；
- 包体：core 125,593/131,072 bytes（96%），react-ui 103,810/114,688（91%），runtime 82%，testkit 77%，adapter-ai-sdk 45%，adapter-chatbi 52%。

core 只剩约 4% 预算；P4 新能力不得继续无界进入默认 core，优先使用文档、可选入口或独立包。

仓库侧发布门已准备为：

- `.github/workflows/publish-beta.yml`：只允许从 `main` 手动触发；preflight 运行版本/registry 检查、`pnpm verify` 和 23 项浏览器质量门；publish job 使用 `npm-beta` environment、OIDC `id-token: write`、Node 22.23.1、npm 11.18.0 和 provenance；
- 首次创建 adapter-ai-sdk 时曾使用一次性 bootstrap workflow 和短期 `NPM_BOOTSTRAP_TOKEN`；完成 Trusted Publisher 配置并撤销 token 后，该 workflow 与验证脚本已在 P4.3 删除，避免误触或形成长期 token 路径；
- 两条 workflow 的 checkout、Node 和 pnpm Actions 均固定为已复核的完整 commit SHA；正式 publish workflow 不读取长期 npm token；
- `pnpm check:release` 将 workflow 文件名、environment、main-only、OIDC、provenance、npm 版本、Action SHA pin、显式 beta tag 和 private AG-UI 约束纳入 `pnpm verify`；
- 正式切换前，隔离 clone 已完成 alpha → beta 版本演算、registry 未发布检查、adapter tarball 构建和 `npm publish --dry-run`；该演练没有改变仓库或外部发布状态。

正式版本切换结果（2026-07-17）：

- 分支：`codex/p4-beta-versioning`，基于已合并且全绿的远端 `main@3964f02`；
- `pre exit → pre enter beta → version → pnpm install --lockfile-only` 已执行，七包版本与上表一致；
- Changesets 对非发布 app 和 private AG-UI 产生的纯格式化噪声已移除；`adapter-ag-ui` 仍为 `private: true`、`0.1.0-alpha.0`；
- `pnpm release:beta:check` 通过，七个目标版本在 registry 均为 unpublished；
- `pnpm verify` 再次通过：130/130、API、包体、Node harness、七包 tarball consumer、TypeScript 与 production Vite build 全绿；
- `pnpm quality:browser` 再次通过：23/23；七个 Beta tarball 均通过 `npm publish --dry-run --access public --tag beta`；
- 截至版本切换提交时，npm publish、dist-tag、Git tag 与 GitHub Release 均未执行。

正式 Beta 发布结果（2026-07-17）：

- 一次性 bootstrap run `29552387574` 从 `main@3aa758e` 创建 `@agentic-chat/adapter-ai-sdk@0.1.0-beta.1`，公开包页面和 Sigstore transparency log 均显示 GitHub Actions provenance；短期 GitHub Environment secret 随后删除，维护者撤销 token 并为新包配置 trusted publisher；
- npm 首次建包同时初始化 `beta` 与 `latest` 为 `0.1.0-beta.1`。维护者批准删除 `latest`，但 npm 10.9.8 与 npm 11.18.0 的删除请求均由 registry 返回 HTTP 400；该行为作为首次建包 registry 例外记录，不解释为稳定 API 承诺，使用文档要求显式 `@beta` 或精确版本；
- 正式 publish run `29553517200` 首次通过 OIDC 发布 core/runtime 后，在 react 的 trusted publisher 配置处以 `ENEEDAUTH` 停止；修正配置后，第三次幂等 attempt 校验并跳过已存在版本，发布剩余包并完成最终七包校验；
- `pnpm release:beta:check` 从公共 registry 确认七个 manifest、精确内部依赖、license 与 repository 全部匹配；每个版本均有 integrity 和 SLSA provenance attestation；
- 六个既有包的 `alpha` 与 `latest` 保持原 Alpha，`beta` 指向本次 Beta；首次 adapter 的 `beta` 与初始 `latest` 均指向 `0.1.0-beta.1`；
- 全新公共 npm consumer 使用七个精确版本完成 `pnpm install`、七个根入口 ESM import、严格 TypeScript typecheck 和 React 19 + Vite production build；
- 发布记录收尾后 `pnpm verify` 再次通过（130/130、API、包体、Node harness、七包 tarball consumer），`pnpm quality:browser` 23/23 通过；同时修复 Windows CRLF checkout 下 CSS API 基线的换行比较误报；
- 建立 `beta-regression` GitHub label、结构化 Beta regression issue template 与 `docs/23-beta-compatibility-ledger.md`；
- 未创建 Git tag 或 GitHub Release，`adapter-ag-ui` 未发布。

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
10. 先通过一次性 bootstrap workflow 用短期最小权限 token 创建 `adapter-ai-sdk@0.1.0-beta.1`，显式使用 `--tag beta --access public` 和 provenance；创建后立即配置其 trusted publisher、删除 GitHub secret 并撤销 token；
11. 通过受保护的 `publish-beta.yml` 发布其余包。workflow 使用 npm CLI `>=11.5.1` 的 `npm publish <reviewed-tarball> --tag beta --access public`，以确保只移动 `beta`，并由 OIDC 生成 provenance；
12. 发布脚本跳过 registry 中已存在且 manifest 与本地完全匹配的精确版本，从而安全跳过已 bootstrap 的 adapter，并支持部分发布失败后的幂等重试；
13. 逐包验证 `npm view` 的版本、`beta`、integrity、README、LICENSE、repository 和 provenance，并断言已有 `latest` 未移动；
14. 从公共 npm `@beta`/精确版本在全新目录重复 install、typecheck、production build 与 smoke；
15. Git tag、GitHub Release 或任何 `latest` 调整继续单独申请批准。

对于六个已有包，发布不得移动现有 `latest`。Changesets 对“只有 prerelease、没有稳定版”的包会默认选择 `latest`，且其 CLI 不允许在 pre-mode 追加自定义 tag，因此 Beta trusted workflow 不直接调用 `changeset publish`，而是对经 pnpm pack 验证的 tarball 显式执行 npm `--tag beta`。`adapter-ai-sdk` 是首次建包，初始 tag 行为必须在 bootstrap 后核验；任何 `latest` 例外都不能悄然当作稳定承诺。

## 7. 回滚与失败处理

### 发布前

- 若版本化或验证失败，不执行 publish；用普通审阅提交恢复 alpha pre-mode/版本文件，保留问题证据；
- 不复用已生成但未评审的 changelog/lockfile；修复后重新完整演练；
- 不使用 `git reset --hard`、`git checkout --` 或删除维护者已有改动。

### 发布后

- npm 版本不可覆盖。发现缺陷时创建 patch changeset，发布递增的下一 Beta；
- 默认不 unpublish。只有安全或法律紧急情况且维护者明确批准时才考虑撤回；
- 错误 dist-tag 只能在维护者批准后修正，优先把 `beta` 指回最后已知良好 Beta；保留 `alpha` 与已有包的 `latest`；
- `adapter-ai-sdk` 首次发布确实初始化了 `latest`；经维护者批准的 npm 10/11 删除尝试均返回 HTTP 400。该 registry 例外已记录，文档与验收继续要求显式 `@beta`/精确版本；
- Git tag/GitHub Release 已创建后不得静默重写，使用新版本和更正说明。

## 8. P4.0 完成门

发布准备完成不等于 Beta 已发布。P4.0 只有在维护者批准并完成 npm 发布后，才能勾选以下最终项：

- [x] 七个公开包均存在精确 Beta 版本与 `beta` dist-tag；
- [x] provenance、README、LICENSE、repository 与内部依赖全部可从 registry/tarball 验证；
- [x] 公共 npm clean consumer 的 install/typecheck/production build/smoke 全绿；
- [x] 仓库提交、npm 版本、changelog 和获批 tag/release（本次未创建）一致；
- [x] 已有包的 `latest` 未移动；首次 adapter 的初始 `latest` 行为与删除失败已记录；
- [x] 无未处理 blocker/high；首次 adapter 的 `latest` registry 例外已获维护者批准处理并公开记录。
