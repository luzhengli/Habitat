# Journal

最新记录在最上方；每个 session 一条。超过约 150 行时，将最新五条之前的内容压缩到
Digest。

## 2026-08-12 — M9: Recovery 改为无项目侧栏的全局审计

- Approval: 产品负责人拒绝此前三份整笔恢复视觉稿，纠正其信息架构：Recovery 可能影响
  所有项目，必须检查所有项目的链接情况；项目只是审计对象，Recovery 页面不展示项目侧栏，
  也不存在“当前项目”。
- Scope interpretation: “所有项目”暂定义为 Habitat 持久化注册表中的全部已纳管项目，不做
  无边界全盘扫描；每个注册项目必须得到明确的可访问性和相关链接检查结果。路径缺失、权限
  不足、不可读或其他未知状态与相关 Store 链接一样，都会阻断整笔恢复。
- Architecture gap: 当前项目清单只在 WebView local storage 持久化，再由前端作为
  `managedProjects` 传给 Rust。现有 `find_managed_links_to_sources` 可以安全扫描给定集合，
  但后端无法证明调用方没有漏传项目；生产执行前需要后端直接读取的 durable authoritative
  managed-project registry，不能把 caller-supplied list 当作全量证据。
- Reaction prototypes: 新增无项目侧栏、相同 4 项目 / 3 相关链接 / 1 不可访问项目 fixture 的
  三份 1440×1024 原型：`recovery-global-overview-v1.png`（A，全局影响概览）、
  `recovery-global-matrix-v1.png`（B，项目影响矩阵，推荐）和
  `recovery-global-guided-v1.png`（C，引导式全局审计）。三稿均显示全量覆盖状态、未知即阻断、
  不自动删除项目链接和唯一禁用恢复动作，无 Skill 选择或逐项恢复。
- Visual QA: 三张 PNG 已按原始 1440×1024 尺寸检查，内容无裁切；Quiet Native token、单一
  珊瑚红语义和 macOS 全局工具页结构保持一致。
- Safety: 本轮只修改原型与 harness 文档，未修改生产 React/Rust、真实 Skill Store、项目
  链接或 Agent 配置；现有未跟踪 `.agents/` 继续不触碰。
- State: 等待产品负责人从新的全局 A/B/C 中选择；选择前不得新增注册表 schema 或实现生产
  Recovery UI。M9 保持 `doing`。

## 2026-08-12 — M9: 确认整笔 Recovery 合同并完成安全后端

- Approval: 产品负责人纠正并确认侧栏 Recovery 是一次性撤销整笔首次迁移，不需要用户
  选择 Skills；若任何受管项目仍链接待移除的 Store 内容，则全量阻断且不自动删除项目链接。
  上一条 Journal 的逐项恢复合同与三份 `recovery-*-v1.png` 原型已废弃，只保留为决策历史。
- Recovery model: 一次确认恢复全部仍在 recovery 的原用户目录/symlink，移除全部仍为
  `imported` 且指纹一致的本事务 Store 内容，并在成功后回到首次设置；任何文件、目标路径、
  transaction 或项目链接阻断都会在写入前停止整笔操作。
- Backend: `discover_recovery_transaction` 从 Store `.habitat/transactions` 发现唯一仍包含文件
  变更的首次迁移 manifest，忽略 `.project.json` 与已 rolled-back/无变更记录；多个有效事务
  拒绝自动选边。重启恢复会复验 manifest schema/id/store、真实事务文件、Store direct child、
  recovery transaction root、真实 original parent 和当前 Agent registry roots。
- Project boundary: `find_managed_links_to_sources` 只扫描 `.agents/.claude/.trae` 三个 Habitat
  adapter 目标，按 canonical target 识别仍依赖本事务 Store import 的相对链接；无关链接与
  普通文件不被当成依赖，也不会被修改。`inspect_recovery_command` 持有检查结果，
  `execute_recovery_command` 在调用既有 exact rollback 前重新发现并预检同一事务。
- Tests: 新增 6 个 fixture 覆盖重启后事务发现、多个有效事务、manifest 越界、仅识别相关
  项目链接、链接存在时整笔阻断/解除后成功回滚，以及篡改后的未知用户 root 阻断。全部使用
  `TempDir`，Rust 共 42 tests passed。
- Prototypes: 新增同一整笔合同的 1440×1024 三稿：
  `recovery-transaction-summary-v1.png`（事务摘要 + 检查器，推荐）、
  `recovery-transaction-report-v1.png`（事务报告）和
  `recovery-transaction-guided-v1.png`（三步引导）；三稿均无 Skill 选择或逐项恢复操作。
- Gate: `npm run check` → exit 0；Rust 42 passed、Vite 1595 modules transformed，并生成 debug
  `Habitat.app`。
