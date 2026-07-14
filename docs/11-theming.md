# 主题与样式

`@agentic-chat/react-ui` 的样式以 `.ac-*` 为前缀，并把主题变量限定在 `.ac-root` 内，不修改宿主的按钮、表单或排版规则。宿主必须显式引入：

```ts
import '@agentic-chat/react-ui/styles.css'
```

## 主题变量

| 变量 | 用途 | 默认值 |
|---|---|---|
| `--ac-bg` | 面板背景 | `#fff` |
| `--ac-surface` | 次级面板与代码背景 | `#f8fafc` |
| `--ac-fg` | 主文本 | `#172033` |
| `--ac-muted` | 次要文本 | `#667085` |
| `--ac-border` | 边框 | `#e4e7ec` |
| `--ac-accent` | 强调色与焦点环 | `#2563eb` |

`AgenticChat` 的 `theme` 属性支持 `system`（默认）、`light` 和 `dark`。显式值优先于系统配色，适合跟随宿主的主题开关：

```tsx
<AgenticChat runtime={runtime} theme="dark" onSend={send} />
```

可以用宿主容器提高选择器上下文，而不修改组件源码：

```css
.sales-assistant .ac-root {
  --ac-bg: #fbfcff;
  --ac-fg: #16213a;
  --ac-muted: #667085;
  --ac-border: #dbe3f0;
  --ac-accent: #7c3aed;
}
```

默认 CSS 根据 `prefers-color-scheme: dark` 切换深色变量。需要应用内显式主题开关时，在稳定的宿主属性下覆盖变量：

```css
[data-app-theme='dark'] .ac-root {
  --ac-bg: #111827;
  --ac-fg: #f3f4f6;
  --ac-muted: #9ca3af;
  --ac-border: #374151;
  --ac-accent: #60a5fa;
}
```

## 边界约定

- 不依赖内部 DOM 层级；只把 `.ac-*` 类和上述变量当作 Alpha 样式契约。
- 不移除 `:focus-visible` outline，替换时需保持至少 2px 的可见焦点。
- 窄屏由宿主控制外层宽度；组件本身不设置固定页面宽度。
- `prefers-reduced-motion` 下组件会关闭动画、平滑滚动和 transition。
- 业务 renderer 应自带作用域类名，避免使用无前缀的全局 `button`、`pre` 等选择器。

Alpha 期间新增或改名变量会记录在 changeset；稳定版前仍可能发生不兼容调整。
