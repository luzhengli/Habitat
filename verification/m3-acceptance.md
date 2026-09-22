# M3 诊断与维护验收

- 真实公开 GitHub 下载通过：anthropics/skills，commit 34040c9c568585f6929bedeaad110ad08f079624，skills/algorithmic-art，5 项/59784 字节，隔离校验后收录 1 项真实技能。完整指纹及元数据见 m3-live-git.json。不执行下载内容。
- 最初两次 GitHub HTTP 403，响应明确匿名配额 0；等待 2026-09-22 08:38:07 UTC 重置后成功。没有借用用户凭据或放宽地址校验。
- Git 网络仅固定 api.github.com、DNS IPv4 公网校验并固定连接 IP、HTTPS 证书校验、不重定向、不读取凭据；对象 SHA/字节验证；拒绝子模块/链接/路径穿越；大小/数量/时间上限。
- 更新候选完整文件 added/removed/changed；旧来源与项目快照不被覆盖。项目版本切换沿用持久确认事务，固定版本可回退；个人修改阻断。
- 诊断页核对来源缺口及受管入口/完整快照，其他作用域和 Agent runtime 均 unknown。没有运行 Agent，不声明已发现。
- 当前 47 tests、typecheck/build 通过。隔离下载的恶意响应与变更用注入 transport 做单元测试，真实网络证明单独列出，不混淆。