- Safety: 未读取或修改真实 Skill Store、项目链接或 Agent 配置；现有未跟踪 `.agents/`
  继续不触碰。
- State: 后端安全边界完成；等待产品负责人从 A/B/C 中选择整笔恢复视觉方向，确认前不得实现
  生产 Recovery React UI。M9 保持 `doing`。

## 2026-08-12 — M9: 侧栏 Recovery 功能进入原型确认

- Root cause: 项目页 `StoreNav` 中的“恢复”只有静态按钮，没有事件、页面状态或 API 调用；
  已有 `rollback_first_run_migration_command` 又只接受当前进程内的整笔首次迁移记录，不能
  直接承担重启后、项目已连接状态下的常驻 Recovery 入口。
- Product boundary: 侧栏 Recovery 默认采用逐项 `恢复原入口`：重新执行 lstat/identity、
  link text、fingerprint 和原目标缺失预检后，只把对应用户级目录或 symlink 从 recovery 移回
  原位置；Store canonical 内容、现有项目相对链接和 Agent 设置保持不变。整笔首次迁移回滚
  是独立高级操作，不能成为侧栏按钮的隐式行为。
- Prototypes: 新增同一 43 Skills / 2 recovery entries fixture 的三份 1440×1024 静态方向：
  `recovery-ledger-v1.png`（三栏恢复账本，推荐）、`recovery-timeline-v1.png`（事务时间线）和
  `recovery-guided-v1.png`（三步引导恢复）；共同覆盖可恢复、原路径占用阻断和已恢复状态。
- Review: 三稿均保持 Quiet Native、单一珊瑚红主动作、真实状态文字与 Store 级导航；原图
  检查无裁切，尺寸均为 1440×1024。方向、共享行为合同和风险记录在
  `docs/prototypes/mvp/recovery-directions.md`。
- Safety: 本轮只修改原型与 harness 文档，未修改 `src/`、`src-tauri/`，未读取或变更真实
  Skill Store、项目链接或 Agent 配置；现有未跟踪 `.agents/` 继续不触碰。
- State: 等待产品负责人明确选择 A/B/C 并确认逐项恢复合同；确认前不得进入生产 UI 或命令
  实现。M9 保持 `doing`。

## 2026-08-12 — M9: 开始实现项目 Skills 状态分组

- Approval: 产品负责人从三份原型中选择可折叠分组方案，并进一步确认删除筛选下方的
  “记住折叠状态”整行及两个分组右侧的“收起”文字；最终视觉目标为
  `docs/prototypes/mvp/project-skills-grouped-selected-v1.png`。
- Scope: 项目 Skills 中栏按最近一次验证状态分为“当前可用 / 尚未添加”，前者垂直置顶；
  两组默认展开，左侧 disclosure 箭头独立控制整组 Skills 的隐藏与恢复。搜索和状态筛选
  继续先过滤结果，Agent 点击仍只形成草稿，不改变 adapter、命令或路径安全语义。
- Implementation: `App.tsx` 先按搜索/筛选得到结果，再以最近验证的 `base` 状态归组；空组
  不渲染，分组标题显示结果数量。每组整行按钮提供 `aria-expanded`、`aria-controls` 和独立
  React 状态；`project-grouped` fixture 保持无草稿的 4 / 2 基线。`project.css` 增加 48px
  disclosure 标题、focus ring、箭头旋转和 reduced-motion 覆盖；`DESIGN.md` 已记录稳定规则。
- Browser evidence: 1440×1024 默认态为
  `docs/qa/project-skills-grouped-default.png`，当前可用折叠态为
  `docs/qa/project-skills-grouped-current-collapsed.png`，同图对比为
  `docs/qa/project-skills-grouped-comparison.png`。两组初始均 `aria-expanded=true`；各自折叠
  只隐藏本组并保留另一组，第二次点击恢复。筛选只留下匹配分组；`project-harness` 草稿仍
  留在尚未添加组且出现待应用栏。console 为 0 warnings / 0 errors。
- Visual QA: `design-qa.md` 新增本切片证据与五项 fidelity surface，`final result: passed`；
  没有 P0/P1/P2，保留真实图标/既有行状态语义作为已接受的 P3 实现差异。
- Gate: `npm run check` → exit 0；Rust 36 passed、Vite 1595 modules transformed，并生成
  debug `Habitat.app`。
- Safety: 本轮不发布、不修改真实项目或 Skill Store；开发态视觉和交互只使用现有
  `project-*` fixture。工作树已有未跟踪 `.agents/`，属于用户内容，本轮不触碰。
- State: 状态分组切片完成；M9 继续 `doing`，仍等待发布目标、签名/分发方式和发布范围确认。

## 2026-08-11 — M9: 修复重复 Recovery 并精确回滚真实事务

