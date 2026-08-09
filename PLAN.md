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

## M4. 明确正式 MVP 的首个产品目标 — done

Done when: 产品负责人写明用户价值、可观察验收标准和明确非目标；在此之前不从
`SPIKE.md` 的建议自行启动实现。

批准的用户价值：用户可以把散落在多个 Agent 用户级目录中的选定 skills 无损收敛到
一个中性 Store，只向指定项目暴露，并清楚看到 Codex、Claude Code、Pi、Cursor 与
Trae 各自的最终 effective exposure。

批准的产品合同：

- 首次使用包含只读 inventory、选定 skill 导入和可选、逐项确认、可回滚 quarantine；
- 导入可以复制到 Store transaction staging，项目安装仍只能创建相对符号链接；
- 默认 Store 为 `~/Library/Application Support/Habitat/Skill Store`，并拒绝任何已知
  discovery root 或受管理项目内的不安全位置；
- Agent 配置保持只读；同名不同内容由用户选择 canonical，其余只隔离、不改写；
- 按所选 Agent 计算最小目标集：Codex/Pi/Cursor 使用 `.agents/skills`，包含 Claude Code
  时追加 `.claude/skills`，包含 Trae 时追加 `.trae/skills`；
- 多目标失败只安全回滚本事务创建且仍符合预期的链接，否则保留并报告部分状态；
- Codex、Claude Code、Pi 作为已验证支持；Cursor、Trae 在真实 runtime QA 前明确标记
  Beta/有条件支持；Trae 国际版与中国版用户 roots 均进入只读 inventory；
- 所有 UI、交互和文案必须先提交至少 3 个可比较原型，由产品负责人明确确认后再实现。

可观察价值门槛：同一 canonical skill 的多入口不重复计数；同名变体不自动覆盖；选为
项目级的 skill 经迁移后不再从受支持用户 root 暴露；目标项目按所选 Agent 读取同一
Store source，未连接项目不可见；rollback 恢复原入口且内容指纹一致；界面如实区分
targeted、path-compatible 和 runtime-verified。

非目标：永久删除 quarantine、自动合并或改写 skill、管理 MCP/Rules 或 runtime-owned
skills、修改 Agent 配置、云同步与团队分发、接管 Agent 启动命令，以及在未验证版本上
宣称 Cursor/Trae 已受支持。

## M5. 确认 MVP 产品合同与交互原型 — doing

Done when: adapter、effective exposure、迁移事务与 rollback 的产品数据合同可供后续实现
独立验证；针对 onboarding、inventory、冲突处理、迁移确认和结果恢复至少生成 3 个可比较
原型，产品负责人明确选择一个方向；确认结论和允许实现的 UI 范围记录在 PLAN/JOURNAL，
期间不修改生产 React/Tauri UI。

当前进展：产品负责人已确认两段式生命周期：首次使用先完成机器级扫描、统一 Store 导入
和原用户入口立即移入恢复区；完成后才进入项目管理。项目页用 Agent 图标切换 Skill 的
项目级可用性，不设置重复的“是否已链接”列；Codex/Pi/Cursor 因共享 `.agents/skills`
同步切换。首次设置 7 个页面状态、项目管理 6 个页面/组件状态、恢复区、术语和视觉探索前
验收条件已形成信息架构合同。此前所有在首次迁移中展示项目上下文的原型均只保留为决策
历史。产品负责人已选择第二轮方案 1 的三栏项目 Skills 工作台；底部状态条、待应用栏、真实
Agent 图标和增量 Skill 详情已按反馈修订，第二次微调进一步缩小图标与控件视觉尺寸。最终稿
确认前 M5 保持 `doing`，生产 UI 仍未获准实现。

## M6. 实现安全内核与迁移事务 — todo

Done when: 中性 Store 校验、正式 frontmatter 诊断、canonical inventory、staging 导入、
manifest quarantine 与 rollback 在临时 fixture 中满足 M4 合同；路径安全语义不放宽，
针对性 Rust 测试和 `npm run check` 通过。

## M7. 实现多 Agent exposure 与项目 adapter — todo

Done when: 五 Agent adapter registry、只读 policy/precedence 解释、所选 Agent 最小目标集、
多目标预检和安全回滚均可观察；Codex/Claude/Pi 完成 runtime 验收，Cursor/Trae 未完成
runtime QA 时只显示批准的有条件等级；`npm run check` 通过。

## M8. 实现已确认 UI 并完成 MVP QA — todo

Done when: 只实现 M5 明确确认的方向，覆盖首次使用到 rollback 的完整界面状态、选择持久化、
错误恢复和可访问性；按 `DESIGN.md` 第 14 节复验并更新 `design-qa.md` 与截图，迁移前后
effective set 在目标/未连接项目 fixture 上符合 M4 价值门槛，`npm run check` 通过。

## M9. 发布准备与观察 — todo

Done when: 发布目标、签名/分发方式、数据升级与回滚路径、支持等级和发布后观察指标已经
明确并验证；提升为 `doing` 时再根据已批准发布范围细化。
