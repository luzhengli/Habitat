# Habitat Web 进度

当前状态：本轮 M0–M4 全部完成。真实本地 Web 项目已实现并通过对应验收。

| 阶段 | 状态 | 实际结果 |
|---|---|---|
| B0 交付基座 | done | 原始 Air/design 27 项 SHA256 保留 |
| M0 正式 Web 工程基线 | done | 实际 lockfile/ci；生产 TSX 严格检查；Vite build；URL/浏览器基线 |
| M1 真实只读技能库 | done | 显式来源授权/撤销、SQLite v1、标准 YAML、UUID、搜索分页/收藏/详情/文件与缺口 |
| M2 本地配置闭环 | done | 完整包快照、项目限定授权、持久草稿/计划/事务、预检/幂等/回读/撤销/SIGKILL 恢复 |
| M3 诊断与能力扩展 | done | Claude Code 有据适配、只读诊断、真实 GitHub 下载/差异、固定版本更新/回退与个人修改保护 |
| M4 Web 发布验收 | done | 52 tests + typecheck/build；Chromium/Safari；Node 24/25；干净本地 clone；启动/停服/备份文档 |

next_action: 本轮无待办。用户可打开 http://127.0.0.1:4173/library，明确授权自己的来源后开始使用；后续新范围另行规划。

验收索引：verification/m0-acceptance.md 至 verification/m4-acceptance.md，截图与原始日志同目录。最终实现代码提交 23cccdd；后续仅验收记录提交。未 push、发布或部署。

风险与边界：Agent 实测发现保持未知；Windows/Linux/Firefox 未验收；SQLite 内建模块仍标 experimental；未知漂移阻断而不强制覆盖；schema v2 未引入。详见 M4 记录与 README。
