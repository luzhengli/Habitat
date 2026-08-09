# 项目粒度 Skills 暴露面与首次迁移调研

日期：2026-08-09

## 结论

Habitat 的核心价值不应只表述为“把 Store skill 链接进项目”，而应表述为：

> 让用户知道每个 Agent 在当前项目中实际看到了哪些 skills，并把用户可控的 skills 从
> 默认全局暴露收敛为按项目显式暴露。

这个价值成立，但不能简单宣称“全局 skill 会把完整 `SKILL.md` 都塞进 context”。
Codex、Claude Code、Pi、Cursor 与 Trae 都采用 progressive disclosure：启动时主要暴露
skill 的名称和描述，完整正文只在调用时加载。全局 skill 过多的实际成本包括：

- 每个 skill 的名称和描述仍占用初始 catalog；Agent Skills 集成指南估算每项约
  50–100 tokens；
- 候选过多会增加误触发、同名冲突、错误版本选择和用户选择噪音；
- Codex 会截短或省略超出预算的 catalog 项；
- Claude Code 调用后的正文会留在会话中，Pi 和 Codex 也会在调用时承担完整正文成本；
- 各 Agent 的来源优先级不同，项目链接存在并不等于项目版本实际生效。

因此 Habitat 必须管理“有效暴露面”，不能只管理目录中的链接。

## 调研范围

首个目标兼容矩阵扩展为五个本地 Agent：

- Codex CLI 0.139.0；
- Claude Code 2.1.207；
- Pi 0.81.1；
- Cursor，官方 Skills 功能始于 2.4，但本机 1.2.4 不具备验证条件；
- Trae，官方当前支持项目 Skills，但本机没有可执行 runtime。

结论来自当前官方文档、Pi 本机安装源码和本机只读 inventory。前三个 Agent 有本机版本
证据；Cursor 与 Trae 目前只有路径合同，不能标为 runtime-verified。云端 Agent、团队
分发和其他 Agent 只作为未来 adapter，不外推本轮结论。

## 已验证三个 Agent 的有效 Skills 策略

| 维度 | Codex | Claude Code | Pi |
| --- | --- | --- | --- |
| 用户级来源 | `~/.agents/skills` | `~/.claude/skills` | `~/.pi/agent/skills`、`~/.agents/skills` |
| 项目级来源 | 从 CWD 到 repo root 的各层 `.agents/skills` | 从启动目录到 repo root 的各层 `.claude/skills`；进入子目录后可按需发现更深层 skill | `.pi/skills`；从 CWD 向上到 Git root，非 Git 时到文件系统根的 `.agents/skills` |
| 其他来源 | admin、system、plugins | enterprise、bundled、plugins、`--add-dir` | packages、settings paths、CLI `--skill` |
| 启动 context | 名称、描述、路径；总 catalog 最多 2% context，未知窗口时最多 8,000 字符 | 默认加载名称和描述；单项描述与 `when_to_use` 合计最多 1,536 字符 | XML catalog 中的名称、描述和路径 |
| 正文加载 | skill 被选择后读取完整 `SKILL.md` | skill 被调用后加载，内容在后续会话中保留 | 模型匹配后用 `read` 读取完整 `SKILL.md` |
| 同名处理 | 不合并，两个都可能出现在 selector | enterprise > personal > project > bundled；personal 会遮蔽同名 project skill | first-found 胜出并报告 collision；本机 0.81.1 的资源顺序把 project 放在 user 前 |
| 单项隐藏 | `~/.codex/config.toml` 的 `[[skills.config]] enabled = false`；`agents/openai.yaml` 可关闭隐式调用 | `skillOverrides` 可设 `name-only`、`user-invocable-only`、`off`；frontmatter 可关闭 model invocation | `disable-model-invocation: true` 从系统 prompt 隐藏；settings 支持路径排除 |
| 全部关闭 | 官方本地文档未声明统一的 per-project all-off 开关 | 可 deny `Skill` tool，但这也关闭项目 skills | `--no-skills` 关闭自动发现，显式 `--skill` 仍可加载 |
| skill 目录 symlink | 官方支持 | 2.1.203 起官方支持并按真实目标去重 | 官方文档支持发现；本机源码 canonicalize 后去重 |

### Codex

