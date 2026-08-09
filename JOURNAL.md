# Journal

最新记录在最上方；每个 session 一条。超过约 150 行时，将最新五条之前的内容压缩到
Digest。

## 2026-08-10 — M7→M8: 完成 effective exposure 与 Claude runtime QA

- Exposure: 新增只读项目 exposure inspection，分别返回 Agent 是否 targeted、预期入口是否
  满足、effective state、支持等级和 runtime-verified，不再用单一链接状态代替实际可见性。
- Cases: fixture 覆盖 Cursor `.agents`＋`.claude` 同源 duplicate、Cursor 次级路径异源
  conflict、Trae 只有设置控制 `.agents` 路径时 unknown；adapter 测试由 8 增至 11。
- Claude: 2.1.207 真实进程证明用户级＋项目级同 realpath 入口合并为 1 个 unique Skill；
  同 basename 不同 realpath 会加载 2 个来源但只显示一个 slash-command 名称，因此不能猜测
  winner；移除项目入口后新进程不再列出 fixture。
- Runtime: 使用只监听 `127.0.0.1` 的临时 Anthropic 协议 mock，真实 Claude Code 2.1.207
  成功展开相对 symlink Skill、发送 streaming 请求并完成响应；没有连接外部模型。用户/项目
  同名不同 realpath 时，请求只注入用户级 fixture，证明该版本由用户级来源遮蔽项目级。
- Contract: registry 将 Claude 2.1.207 CLI 升为 `runtime-verified`，并记录同 realpath 去重、
  用户级 precedence、调用与 unlink/reload 证据；effective exposure 新增 `shadowed`，调用方
  可传入用户级 route，避免把已被用户来源遮蔽的项目入口显示为可用。
- Evidence: `npm run check` → exit 0；Rust 30 passed，Vite 1583 modules transformed，并生成
  debug `Habitat.app`。所有 runtime fixture 都位于 `/private/tmp`，未使用真实项目或 Store。
- Checkpoint: `299227c` 保存 effective exposure 检查、3 个新增 fixture 与 Claude 初始化矩阵。
- State: M7 done；Cursor/Trae 继续 `path-compatible`。M8 doing，但首先补齐首次设置的 3 个
  可比较视觉原型，确认前不修改生产 React/Tauri UI。
- Next: 保存 M7 runtime 检查点，然后按已批准 IA 与 V2 视觉系统开始首次设置视觉探索。

## 2026-08-10 — M5→M7: 确认 V2，完成迁移内核

- Approval: 产品负责人确认 `project-skills-round2-selected-v2.png`，M5 结束；V2 是项目
  Skills 工作台、条件式待应用栏和增量详情结构的生产 UI 方向。
- Boundary: 首次设置继续由已批准 IA 约束，M8 前仍需按 V2 视觉系统补齐具体状态；当前先
  进入 M6，不抢跑生产 React/Tauri UI。
- M6: 新增独立 `src-tauri/src/migration.rs`，实现中性 Store 校验、结构化 frontmatter
  诊断、canonical inventory、版本化 SHA-256 内容指纹、staging 导入、即时 recovery、事务
  manifest 与保守 rollback；未把接口注册为生产 Tauri command。
- Identity: 同一 canonical path 只生成一个 artifact；同指纹副本与同名不同指纹变体仍是
  独立 artifact。执行前复验 Store identity、源 canonical path、lstat identity、链接文本和
  内容指纹，Store 与 discovery root/受管理项目的任一祖先/后代关系都会阻断。
- Fixtures: 7 个临时目录测试覆盖 Store 位置/符号链接、canonical 去重、重复副本、同名变体、
  非法声明、导入后立即恢复区、源/Store 漂移、rollback 目标漂移与精确恢复。
- Safety: 本阶段不得访问或修改真实 Skill Store、真实项目或 Agent 配置。
- Evidence: `cargo test --manifest-path src-tauri/Cargo.toml` → 18 passed；`npm run check` →
  exit 0，Vite 1583 modules transformed，并生成 debug `Habitat.app`。
- Checkpoint: `5393356` 保存可回滚迁移内核、临时 fixture 证据及 M6→M7 状态。
- M7 kernel: 新增版本化五 Agent adapter registry 与项目 exposure 事务；共享 `.agents`、
  独立 `.claude`/`.trae` 目标由所选 Agent 的最小集合计算，所有目标先预检，应用只创建
  相对 symlink，并用 Store 内 manifest 对本事务创建/移除的链接和空容器做保守回滚。
