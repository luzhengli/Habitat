# Habitat

Habitat 是一个 macOS-only、Codex-only 的 Tauri 2 可行性原型。它维护一个用户选择的本地 Skill Store，并在项目的 `.agents/skills` 中安全创建或解除相对符号链接。

本原型不复制 skill 文件，不删除 Store 源目录，不执行 Git commit/push，也不提供任意 shell 接口。

## 系统依赖

- macOS
- Xcode Command Line Tools：`xcode-select --install`
- Node.js 20+
- Rust 1.77.2+ 与 Cargo
- 可从应用 PATH 访问的 `git`、`npx`

本次验证环境为 Node 23、Rust 1.97.1、Tauri 2.11.5。

## 安装与运行

```bash
npm install
npm run tauri dev
```

应用启动后：

1. 选择唯一 Skill Store；
2. 选择当前项目；
3. 选择一个 skill，阅读真实路径、Git 状态和预检结果；
4. 明确点击“添加到 {project}”或“解除链接”。

Store 扫描范围只包括根目录的直接子目录，以及 `.agents/skills` 的直接子目录；只有包含可读取 `SKILL.md` 的真实目录才会进入列表。

## 可重复临时场景

```bash
npm run fixture
```

命令会在系统临时目录创建并输出：

- `store`：含 `finding-unknowns`、`sharpen`、`explain-and-quiz`、`project-harness`；
- `project`：前三个已通过相对 symlink 链接，`project-harness` 可添加；
- `conflictProject`：`project-harness` 的目标位置是一个真实目录，用于错误状态验收。

它不会读取或修改 `/Users/luyao/Project/luyao-skills`。

## 验证

```bash
npm run check
```

该 gate 依次检查 Git diff 空白错误、运行 Rust 测试，并完成前端 TypeScript/Vite
生产构建与 debug macOS 应用打包。

Debug 应用输出到：

```text
src-tauri/target/debug/bundle/macos/Habitat.app
```

Rust 测试覆盖合法相对 symlink、失效 symlink、未知链接/名称冲突、普通文件、真实目录、Store 越界、项目越界、重复添加幂等、解除后保留源文件，以及固定外部命令 allowlist 的精确签名与拒绝执行语义。

## 受限命令

Rust 只接受以下固定程序与参数组合，程序名和参数分别传给 `std::process::Command`：

```text
npx skills list --project --json
git status --short
git diff
```

stdout、stderr、退出码、loading、success 与 error 都会保留并映射到检查器。命令运行目录必须先 canonicalize 为用户选择的项目目录。

## QA 证据

- [原型参考图](docs/references/habitat-prototype.png)
- [1440×1024 三栏](docs/qa/habitat-1440x1024.png)
- [1024px 检查器抽屉](docs/qa/habitat-1024-drawer.png)
- [添加成功](docs/qa/habitat-add-success.png)
- [真实目录冲突](docs/qa/habitat-conflict-error.png)
- [视觉对照报告](design-qa.md)
- [可行性结论](SPIKE.md)

`docs/qa/state/*.json` 是由 Rust `capture_state` 辅助二进制从真实临时目录生成的视觉 QA 快照，只在 Vite 开发模式的 `?qa=` 路由中使用；生产 Tauri 构建不会自动选择或修改任何路径。
