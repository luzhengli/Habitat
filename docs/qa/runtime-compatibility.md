# Runtime compatibility QA

本文件记录命名版本的真实 runtime 证据。路径被扫描、Skill 被注册、模型成功调用和发布级
`runtime-verified` 是不同结论；任何外部阻断都不能被换算成通过。

## 2026-08-10

### 本机版本

| Agent | 命令结果 | 本轮结论 |
| --- | --- | --- |
| Codex | `codex-cli 0.139.0` | 版本与既有已验证 fixture 基线一致。 |
| Claude Code | `2.1.207` | 相对 symlink、调用、去重、冲突 precedence 与 unlink/reload 已验证。 |
| Pi | `0.81.1` | 版本与既有源码和 fixture 基线一致。 |
| Cursor | 未安装 | 继续保持 `path-compatible`。 |
| Trae | 未安装 | 继续保持 `path-compatible`。 |

### Claude Code 2.1.207 相对 symlink fixture

使用完全位于 `/private/tmp/habitat-claude-runtime-qa-20260810` 的临时 Store 与项目：

```text
store/habitat-runtime-qa/SKILL.md
project/.claude/skills/habitat-runtime-qa
  -> ../../../store/habitat-runtime-qa
```

只读/无工具的 `claude --print --verbose --tools "" --no-session-persistence` 初始化事件同时在
`slash_commands` 和 `skills` 中列出 `habitat-runtime-qa`，并报告
`claude_code_version: 2.1.207`。这证明该命名版本在真实进程中跟随 Habitat 形式的相对目录
symlink 并注册 Skill；fixture 未使用真实项目或真实 Skill Store。

### Claude Code 初始化行为矩阵

额外使用 `CLAUDE_CONFIG_DIR` 将用户级配置和 `skills` 根隔离到同一临时目录；没有读取或
修改真实用户 Skill 根。2.1.207 的初始化事件与 debug 日志得到以下结果：

| 场景 | 真实进程证据 | 结论 |
| --- | --- | --- |
| 单个项目级相对 symlink | `slash_commands` 与 `skills` 各出现一次 | add/discover 通过。 |
| 用户级与项目级两个入口指向同一 realpath | 日志为 `Loaded 1 unique skills`，同时记录 `user: 1, project: 1` | 跨 scope realpath 去重通过。 |
| 用户级与项目级同 basename、不同 realpath | 日志为 `Loaded 2 unique skills`；`skills` 出现两次同名值，`slash_commands` 只有一个名称 | 冲突真实存在，不能仅凭命令名推断赢家。 |
| 移除两个项目入口后启动新进程 | `slash_commands` 与 `skills` 均不再出现 fixture | unlink 后 reload 通过。 |

同 realpath 测试也在同一项目根内使用两个不同目录入口复验，初始化仍只注册一个 Skill。
同名不同内容测试说明 frontmatter `name` 不能单独代表 Claude 的唯一入口；Habitat 必须继续
保留所有 route，并在 winner 未经 invocation 证明时显示冲突或未知。

外部 provider 的第一次模型调用在生成任何 token 前被拒绝：HTTP 400，CodingPlan 订阅无效，
`total_cost_usd: 0`。该外部状态不再作为 runtime 验收的依赖。

### Claude Code 真实调用与 precedence

为验证 Claude Code 客户端本身的 Skill 展开，不依赖外部付费模型，启动了只监听
`127.0.0.1:18765` 的临时 Anthropic Messages 协议 mock。真实 2.1.207 进程通过隔离的
`CLAUDE_CONFIG_DIR` 和本机 base URL 调用 `/habitat-runtime-qa`，成功完成 streaming 请求与
响应；mock 随后停止，未连接外部模型。

对请求体只做布尔断言，不保存或展示系统提示：

- 单个项目 Skill，以及用户/项目同 realpath 双入口：请求包含项目 fixture 的唯一指令标记，
  不包含冲突 fixture 标记；
- 用户级与项目级同 basename、不同 realpath：项目入口指向 A、用户入口指向 B，请求只包含
  B 的指令标记；因此 2.1.207 的 slash invocation 是用户级来源遮蔽项目级来源；
- Claude Code 返回 mock 的固定 streaming 响应并以 `is_error: false`、`end_turn` 完成。

这覆盖 add、discover、invoke、跨 scope realpath dedupe、同名冲突 precedence、unlink 与
reload。Claude Code 2.1.207 的 CLI surface 可以标记为 `runtime-verified`。此结论只针对命名
版本和 Skill 加载/展开合同，不声称本地 mock 验证了任何模型的语义质量。

### 下一次复验

Claude Code 命名版本变化时，重跑初始化矩阵与本机协议 mock 调用；Cursor、Trae 安装后补齐
各自发布版本矩阵。在此之前二者继续保持 `path-compatible`。
