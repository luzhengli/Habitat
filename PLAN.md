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

当前状态：内部 symlink 权限误报与共享 discovery root 重复 Recovery 均已修复；重叠 Agent
routes 仍保留在 inventory，但迁移计划只生成一次物理移动，不一致重复记录会阻断。真实失败
事务已精确 rollback：43 个 Store 导入移除、2 个原 symlink 恢复，Store 顶层回到空状态；
`npm run check` 通过。产品负责人选择的项目 Skills 状态分组切片已完成：“当前可用 / 尚未
添加”按最近验证状态归组、默认全部展开，并可通过左侧箭头独立折叠与恢复；已删除“记住
折叠状态”与“收起”文字。1440×1024 同视口视觉复验、实际折叠/筛选/草稿稳定性浏览器证据、
`design-qa.md` 和 `DESIGN.md` 均已同步，`npm run check` 通过；Agent 草稿、adapter 与文件
安全语义未改变。产品负责人已确认侧栏 Recovery 是不选择 Skills 的一次性整笔首次迁移
rollback：全量恢复原用户入口、移除本事务 Store 导入并回到首次设置；任何受管项目链接仍
指向待移除 Store 内容时整笔阻断，且不自动跨事务删除项目链接。后端已实现重启后唯一有效
事务发现、manifest/canonical 边界复验、已知 Agent root 限制、项目链接扫描、重新预检与
有界执行命令，42 个 Rust 测试及 `npm run check` 通过。产品负责人进一步确认 Recovery 是
跨所有已纳管项目的 Store 级操作，项目只是全量审计对象，Recovery 页面不得保留项目侧栏
或当前项目语义；此前两轮带项目导航的原型均废弃。新的全局影响概览、项目影响矩阵和引导式
全局审计三稿已完成，均把不可访问或未完成检查的注册项目作为整笔阻断。现有 Rust 扫描器仍
依赖调用方传入项目列表，不能独立证明列表完整；生产执行前须补充后端直接读取的持久化受管
项目注册表。产品负责人已选择新方案 A“全局影响概览”继续深化；当前先补齐进入检查、各类
阻断处理、项目链接解除后返回、重新预检、危险确认、执行、成功、可恢复的部分失败、重启
续接与无事务等完整动线，并确认全量审计集合。生产 React UI 与注册表 schema 须等待这组
完整状态再次确认。方案 A 的完整合同现已覆盖 14 个业务状态和 11 张 1440×1024 关键状态
原型；全量集合建议采用“后端项目注册表 ∪ 与待回滚 imports 相交的历史项目事务 roots”，
不可访问的当前或历史项目均不可通过删除 UI 记录绕过。等待产品负责人确认这一安全边界、
项目处理交接、最终确认、部分失败续接和成功后保留 dormant 项目元数据的合同。M9 仍继续
等待发布目标、签名/分发方式和发布范围确认。产品负责人已确认上述完整 Recovery 合同，允许
进入后端项目注册表、历史事务并集审计、production UI、fixture 验收与设计 QA 实现。该实现
现已完成：Store 自持有版本化项目注册表，审计集合取注册表与相关历史项目事务 roots 的并集，
不可访问与身份变化均阻断；执行使用 transaction id + audit revision 再次全量复验。无项目侧栏
的 Recovery production 状态机、项目工作台交接和全部异常出口已通过 1440×1024、1024×768
浏览器 QA；Rust 44 tests 与完整 `npm run check` 通过。M9 继续等待发布目标、签名/分发方式和
发布范围确认。按钮卡住专项审计进一步确认全部 23 个 Tauri command 原先都在主线程执行重
文件系统/进程工作；现已统一改为 async command 调度且不改变参数或安全语义，并用回归测试
阻止普通同步 command 回归。项目预检/应用、项目登记与切换、首次回滚、Recovery 对话框、
诊断复制、Agent overflow 和占位设置按钮的反馈/互锁也已按既有设计模式收敛；浏览器 console
为 0 warnings / 0 errors，Rust 45 tests 与完整 `npm run check` 通过。M9 仍继续等待发布范围。
