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
macOS-only 描述应用运行平台，不限制 Codex、Claude Code、Pi Agent 等下游消费者。
首个 MVP 仍只管理 skills，MCP、Rules 等项目 harness 资产仅作为未来扩展方向。

## M5. 交付已批准产品目标 — todo

Done when: 在 M4 批准的范围内完成实现与针对性测试，`npm run check` 通过并记录实际
证据；提升为 `doing` 时再细化本 milestone。

## M6. 发布准备与观察 — todo

Done when: 发布目标、打包/分发方式、回滚路径和发布后观察指标已经明确并验证；提升为
`doing` 时再根据已批准发布范围细化。
