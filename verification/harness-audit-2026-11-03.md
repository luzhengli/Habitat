# Harness 审计与整理

审计于 2026-11-02 开始，2026-11-03 收尾；基线为 `main@73b712f`，开始时工作区干净。范围是项目指令、当前状态、续跑入口及验证索引，生产实现与原型资产不在改动范围。

## 发现与处理

| 问题 | 处理 |
|---|---|
| 入口仍称尚无 V0 审计、从 V0 开始，只提 A1 | 入口改为按 PLAN 当前下一步续跑，明确 A1/A2 待确认；保留 A0 可独立推进范围 |
| PLAN/JOURNAL 叠加互相覆盖的锁屏、goal、进程和同步状态 | 历史原件归档；PLAN 只留当前阶段、一个 next_action，JOURNAL 只留最近检查点 |
| tasks 混合当前工作、历史派发与旧会话运行状态 | schema v2 区分当前优先阶段和 activePhases；M4 统一为 reopened；历史依赖按原 ID 追溯，A2 的候选血缘与审批依赖分开 |
| docs/06、08 的原实施路线和环境阻塞容易被重新执行 | 原件归档；活动文档保留 M4 全部仍适用的门槛、验收映射、交付用途和当前入口 |
| verification 索引错误声称 check 无需前端依赖 | 更正为根目录与 apps/web 依赖均需安装；区分工程检查、视觉验收和历史交付校验 |
| 旧 browser-smoke 断言已移除的 bootstrap 页面并覆盖 current-* | 从活动 tests 移出，逐字节保存为非执行文本；当前浏览器验收按覆盖矩阵逐项采证 |
| 基线及候选入口假定 localhost 一直运行，焦点矩阵落后于恢复证据 | 优先链接自包含 HTML；临时端口使用前重查；汇总已有 Safari 焦点范围，保留 IME/完整视觉缺口 |

原件、来源路径与摘要见 [归档快照](../docs/archive/harness/2026-11-02-pre-audit/README.md)。已有模型记录、截图、日志、MANIFEST/SHA256SUMS 均保留；候选状态仍以 [基线登记](../design/prototype-baselines.md) 为准。

## 通用评分器的适用边界

执行 `node ~/.agents/skills/harness-creator/scripts/validate-harness.mjs --target <repo> --json` 得到 36/100、exit 1：

| 子系统 | 原始分数 | 本项目实际载体 |
|---|---|---|
| instructions | 2/5 | AGENTS、CODEX-START、docs/10 |
| state | 1/5 | PLAN、JOURNAL、tasks.json |
| verification | 3/5 | package.json 的 check、verification 索引与证据 |
| scope | 2/5 | 原型确认范围、阶段依赖及验收条件 |
| lifecycle | 1/5 | 续跑入口、最近检查点与归档索引 |

最低分为 state/lifecycle。评分器固定查 `feature_list.json`、`progress.md`、`init.sh` 和英文标题，没有读取本项目的等价文件；分数不能据此证明这些能力缺失。实际审计确认的问题是状态混杂、历史入口过期和证据用途不清，已按上表处理；未为抬分创建另一套任务文件或重写技能工具。

## 验证与限制

两个只读代理对本次修改做了定向复核，指出 A2 血缘被误写为审批前置，以及 M4 工程门槛被一并移入归档。主代理已用 `basedOnRevision` 表达血缘、补回原 M4 门槛，并验证原验收映射与 docs/10 核心合同保留。

可重放检查：`python3 verification/harness-audit-2026-11-03.py`；[检查脚本](harness-audit-2026-11-03.py) 只读仓库，不启动服务。通过项目：

- 6 份归档原件与 `73b712f` 的 Git 内容及摘要一致；原 MANIFEST/SHA256SUMS、package.json 未修改。
- 活动任务 JSON 有效，ID 唯一，依赖可在活动/归档账本解析且无循环；PLAN 只有一个 next_action 并与 tasks 一致。
- 22 项 A0 资产与两个候选 HTML 的 SHA-256 一致；A1/A2 仍待确认，M4/V3 未关闭。
- 活动文档的本地文件链接有效；旧 smoke 脚本不在 npm check 调用链中，已保存为文本后移出活动 tests。
- `git diff --check` 通过。六个日常入口文件的非空白字符减少约 48%；这是文本体积统计，不是 token 或性能收益承诺。

本次快照检查固定了当前阶段与候选状态，只用于重放本次维护验收；未来正常批准/阶段演进时应更新对应证据，不把此日期脚本接入常规工程 gate。

本次未运行生产测试、启动服务或浏览器。上一轮工程 check 与所有视觉结果仍保留原有时间/范围，不将文档维护认定为产品验收。

协作：复用 `harness_state_audit`、`harness_verification_audit` 两个只读代理；followup 无配置覆盖参数，原模型/强度未能独立确认，记为 unknown。主代理统一归档、写入、结构校验与提交。