OpenAI 官方文档明确说明：Codex 从 repository、user、admin 和 system 位置读取 skills；
repository skills 从 CWD 到 repository root 逐层扫描 `.agents/skills`。初始列表只包含
名称、描述和路径，并受 2% context 或 8,000 字符预算约束；超量时先截短描述，仍超量
时可能省略 skill 并警告。

同名 skills 不会合并，因此仅在项目中增加同名链接并不能保证用户级 skill 消失。用户
可以按 `SKILL.md` 路径在 `~/.codex/config.toml` 中逐项禁用，但这是一份 Agent 专用、
会随版本演进的配置，不适合作为 Habitat 唯一的跨 Agent 隔离机制。

### Claude Code

Claude Code 默认暴露 personal、project、plugin、bundled 和可能存在的 enterprise
skills。与 Agent Skills 客户端实现指南推荐的“project 覆盖 user”不同，Claude Code
当前明确采用 enterprise > personal > project > bundled。同名 personal skill 会遮蔽
project skill，这是 Habitat 必须单独模拟的 adapter 语义。

默认情况下 description 在 context 中，完整正文只在调用时加载；调用后的正文会留在
会话中。`disable-model-invocation: true` 或 `skillOverrides` 的
`user-invocable-only`/`off` 可以把 description 移出 context。`skillOverrides` 按名称
生效，不能安全地表达“关闭 personal 的 foo、同时保留 project 的同名 foo”，所以同名
迁移不能只靠设置覆盖。

Claude Code 2.1.203 起正式支持 personal/project skill 目录项为 symlink；当前本机
2.1.207 满足这个最低条件。已有兼容性文档中“官方未明确保证 symlink”的结论已经过时。

### Pi

Pi 默认读取两个用户级目录、两个项目级目录，以及 packages、settings 和 CLI 追加路径。
`--no-skills` 可以关闭自动发现，但这是启动参数，不是某个项目内的持久隔离合同。Pi 只
把未设置 `disable-model-invocation` 的 skill 放入系统 prompt，正文仍按需读取。

Pi 同名时保留 first-found。当前 0.81.1 本机源码的资源收集顺序是 project `.pi`、项目
祖先 `.agents`、user `.pi`、user `.agents`，所以项目版本通常胜出；但这属于版本化实现
行为，Habitat 应显示 winner/loser，而不能把它固化为跨 Agent 通则。

## 新增 Agent 的有效 Skills 策略

| 维度 | Cursor | Trae |
| --- | --- | --- |
| 用户级来源 | `~/.agents/skills`、`~/.cursor/skills`，并兼容 `~/.claude/skills`、`~/.codex/skills` | 国际版 `~/.trae/skills`；中国版 `~/.trae-cn/skills`；启用设置后还可能包含 common root |
| 项目级来源 | `.agents/skills`、`.cursor/skills`，并兼容 `.claude/skills`、`.codex/skills`；还能发现项目子目录中的 nested roots | `.trae/skills`；设置中显式启用后读取 `.agents/skills` |
| 其他来源 | built-in skills；editor、CLI、cloud 的实现可能不同 | built-in skills；UI 创建/导入来源 |
| 启动 context | 名称/描述供 Agent 选择，正文资源按需加载；官方未公开 aggregate catalog 预算 | 摘要先扫描，正文按相关性加载；官方未公开 aggregate catalog 预算 |
| 作用域 | nested root 按目录作用域；`paths` 可按 glob 限制 | 官方当前未声明等价的 path-scoping frontmatter |
| 同名处理 | 官方未声明各 root 的优先级或同 realpath 去重 | `.trae/skills` 胜过 `.agents/skills`；project/user 同名完整顺序未公开 |
| 单项隐藏 | `disable-model-invocation: true` 只保留手动 `/skill` 调用 | project/global skill 可在 UI 禁用；project 状态写入 `.trae/skill-config.json` |
| skill 目录 symlink | 官方未形成稳定合同，历史 IDE/CLI 行为有差异 | 官方未声明，需真实 runtime QA |

### Cursor

Cursor 官方会同时扫描 `.agents`、`.cursor`、`.claude` 和 `.codex` 四组 project/user
roots。对 Habitat 来说，这有两个直接后果：