- M7 fixtures: 新增 8 个测试，覆盖 registry 支持边界、共享目标去重、仅 Trae 不创建其他
  adapter、已选目标冲突全量阻断、未选目标冲突保持不动、中途失败自动回滚、漂移 partial
  与 create/remove 的显式 rollback；Rust 当前共 26 个测试通过。
- Runtime QA: 本机 Codex `0.139.0`、Claude Code `2.1.207`、Pi `0.81.1`；Cursor/Trae 未安装。
  Claude 真实进程已从临时项目的相对目录 symlink 发现并注册 fixture Skill，但模型调用被
  外部 CodingPlan 订阅状态以 HTTP 400 阻断，`total_cost_usd: 0`。证据记录在
  `docs/qa/runtime-compatibility.md`；Claude 仍为 `targeted`，M7 不得标为完成。
- Evidence: `npm run check` → exit 0；Rust 26 passed，Vite 1583 modules transformed，并生成
  debug `Habitat.app`。
- Checkpoint: `9aeaf95` 保存五 Agent registry、项目多目标事务、runtime QA 证据和 M7 当前状态。
- Next: 外部订阅恢复后补齐 Claude invocation/reload/dedupe/conflict/unlink 验收；通过前 M7
  保持 `doing`，且不进入 M8 生产 UI。

## 2026-08-10 — M5: 选择三栏方向并生成首份修订稿

- Decision: 产品负责人选择第二轮方案 1 的三栏项目 Skills 工作台，但修订稿确认前仍不
  进入生产 UI 实现。
- Footer: 删除最下方常驻状态条；待应用区域明确为只在 Agent 图标产生未提交草稿时出现的
  临时操作栏，压缩为“待应用更改 / 添加 2 / 移除 1 / 尚未写入项目”。
- Navigation: 左栏“恢复中心”改为“恢复”。
- Inspector: 右栏不再重复列表已有的来源、版本与完整 Agent 状态，只展示本次更改、检查
  结果、项目入口与折叠技术详情。
- Icons: Codex、Cursor、Claude Code、Trae 使用 Lobe Icons 的真实品牌图形参考，Pi 使用
  `pi.dev` 官方 Press Kit 标志；状态勾、点、减号和警告与品牌图形分层表达。
- Prototype: 新增 `docs/prototypes/mvp/project-skills-round2-selected-v1.png`，归档尺寸为
  1440×1024。
- Icon scale: 产品负责人认为 V1 基本可用，但 Agent 图标偏大；新增
  `project-skills-round2-selected-v2.png`，将品牌图形收至约 14–16px、点击容器约 28px，
  共享入口保持一个组合控件，其他布局和信息合同不变。
- Boundary: 本轮未修改 `src/`、`src-tauri/`、真实 Skill Store、项目或 Agent 配置；M5
  继续 `doing`，等待产品负责人确认修订稿。
- Checkpoint: `0d5b38d` 保存方案 1 修订稿、真实图标依据与 M5 选择状态。
- Checkpoint: `1a5a1b5` 保存图标尺寸微调后的 V2 当前视觉目标。
- Next: 评审修订稿中右栏增量信息与待应用栏，确认后再固定允许实现的 UI 范围。

## 2026-08-09 — M5: 生成第二轮项目 Skills 视觉方案

- Scope: 以迁移完成后的 P2 项目 Skills 为唯一比较面，首次迁移只作为前置条件，不再把
  机器级迁移、项目链接与日常管理混在同一页面。
- Shared contract: 三稿使用相同项目、Skill、Agent 状态和待应用草稿；均删除顶部含糊统计、
  独立链接状态、策略、优先级和原始路径，并把 Codex/Pi/Cursor 作为一个共享入口控件。
- Prototypes: 新增三栏工作台、行内展开账本、Agent 可用性矩阵三个 1440×1024 静态方向；
  三者都只在用户点击 Agent 控件后形成草稿，再通过单一“查看并应用”动作提交。
- Boundary: 本轮未修改 `src/`、`src-tauri/` 或真实用户文件；视觉方向尚未选择，M5 继续
  `doing`，生产 UI 仍未获准实现。