- Root cause: Codex/Pi/Cursor 等 adapter 会把共享 discovery root 分别记为 Agent route；
  inventory 应保留这些语义 route，但 `build_import_plan` 错把每条 route 都变成物理 Recovery
  操作。真实计划含 212 次移动但只有 104 个唯一入口，第二次移动同一路径时源已不存在。
- Fix: 迁移计划按 canonical `originalPath` 合并一致的物理操作；重复 route 的 entry kind、
  lstat identity、link text 或 fingerprint 任一不一致即返回
  `duplicate_recovery_conflict`，不会静默选边。inventory 的多 Agent route 保持不变。
- TDD: 新增重叠三 Agent roots 的完整迁移与 rollback 回归，以及冲突重复 route 的计划阻断
  回归。红测先证明 3 条 route 产生 3 次移动，再收敛为 1 次安全移动。
- Evidence: `npm run check` → exit 0；Rust 36 passed、Vite 1595 modules transformed，并
  生成 debug `Habitat.app`。Checkpoint `8a7858b` 保存正式修复与测试。
- Real rollback: 用户明确授权后，只对事务
  `2a2efc9c-18b6-46c7-a97b-bea1fe8f08c4` 调用 `rollback_transaction`；内核在写入前复验
  Store identity、43 个导入指纹、2 个 Recovery identity/link text 和原路径缺失状态。
- Result: manifest 为 `rolled_back`；43 imports 均为 `rolled_back`，2 recoveries 为
  `restored`、其余 210 个从未执行且保持 `pending`。两个原 symlink 以原 inode 和目标恢复，
  Store 顶层无 canonical Skill，当前事务的 staging/recovery 容器均为空。
- State: 两个已知迁移 blocker 均解除，M9 继续 `doing`；下一步可用新 debug App 从全新扫描
  重新执行首次迁移。

## 2026-08-11 — M9: 修复首次迁移内部 symlink 权限误报

- Root cause: `github-trending` 的 Python venv 含 4 个 `0700` 内部 symlink；staging 使用
  macOS 默认 `0755` 重建链接，而 v1 指纹包含 lstat mode，导致内容与链接文本相同仍触发
  `staging_verification_failed`。两次真实失败事务都稳定停在第 6 个 Skill。
- Fix: `copy_tree` 创建内部链接后通过 `fchmodat(AT_SYMLINK_NOFOLLOW)` 恢复源 mode；继续
  使用 `habitat-tree-v1` 完整指纹，不忽略权限、不跟随或修改链接目标，也不放宽路径边界。
- Regression: 新增确定性临时 fixture，锁定 `0700` 内部链接可以完成扫描、staging、Store
  导入、Recovery 移动、最终指纹验证和完整 rollback，恢复后的入口与 symlink mode 均一致。
- Real-world QA: 将真实 `github-trending` 作为只读源复制到 `TempDir`；2,534 个条目和 4 个
  symlink 指纹一致，临时克隆完成完整迁移及 rollback。真实用户级 Skill 未移动或修改。
- Evidence: `cargo test` → 34 passed；`npm run check` → exit 0，Rust 34 passed、Vite 1595
  modules transformed，并生成 debug `Habitat.app`。
- Safety: `/Users/luyao/Project/my-skills` 的两份旧事务仍为 `failed_partial`，各 5 staged、
  0 imported、0 quarantined；本轮未清理或修改真实 Store，旧记录不阻断新的唯一事务。
- Checkpoint: `dbff086` 保存 symlink mode 修复、回归测试、依赖锁定与 M9 状态。
- State: M9 继续 `doing`；迁移发布阻断项已解除，下一步回到发布目标、签名/分发方式和范围
  确认。

## 2026-08-10 — M8→M9: 完成项目 Skills V2 与 MVP QA

- UI: 用产品负责人确认的 V2 替换旧项目 Spike。三栏工作台使用真实小尺寸 Agent 图标；
  Codex/Pi/Cursor 同步切换共享入口，Claude Code 与 Trae 独立切换；点击只形成项目草稿，
  条件式待应用栏汇总受影响 Skill、添加/移除操作和阻断数。
- Flow: 新增添加项目确认层，先选择项目和 Agent 管理范围并明确暂不创建链接；新增独立项目
  设置确认层，按添加/移除分组展示真实目标。dirty project 切换被阻止，项目与 Agent 范围
  保存到本地 WebView 存储。
- Backend: 注册 inspect/plan/apply/rollback 项目命令。前端只提交 Store Skill 名称和 Agent
  选择；Rust 从当前 Store scan 解析源路径、持有计划/manifest，并要求 transaction id 精确
  匹配，实际写入继续复用 M7 的 canonical path、lstat、全量预检和相对链接事务。
