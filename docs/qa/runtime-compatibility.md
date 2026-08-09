# Runtime compatibility QA

本文件记录命名版本的真实 runtime 证据。路径被扫描、Skill 被注册、模型成功调用和发布级
`runtime-verified` 是不同结论；任何外部阻断都不能被换算成通过。

## 2026-08-10

### 本机版本

| Agent | 命令结果 | 本轮结论 |
| --- | --- | --- |
| Codex | `codex-cli 0.139.0` | 版本与既有已验证 fixture 基线一致。 |
| Claude Code | `2.1.207` | 相对目录 symlink 的发现与注册通过；完整调用未通过。 |
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

模型调用在生成任何 token 前被当前外部 provider 拒绝：HTTP 400，CodingPlan 订阅无效，
`total_cost_usd: 0`。覆盖用户 `settings.json` 中第三方 provider 后，本机没有另一份可用的
Claude 登录，因此不能完成 Skill 指令执行。Claude Code adapter 继续保持 `targeted`，不得
升级为 `runtime-verified`。

### 下一次复验

外部订阅恢复后，在新的临时 fixture 中执行两个同名不同内容来源，确认实际 winner/冲突提示，
并验证单入口 Skill 指令结果。命名版本变化时重跑整张初始化矩阵。完成前 M7 保持 `doing`。
