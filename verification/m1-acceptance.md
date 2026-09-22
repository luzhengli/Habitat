# M1 真实只读技能库

30 项测试通过；严格 TSX/typecheck/build 通过（m1-check.log）。新增 catalog 测试使用临时目录，证明 SQLite 重开后 UUID/来源/收藏保留、授权撤销后读取拒绝、源字节不变、YAML 多行中文/未知字段/缺字段/重复键/二进制、同名异内容和链接缺口。原有测试覆盖超限、坏 UTF-8、根漂移、权限边界。

真浏览器：无授权空态 → 明确输入本仓库 fixtures/skills → 勾选只读授权 → 扫描出现 review-code/write-brief 的真实 description → 打开 SKILL.md。详情有 URL 深链，刷新恢复。截图 m1-detail-960.png。应用索引使用 /private/tmp/habitat-web-acceptance-data，未扫描真实用户技能。

安全范围：只读直接子目录；不跟随源链接，明确列出缺口；正文作为文本，不加载外部图片或执行代码。目录登记与后续项目写权限分离。

数据库：Node 25.6.1 builtin node:sqlite，实测 SQLite 3.51.2，仍带 experimental warning；schema v1，WAL + synchronous FULL。发布矩阵需继续验证 Node 24。依据 https://nodejs.org/download/release/v25.6.1/docs/api/sqlite.html 。

元数据依据：https://agentskills.io/specification 。标准 YAML 解析器来自锁定的 npm yaml；元数据不满足格式保留诊断，不伪造用途。
