# Agentic Chat

Agentic Chat is a framework-independent runtime model plus React bindings and UI components for durable agent runs, activities, tools, interventions, and artifacts.

P3 engineering is complete and the seven public packages are available on npm under the `beta` dist-tag. P4 is freezing the 1.0 contract, documentation, governance and compatibility matrix. The first production integration is ChatBI, while the public packages remain domain-neutral. Beta users should install `@beta` or exact versions; `latest` is not yet the stable release promise.

## Packages

- `@agentic-chat/core` — canonical events, state, and reducer.
- `@agentic-chat/runtime` — runtime contract, commands, and selectors.
- `@agentic-chat/react` — headless React provider and hooks.
- `@agentic-chat/react-ui` — optional styled React components.
- `@agentic-chat/adapter-chatbi` — ChatBI event and command adapter.
- `@agentic-chat/adapter-ai-sdk` — AI SDK UI Message Stream v1 adapter with no AI SDK runtime dependency.
- `@agentic-chat/testkit` — fixtures and adapter conformance helpers.

Beta debugging can explicitly enable the payload-free Runtime Inspector; production collection remains off by default. See the [Canonical Schema 1.0](docs/24-canonical-schema-1.0.md), [API lifecycle policy](docs/25-api-lifecycle-and-support.md) and [migration guide](docs/26-migration-to-1.0.md).

## Development

```bash
pnpm install
pnpm verify
```

See [`docs/01-product-requirements.md`](docs/01-product-requirements.md) and [`docs/03-delivery-roadmap.md`](docs/03-delivery-roadmap.md) for current scope.
Custom UI integrations can start with the [`renderer guide`](docs/09-renderer-guide.md).
For a new application, follow the [`Quick Start`](docs/10-quick-start.md), then see the
[`theming`](docs/11-theming.md) and [`adapter`](docs/12-adapter-guide.md) guides.
Alpha 发布记录作为历史资料保留；Beta 发布与回滚证据见
[`P4.0 Beta release readiness`](docs/22-p4-beta-release-readiness.md)。独立消费验证参考
[`30-minute Quick Start acceptance`](docs/14-quick-start-acceptance.md)。

## License

MIT
