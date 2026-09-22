# Habitat Web 工作日志

## 2026-09-22 — 交接基线

用户最新决定：保留已经认可的 HTML/Air 设计，放弃旧项目内重构，启动全新 Web 项目。

已完成：重新组织新项目根目录与文档；保留 Air 原型/React 参考/截图；提供 Node 本地只读服务、启动页和正常 React/Vite 源码起点；只读 fixture 与会话/请求边界测试。

已运行：Node v22.16.0 / Linux，npm run check，27 项通过。只使用包内/系统临时目录，不触碰真实用户技能。

环境限制：npm registry DNS 无法解析，实际安装依赖和 Vite 构建没有执行成功。apps/web 故意不伪造依赖版本或 package-lock。setup:web 会在 Codex 可联网环境中安装并精确记录版本，随后必须执行构建与验证。

未完成：M0–M4 的正式 Web 产品；当前 services 没有写入、项目登记、持久化或 Agent 运行能力。prototype 的旧历史测试不证明这些能力。

下一步：CODEX-START / M0。不要把这份日志写成所有功能已交付。

## 2026-09-22 — M0 实现与验收

初始化独立 main 仓库，保留所有交付文件。ci、27 tests、严格 TSX/typecheck 与 Vite build 通过；check 纳入构建/类型 gate。浏览器生产库空态和 1440/960 截图保存于 verification/m0-*。实际开发服务启动。修复服务层 nonce 替换误伤原型 JS。首次端口 EPERM 经受控执行通过；重复启动 EADDRINUSE 停止重复服务后恢复。下一步 M1 持久来源与标准元数据。

## 2026-09-22 — M1 真实来源闭环

完成 SQLite v1 索引、来源授权/撤销、扫描 job、YAML 解析、UUID、搜索分页 API、收藏、详情与问题列表。30 tests/typecheck/build 通过，真实浏览器授权合成 fixture 后读取两项技能。详见 verification/m1-acceptance.md。下一步 M2 完整包复制和有界项目事务；Agent 首先选择有官方项目路径和符号链接依据的 Claude Code，不声称运行时已发现。

## 2026-09-22 — M2 事务闭环

完成完整 manifest、固定副本、Claude Code 项目授权与入口、持久 plan/operation/step、revision/幂等/锁、回读/补偿/撤销/重启恢复、持久草稿及历史界面。浏览器临时项目配置与撤销已实际执行，原件字节不变。新增真实 SIGKILL 恢复测试；详情见 verification/m2-acceptance.md。下一步 M3 受限公开 Git 来源与诊断，不运行技能或 Agent。

## 2026-09-22 — M3 诊断与 Git 维护

受限 GitHub API 下载/候选/差异/收录已实现，项目固定版本切换与撤销通过，个人修改保留。匿名 API 配额最初为 0，重置后实际下载 anthropics/skills 指定子目录成功：5 项、59784 字节、1 项技能。m3-live-git.json 留证。47 tests/typecheck/build 通过；继续 M4 浏览器、安全与干净 clone 验收。

## 2026-09-22 — M4 完成与交付

52 tests（39 项真实服务/领域 + 13 项原型）、严格 TSX/typecheck/build 通过；Node 25.6.1 与 24.14.0 验证；root/web audit 0 已知漏洞。Chromium 四尺寸、真实 Safari 列表/详情/刷新/Esc/项目/历史实测。真实 Git 浏览器下载/候选/收录通过；恶意文本不执行；停服明确离线，重启续接。独立本地 clone ci/build/test 通过且工作树干净，真实启动未授权空库。

最后修复：目录复制后恢复 mode；Store/项目写权限在任何文件施工前预检；数据库文件拒绝外来 symlink。最终实现 23cccdd。冻结 Air/design 27 项原始校验和一致。详细证据 verification/m4-acceptance.md。临时验收服务已停止，默认正式服务 127.0.0.1:4173 运行、授权根为 0；测试材料独立保留。

未支持范围已明确记录，未伪造 Agent 发现、跨平台验收或未来 schema 迁移。当前无不可绕过阻塞，M0–M4 全部完成；未推送或发布。next_action：本轮无待办，用户可显式授权真实来源开始使用。