- Fixture: 新增 command-boundary 临时目录测试，真实创建 `.agents`、`.claude`、`.trae` 三组
  相对链接，验证五 Agent 均满足，再移除三组链接并证明 Store source 不变；未知 Store 名称
  在计划前阻断。Rust 总计 33 tests。
- Visual QA: `project-skills-v2-comparison-final.png` 在原始 1440×1024 像素并排比较确认稿与
  实现；另有项目确认层、添加项目层和 1024×768 抽屉证据。浏览器完成草稿 → 检查 → 应用，
  pending bar 清空且无 console error；`design-qa.md` 为 `final result: passed`。
- Evidence: `npm run check` → exit 0；Rust 33 passed，Vite 1595 modules transformed，并生成
  debug `Habitat.app`。
- Checkpoint: `efaf495` 保存项目 Skills V2、安全命令、真实 fixture、视觉/交互证据与 DESIGN
  稳定组件规则。
- State: M8 done；M9 doing。MVP 本地实现已完成，尚未批准发布、签名或修改任何真实用户
  项目/Skill Store。
- Next: 先由产品负责人确认发布目标、分发方式和支持范围；批准前只准备决策，不进行外部分发。

## 2026-08-10 — M8: 实现首次设置 F0–F6 与迁移命令

- Backend: 注册仅使用 adapter registry 已知用户 roots 的只读扫描、Store 校验、计划、执行
  与 rollback 命令；snapshot、plan 与 manifest 由 Rust session state 持有，执行/恢复要求
  transaction id 精确匹配。
- Canonical copy: `build_import_plan` 允许同名同指纹副本作为一个逻辑选择，只向 Store 导入
  一份，同时把所有等价 artifact 的旧入口纳入 Recovery；新增临时 fixture 测试锁定该行为。
- UI: 新增无项目上下文的五步首次设置 shell，覆盖扫描、问题优先分组、同名版本选择、Agent
  图标组与 `+n` 浮层、Store 目录选择、迁移确认、执行、完成与撤销。完成后才切入项目页，
  Store 路径与 setup 状态保存在本地 WebView 存储并在后端操作前重新校验。
- Icons: Agent 品牌图标来自无运行时依赖的 `@lobehub/icons-static-svg`；保持约 15px 图形与
  28px 目标，未引入 Lobe UI/Ant Design 依赖。
- QA: 1440×1024 原图/实现并排比较经两轮收敛；修复横向溢出、嵌套交互控件与版本卡层级。
  1024×768 改用 420px 可关闭/重开的检查器抽屉。完整开发 fixture 流程验证选择前禁用、选择
  后放行、29 个导入/40 个恢复移动/2 个保持不变、完成与撤销，fresh tabs 无 console error。
- Evidence: `design-qa.md` → `final result: passed`；`npm run check` → exit 0，Rust 31 passed，
  Vite 1593 modules transformed，并生成 debug `Habitat.app`。
- State: M8 继续 `doing`。首次设置切片已通过；项目管理仍是旧 Spike，尚未达到 M8 完成条件。
- Next: 按已确认的项目 Skills V2 实现 Agent 图标草稿、条件式待应用栏与增量详情，并在临时
  Store/项目 fixture 上补齐 UI 层端到端证据。

## 2026-08-10 — M8: 选择首次设置方案 1 并授权实现

- Approval: 产品负责人从同一“扫描完成后整理 Skills”状态的三份新原型中选择方案 1；选中图
  已归档为 `docs/prototypes/mvp/first-run-organize-selected-v1.png`（1440×1024）。
- Direction: 首次设置使用无项目上下文的五步 shell；主区按“需要你决定 / 可直接整理 /
  暂不导入”分组，右侧一次只处理一个同名差异，底部只有一个页面级操作栏。
- Boundary: Agent 只用小尺寸真实图标组表示，最多 3 个内联并通过浮层显示其余；原始路径、
  fingerprint、adapter、precedence 等只进入技术详情。首次设置不创建项目链接，也不显示项目
  侧栏或项目 Agent 开关。
- State: M8 继续 `doing`；视觉门槛已通过，生产 React/Tauri UI 现在仅对上述首次设置范围和
  先前确认的项目 Skills V2 开放。
- Next: 注册迁移内核的有界命令，先用临时 fixture 接通 F0–F6 与错误恢复，再完成同视口视觉
  QA、完整 gate 和检查点提交。

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
- Checkpoint: `e419ef7` 保存 Claude invocation、用户级 precedence、shadowed exposure 与 M7
  完成状态。
- State: M7 done；Cursor/Trae 继续 `path-compatible`。M8 doing，但首先补齐首次设置的 3 个
  可比较视觉原型，确认前不修改生产 React/Tauri UI。
- Next: 按已批准 IA 与 V2 视觉系统开始首次设置视觉探索。

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
