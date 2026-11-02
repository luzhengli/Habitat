# Habitat Web 最近检查点

当前阶段/阻塞/下一步统一见 [PLAN](PLAN.md) 与 [tasks.json](tasks.json)。[历史索引](docs/archive/README.md) 保留 2026-09-22 至本次整理前的完整日志、阶段记录及旧进程信息；历史中的“当前”“全部完成”和 next_action 不作为现行指令。

## 2026-11-03 — Harness 审计与归档

按用户要求检查入口、任务状态、验证与历史证据。清除“尚无 V0 审计”“从 V0 开始”、只提 A1、锁屏/服务仍运行、无依赖即可 check 等过期描述；将原 PLAN/JOURNAL/tasks、旧实施路线/交付说明和 bootstrap 浏览器脚本保存为可核验原件。活动任务保留阶段、候选待确认事项及归档依赖索引。

复用 `harness_state_audit`、`harness_verification_audit` 两个只读代理，对修改做定向复核；已修正其指出的 A2 审批依赖误读和 M4 工程门槛归档问题。主代理负责所有写入与集成。followup 无配置覆盖参数，既有模型/强度记为未知。

验证：`python3 verification/harness-audit-2026-11-03.py` 与 `git diff --check` 通过，覆盖 JSON/依赖、活动引用、归档字节、候选/原型 hash 及有效验收条款保留，见 [审计记录](verification/harness-audit-2026-11-03.md)。通用评分器为 36/100、exit 1，因固定英文关键字/文件名漏识别现有结构，未作为工程 gate。未运行生产测试、启动服务或浏览器。

续跑条件：按 PLAN 当前下一步处理具体范围；归档只按需读取。后续检查点记录实际命令/结果与未验证项，替换已失效的当前状态，保留历史链接。
