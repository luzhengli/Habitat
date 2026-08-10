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

## M5. 确认 MVP 产品合同与交互原型 — done

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
Agent 图标和增量 Skill 详情已按反馈修订，第二次微调进一步缩小图标与控件视觉尺寸；产品
负责人确认 V2 作为最终方向。允许后续实现的 UI 范围是该三栏项目 Skills 工作台、条件式待
应用栏与增量详情结构；首次设置仍以已批准 IA 为合同，进入 M8 前需按同一视觉系统补齐具体
状态并复验。M5 已完成，视觉确认不代表跳过 M6/M7 安全内核和 runtime 验证。

## M6. 实现安全内核与迁移事务 — done

Done when: 中性 Store 校验、正式 frontmatter 诊断、canonical inventory、staging 导入、
manifest quarantine 与 rollback 在临时 fixture 中满足 M4 合同；路径安全语义不放宽，
针对性 Rust 测试和 `npm run check` 通过。

完成情况：新增独立 Rust 迁移内核，使用版本化目录清单和 SHA-256 内容指纹进行 canonical
inventory；同一 canonical path 合并为一个 artifact，相同指纹副本和同名不同指纹变体保持
独立。Store 会拒绝符号链接、已知 discovery root 或项目的祖先/后代位置，并在执行前复验
Store 文件身份、源 canonical path、lstat 身份、链接文本与内容指纹。确认后先写事务 manifest，
经 staging 验证后导入 Store，再立即将原用户入口移动到 recovery；rollback 只在目标缺失且
Store/recovery 内容未漂移时精确恢复。全部验证只使用临时 fixture；未注册生产 UI command，
未访问真实用户路径。新增 7 个迁移测试，Rust 共 18 个测试及 `npm run check` 全部通过。

## M7. 实现多 Agent exposure 与项目 adapter — done

Done when: 五 Agent adapter registry、只读 policy/precedence 解释、所选 Agent 最小目标集、
多目标预检和安全回滚均可观察；Codex/Claude/Pi 完成 runtime 验收，Cursor/Trae 未完成
runtime QA 时只显示批准的有条件等级；`npm run check` 通过。

完成情况：实现版本化五 Agent registry、Codex/Pi/Cursor 共享目标组、Claude/Trae 独立目标、
项目级全量预检、相对链接应用、事务 manifest 和保守回滚。fixture 证明未选择目标不创建也不
触碰其冲突、任一已选目标冲突会在写入前阻断、中途失败只回滚本事务仍符合预期的更改，漂移
则保留并报告 partial。

只读 exposure inspection 将 `targeted`、预期入口是否满足、effective 的
`available/duplicate/shadowed/conflict/unknown` 与 `runtime_verified` 分开返回。Cursor 的
`.agents`＋`.claude` 同源双入口显示 duplicate，次级路径异源显示 conflict；Trae 仅从设置
控制的 `.agents` 路径可见时显示 unknown；Claude 2.1.207 的异源用户入口会将项目入口标为
shadowed。

Claude Code 2.1.207 真实进程已通过相对 symlink 发现、跨 scope realpath 去重、同名不同
realpath 冲突、unlink/reload 与 Skill invocation。调用使用只监听 loopback 的临时 Anthropic
协议 mock：请求只注入用户级冲突来源，证明用户级遮蔽项目级。registry 已将该 CLI surface
升级为 `runtime-verified`。Rust 共 30 个测试及完整 `npm run check` 通过；Cursor/Trae 因
本机无 runtime 继续保持 `path-compatible`。M7 完成。

## M8. 实现已确认 UI 并完成 MVP QA — done

Done when: 只实现 M5 明确确认的方向，覆盖首次使用到 rollback 的完整界面状态、选择持久化、
错误恢复和可访问性；按 `DESIGN.md` 第 14 节复验并更新 `design-qa.md` 与截图，迁移前后
effective set 在目标/未连接项目 fixture 上符合 M4 价值门槛，`npm run check` 通过。

完成情况：首次设置 F0–F6 已覆盖已知用户 roots 的只读扫描、同名版本选择、Store 校验、计划、
事务执行、完成与精确 rollback；项目管理旧 Spike 已替换为确认的三栏 V2。添加项目只保存
项目与 Agent 范围，不创建链接；Agent 图标只编辑项目草稿，统一经过条件式待应用栏、独立确认
与后端持有的 adapter plan 后，才创建或移除相对链接。项目和 Agent 范围持久化在本地 WebView
存储，切换 dirty project 会被阻止，不会静默应用。

1440×1024 原图/实现并排、项目确认层、添加项目层和 1024×768 抽屉布局均已复验；
`design-qa.md` 为 passed。浏览器 fixture 走通 2 个 Skill / 3 个链接操作的草稿、检查、应用与
成功反馈；Rust 临时 Store/项目 fixture 通过同一 name-only command boundary 创建三组相对
链接、验证五 Agent effective exposure、再移除链接并证明 Store 源保持完整，未知 Store 名称
在计划前阻断。`npm run check` 通过（Rust 33 tests + Vite 1595 modules + debug Habitat.app）。
检查点 `efaf495` 保存项目 Skills V2、QA 证据与 DESIGN 合同同步。M8 完成。

## M9. 发布准备与观察 — doing

Done when: 发布目标、签名/分发方式、数据升级与回滚路径、支持等级和发布后观察指标已经
明确并验证；提升为 `doing` 时再根据已批准发布范围细化。

当前状态：内部 symlink 权限误报已修复，但真实重试暴露共享 discovery root 会把同一物理入口
重复加入 Recovery；当前事务已导入 43 个 canonical Skill、移动 2 个入口后安全停在
`failed_partial`。M9 正在以临时 fixture 修复物理入口去重，通过完整 gate 后再按 manifest
精确 rollback；期间不发布应用、不猜测或覆盖真实用户文件。
