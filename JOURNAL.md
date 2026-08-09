# Journal

最新记录在最上方；每个 session 一条。超过约 150 行时，将最新五条之前的内容压缩到
Digest。

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
