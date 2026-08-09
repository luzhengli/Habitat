# 项目级 Agent Skills 兼容性调研

日期：2026-08-09

## 结论

Habitat 可以保持 Agent-agnostic，但不能把 `.agents/skills` 当成所有 Agent 的唯一项目级
发现路径，也不能把“路径被官方扫描”直接等同于“Habitat 的跨目录 symlink 已验证可用”。

首个兼容范围现为 Codex、Claude Code、Pi、Cursor、Trae。推荐采用三层契约：

1. Store 中只保留一份符合 Agent Skills 公共格式的 canonical skill；
2. 由版本化 adapter registry 声明每个 Agent 的发现路径、配置条件和验证版本；
3. 按用户选择的 Agent 计算最小项目目标集，而不是为每个 Agent 机械创建一份链接。

五个 Agent 全部启用时，最小覆盖集是：

```text
Store/<skill>
  ├── project/.agents/skills/<skill>  # Codex + Pi + Cursor
  ├── project/.claude/skills/<skill>  # Claude Code；Cursor 也会扫描
  └── project/.trae/skills/<skill>    # Trae，不依赖 .agents 开关
```

Cursor 不需要新增 `.cursor/skills` adapter。Trae 虽能兼容 `.agents/skills`，但官方当前
要求用户先打开“启用 .agents skills directory”；Habitat 若要承诺开箱即用的 Trae
覆盖，应使用原生 `.trae/skills` adapter，且不静默修改该开关。

## 标准只统一内容，不统一安装位置

