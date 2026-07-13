# ADR-0002：Intervention 与 Run 状态分离

状态：已接受（P0，Intervention UI 仍为 experimental）。

## 背景

用户提交 Intervention response，只能证明前端或后端接收了响应，不能证明权限校验通过、Agent 已恢复或 Run 已重新执行。一个 Run 也可能同时存在多个 Intervention。

## 决策

- `intervention.requested` 只创建 pending Intervention；
- `intervention.resolved` 只记录最终 response，且只能处理一次；
- 两者都不隐式修改 Run status；
- 后端或 adapter 必须发送显式 `run.status.changed(awaiting_input|running|paused)`；
- UI 以 Run status 判断自动执行状态，以 Intervention status 判断某个请求是否仍可操作；
- response command 的 accepted/pending 不等同于 Intervention resolved，P1/P3 command state 另行建模。

## 影响


编码 Agent fixture 显式发送 waiting/resumed 状态，验证刷新重放不会因为 Intervention 局部状态推断错误的 Run 状态。ChatBI P1 不支持 Intervention，不受此实验能力影响。
