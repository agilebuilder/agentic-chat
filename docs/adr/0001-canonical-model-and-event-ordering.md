# ADR-0001：Canonical model 与事件顺序

状态：草案，P0 fixture 验证中。

## 决策

- Canonical model 与 ChatBI wire protocol 分离；adapter 执行字段和语义映射。
- Run 是执行实例；Activity 是过程节点；ToolCall 是工具状态的单一事实源，tool Activity 只引用它。
- Canonical reducer 是纯函数，同一初始状态和事件序列必须得到相同结果。
- 当前 ChatBI adapter 的 sequence 作用域是单 Run，并要求严格递增。
- Transport cursor、canonical sequence 和 snapshot revision 是三个独立概念。
- 发现 sequence gap 时阻塞对应 stream，等待 replay 或 snapshot，不按到达顺序静默应用。
- Timestamp 只用于展示，不决定事件顺序。
- 终态 Run 不接受普通进度事件。
- 未进入核心模型但占用来源 sequence 的事件转换为 `source.observed`，以保留顺序和诊断；来源扩展键必须使用协议或产品命名空间，不允许核心 reducer 依赖任意扩展字段。

## ChatBI 事实依据

ChatBI 1.0 持久化 `event_id` 和单 Run `sequence`，支持 `after_sequence` 和 `Last-Event-ID`，工具事件通过 `tool_call_id` 关联。断开 SSE 不会取消 Run。当前异常进程重启会把残留 queued/running Run 恢复为 failed，因此其能力是事件重放与连接恢复，而不是跨进程继续执行。

## 待验证

- retry 是同一 Run 的 attempt 还是新 Run；
- snapshot schema 与增量 replay 的等价规则；
- Message、最终结果和 Artifact 的正式引用关系。

## 多来源验证结论

- ChatBI 提供单 Run 严格 sequence，adapter 原样保留；
- AG-UI 规范要求按接收顺序处理，但基础事件没有 ChatBI 式 sequence/event ID；首版 adapter 在一次已排序的订阅流内按 source index 合成 canonical sequence 和确定性 event ID，并将这种恢复能力声明为降级能力；
- 编码 Agent fixture 可以用通用 Activity parent、并行 root、ToolCall 和 Intervention 表达，不需要加入来源专属核心字段。
