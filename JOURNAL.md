# Journal

最新记录在最上方；每个 session 一条。超过约 150 行时，将最新五条之前的内容压缩到
Digest。

## 2026-08-09 — M4: 调研项目级 Skills 的跨 Agent 发现契约

- Finding: Agent Skills 标准统一 `SKILL.md` 内容格式，但没有统一项目发现目录；Codex
  与 Pi 原生支持 `.agents/skills`，Claude Code 官方只声明 `.claude/skills`。
- Local evidence: Codex 0.139.0 在非 Git 临时 fixture 中发现 Habitat 创建的三个相对
  symlink；Pi 0.81.1 第一方文档与本机源码支持 `.agents/skills`、非 Git 父级扫描和目录
  symlink；`skills 1.5.22 list --project --json` 的 agent 映射与 Pi 运行时能力存在漂移。
- Decision: 推荐“统一 Agent Skills 源内容 + 版本化项目 adapter”，首个候选 adapter 为
  `.agents/skills` 和 `.claude/skills`；本轮只记录研究，不扩大写路径或进入 MVP 实现。
- Checkpoint: `e67928d` 新增 `docs/research/agent-skill-compatibility.md`，并同步修正
  `AGENTS.md`、`README.md` 与 `PLAN.md` 中对当前原型兼容性的过度表述；
  `git diff --check` 通过。
- Next: 产品负责人批准首个兼容矩阵、默认 adapter、多目标失败语义与最低验证版本；M4
  继续保持 `doing`。

## 2026-08-09 — M4: 确认 Agent-agnostic 产品定位

- Confirmed: Habitat 运行平台仍为 macOS，但管理对象是通用目录项目中的项目级
  skills；Codex、Claude Code、Pi Agent 等仅作为下游消费者，Habitat 不介入其运行时。
- Scope: 首个 MVP 仍只管理 skills；MCP、Rules 等项目 harness 资产仅记录为未来扩展
  方向，不进入当前实现范围。
- Checkpoint: `01c7d34` 更新 `AGENTS.md`、`README.md` 与 `PLAN.md`，消除
  `Codex-only` 定位冲突；`git diff --check` 通过。
- Next: 产品负责人继续明确首个 MVP 的具体用户价值、可观察验收标准与非目标；M4
  继续保持 `doing`，不启动实现。

## 2026-08-09 — M2–M3: 接入设计规范并加固命令安全基线

- Done: `c38e7c4` 将 UI 类任务路由到 `DESIGN.md` 第 14 节验收入口；抽取固定命令
  allowlist 决策并增加精确签名与拒绝执行测试；README 同步实际覆盖。
- Evidence: `cargo test --manifest-path src-tauri/Cargo.toml project_command` → 2 passed,
  0 failed；`npm run check` → exit 0，Rust tests 11 passed、Vite 1583 modules
  transformed，并生成 `src-tauri/target/debug/bundle/macos/Habitat.app`。
- Next: 明确正式 MVP 的首个产品目标、可观察验收标准和非目标。
- Watch out: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` 在本轮之前的
  Rust 文件上已有格式差异；本轮未扩大为全仓格式化，也未把这个已失败命令加入 gate。

## 2026-08-09 — M1: 建立最小 harness 与统一 gate

- Done: 新增 `AGENTS.md`、`PLAN.md`、`JOURNAL.md`；将已验证的前端构建、Rust
  测试和 debug 应用打包收敛为 `npm run check`；README 改为引用唯一 gate。
- Evidence: `npm run check` → exit 0；Git diff check 通过；Rust tests 9 passed,
  0 failed；Vite build 成功，1583 modules transformed；成功生成
  `src-tauri/target/debug/bundle/macos/Habitat.app`。
- Next: 与产品负责人明确正式 MVP 的首个目标、验收标准和非目标。

## Digest

- `f92ff57`：完成 Habitat skill management feasibility prototype；路径安全、固定命令、
  原生交互和视觉 QA 的既有结论见 `SPIKE.md`、`README.md` 与 `design-qa.md`。
