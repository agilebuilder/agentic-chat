# ADR-0008：Durable Intervention 与幂等响应

状态：已接受（P3.4）

## 背景

HITL 同时涉及可重放的 Agent 事实和一次性的客户端命令。若把“正在提交”写入 canonical snapshot，刷新后无法判断请求是否仍在网络中；若仅靠按钮 disabled 防重，双击、重试、刷新和多标签页仍可能让审批执行两次。

## 决策

- canonical Intervention 只持久化 `pending | resolved | expired`；`submitting/succeeded/failed` 属于 Runtime command state。
- `intervention.requested` 可携带描述、风险、影响、权威过期时间、choice options 或 form fields；resolved 与 expired 都只能从 pending 进入一次。
- 到达 expiresAt 不触发本地时钟状态转换。权威来源必须发出 `intervention.expired`，从而保证纯 replay 与 snapshot + delta 一致。
- response command 必须携带 idempotency key。Runtime 对同一个 Intervention 的相同 key 复用 Promise；失败后允许同 key 重提；成功后在 resolved/expired 事件到达前拒绝不同 key 覆盖。
- Runtime 的合并只覆盖当前进程。Host/后端必须持久化 key、绑定请求指纹并执行权限校验，才能宣称跨刷新/进程的端到端 exactly-once。
- command 成功不等于 Intervention resolved，也不等于 Run resumed。Run 的 awaiting_input、paused 与 running 继续由显式 Run 事件驱动。
- 默认 UI 显示 pending 操作、submitting/失败反馈和 resolved/expired 只读记录；历史记录默认不回显 response payload，避免无意暴露敏感表单内容。

## 结果

- snapshot 可确定性恢复待处理和已完成介入，不会恢复虚假的网络提交状态。
- 重复点击与同进程 retry 不会产生第二次 command；权限/网络失败仍可安全重提。
- Adapter 不得根据本地时间或 command receipt 自行伪造权威状态。
- 需要跨设备 exactly-once 的集成必须实现后端幂等存储，这不是 UI capability declaration 可以替代的安全边界。
