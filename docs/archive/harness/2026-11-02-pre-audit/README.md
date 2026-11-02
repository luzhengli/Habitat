# Harness 整理前快照

来自提交 `73b712f`，于 2026-11-02 逐字节保存；来源路径与 SHA-256 见 [snapshots.json](snapshots.json)。本目录不是续跑入口，原文件内的相对路径按原来源位置解释。

| 快照 | 用途 |
|---|---|
| [PLAN.md](PLAN.md) | 历次状态、恢复/阻塞与同步检查点 |
| [JOURNAL.md](JOURNAL.md) | 2026-09-22 至本次整理前的完整工作日志 |
| [tasks.json](tasks.json) | 原阶段/派发记录、历史模型配置、启动与 GitHub 同步事实 |
| [06-original-plan.md](06-original-plan.md) | B0–M4 原实施路线；保留当时的环境与能力描述 |
| [08-original-delivery.md](08-original-delivery.md) | 原始交付与测试记录；不代表当前工程状态 |
| [browser-smoke.py.txt](browser-smoke.py.txt) | 已退役的 bootstrap smoke 脚本；旧页面断言和固定输出路径不适用于当前前端 |

当前任务可用原 ID 查询归档任务的依赖与证据；阶段/任务若同时出现在活动 tasks.json 中，以活动记录为准。原日志中的“全部完成”、锁屏或服务运行结论均受其日期和后续纠正约束。

归档不修改原型文件或既有截图、日志和清单。未迁移的验证证据继续位于仓库 `verification/`。需要复核原件时比较本目录摘要，不为匹配当前代码重写原 MANIFEST/SHA256SUMS。
