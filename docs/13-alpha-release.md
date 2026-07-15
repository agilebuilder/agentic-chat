# Alpha 发布流程

公共包通过 Changesets 统一版本化并发布到 npm `@agentic-chat/*` scope。当前 Alpha 起始版本为 `0.1.0-alpha.0`，私有的 `@agentic-chat/adapter-ag-ui` 和所有 `apps/*` 不发布。

Changesets 的默认 `access` 与每个公开包的 `publishConfig.access` 均固定为 `public`。不要依赖开发机上的 npm 全局 access 默认值；scope 包缺少该配置时会被 npm 当作 restricted 包处理。

## 为改动创建 changeset

```bash
pnpm changeset
```

选择受影响的公共包并说明面向用户的变化。Alpha 期间仍按语义化版本选择 patch/minor/major；Changesets 会把它转换成下一个 prerelease 版本。

## Alpha 模式

仓库已提交 `.changeset/pre.json` 并进入 `alpha` 预发布模式。只有新发布分支不存在该文件时才执行：

```bash
pnpm changeset:pre-enter
```

然后应用版本与依赖更新：

```bash
pnpm version:packages
pnpm install --lockfile-only
pnpm verify
```

检查生成的 changelog、包版本、内部依赖范围和 tarball 内容后发布：

```bash
pnpm release:alpha
```

该命令依赖 `.changeset/pre.json` 中的 `alpha` 预发布模式自动选择 npm dist-tag，不要额外向 `changeset publish` 传入 `--tag alpha`；Changesets 禁止在 pre mode 中同时指定自定义 tag。发布前必须完成 npm 登录、组织发布权限和双因素认证配置。

首次创建 npm package 时，Changesets 会为尚无稳定版的包同时初始化 `alpha` 和 `latest`，npm registry 不允许删除该初始 `latest`。这不代表 API 已稳定；Alpha 文档、自动化与正式验收必须使用 `@alpha` 或确切 prerelease 版本，不能使用无版本的 `npm install <package>`。稳定版只有经过单独评审后才会主动发布。

## 后续 Alpha 与退出

后续每批改动继续添加 changeset，然后执行 `version:packages`、验证和 `release:alpha`。准备稳定版时：

```bash
pnpm changeset:pre-exit
pnpm version:packages
```

稳定版发布必须单独评审，不能在 Alpha CI 中自动切换为 `latest`。
