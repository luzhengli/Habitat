# Habitat Web 当前计划

更新：2026-11-03。工程已存在；高保真还原部分完成，A1/A2 仍待用户确认。当前优先处理 V1 已展示范围的确认，V0/V2 仍有未完成项；M4 视觉验收保持重新打开。

## 阶段与证据

| 阶段 | 状态 | 已有结果 / 退出门槛 |
|---|---|---|
| B0、M0–M3 | done（历史工程基线） | 依赖、严格 TSX、真实来源/授权、持久事务、诊断/Git 已实现；见 [验证索引](verification/README.md) |
| V0 | in_progress | 已有源码、fixture 与部分逐状态对照；[覆盖矩阵](verification/fidelity/coverage.md) 和 [差异清单](verification/fidelity/gap-inventory.md) 尚未全覆盖 |
| V1 | in_progress | A1/A2 已展示范围 awaiting_user_confirmation；仅用户确认具体版本/范围才解锁对应实现 |
| V2 | in_progress | A0 库/壳/全局搜索首切片及部分焦点修复已有证据；剩余页面未完成 |
| V3 | todo | 完整逐状态/视口对照、功能回归与用户最终视觉确认未完成 |
| M4 | reopened | 历史工程记录有效，WEB-15/FID-04/FID-05 视觉门槛仍未关闭 |

阶段退出条件见 [docs/10](docs/10-原型先行与高保真还原合同.md)，活动任务与依赖见 [tasks.json](tasks.json)；阶段依赖按获批页面/状态逐范围推进，不能由一个子任务完成推断全阶段完成。

## 当前下一步

next_action：取得 A1/A2 的具体版本/范围确认或修改意见；确认前仅推进有证据证明不依赖候选变更的 A0 还原与补证，确认后只解锁获批范围。按覆盖矩阵选择未完成项，不从 V0 或 M0 重新开始。

- [候选审阅入口](design/prototype-revisions/REVIEW.md) 提供两个自包含 HTML；版本/hash/批准范围以 [基线登记](design/prototype-baselines.md) 为准。
- 阻塞只针对依赖未确认设计的生产页面/状态。用户最终视觉验收、完整 Safari/指定视口/IME 等仍待完成。
- 旧锁屏、PID、终端 session、localhost 存活信息属于历史；本计划不声明当前服务或桌面状态，使用前实测。

## 最近验证与维护

工程最近记录为 2026-11-02 的 54 tests、源边界、严格 TSX、build 通过，见 [同步证据](verification/github-sync.md)；当时截图差异专项缺 Pillow，未运行。该记录不等于本次重跑或视觉验收。

本次完成 harness 状态梳理、历史归档和入口修正；实际检查与限制见 [审计记录](verification/harness-audit-2026-11-03.md)。后续维护只更新当前结论；历史过程见 [归档索引](docs/archive/README.md)，最近命令与结果见 [JOURNAL](JOURNAL.md)。
