# Habitat

Habitat 是一个 macOS-only、Codex-only 的 Tauri 2 桌面原型，用本地 Skill Store
和项目内相对符号链接管理 skills。可行性 Spike 已完成；下一阶段产品目标尚未批准，
当前工作重点是保住已验证的路径安全边界并让后续开发可以可靠接力。

## Session protocol

- 开始时阅读 `PLAN.md` 和 `JOURNAL.md` 最新一条，处理唯一的 `doing` milestone；
  若没有，则将下一个 `todo` 提升为 `doing`。
- 状态变化时立即更新 PLAN 和 JOURNAL，不等到会话结束。
- 工作检查点应提交到 Git；JOURNAL 记录 commit，但不能替代 commit。
- 结束前或上下文将满时，确认 PLAN 状态真实，并在 JOURNAL 顶部写入本次证据和下一步。

## Verification

- `npm run check` — 检查 diff 空白错误、执行 Rust 测试、构建前端并打包 debug
  `Habitat.app`。

Done 表示 milestone 的可观察 done-criteria 成立、上述 gate 通过，且 JOURNAL 引用
实际输出。仅靠代码检查不能宣布完成。

## Rules

- Skill 安装只创建指向 Store 的相对符号链接；不得复制 skill 内容，也不得删除、
  移动或修改 Store 源目录。
- 所有 Store、项目、`.agents` 和 `.agents/skills` 边界继续使用 canonical path 与
  lstat 语义校验；未知、失效或冲突目标必须阻断，不能猜测覆盖或删除。
- 前端不得提供任意程序名、命令字符串或参数；Rust 外部命令保持显式 allowlist。
- 真实用户 Skill Store 和真实项目不得用于可变测试；使用临时 fixture。
- 生产构建不得通过 QA 路由自动选择或修改任何路径；`docs/qa/state/*.json` 只服务于
  Vite 开发模式视觉状态。
- 涉及 UI、交互或文案的 milestone，开始前阅读 `DESIGN.md` 相关章节；重要界面修改
  按第 14 节复验，并更新 `design-qa.md` 与截图证据。`DESIGN.md` 是规范，
  `design-qa.md` 是最近一次验收证据。

## Boundaries

- 未经明确批准，不进入正式 MVP 功能开发，不发布应用，也不修改真实用户项目或
  Skill Store。
- 当 milestone 的验收标准含糊，或变更会扩大命令 allowlist、放宽路径安全语义、
  改变外部 schema 契约或可能触及 Store 源文件时，停止并询问。