- Evidence: 原始生成图使用已偏好的三栏稿与真实 Spike 截图作为视觉参考；归档副本统一为
  1440×1024，生成约束与比较轴记录在 `docs/prototypes/mvp/project-skills-round2.md`。
- Checkpoint: `9498914` 保存三份视觉方向、比较合同与 M5 当前状态。
- Next: 等待产品负责人选择 1、2、3，或明确要组合和修订的部分。

## 2026-08-09 — M5: 固定 MVP 页面信息架构

- IA: 新增 `docs/product/mvp-information-architecture.md`，将已批准生命周期拆为首次设置
  shell 与项目管理 shell，逐页定义用户问题、必要信息、主次操作、阻断和失败状态。
- First run: 固定 F0–F6：开始扫描、扫描中、整理 Skills、选择 Store、确认首次迁移、
  执行验证、完成设置；全程不出现项目，完成页明确没有项目可用并引导添加第一个项目。
- Project: 固定 P0–P5：无项目、添加项目、项目 Skills、待应用栏、检查项目设置、应用
  结果；Agent 图标只更新草稿，项目变更不再称为迁移。
- Components: Codex/Pi/Cursor 是一个包含三个图标的共享目标控件，Claude Code 与 Trae
  独立；删除“是否已经链接”、策略、优先级和原始路径列，并定义 Agent 图标完整状态机。
- Recovery: 恢复区归属技能库，只允许经过当前状态预检的精确恢复，永久删除继续排除在
  MVP 外。
- Boundary: 本轮只更新信息架构和合同，没有生成图片、修改生产 UI 或触碰真实用户数据；
  M5 继续保持 `doing`。
- Checkpoint: `5b63f5e` 保存页面信息架构、first-run manifest 边界和 M5 当前进展。
- Next: 产品负责人先评审页面字段与操作，再决定何时启动新一轮三方向视觉探索。

## 2026-08-09 — M5: 确认首次迁移与项目链接的生命周期边界

- Decision: 首次使用是机器级流程：只读扫描本机 Agent 用户级 Skills、整理 canonical
  内容、导入自定义 Store，并在验证 Store 指纹后立即将迁移过的原用户入口移入恢复区；
  首次迁移不选择项目、不创建项目链接。
- Project flow: 首次迁移完成后才添加项目。每个 Skill 通过可点击的 Agent 图标组形成
  待应用方案；不再设置“是否已链接”列，点击图标也不会立即写文件。
- Shared target: 产品负责人确认 Codex、Pi、Cursor 因共享 `.agents/skills` 作为一个
  同步切换组；Claude Code 与 Trae 保持独立。亮暗之外还需勾、待应用点、错误标记、
  tooltip、焦点和可访问名称。
- Contract: 新增 `docs/product/mvp-user-flow.md`，并修正产品合同中的 first-run plan、
  transaction、project exposure 与 prototype fixture；此前含项目上下文的迁移图均失效。
- Boundary: 本轮只同步产品动线、合同与原型状态，没有继续生成图片，没有修改生产 UI，
  也没有触碰真实用户 Skill Store、项目或 Agent 配置。
- Checkpoint: `9503c39` 保存两段式生命周期、Agent 同步切换合同和失效原型记录；M5
  仍等待基于新动线的视觉比较与产品负责人明确选择。
- Next: 等产品负责人要求后，再基于已批准生命周期生成新的可比较视觉方向。

## 2026-08-09 — M5: 否决 2.1 迁移页并生成 Migration Review V3

- Feedback: 产品负责人认为 2.1 迁移计划仍不可接受，明确指出 Agent 等枚举值缺少组件化
  表达、页面底部错位且定义不清、检查与执行动线混杂，并要求参考 `baoyu-design` 后重做。
- Audit: 当前页把四类处理结果平铺为同权长清单；Agent、兼容性、安全说明、统计和操作
  分散在多个区域；四段进度条混合检查与执行状态。截图可见的可访问性风险也已记录。
- Method: 阅读 `baoyu-design` 的主 skill、hi-fi 与 interactive prototype 方法；采用其
  “真实上下文优先、设计系统为约束、方向必须有结构差异、选择后再做交互原型”的原则，
  不照搬其视觉皮肤或代码。
- Prototype: 新增 3 个 1440×1024 独立方向：结果先行、分步检查、变更路径图。三者均
  使用 Agent 图标组与溢出浮层、唯一工作流底栏，并将检查导航与执行进度分开。
