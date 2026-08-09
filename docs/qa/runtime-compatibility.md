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

随后模型调用在生成任何 token 前被当前外部 provider 拒绝：HTTP 400，CodingPlan 订阅无效，
`total_cost_usd: 0`。因此本轮不能验证 Skill 指令执行、reload、同 realpath 去重、同名冲突或
unlink 后刷新。Claude Code adapter 继续保持 `targeted`，不得升级为 `runtime-verified`。

### 下一次复验

外部订阅恢复后，在新的临时 fixture 中依次验证：单入口调用、同 realpath 双入口去重、同名
不同 realpath 冲突、移除链接后 reload，以及无残留项目入口。完成前 M7 保持 `doing`。
