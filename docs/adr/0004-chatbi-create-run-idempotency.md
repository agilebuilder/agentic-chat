# ADR-0004：ChatBI 创建 Run 的端到端幂等

- 状态：接受
- 日期：2026-07-13

## 背景

P1 的 runtime command 已接收 idempotency key，但 ChatBI client 丢弃该参数，后端每次 POST 都创建新 Run。网络层重试相同逻辑请求时可能重复写入用户消息并启动多个 Run。

## 决策

1. `POST /sessions/{session_id}/runs` 必须携带 `Idempotency-Key`；key 长度为 8–200，只允许字母、数字、点、下划线、冒号和连字符。
2. key 的作用域是 Session；不同 Session 可以使用相同 key。
3. 后端对完整 CreateRun body 做稳定 JSON 序列化和 SHA-256 指纹。
4. SQLite 使用 `run_idempotency_keys` 持久化 `(session_id, key, fingerprint, run_id)`；创建 Run、用户消息和幂等记录位于同一 `BEGIN IMMEDIATE` 事务。
5. 首次创建返回 `201` 和 `Idempotency-Replayed: false`；相同 key、相同 body 返回原 Run、`200` 和 `Idempotency-Replayed: true`，不再次写消息或启动 coordinator。
6. 相同 key、不同 body 返回 `409`；缺少或格式非法的 key 返回 `422`。
7. ChatBI adapter 将 runtime command 的 key 原样放入 header。Controller 默认为新逻辑命令生成 UUID，也允许调用方在显式重试创建时复用原 key。

## 影响

- 旧的无 header CreateRun 调用需要升级；SSE、取消和读取接口不受影响。
- 幂等记录随 Session 或 Run 删除而级联删除。
- 幂等保证覆盖持久化创建和任务启动去重；业务上明确发起两个不同命令时必须使用不同 key。