- Boundary: 本轮仍只更新静态原型和评审记录，未修改 `src/`、`src-tauri/`、真实用户
  Skill Store、项目或 Agent 配置；M5 保持 `doing`，生产 UI 未获准实现。
- Next: 等待产品负责人从本轮三张图中选择方向，或继续指出要组合与修订的部分。

## 2026-08-09 — M5: 修订原方案 2 为三屏 Option 2.1 动线

- Feedback: 产品负责人保留原 Inventory workbench，要求删除顶部计数、统一折叠行高、
  将“暴露给”改为“适用于”并限制内联 Agent 数、补充策略说明、移除优先级，同时继续
  研究更清晰的迁移动线；策略文案统一为“仅用于当前项目”，不嵌入项目名。
- Flow: 管理页只形成迁移草案并处理待决定项；`迁移计划`使用保留项目侧栏的独立主页面
  承担检查与确认；完成页汇总可恢复结果，再由`查看当前项目中的 Skills`返回稳定的
  项目—Skills—Skill 详情三栏管理页。
- Prototype: 新增 `inventory-workbench-v2-1-management.png`、
  `inventory-workbench-v2-1-plan.png` 和 `inventory-workbench-v2-1-complete.png`，均为
  1440×1024；2R 不再是当前候选，三屏 2.1 动线等待产品负责人最终确认。
- Boundary: 本轮仅更新静态决策原型与文档，没有修改 `src/`、`src-tauri/`、真实用户
  Skill Store、项目或 Agent 配置；M5 保持 `doing`，生产 UI 仍未获准实现。
- Evidence: 三张 PNG 均验证为 1440×1024；`git diff --check` 通过，变更中不包含
  `src/` 或 `src-tauri/`；检查点 `a5f0ec2` 保存三屏原型与生成依据。
- Next: 等待产品负责人确认三屏 2.1 动线或指出下一轮具体屏幕修改。

## 2026-08-09 — M5: 生成 Inventory workbench 2R 修订原型

- Feedback: 产品负责人倾向原方案 2 的三栏布局，但要求交互更自然，并避免向用户暴露
  entry、exposure、policy、precedence、canonical、fingerprint 等内部产品模型。
- Review: 只读 subagent 与主 agent 均建议保留三栏骨架，改为“问题优先 + 渐进披露”；
  默认按需要决定、仅用于当前项目、所有项目可用和本次不改分组，技术字段收进详情。
- Prototype: 新增 `docs/prototypes/mvp/inventory-workbench-v2r.png`，使用自然版本选择、
  无默认选项、文字化 Agent 状态和 `处理 1 个待决定项` 的连续动作；生成依据已回写 brief
  与 prompt set。
- Boundary: 本轮未修改 `src/`、`src-tauri/` 或真实用户文件；2R 仍是待确认静态原型，
  不代表 M5 完成或生产 UI 获准实现。
- Evidence: 2R PNG 已验证为 1440×1024；`git diff --check` 通过，diff 未包含 `src/`
  或 `src-tauri/`。
- Checkpoint: `e92da7c` 保存 2R 修订原型、评审结论、选择状态和生成 prompt；M5 仍等待
  产品负责人最终确认。
- Next: 等待产品负责人确认 2R 或提出下一轮具体修改；确认前 M5 保持 `doing`。

## 2026-08-09 — M5: 完成产品合同草案与三方向原型

- Contract: 新增 `docs/product/mvp-product-contract.md`，定义 adapter、canonical artifact、
  exposure route、effective exposure、inventory snapshot、迁移事务、manifest、rollback、
  多目标链接与支持等级合同；没有实现生产代码。
- Prototypes: 基于现有 `DESIGN.md`、参考原型和真实 Spike 截图，分别生成 Guided migration、
  Inventory workbench、Project exposure 三个独立 `1440×1024` 方向；三者使用相同 fixture、
  冲突与支持等级，便于公平比较。
- Boundary: `src/`、`src-tauri/`、真实用户 Skill Store、项目和 Agent 配置均未修改；原型
  只保存在 `docs/prototypes/mvp/`，不能作为功能或 runtime 兼容性证据。
- Evidence: 三个 PNG 均验证为 1440×1024；生成 reference 和 prompt set 已保存在同目录；
  `git diff --check` 通过，diff 未包含 `src/` 或 `src-tauri/`。
