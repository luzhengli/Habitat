# 验证入口与历史证据

当前高保真验收未完成，M4 保持重新打开。逐页缺口见 [fidelity/coverage.md](fidelity/coverage.md)，验收合同见 [docs/10](../docs/10-原型先行与高保真还原合同.md)；原型批准见 [基线登记](../design/prototype-baselines.md)。

## 当前检查方式

- 安装按 [README](../README.md) 执行根目录与 apps/web 的 `npm ci`。`npm run check` 包含 Node 测试、源边界、严格 TSX 和 Vite build，需要两侧依赖。
- UI 验收另按 docs/10 做同浏览器/视口/内容/状态的截图、测量和 diff；工程 check 不能代替视觉验收。
- 仅文档或 harness 状态变更核对 JSON、任务依赖/本地引用、原型/归档保真及 `git diff --check`，无需重复生产测试。
- `npm run verify:delivery` 仅用于原始交付清单核对，不作当前开发 gate。旧 `tests/browser-smoke.py` 依赖已移除的 bootstrap 页面，已[退役归档](../docs/archive/harness/2026-11-02-pre-audit/browser-smoke.py.txt)。当前没有覆盖全部生产页面的通用浏览器脚本，按覆盖矩阵采证。

## 证据索引

| 范围 | 证据 | 限制 |
|---|---|---|
| M0–M3 工程基线 | [M0](m0-acceptance.md)、[M1](m1-acceptance.md)、[M2](m2-acceptance.md)、[M3](m3-acceptance.md) | 历史功能与安全记录 |
| M4 历史工程结果 | [M4](m4-acceptance.md)、m4-check.log / node24-check.log / clean-clone-check.log | 52 项历史测试及兼容性；视觉完成声明已撤回 |
| 高保真切片 | [slice-acceptance](fidelity/slice-acceptance.md)、[command-acceptance](fidelity/command-acceptance.md)、[覆盖矩阵](fidelity/coverage.md) | 部分 A0 范围，不代表整体验收 |
| 2026-11-02 工程检查 | [GitHub 同步记录](github-sync.md) | 54 tests/类型/build；截图差异专项因缺 Pillow 未运行 |
| Harness 维护 | [2026-11-03 审计](harness-audit-2026-11-03.md) | 状态/入口/归档检查，不是应用回归 |
| 原交付 | [docs/08](../docs/08-交付清单与验证记录.md)、[原型保真](reference-preservation.json) | `current-*` 是 2026-09-22 的旧命名，不代表当前结果；`historical-*` 是原 Air 包记录 |

新证据采用日期/阶段/版本目录，记录命令、提交或文件 hash、fixture 与运行环境；既有截图/日志不覆盖。历史引用中缺失的文件应明确标为不可用，不能据文档描述补造结果。追溯旧进程和状态见 [归档索引](../docs/archive/README.md)。