1. `.agents/skills` 已覆盖 Cursor，不需要新增 `.cursor/skills` adapter；
2. 为 Claude Code 创建的 `.claude/skills` 也会被 Cursor 再次扫描。官方没有保证同一
   canonical target 去重，所以 effective exposure 必须保留两条 route，并在真实 runtime
   验证最终 catalog 是否重复。

Cursor 还会递归发现 nested roots，并根据目录和 `paths` 把 skill 限定到特定文件。因此
“某项目可见”不再是一个简单布尔值；至少要能表达 `available`、`path-conditional` 和
`manual-only`。

### Trae

Trae 原生项目目录是 `.trae/skills`。虽然 3.3.44 起支持 `.agents/skills`，当前官方
文档要求用户先启用对应设置；Habitat 若只创建 common link，就只能报告“路径存在、Trae
覆盖取决于设置”，不能报告“已连接”。

推荐使用原生 `.trae/skills` adapter 获得确定的项目发现路径，同时保持 Agent 配置只读。
国际版与中国版共用项目目录，但用户目录分别为 `~/.trae/skills` 与
`~/.trae-cn/skills`，inventory 与 quarantine 必须按 edition 分开建模。原生目录的
symlink 能力仍待受支持 runtime 验收。

## 本机只读 inventory

本机当前状态恰好展示了为什么需要有效暴露面模型：

- `~/.agents/skills` 有 44 个直接 skill 目录；
- `~/.codex/skills` 除系统目录外还包含本地 skill 和 9 个指回
  `~/.agents/skills` 的 symlink；
- Codex 配置中有 27 个 `enabled = false` 条目，因此磁盘 inventory 与 Codex 的有效
  inventory 不相同；
- `~/.claude/skills` 有 14 个 symlink，全部指向 `~/.agents/skills` 的子集，其中 3 个
  skill 设置了 `disable-model-invocation: true`；
- `~/.pi/agent/skills` 不存在，但 Pi 默认仍会扫描 `~/.agents/skills`，因此其候选集合
  接近全部 44 个，而不是 Claude 的 14 个或 Codex 的已过滤集合；
- `~/.cursor/skills` 不存在，但 Cursor 会扫描已有的 common、Claude 和 Codex 用户目录，
  所以缺少 native root 不代表没有全局 exposure；
- `~/.trae/skills` 与 `~/.trae-cn/skills` 各有 20 个 symlink，全部指向
  `~/.agents/skills` 下的同一组 lark skills；本机没有 Trae runtime，不能判断当前活动
  edition，也不能把 40 条入口误报为 40 个 artifact。

按 Agent Skills 指南的 50–100 tokens/skill 粗略估算，Pi 当前仅 41 个可隐式发现的用户
skill description 就可能占约 2,050–4,100 tokens；这是估算，不替代真实 prompt 测量。
Codex 有自己的更严格 catalog 字符预算，Claude 还会额外包含 bundled/plugin skills。

Habitat 不能把 44 个目录显示成一份统一的“已安装列表”。它至少需要同时展示：

- canonical artifact：真实内容位于哪里；
- exposure：哪个 Agent、哪个 scope、通过哪个路径暴露；
- policy：是否被配置禁用、只允许用户调用或允许隐式调用；
- precedence：同名时谁生效、谁被遮蔽；
- runtime-owned sources：bundled、system、admin、enterprise、plugin 等 Habitat 不管理的
  来源。

## Store 的必要新约束

如果 Store 本身位于 `~/.agents/skills`、`~/.codex/skills`、`~/.claude/skills`、
`~/.cursor/skills`、`~/.pi/agent/skills`、`~/.trae/skills`、
`~/.trae-cn/skills` 或其他已知自动发现根目录下，那么相关 Agent 仍会看到整份 Store，
项目隔离目标从根本上失败。

因此首个 MVP 应新增硬约束：

- Store 必须位于中性目录；建议默认使用
  `~/Library/Application Support/Habitat/Skill Store`，同时允许用户选择其他安全目录；
- Store 的 canonical path 不得等于、位于或包含任何已知 Agent 用户级、项目级、系统级
  discovery root；
- Store 也不应位于某个受管理项目内，避免该项目或 Git 意外携带整个 Store；
- 新增 Agent adapter 时必须同时更新“禁止作为 Store 的 discovery roots”registry；
- local symlink 只承诺本机本地 Agent。远端、cloud session 或其他机器通常无法解析指向
  本机 Store 的链接，不属于首个 MVP 的兼容保证。

