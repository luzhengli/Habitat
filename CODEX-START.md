# Habitat Web · 续跑入口

1. 读 [AGENTS](AGENTS.md)、[README](README.md)、[PLAN](PLAN.md)、[JOURNAL](JOURNAL.md) 最新检查点和 [tasks.json](tasks.json)；核对 cwd、分支与 git status，保留已有修改。归档按需查，不重做已完成的工程初始化和差异盘点。
2. 本轮任务以用户最新请求为准；继续高保真工作时按 PLAN 的 next_action 选择范围。读取 [原型合同](docs/10-原型先行与高保真还原合同.md)、[基线登记](design/prototype-baselines.md) 与 [覆盖矩阵](verification/fidelity/coverage.md)，先核对已有证据。
3. A1/A2 的可审阅文件见 [REVIEW](design/prototype-revisions/REVIEW.md)。未获确认的设计不得接入生产；已确认 A0 范围可继续还原或补证，不把候选等待扩大成所有工作的禁令。若需修改候选，创建新版本并记录确认范围。
4. 按 AGENTS 拆分有独立收益的工作，固定接口、文件与浏览器负责人。复用真实 API/授权/事务/回读/撤销链；按 docs/10 完成同条件测量、实现、叠加/diff 与修正。
5. 代码改动运行 `npm run check` 和必要专项回归；UI 改动另需 docs/10 的 Chromium/Safari 与逐状态视觉证据。仅文档变更检查 JSON、依赖/引用和 `git diff --check`。命令范围见 [验证索引](verification/README.md)。
6. 同步 PLAN/tasks 的当前状态和唯一下一步，将实际结果、失败与未验证项写入 JOURNAL；旧检查点按 [归档索引](docs/archive/README.md) 保留。使用约定式提交，大迭代可按完整、可验证的改动拆分。

V0–V3 的退出条件、功能回归及用户最终视觉确认均满足后才可关闭 M4。临时端口、进程号、会话状态必须在使用前重查；历史测试通过或打开候选不代表用户批准。
