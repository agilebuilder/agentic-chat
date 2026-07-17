# Beta 兼容性台账

> 起始基线：`main@3aa758e`，2026-07-17 发布的首个公共 Beta。

本台账记录 Beta 至 1.0 期间所有可能影响使用者的公共契约变化。Stable 根导出默认保持兼容；`Experimental` / `experimental` API 可以调整，但必须在此记录影响、替代方案和验证证据。

## 发布矩阵

| Package | 首个公共 Beta | dist-tag |
|---|---:|---|
| `@agentic-chat/core` | `0.1.0-beta.2` | `beta` |
| `@agentic-chat/runtime` | `0.1.0-beta.2` | `beta` |
| `@agentic-chat/react` | `0.1.0-beta.2` | `beta` |
| `@agentic-chat/react-ui` | `0.1.0-beta.2` | `beta` |
| `@agentic-chat/testkit` | `0.1.0-beta.1` | `beta` |
| `@agentic-chat/adapter-chatbi` | `0.1.0-beta.1` | `beta` |
| `@agentic-chat/adapter-ai-sdk` | `0.1.0-beta.1` | `beta`；首次建包还初始化了 `latest`，不代表稳定承诺 |

`@agentic-chat/adapter-ag-ui` 不在公开矩阵中，继续 `private: true`。

## 变更记录

| 日期 | 范围 | 类型 | 使用者影响 | 迁移/替代方案 | 验证 |
|---|---|---|---|---|---|
| 2026-07-17 | 全部公开包 | Beta 基线 | 建立后续兼容性比较起点 | 使用显式 `@beta` 或上表精确版本 | API Extractor、130/130、browser 23/23、公共 npm clean consumer |

## 记录规则

- Breaking candidate 必须在实现前说明理由、受影响 API、迁移方案、ADR 和 changeset；
- Experimental 调整也必须列出旧行为、新行为和可执行迁移示例；
- 新 canonical 字段必须至少由两个事件来源证明，不得写入单一宿主业务字段；
- 每个条目附 API diff、testkit/consumer 证据及对应 PR/issue；
- RC 开始后如发生 breaking change，重新开始稳定观察期。

Beta 回归使用 GitHub `beta-regression` label 和 `.github/ISSUE_TEMPLATE/beta-regression.yml` 提交；复现必须使用公共 registry 精确版本，不接受仅能在 workspace source alias 下复现的结论。