## 首次使用的推荐迁移流程

### 1. 只读发现

首次启动先扫描已支持 Agent 的已知用户级根目录和用户选择的项目，不立即移动文件：

- `.agents`、Codex、Claude、Pi、Cursor、Trae 国际版与中国版的已知 roots；
- Agent 专用的禁用/调用策略，只读解析支持的字段；
- `SKILL.md` 格式、目录名、兼容性扩展和 symlink；
- canonical path、内容指纹、同名和同内容关系。

分类不能只按名称：

- 同一 canonical target 的多个链接是同一 artifact 的多个 exposure；
- 不同路径但内容指纹相同的是可去重副本；
- 同名但内容不同的是 variant conflict，禁止自动合并或覆盖；
- 指向 skill 根外部的内部 symlink、失效链接、无法解析 YAML 和缺少 description 的内容
  进入需人工处理状态；
- system/admin/enterprise/bundled/plugin 只报告，不纳入迁移。

### 2. 生成迁移计划

用户为每个 canonical skill 选择：

- 转为项目级管理；
- 明确保留为全局 skill；
- 暂不处理；
- 同名变体中选择 canonical 版本，其他版本进入冲突隔离区。

计划必须预览迁移后的五份“有效集合”，而不仅是文件移动列表：Codex、Claude Code、Pi、
Cursor 与 Trae 各自会看到什么、哪些路径有条件生效、哪些同名项被遮蔽、哪些
runtime-owned skills 仍然存在。

### 3. 导入中性 Store

“安装到项目”仍然只创建链接；但“从旧全局目录导入 Store”必须是独立、显式确认的迁移
事务。推荐流程：

1. 复制到 Store 内的 transaction staging；
2. 不跟随 skill 根外的 symlink，记录链接文本并阻断逃逸目标；
3. 对普通文件内容和 symlink 文本计算清单与指纹；
4. 校验 `SKILL.md` 和目标 Agent 兼容性；
5. 在 Store 内原子 rename 为最终目录；
6. 在任何旧入口变化前，再次确认源与 Store 内容一致。

迁移期间允许暂时存在两个副本；完成隔离后 Store 才成为唯一 canonical source。不能为了
避免临时副本而直接移动唯一源文件，因为中途失败会同时破坏多个 Agent。

### 4. 隔离旧全局入口

“清理全局”在首个 MVP 中不应等于删除。推荐默认行为是：

- 只处理用户逐项确认且已成功导入的 entry；
- 把真实目录或入口 symlink 原样移动到 Habitat 管理、不会被 Agent 扫描的 quarantine；
- symlink 只移动链接本身，绝不沿链接移动目标；
- transaction manifest 记录原路径、lstat 类型、链接文本、canonical target、内容指纹和
  quarantine 路径；
- 任一步失败就停止，不扩大目标、不强制删除；
- 提供从 manifest 恢复原路径的显式 rollback；
- 首个 MVP 不提供永久清空 quarantine。

逐 Agent 改配置可以作为未来的高级模式，但不应成为默认清理方案：五个 Agent 的字段、
优先级和作用范围不同，Trae 的 `.agents` 支持还受设置控制，而且 Cursor 会交叉扫描多组
兼容目录。物理移出所有受支持的自动发现 roots 才是跨 Agent 一致的用户级隔离。

### 5. 建立项目暴露并验证

隔离前必须至少为一个项目建立并验证目标链接：

- `.agents/skills/<name>` 覆盖 Codex、Pi 与 Cursor；
- `.claude/skills/<name>` 覆盖 Claude Code；
- `.trae/skills/<name>` 覆盖 Trae，不依赖 `.agents` 设置；
- 全量预检后才写入，多目标失败采用已批准的安全回滚语义；
- 最终展示 `project expected` 与各 Agent `effective` 的差异；
- Claude/Pi 的 project trust、各 runtime 的重载或重启提示，以及 Cursor/Trae 的未验证
  状态必须可见。

## 对首个 MVP 的修订建议

如果 Habitat 只支持“已有干净 Store → 添加项目链接”，它无法为已经把大量 skills 安装到
全局目录的用户兑现项目隔离价值。因此首个 MVP 至少应增加以下 onboarding 能力：