[Agent Skills specification](https://agentskills.io/specification) 规定了 skill 目录、
`SKILL.md`、frontmatter 与可选 `scripts/`、`references/`、`assets/`，但没有定义宿主
Agent 必须从哪个项目目录发现 skills。

因此需要分别验证：

- 内容兼容：Agent 是否理解同一份 skill 内容；
- 发现兼容：Agent 是否扫描目标路径；
- 链接兼容：IDE、CLI 与 cloud runtime 是否跟随跨目录 symlink；
- 执行兼容：工具名、frontmatter 扩展和运行环境是否成立；
- 有效暴露：配置、路径作用域、重名优先级和内置来源后，Agent 实际看到什么。

## 当前兼容矩阵

| Agent | 官方项目级路径 | `.agents/skills` | Habitat 相对目录 symlink | 当前验证级别 |
| --- | --- | --- | --- | --- |
| Codex 0.139.0 | `.agents/skills` | 原生 | 官方支持 | 本机 runtime 已验证 |
| Claude Code 2.1.207 | `.claude/skills` | 未声明 | 2.1.203 起官方支持并按真实目标去重 | 本机版本满足，待端到端验收 |
| Pi 0.81.1 | `.pi/skills`、`.agents/skills` | 原生 | 本机源码跟随并 canonicalize | 本机源码与 fixture 已验证 |
| Cursor | `.agents/skills`、`.cursor/skills`，兼容 Claude/Codex 路径 | 原生 | 官方未形成稳定合同；IDE/CLI 曾有差异 | 路径兼容，runtime 待验证 |
| Trae | `.trae/skills`；可选 `.agents/skills` | 需设置开关 | 官方未明确 symlink 语义 | 路径兼容，runtime 待验证 |

这里的“路径兼容”只表示官方声明会扫描该目录，不是发布级兼容承诺。Cursor 与 Trae 在
选定受支持版本完成真实相对链接验收前，UI 必须显示“未验证/有条件”，不能显示“已支持”。

### Codex

[OpenAI 官方 Build skills 文档](https://learn.chatgpt.com/docs/build-skills) 明确说明：

- repository skills 位于从 CWD 到 repository root 各层的 `.agents/skills`；
- Codex 支持 symlinked skill folders，并在扫描时跟随目标；
- skill 内容建立在开放 Agent Skills 标准上。

本机额外使用 `codex-cli 0.139.0` 的 `codex debug prompt-input` 做了只读验证：在一个
不含 `.git` 的临时项目 CWD 中，Codex 成功发现 Habitat fixture 创建的三个
`.agents/skills/<name>` 相对符号链接，并读取真实 Store 内的 `SKILL.md`。

### Claude Code

[Claude Code 官方 Skills 文档](https://code.claude.com/docs/en/skills) 声明个人目录
`~/.claude/skills` 与项目目录 `.claude/skills`，没有声明扫描 `.agents/skills`。

Claude Code 2.1.203 起正式支持 personal/project skill 目录项为 symlink，并对同一真实
目标去重。本机 2.1.207 满足最低条件，但 Habitat 仍需覆盖有效链接、失效链接、重载与
解除链接的真实启动验收。

### Pi

[Pi 第一方 Skills 文档](https://pi.dev/docs/latest/skills) 列出：

- 全局：`~/.pi/agent/skills` 与 `~/.agents/skills`；
- 项目：`.pi/skills` 与 CWD/父目录中的 `.agents/skills`；
- Git 项目扫描到 repo root，非 Git 目录扫描到 filesystem root；
- 项目资源只在项目被信任后加载。

本机 `Pi 0.81.1` 源码对目录 symlink 调用 `stat`、按 canonical real path 去重。因此
`.agents/skills` 已覆盖 Pi，不需要默认创建 `.pi/skills` 链接。

### Cursor

[Cursor 官方 Skills 文档](https://cursor.com/docs/skills) 当前声明：

- 项目级自动扫描 `.agents/skills`、`.cursor/skills`，并兼容 `.claude/skills`、
  `.codex/skills`；用户级也扫描对应四组目录；
- skill 资源按需加载，`disable-model-invocation` 可禁止自动调用；
- 递归发现项目内的 `SKILL.md`，嵌套 skill root 会按所在目录限制作用域；`paths`
  frontmatter 还会进一步限制文件匹配范围；
- Cursor 自带的 skills 由 runtime 管理，仍会与用户 skills 一起出现。

[Cursor 2.4 changelog](https://cursor.com/changelog/2-4) 是 Skills 在 editor 和 CLI 中的
功能起点。因此 2.4 是“功能存在”的版本下限，但不是 Habitat 的发布下限。本机 Cursor
仍是 1.2.4，无法验证 Skills。

symlink 需要单独做版本化 QA。Cursor 2.4 的
[官方社区已确认过 symlink 已知问题](https://forum.cursor.com/t/cursor-doesnt-follow-symlinks-to-discover-skills/149693)，
后续又出现过 IDE 与 CLI 行为不一致的
[可复现报告](https://forum.cursor.com/t/discovery-of-symlinked-skills-not-working-for-all-cases-in-cli/163569)。
社区员工在最新 CLI 上无法复现后一问题，但这仍不是跨 runtime 的稳定合同。

另一个盲点是重复入口：Cursor 同时扫描 `.agents/skills` 与 `.claude/skills`，而 Habitat
为了 Claude Code 必须创建后者。官方没有声明同一 realpath 的去重或同名优先级，所以
Cursor adapter 必须把“两条路径指向同一 artifact”作为显式测试，不得假设只展示一次。

### Trae

[Trae 官方 Skills 文档](https://docs.trae.cn/ide_skills) 当前声明：

- 项目原生目录为 `.trae/skills`；中国版用户目录为 `~/.trae-cn/skills`；
- project/global skill 可在 UI 中启用或禁用；项目禁用状态写入
  `.trae/skill-config.json`，global 禁用状态的存储合同未公开；
- `.agents/skills` 需要用户在“设置 → Skills & Commands”中显式启用；
- `.trae/skills` 与 `.agents/skills` 同名时，原生 `.trae/skills` 优先；
- Skills 按相关性加载，也可手动调用；内置 skills 不属于 Habitat 管理范围。

[Trae 官方 changelog](https://www.trae.cn/changelog) 显示 3.3.44 才加入
`.agents/skills` 自动加载。当前文档又把它定义为设置控制的能力，因此 Habitat 不能仅凭
目录存在判断 Trae 已覆盖。

国际版与中国版用户目录必须作为两个 edition profile：官方社区当前给出的路径分别是
`~/.trae/skills` 和 `~/.trae-cn/skills`。本机两者都存在，且各有 20 个指向
`~/.agents/skills` 的 symlink，但没有可执行的 Trae app/CLI，无法证明哪一版 runtime
正在使用。项目路径两版都使用 `.trae/skills`。

Trae 官方文档没有明确承诺 skill 目录 symlink。Habitat 采用原生 adapter 后仍必须在
受支持版本验证：跨项目 Store 相对链接、失效链接、重启、禁用状态、同名优先级与解除。

## Adapter registry，而不是固定路径列表

建议每个 adapter 至少记录：

- `agent_id`、edition、最低/已验版本；
- project roots、user roots、额外来源；
- 是否需要配置开关或 project trust；
- symlink 与 realpath 去重能力；
- 同名优先级、作用域条件和 runtime-owned 来源；
- reload/restart 要求与验证证据日期。

安装计划根据所选 Agent 做最小集合覆盖：

| 用户选择 | 项目目标 |
| --- | --- |
| Codex、Pi、Cursor 的任意组合 | `.agents/skills` |
| 包含 Claude Code | 追加 `.claude/skills` |
| 包含 Trae | 追加 `.trae/skills` |

这比“每个 Agent 一个链接”更少重复，也比固定“双 adapter”更能表达实际支持范围。若用户
只选择 Trae，Habitat 不应额外创建 `.agents` 或 `.claude`。

## 对首次迁移的影响

要保证迁移后不再全局暴露，inventory 与 quarantine 必须覆盖每个已支持 user root：

- common/Codex/Claude/Pi：`~/.agents/skills`、`~/.codex/skills`、
  `~/.claude/skills`、`~/.pi/agent/skills`；
- Cursor：再加 `~/.cursor/skills`，并注意它还扫描前述 common/Claude/Codex roots；
- Trae 国际版与中国版：分别加 `~/.trae/skills`、`~/.trae-cn/skills`。

同一 canonical target 可能从多个 root 暴露；quarantine 需要移动全部选中入口，少移动
一个就不能宣称该 skill 已从对应 Agent 的全局 catalog 中消失。Store 自身也必须拒绝
位于这些 discovery roots 的等于、祖先或后代路径。

## 版本与发布门槛

当前可作为测试基线的本机版本：Codex 0.139.0、Claude Code 2.1.207、Pi 0.81.1。

新增两个 Agent 的状态是：

- Cursor：2.4 仅是功能下限；本机 1.2.4 不支持，发布下限待当前版本真实 QA 后确定；
- Trae：3.3.44 是 `.agents` 兼容功能下限；原生 `.trae/skills` 的发布下限与 symlink
  合同仍待真实 QA；本机无 runtime。

因此首个 MVP 可以现在承诺“五 Agent 是目标兼容范围”，但在 QA 完成前不能承诺五者均为
runtime-verified。UI 和文档应分开显示 `targeted`、`path-compatible`、
`runtime-verified`。

## 实现前的决定

已确认：

1. 兼容范围扩展为 Codex、Claude Code、Pi、Cursor、Trae；
2. 多目标中途失败时，只回滚本事务创建且仍符合预期的链接，否则保留并报告部分状态。

仍需产品负责人批准：

1. 是否以“所选 Agent 的最小覆盖集”取代固定 `.agents + .claude` 默认；
2. Trae 是否默认使用原生 `.trae/skills`，从而不修改或依赖 `.agents` 设置开关；
3. Cursor 与 Trae 在真实 runtime QA 完成前，是以 Beta/有条件支持进入 MVP，还是阻断发布；
4. 是否要求 Cursor 对 `.agents` 与 `.claude` 同源双入口完成去重验收；若不去重，产品如何
   展示和告警；
5. Trae 国际版与中国版是否都进入首发 inventory，还是按检测到的 edition 启用。

## 主要来源

- [Agent Skills specification](https://agentskills.io/specification)
- [OpenAI Build skills](https://learn.chatgpt.com/docs/build-skills)
- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [Pi Skills](https://pi.dev/docs/latest/skills)
- [Cursor Agent Skills](https://cursor.com/docs/skills)
- [Cursor 2.4 changelog](https://cursor.com/changelog/2-4)
- [Trae Skills](https://docs.trae.cn/ide_skills)
- [Trae changelog](https://www.trae.cn/changelog)
