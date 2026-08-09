# Journal

最新记录在最上方；每个 session 一条。超过约 150 行时，将最新五条之前的内容压缩到
Digest。

## 2026-08-09 — M4–M5: 批准 MVP 合同并加入 UI 原型确认门槛

- Decision: 产品负责人批准中性 Store、首次导入与可回滚 quarantine、Agent 配置只读、
  同名变体不改写、按所选 Agent 计算最小 adapter 集合，以及 Cursor/Trae 有条件支持等
  MVP 合同；M4 完成。
- Design gate: 所有 UI、交互和文案在生产实现前必须先生成至少 3 个可比较原型，等待
  产品负责人明确确认一个方向；该结论已同步到 `AGENTS.md`、`PLAN.md` 与 `DESIGN.md`。
- Scope: 本轮只更新 harness 和设计规范，没有生成原型、修改生产 UI、实现 MVP 功能，
  也没有触碰真实用户 Skill Store、项目或 Agent 配置。
- Evidence: `npm run check` → exit 0；Rust tests 11 passed，Vite 1583 modules
  transformed，并生成 `src-tauri/target/debug/bundle/macos/Habitat.app`。
- Checkpoint: `b05499b` 批准 MVP 产品合同、拆分后续 milestones，并将多原型确认设为
  生产 UI 实现前的硬门槛。
- Next: M5 先固定产品数据合同并生成 onboarding 到 rollback 的多个交互原型；等待产品
  负责人确认后，才允许后续 milestone 实现生产 UI。

## 2026-08-09 — M4: 扩展 Cursor 与 Trae 兼容范围

- Finding: Cursor 原生扫描 `.agents/skills`，无需新增 `.cursor` adapter，但也会扫描
  Habitat 为 Claude 创建的 `.claude/skills`；官方未声明同 realpath 去重，必须验证双
  route 是否重复。Trae 的 `.agents/skills` 支持受用户设置控制，确定性项目覆盖应使用
  原生 `.trae/skills`，且不静默修改 Agent 配置。
- Product model: 固定双 adapter 应升级为“所选 Agent 的最小覆盖集”：`.agents` 覆盖
  Codex/Pi/Cursor，`.claude` 覆盖 Claude Code，`.trae` 覆盖 Trae。五者全选时才创建
  三个目标；安装仍沿用已批准的全量预检与安全回滚语义。
- Runtime boundary: Cursor Skills 始于 2.4，但本机 Cursor 仅 1.2.4；本机没有 Trae
  app/CLI。两者目前只能标记 path-compatible，symlink、重启、同名与禁用语义在选定
  release runtime 验证前不能标记 runtime-verified。
- Local evidence: `~/.cursor/skills` 不存在；`~/.trae/skills` 与
  `~/.trae-cn/skills` 各有 20 个 symlink，均指向 `~/.agents/skills` 下相同的 lark
  skills。首次迁移必须区分 Trae 国际版/中国版，并按 canonical target 合并重复入口。
- Scope: 产品负责人确认兼容目标扩展为 Codex、Claude Code、Pi、Cursor、Trae；本轮只
  更新研究与 harness 状态，未实现新 adapter，未修改真实用户 skills 或 Agent 配置。
- Checkpoint: `68f1f0f` 更新五 Agent 兼容矩阵、effective exposure、迁移 roots、README、
  AGENTS 与 PLAN；`git diff --cached --check` 通过。
- Next: 批准最小覆盖集、Trae 原生 adapter、Cursor/Trae runtime QA 门槛和 Trae edition
  范围，并继续评审首次导入/quarantine 的五项既有决定；M4 保持 `doing`。

## 2026-08-09 — M4: 调研项目级 Skills 暴露面与首次迁移

- Finding: Codex、Claude Code 与 Pi 都采用 progressive disclosure；全局 skills 的主要
  成本是 metadata catalog、误触发和同名遮蔽，而不是启动时加载所有正文。三者的用户级
  roots、过滤机制和同名优先级不同，项目链接存在不等于项目版本实际生效。
- Local evidence: `~/.agents/skills` 有 44 个 skill；Codex 配置有 27 个禁用条目；
  `~/.claude/skills` 有 14 个指向该目录子集的 symlink；`~/.pi/agent/skills` 不存在，
  但 Pi 仍默认扫描全部通用用户级目录。本轮只读，未改动这些真实路径。
- Recommendation: Store 必须位于任何 Agent discovery root 之外；首次使用应先建立
  effective exposure inventory，再把选定 skill 导入中性 Store，并以 manifest 驱动、
  可回滚的 quarantine 隔离旧全局入口，首版不永久删除。
- Correction: Claude Code 官方当前明确从 2.1.203 起支持 personal/project skill 目录
  symlink；已修正旧研究结论，本机 2.1.207 满足最低版本。
- Decision: 默认双 adapter 与多目标安全回滚已经产品负责人批准；导入/quarantine 是否
  进入 MVP、Store staging 复制边界、默认 Store 路径、Agent 配置只读边界和同名变体
  策略仍待批准，M4 保持 `doing`。
- Checkpoint: `473747f` 新增项目粒度暴露面与首次迁移研究，修正 Claude symlink 兼容
  结论并同步 PLAN；`git diff --cached --check` 通过。
- Next: 产品负责人评审新增五项高成本决定；批准前不进入实现，也不触碰真实用户 skills。

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
