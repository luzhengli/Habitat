# Plan

同时只能有一个 `doing`。状态：`todo` / `doing` / `done` / `dropped`。顺序就是执行
顺序；done-criteria 必须可由下一位 agent 独立观察和验证。

## M1. 建立持久 harness 与统一验证 gate — done

Done when: `AGENTS.md`、`PLAN.md`、`JOURNAL.md` 能让新会话找到当前状态与边界，
并且 `npm run check` 一次完成 diff、Rust 测试、前端构建和 debug 应用打包且通过。

## M2. 确定验证基线加固目标 — done

Done when: 产品负责人确认先把 `DESIGN.md` 接入 harness 导航，并为现有硬安全合同补充
自动化保护；本轮不引入完整前端测试框架、CI 或正式 MVP 功能。

## M3. 加固当前原型的测试与验收基线 — done

Done when: UI 类任务能从 `AGENTS.md` 找到 `DESIGN.md` 的规范与验收入口；Rust 测试
锁定且仅允许三个固定外部命令签名，近似但未批准的参数组合均被拒绝；README 与实际
覆盖一致；`npm run check` 通过并在 JOURNAL 记录证据。

## M4. 明确正式 MVP 的首个产品目标 — doing

Done when: 产品负责人写明用户价值、可观察验收标准和明确非目标；在此之前不从
`SPIKE.md` 的建议自行启动实现。

已确认定位：Habitat 应面向通用目录项目，并与消费项目级 skills 的具体 Agent 解耦；
macOS-only 描述应用运行平台。首个目标兼容范围已扩展为 Codex、Claude Code、Pi、
Cursor 与 Trae 五个下游消费者。
首个 MVP 仍只管理 skills，MCP、Rules 等项目 harness 资产仅作为未来扩展方向。

调研结论：Agent Skills 标准统一内容格式但不统一发现目录；`.agents/skills` 可覆盖
Codex、Pi、Cursor，Claude Code 使用 `.claude/skills`，Trae 的 common root 受设置开关
控制，确定性覆盖需要 `.trae/skills`。Cursor 与 Trae 的跨目录 symlink 仍缺少发布级
runtime 验证，证据见
`docs/research/agent-skill-compatibility.md`。

已批准：原三 Agent 范围的默认 adapter 为 `.agents/skills` + `.claude/skills`；多目标
中途失败时只安全回滚本事务创建且仍符合预期的链接，否则保留并报告部分状态。加入
Cursor 与 Trae 后，M4 完成前还需批准改用“所选 Agent 的最小覆盖集”、Trae 原生
`.trae/skills` adapter，以及未完成 runtime QA 时的支持等级。

新增调研结论：五个 Agent 都采用 metadata 先行、正文按需加载，但用户级来源、过滤、
条件开关和同名优先级不同；仅增加项目链接不能消除全局 catalog、误触发或遮蔽。
Habitat 需要五 Agent effective exposure 模型、中性 Store 路径约束，以及覆盖 common、
Codex、Claude、Pi、Cursor、Trae 国际版/中国版全部已知用户 roots 的首次导入与可回滚
隔离方案，证据见
`docs/research/project-skill-scope-and-migration.md`。实现前仍需批准迁移是否进入首个 MVP、
Store staging 复制边界、默认 Store 路径、是否保持 Agent 配置只读，以及同名变体策略。

## M5. 交付已批准产品目标 — todo

Done when: 在 M4 批准的范围内完成实现与针对性测试，`npm run check` 通过并记录实际
证据；提升为 `doing` 时再细化本 milestone。

## M6. 发布准备与观察 — todo

Done when: 发布目标、打包/分发方式、回滚路径和发布后观察指标已经明确并验证；提升为
`doing` 时再根据已批准发布范围细化。
