# Plan

同时只能有一个 `doing`。状态：`todo` / `doing` / `done` / `dropped`。顺序就是执行
顺序；done-criteria 必须可由下一位 agent 独立观察和验证。

## M1. 建立持久 harness 与统一验证 gate — done

Done when: `AGENTS.md`、`PLAN.md`、`JOURNAL.md` 能让新会话找到当前状态与边界，
并且 `npm run check` 一次完成 diff、Rust 测试、前端构建和 debug 应用打包且通过。

## M2. 明确下一阶段产品目标 — doing

Done when: 产品负责人选定一个下一阶段目标，写明用户价值、可观察验收标准与明确非目标；
在此之前不从 `SPIKE.md` 的建议自行启动实现。

## M3. 交付已批准目标 — todo

Done when: 在 M2 明确的范围内完成实现与针对性测试，`npm run check` 通过，并记录
实际验证证据；提升为 `doing` 时再细化本 milestone。

## M4. 发布准备与观察 — todo

Done when: 发布目标、打包/分发方式、回滚路径和发布后观察指标已经明确并验证；提升为
`doing` 时再根据已批准发布范围细化。