- Checkpoint: `3a75459` 保存 MVP 产品合同草案、共享原型 brief、三张独立原型和可复现
  prompt set；M5 仍等待产品负责人选择。
- Next: 等待产品负责人选择 1、2、3，或提出需要重新生成/组合的具体反馈；选择前 M5 保持
  `doing`，不得进入生产 UI 实现。

## 2026-08-09 — M4–M5: 批准 MVP 合同并加入 UI 原型确认门槛

- Decision: 产品负责人批准中性 Store、首次导入与可回滚 quarantine、Agent 配置只读、
  同名变体不改写、按所选 Agent 计算最小 adapter 集合，以及 Cursor/Trae 有条件支持等
  MVP 合同；M4 完成。
- Design gate: 所有 UI、交互和文案在生产实现前必须先生成至少 3 个可比较原型，等待
  产品负责人明确确认一个方向；该结论已同步到 `AGENTS.md`、`PLAN.md` 与 `DESIGN.md`。
- Scope: 本轮只更新 harness 和设计规范，没有生成原型、修改生产 UI、实现 MVP 功能，
  也没有触碰真实用户 Skill Store、项目或 Agent 配置。
- Evidence: `npm run check` → exit 0；Rust tests 11 passed，Vite 1583 modules
  transformed，并生成 `src-tauri/target/debug/bundle/macos/Habitat.app`。
- Checkpoint: `b05499b` 批准 MVP 产品合同、拆分后续 milestones，并将多原型确认设为
  生产 UI 实现前的硬门槛。
- Next: M5 先固定产品数据合同并生成 onboarding 到 rollback 的多个交互原型；等待产品
  负责人确认后，才允许后续 milestone 实现生产 UI。

## 2026-08-09 — M4: 扩展 Cursor 与 Trae 兼容范围

- Finding: Cursor 原生扫描 `.agents/skills`，无需新增 `.cursor` adapter，但也会扫描
  Habitat 为 Claude 创建的 `.claude/skills`；官方未声明同 realpath 去重，必须验证双
  route 是否重复。Trae 的 `.agents/skills` 支持受用户设置控制，确定性项目覆盖应使用
  原生 `.trae/skills`，且不静默修改 Agent 配置。
- Product model: 固定双 adapter 应升级为“所选 Agent 的最小覆盖集”：`.agents` 覆盖
  Codex/Pi/Cursor，`.claude` 覆盖 Claude Code，`.trae` 覆盖 Trae。五者全选时才创建
  三个目标；安装仍沿用已批准的全量预检与安全回滚语义。
- Runtime boundary: Cursor Skills 始于 2.4，但本机 Cursor 仅 1.2.4；本机没有 Trae
  app/CLI。两者目前只能标记 path-compatible，symlink、重启、同名与禁用语义在选定
  release runtime 验证前不能标记 runtime-verified。
- Local evidence: `~/.cursor/skills` 不存在；`~/.trae/skills` 与
  `~/.trae-cn/skills` 各有 20 个 symlink，均指向 `~/.agents/skills` 下相同的 lark
  skills。首次迁移必须区分 Trae 国际版/中国版，并按 canonical target 合并重复入口。
- Scope: 产品负责人确认兼容目标扩展为 Codex、Claude Code、Pi、Cursor、Trae；本轮只
  更新研究与 harness 状态，未实现新 adapter，未修改真实用户 skills 或 Agent 配置。
- Checkpoint: `68f1f0f` 更新五 Agent 兼容矩阵、effective exposure、迁移 roots、README、
  AGENTS 与 PLAN；`git diff --cached --check` 通过。
- Next: 批准最小覆盖集、Trae 原生 adapter、Cursor/Trae runtime QA 门槛和 Trae edition
  范围，并继续评审首次导入/quarantine 的五项既有决定；M4 保持 `doing`。

## 2026-08-09 — M4: 调研项目级 Skills 暴露面与首次迁移

- Finding: Codex、Claude Code 与 Pi 都采用 progressive disclosure；全局 skills 的主要
  成本是 metadata catalog、误触发和同名遮蔽，而不是启动时加载所有正文。三者的用户级
  roots、过滤机制和同名优先级不同，项目链接存在不等于项目版本实际生效。