1. 已支持 roots 的只读 inventory；
2. 五个 Agent 的 effective exposure、过滤、条件开关和同名 winner/loser 解释；
3. Store neutral-path 硬校验；
4. 将用户选定的既有 skill 导入 Store；
5. 可选、逐项确认、可回滚的用户级 quarantine；
6. 导入后立即为至少一个项目建立所选 Agent 的最小 adapter 覆盖集；
7. 迁移前后 effective set 与 catalog 大小的测量。

首个 MVP 继续不做：

- 永久删除原 skills 或 quarantine；
- 自动合并、改写或重命名同名变体；
- 修改 Store 中已经存在的 skill 内容；
- 管理 system、admin、enterprise、bundled 或 plugin skills；
- 承诺“Agent context 中只有 Habitat 项目 skills”；运行时自带 skills 仍会存在；
- 云端同步、团队分发、跨设备链接修复；
- 为了隔离而包装或接管任一 Agent 的启动命令；
- 静默修改 Trae 的 `.agents` 开关或其他 Agent 配置；
- 在未验证的版本上宣称 Cursor/Trae symlink 已受支持。

## Discovery Goal 与价值门槛

修订后的 Discovery Goal：

> 用户可以从当前混乱的多 Agent 全局安装状态出发，把选定 skills 无损收敛到一个中性
> Store，只在目标项目暴露它们，并清楚看到每个 Agent 的最终有效集合。

建议价值门槛：

- Habitat inventory 与五个 Agent 的实际列表在受支持来源上完全一致；
- 同一 canonical skill 的多入口不会被误报为多个独立 skill；
- 同名不同内容永不自动覆盖；
- 迁移后，用户选择“项目级”的 skill 不再从任何受支持用户级 root 暴露；
- 目标项目五个 Agent 均能读取 Store 中的同一 canonical source；
- 另一个未连接项目看不到这些用户管理的 skills；
- rollback 能恢复每个旧入口，内容指纹与迁移前一致；
- 用实际 Agent catalog 或诊断输出测量迁移前后候选数量和 context 占用，不只使用理论
  token 估算。

如果只能创建项目链接，却不能解释或隔离旧全局暴露，MVP 不应宣称已经实现“项目粒度
Skills 管理”。

## 实现前仍需批准的高成本决定

前一轮已批准：对 Codex、Claude Code、Pi 默认启用 `.agents/skills` +
`.claude/skills`；多目标中途失败时安全回滚，否则报告部分状态。本轮已确认兼容范围扩展
到 Cursor 与 Trae，但这会重新打开默认 adapter 的产品决策。

本轮新增、尚未批准：

1. 首个 MVP 是否包含“既有用户级 skills 导入 + 可回滚 quarantine”；
2. 是否接受 Store 导入作为独立迁移事务，可复制到 staging，但安装到项目仍严格禁止复制；
3. 默认 Store 是否使用 `~/Library/Application Support/Habitat/Skill Store`，并拒绝所有
   已知 discovery root；
4. 首个 MVP 是否完全不改 Agent 配置，只读解释配置并通过物理隔离获得跨 Agent 一致性；
5. 对同名不同内容是否统一采用“选择一个 canonical，其余只隔离不改写”的策略。
6. 是否以“所选 Agent 的最小覆盖集”取代固定双 adapter；五个 Agent 全选时加入
   `.trae/skills`；
7. Cursor 与 Trae 必须完成真实 runtime QA 才能进入正式 MVP，还是可先以明确的 Beta/
   有条件状态交付；
8. Trae 国际版与中国版是否都进入首发 inventory，还是只启用检测到的 edition。

## 主要来源

- [OpenAI Build skills](https://learn.chatgpt.com/docs/build-skills)
- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [Claude Code context management](https://code.claude.com/docs/en/how-claude-code-works)
- [Pi Skills](https://pi.dev/docs/latest/skills)
- [Cursor Agent Skills](https://cursor.com/docs/skills)
- [Cursor 2.4 changelog](https://cursor.com/changelog/2-4)
- [Trae Skills](https://docs.trae.cn/ide_skills)
- [Trae changelog](https://www.trae.cn/changelog)
- [Agent Skills specification](https://agentskills.io/specification)
- [Agent Skills client implementation guide](https://agentskills.io/client-implementation/adding-skills-support)
