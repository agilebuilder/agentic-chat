# P3 多后端 Beta 开发日志

> 状态：进行中
> 启动日期：2026-07-15

## 目标与分片

P3 以“多个生产风格来源通过同一公共契约、同一默认 UI 可切换”为主线，不一次性冻结所有高级实体语义。

| 切片 | 内容 | 状态 |
|---|---|---|
| P3.1 | 公共 adapter conformance 基线与 AG-UI 稳定生命周期映射 | 已完成 |
| P3.2 | Canonical snapshot + delta、Task patch/revision 与等价 replay | 待开始 |
| P3.3 | 并行/父子 Activity、subagent 展示、retry/attempt | 待开始 |
| P3.4 | Human-in-the-loop 状态机、幂等响应与恢复 | 待开始 |
| P3.5 | Artifact version/provenance/preview 安全策略 | 待开始 |
| P3.6 | 第三个生产风格 adapter 与 runtime 切换示例 | 待开始 |
| P3.7 | Inspector、诊断、Beta 无障碍/性能/安全门 | 待开始 |

## P3.1 完成内容

- 新增 `checkAdapterConformance`，统一检查 envelope、顺序、终态、ToolCall 关联、reducer diagnostic 与 replay 幂等性；
- ChatBI、编码 Agent fixture 和 AG-UI fixture 改为使用同一 suite；
- AG-UI 增加 step、state、activity、messages、reasoning、RAW/CUSTOM 等当前官方稳定事件的结构类型；
- workflow step、assistant 文本、流式工具参数、工具结果和 Run result 形成确定性映射；
- 未建模事件安全降级为无 payload 的 `source.observed` 并产生 adapter diagnostic；
- 明确 `TOOL_CALL_END` 不会提前完成工具；
- 修正 `timestamp: 0` 和超过 59 个事件时的合成时间问题；
- 为 malformed lifecycle、共享状态降级、工具参数结束和 Run result 增加自动化测试；
- 记录 ADR-0005，并更新 adapter 开发指南。

## 当前边界

- `@agentic-chat/adapter-ag-ui` 继续保持 `private: true`，当前是协议映射基线，不是可连接任意 AG-UI endpoint 的生产 transport；
- AG-UI snapshot/delta 尚未转换为 `CanonicalSnapshot`，这属于 P3.2；
- reasoning 不展示为最终回答或普通 status，等待跨来源语义验证；
- 编码 Agent fixture 仍是行为样本，不计作第三个生产 adapter；
- P3 路线图验收项尚未勾选，需真实 adapter、UI 和恢复验收共同完成。

## 下一片入口

P3.2 先定义 snapshot revision、entity replacement/patch 规则和 replay 等价测试，再决定 AG-UI `STATE_SNAPSHOT`/`STATE_DELTA` 中哪些命名空间可以进入 Task/Artifact/Intervention；未知业务 state 仍保留在来源侧。