- Local evidence: `~/.agents/skills` 有 44 个 skill；Codex 配置有 27 个禁用条目；
  `~/.claude/skills` 有 14 个指向该目录子集的 symlink；`~/.pi/agent/skills` 不存在，
  但 Pi 仍默认扫描全部通用用户级目录。本轮只读，未改动这些真实路径。
- Recommendation: Store 必须位于任何 Agent discovery root 之外；首次使用应先建立
  effective exposure inventory，再把选定 skill 导入中性 Store，并以 manifest 驱动、
  可回滚的 quarantine 隔离旧全局入口，首版不永久删除。
- Correction: Claude Code 官方当前明确从 2.1.203 起支持 personal/project skill 目录
  symlink；已修正旧研究结论，本机 2.1.207 满足最低版本。
- Decision: 默认双 adapter 与多目标安全回滚已经产品负责人批准；导入/quarantine 是否
  进入 MVP、Store staging 复制边界、默认 Store 路径、Agent 配置只读边界和同名变体
  策略仍待批准，M4 保持 `doing`。
- Checkpoint: `473747f` 新增项目粒度暴露面与首次迁移研究，修正 Claude symlink 兼容
  结论并同步 PLAN；`git diff --cached --check` 通过。
- Next: 产品负责人评审新增五项高成本决定；批准前不进入实现，也不触碰真实用户 skills。

## 2026-08-09 — M4: 调研项目级 Skills 的跨 Agent 发现契约

- Finding: Agent Skills 标准统一 `SKILL.md` 内容格式，但没有统一项目发现目录；Codex
  与 Pi 原生支持 `.agents/skills`，Claude Code 官方只声明 `.claude/skills`。
- Local evidence: Codex 0.139.0 在非 Git 临时 fixture 中发现 Habitat 创建的三个相对
  symlink；Pi 0.81.1 第一方文档与本机源码支持 `.agents/skills`、非 Git 父级扫描和目录
  symlink；`skills 1.5.22 list --project --json` 的 agent 映射与 Pi 运行时能力存在漂移。
- Decision: 推荐“统一 Agent Skills 源内容 + 版本化项目 adapter”，首个候选 adapter 为
  `.agents/skills` 和 `.claude/skills`；本轮只记录研究，不扩大写路径或进入 MVP 实现。
- Checkpoint: `e67928d` 新增 `docs/research/agent-skill-compatibility.md`，并同步修正
  `AGENTS.md`、`README.md` 与 `PLAN.md` 中对当前原型兼容性的过度表述；
  `git diff --check` 通过。
- Next: 产品负责人批准首个兼容矩阵、默认 adapter、多目标失败语义与最低验证版本；M4
  继续保持 `doing`。

## 2026-08-09 — M4: 确认 Agent-agnostic 产品定位

- Confirmed: Habitat 运行平台仍为 macOS，但管理对象是通用目录项目中的项目级
  skills；Codex、Claude Code、Pi Agent 等仅作为下游消费者，Habitat 不介入其运行时。
- Scope: 首个 MVP 仍只管理 skills；MCP、Rules 等项目 harness 资产仅记录为未来扩展
  方向，不进入当前实现范围。
- Checkpoint: `01c7d34` 更新 `AGENTS.md`、`README.md` 与 `PLAN.md`，消除
  `Codex-only` 定位冲突；`git diff --check` 通过。
- Next: 产品负责人继续明确首个 MVP 的具体用户价值、可观察验收标准与非目标；M4
  继续保持 `doing`，不启动实现。

## 2026-08-09 — M2–M3: 接入设计规范并加固命令安全基线

- Done: `c38e7c4` 将 UI 类任务路由到 `DESIGN.md` 第 14 节验收入口；抽取固定命令
  allowlist 决策并增加精确签名与拒绝执行测试；README 同步实际覆盖。
- Evidence: `cargo test --manifest-path src-tauri/Cargo.toml project_command` → 2 passed,
  0 failed；`npm run check` → exit 0，Rust tests 11 passed、Vite 1583 modules
  transformed，并生成 `src-tauri/target/debug/bundle/macos/Habitat.app`。
- Next: 明确正式 MVP 的首个产品目标、可观察验收标准和非目标。
- Watch out: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` 在本轮之前的
  Rust 文件上已有格式差异；本轮未扩大为全仓格式化，也未把这个已失败命令加入 gate。

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
