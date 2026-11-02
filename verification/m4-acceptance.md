# M4 本地 Web 发布验收 · 2026-09-22

> 用户反馈后的更正：现有实现与已认可原型差异很大。本记录保留已执行的功能、构建和浏览器测试事实，但其“整体完成”结论已撤回；M4/WEB-15 高保真验收重新打开，后续依据 docs/10。没有新原型版本或最终视觉验收获确认。

## 上一轮工程完成记录

- 最终实现提交：23cccdd（后续提交仅追加验收记录）。从本地独立仓库无 hardlink 克隆到 `/private/tmp/habitat-clean-6fee1c5`，两个 `npm ci` 成功；快进至最终实现后完整 `npm run check` 成功，克隆工作树干净。无远端 push/发布。
- 52 tests 通过：39 项真实服务/领域/临时文件系统/API 测试 + 13 项冻结原型回归。严格 TypeScript（生产 TSX、allowJs=false）、Vite build、源边界通过。日志：m4-check.log、node24-check.log、clean-clone-check.log。
- Node 25.6.1 与固定 Node 24.14.0 分别实测；Node 24 为 README/.nvmrc 推荐。SQLite 实测采用内建模块，experimental 状态明确记录。
- npm audit（root 和 apps/web）：0 已知漏洞；两个 ci 也返回零漏洞。不等同完整安全认证。
- 冻结 reference/design 的 27 项原始 SHA256 全部一致。修复仅在服务层 CSP nonce 插入，不修改 Air 原件。

## 浏览器与核心流程

Chromium（Codex 内嵌浏览器）分别实测：1440×960、1280×820、960×640、390×844；技能库、授权、详情深链/刷新、项目、草稿、预览取消/确认、回读、历史撤销、诊断、设置、Git 候选。

Safari 真应用分别实测：真实列表与说明、详情正文、URL 深链、刷新恢复、Esc 关闭、项目导航、历史页面。截图 m4-safari-detail.png；不是用 Chromium/WebKit 模拟结果代替。

真实全流程在隔离目录：授权本仓库 fixtures → 扫描/详情 → 登记空临时项目 → 草稿 → 取消计划且项目为空 → 确认创建完整快照/符号链接 → cmp 与原件一致 → 回读 → 历史撤销 → lstat/readlink 证明入口不存在。来源和无关项目未修改。

真实 Git 浏览器流程：设置 → 网络明确确认 → 下载 anthropics/skills 指定子目录 → 5 项/59784 字节 commit 候选 → 确认仅收录 → 设置显示固定版本。截图 m4-git-candidate.png；后端原始证据 m3-live-git.json。

坏链接在覆盖诊断中明确列出。中文与 `<script>`/`<img>` 测试内容作为纯文本，DOM 中图片节点为 0，无脚本对话框。截图 m4-xss-text.png。停止服务后点击扫描显示明确离线说明，未变成空库或 demo；重新启动后索引/来源续接。截图 m4-offline.png。

干净克隆真实生产启动于 127.0.0.1:4183，未授权时 0 项技能；截图 m4-clean-clone-empty.png。测试实例已停止，最终默认服务运行于 127.0.0.1:4173，默认应用目录、0 个授权来源。

## 安全与恢复证据

Host/Origin/Fetch-Metadata/session/CSRF，JSON/body 限额，路径/文件 ID 边界，坏 UTF-8/二进制/超限，symlink 与源/目标漂移，完整包 mode/hash，Store/project 重叠与权限预检、DB 外来链接拒绝、旧 revision/幂等/并发、安全取消、失败补偿、个人修改保护、真实 SIGKILL 后 journal 恢复均有自动化测试。

固定版本更新和撤销保留旧快照。更新候选完整包差异测试使用注入 transport，真实网络下载证据另列；不把单元替身当真实 Git 成功。GitHub 匿名配额最初耗尽，等待重置后成功，不使用用户凭据。

schema v1 的初始化、持久重开与未知较高版本拒绝已验证。没有需求驱动的 schema v2，本轮不虚构 v1→v2 数据迁移或旧 Habitat 兼容。未来引入 schema 变更仍必须增加对应迁移与备份测试。

## 明确边界

- 首发只有 Claude Code 项目入口适配；“已配置”不代表 Agent 运行时已发现。未运行外部 Agent、不执行 Skill、不使用付费凭据；发现状态 unknown 是真实产品状态。
- Windows/Linux 文件语义和 Firefox 未验收；本轮 macOS + Chromium/Safari 本地交付。无公网部署、私有 Git、压缩包上传、集合/开发跟随或云账号。
- 不对抗已拥有同一 OS 用户代码执行能力的恶意进程；Node 路径 API 的 TOCTOU 限制保留。未知对象不覆盖，recovery-required 阻断新写。
- JSON 元数据导出不是含正文的备份；完整备份须停服复制整个数据目录并保留原 Store 绝对位置。
- 无引用快照/下载候选/空容器不自动删除，避免清理未知数据。来源限额、文件/下载限额见 README。

上一轮曾据工程检查判定无待办；该整体结论现已被用户反馈覆盖。当前待完成 V0–V3 与 M4 视觉验收，详见 PLAN/tasks.json。上述未支持能力仍不标为已实现。
