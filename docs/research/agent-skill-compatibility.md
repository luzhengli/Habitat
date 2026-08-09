# 项目级 Agent Skills 兼容性调研

日期：2026-08-09

## 结论

Habitat 可以保持 Agent-agnostic，但不能把 `.agents/skills` 当成所有 Agent 的唯一项目级
发现路径。

推荐采用两层契约：

1. Store 中的源内容遵循 Agent Skills 开放格式，保持一份 `SKILL.md` 与配套资源；
2. 项目侧通过版本化 adapter 将同一源 skill 以相对符号链接暴露到各 Agent 的真实发现
   目录。

对当前明确提到的三个 Agent，首个兼容集合应至少覆盖：

- `.agents/skills/<name>`：Codex、Pi，以及多种采用通用目录的 Agent；
- `.claude/skills/<name>`：Claude Code。

Pi 当前也原生支持 `.pi/skills`，但其第一方文档同时明确支持项目 `.agents/skills`，因此
没有必要默认创建第二份 `.pi/skills` 链接。重复入口还会引入名称冲突、重复展示与解除
语义问题。

## 标准只统一内容，不统一安装位置

[Agent Skills specification](https://agentskills.io/specification) 规定了 skill 目录、
`SKILL.md`、frontmatter 与可选 `scripts/`、`references/`、`assets/`，但没有定义宿主
Agent 必须从哪个项目目录发现 skills。

因此需要严格区分：

- 内容兼容：多个 Agent 能理解同一个 skill 目录；
- 发现兼容：这些 Agent 是否会扫描同一个项目路径；
- 执行兼容：skill 使用的工具名、frontmatter 扩展和运行环境是否在各 Agent 中成立。

Habitat 当前只解决了内容存储和 `.agents/skills` 发现路径的一部分，尚不能据此承诺完整
的跨 Agent 兼容。

## 当前兼容矩阵

| Agent | 官方项目级路径 | `.agents/skills` | 相对 skill 目录 symlink | 非 Git 目录 |
| --- | --- | --- | --- | --- |
| Codex 0.139.0 | `.agents/skills` | 原生支持 | 官方明确支持 | 本机 CWD 夹具已验证；非 Git 父级扫描未见官方承诺 |
| Claude Code 2.1.207 | `.claude/skills` | 官方未支持 | 官方文档未明确保证，需纳入版本 QA | 起始目录应可用；非 Git 父级边界未验证 |
| Pi 0.81.1 | `.pi/skills`、`.agents/skills` | 原生支持 | 本机安装源码会跟随目录 symlink | 官方明确扫描到 Git 根；非 Git 时扫描到文件系统根 |

### Codex

[OpenAI 官方 Build skills 文档](https://learn.chatgpt.com/docs/build-skills) 明确说明：

- 仓库级 skills 位于从 CWD 到 repository root 各层的 `.agents/skills`；
- Codex 支持 symlinked skill folders，并在扫描时跟随目标；
- skill 内容建立在开放 Agent Skills 标准上。

本机额外使用 `codex-cli 0.139.0` 的 `codex debug prompt-input` 做了只读验证：在一个
不含 `.git` 的临时项目 CWD 中，Codex 成功发现 Habitat fixture 创建的三个
`.agents/skills/<name>` 相对符号链接，并把真实 Store 内的 `SKILL.md` 路径放入可见
skills 列表。这证明当前版本至少支持非 Git CWD；不把这项结果外推为所有版本的非 Git
父目录扫描保证。

### Claude Code

[Claude Code 官方 Skills 文档](https://code.claude.com/docs/en/skills) 只声明以下本地
发现位置：

- 个人：`~/.claude/skills/<name>/SKILL.md`；
- 项目：`.claude/skills/<name>/SKILL.md`；
- 从启动目录向 repository root 扫描父级 `.claude/skills`，并按需发现更深目录。

该文档同时说明 Claude Code 遵循 Agent Skills 开放标准，但没有声明会扫描
`.agents/skills`。本机 `Claude Code 2.1.207` 可执行文件中的路径文本也只出现
`.claude/skills`，没有发现 `.agents/skills`；这只是辅助证据，产品合同仍以官方文档
为准。

Claude 官方文档没有明确承诺项目 skill 目录 symlink。生态工具普遍采用逐 skill
symlink，但 Habitat 在对外承诺 Claude 支持前，仍应对选定 Claude Code 版本做真实
启动验收，覆盖有效链接、失效链接、热更新与解除链接。

### Pi

[Pi 第一方 Skills 文档](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md)
明确列出：

- 全局：`~/.pi/agent/skills` 与 `~/.agents/skills`；
- 项目：`.pi/skills` 与 CWD/父目录中的 `.agents/skills`；
- 在 Git 项目中扫描到 repo root，非 Git 目录中扫描到 filesystem root；
- 项目资源只在项目被信任后加载。

本机 `Pi 0.81.1` 的已安装源码还明确对目录 symlink 调用 `stat` 跟随目标，并用
canonical real path 去重。因此 Habitat 当前 `.agents/skills` 链接已覆盖 Pi，不必为了
Pi 再创建 `.pi/skills` 链接。

## `npx skills` 不是运行时真相来源

[Vercel Labs skills CLI](https://github.com/vercel-labs/skills) 维护自己的 agent path
registry，并推荐把一份 canonical skill 以 symlink 暴露给多个 Agent。其当前映射是：

- Codex → `.agents/skills`；
- Claude Code → `.claude/skills`；
- Pi → `.pi/skills`。

本机缓存版本为 `skills 1.5.22`。在同一个 Habitat 临时 fixture 中直接执行其
`list --project --json`，三个 `.agents/skills` 项目 skill 被列为 Codex、Cursor、
Gemini CLI、GitHub Copilot、OpenCode 等可见，但没有列出 Claude Code 或 Pi。

Pi 第一方运行时实际上支持 `.agents/skills`，说明 CLI registry、CLI 输出 schema 与
真实 Agent 能力会发生漂移。Habitat 可以保留 `npx skills` 作为辅助诊断，但不得用它
决定安全写入目标或宣告某个 Agent 一定可用。

## 对 Habitat MVP 的建议

### 1. Store 保持 Agent-agnostic

- Store 只保存一份 skill 源目录；
- 不复制、不改写 Agent 专用 frontmatter；
- 使用 Agent Skills 标准的严格公共子集做基础校验；
- 对 `allowed-tools`、Claude 扩展字段、`agents/openai.yaml` 等实现差异只做兼容诊断，
  不静默转换。

### 2. 项目安装改为 adapter 集合

把一次“安装到项目”建模为一个 logical installation，下面包含一个或多个 target link：

```text
Store/<skill>
  ├── project/.agents/skills/<skill>  # common adapter: Codex + Pi + others
  └── project/.claude/skills/<skill>  # Claude Code adapter
```

首个 MVP 可只实现两个 adapter：`common-agents` 与 `claude-code`。未来再通过显式、
版本化 registry 增加其他 Agent 路径，不能把外部 CLI 的动态列表直接变成可写路径。

### 3. 保留现有安全语义

扩展目标目录时，每一个新的容器仍必须沿用当前 canonical path 与 lstat 合同：

- `.claude`、`.claude/skills` 与目标名都必须单独预检；
- 普通文件、真实目录、失效 symlink、未知 symlink 一律阻断；
- 只有确认指向同一 Store source 的已知相对 symlink 才能幂等或解除；
- 多 target 安装必须先完成全量预检，再写入；部分成功状态必须可观察、可恢复，不能
  猜测回滚或删除未知目标。

这会扩大当前路径 schema，按 `AGENTS.md` 边界必须在实现前获得产品目标批准。

### 4. 通用目录不能依赖 Git

- 选择项目的有效性只取决于安全的真实目录，不应要求存在 `.git`；
- Git status/diff 只能是可选诊断；“不是 Git 仓库”应显示为不适用，而不是安装失败；
- Agent 发现验收应从所选项目根启动，并分别覆盖 Git repo 与普通目录 fixture。

### 5. 对用户展示真实覆盖状态

不能再用一个 `.agents/skills` 链接笼统显示“已添加到项目”。建议至少区分：

- 已连接：目标兼容 profile 的所有 link 均正确；
- 部分连接：只有部分 Agent adapter 正确；
- 冲突：任一目标存在未知内容或不安全容器；
- 未连接：所有目标均不存在。

## M4 尚需产品负责人批准的决定

1. 首个 MVP 是否承诺 Codex + Claude Code + Pi 三者均可发现；
2. 默认是否自动启用 `common-agents` + `claude-code` 两个 adapter；
3. 已有 `.agents/skills` 项目升级时，是显示“部分连接”并让用户显式补齐，还是提供一次
   明确确认的兼容性迁移；
4. 多 target 写入第二步失败时，采用保留可观察部分状态，还是只回滚本次新建且已确认
   的链接；
5. 每个受支持 Agent 的最低版本与发布前兼容测试矩阵。

