# Changesets

面向用户的公共包改动必须附带 changeset：

```bash
pnpm changeset
```

Alpha 发布使用 `alpha` pre-release tag，仓库已通过 `pre.json` 进入该模式。应用版本和发布的完整流程见
[`docs/13-alpha-release.md`](../docs/13-alpha-release.md)。私有的 `@agentic-chat/adapter-ag-ui`
以及 `apps/*` 不参与发布。
