# 04 · Web 架构与安全边界

> 2026-09-22 实现更新：下文“当前基座/尚未实现”描述为交付时快照。现有真实实现与能力以 README、PLAN、/api/v1/capabilities 和 verification/m0–m4 验收为准；安全约束仍有效。
## 1. 架构选择

首发选择同机 local-first Web：

```text
Browser / React / Vite
        │ same-origin HTTP, session + request proof
        ▼
Local Node service (127.0.0.1)
        ├─ queries: catalog, projects, diagnostics, history
        ├─ plans: typed intent → full preflight → immutable preview
        ├─ operations: journal → execute → readback → recovery
        └─ adapters: bounded filesystem / sources / Agent discovery
                   │
          explicitly granted local roots + application-owned storage
```

不建立 Tauri、Electron、浏览器扩展、MCP、微服务、容器编排或 Agent 多代理系统。这里限制的是 Habitat 产品架构，不限制开发过程使用 Codex subagent；开发协作按 AGENTS.md 的 Orchestration 合同执行。新服务语言默认 JS/TypeScript，少量领域模块即可。当前内建 HTTP 服务是可测试起点，可按增长转为 Fastify但不是首个里程碑前置条件。

React 页面通过 HTTP 客户端而非 IPC 调用；构建后静态资源和 API 同端口。开发 Vite5173 代理本地4173，不开放宽松 CORS。无 SSR 需求，不默认引入 Next.js 服务端渲染、RSC或云数据库。

Web是界面形态，不等于公网SaaS。纯文件选择 API 有授权/兼容边界，不能静默读取任意本机目录或创建 Agent 符号链接；远程服务看到的是远程磁盘。来源见09。要零本地进程，只能缩成上传/下载型技能资产库，会失去本次本地配置目标，本包不擅自作这种产品削减。

## 2. 当前可运行基座与目标实现

当前：Node内建HTTP、启动时授权、8个根上限、每根500个直接子项、每个SKILL.md最多256KiB、无递归/链接跟随、UTF-8检查、路径身份/正文指纹校验、会话与请求边界。只读取不持久注册，所有认证后非GET请求501。目录名只是显示/定位，不是假装标准frontmatter。

目标：增加标准解析、索引、来源授权UI、项目、非破坏性导入、事务、发现能力。当前简单快照ID不是最终跨重定位身份；不要把starter实现限制固化为最终产品限制。限制放在capabilities/配置中，并用新的测试支撑每次扩大。

## 3. 服务位置与授予权限

默认不授权任何真实目录。bootstrap根由CLI环境配置；正式版授权UI必须显示“服务本机路径”和read-only/项目写入范围，并通过受保护请求明确确认。

SourceGrant包含canonical路径、身份、权限、授予时间和撤销状态。相对路径不能越界；不把~、URL、UNC、符号链接解释留给前端。首次范围拒绝文件系统根，不建议整个home；写入范围仅项目约定skill容器或应用Store，不是整个项目可任意改。

浏览器原生选择可能只有File对象和相对路径，不具备Node绝对路径；上传复制与外部引用分开。服务可提供**已授权根内**有界目录选择，不能先开放全盘目录浏览再谈授权。

撤销授权后新读写被拒绝；有活动事务/受管引用时解释影响。文件权限不足必须失败，不能提权、调用sudo或偷偷更换目标。首次macOS验证后再加Windows/Linux路径和symlink策略；Windows权限不足不静默退回复制模式。

## 4. Localhost的HTTP安全

威胁范围：恶意远程网页、恶意技能内容、DNS重绑定、跨站请求和用户误操作。不能防御已经能以同一OS用户执行任意代码的恶意进程；本地服务不是对抗同用户进程的沙箱。必须明确这一边界。

当前基座：固定127.0.0.1监听，校验精确Host（含端口）、Origin和Fetch-Metadata；拒绝跨站和null Origin；仅开发模式允许精确5173 Origin；无CORS *。session需固定自定义头，返回HttpOnly/SameSite=Strict cookie与仅内存csrfToken，后续所有API需二者。token不写URL或localStorage；cookie仅/api；会话1小时/重启失效，最大64。当前HTTP无Secure cookie仅因loopback HTTP；公网必须HTTPS且重做身份/权限，不可照搬。

这不是“用户账号”，也不是OAuth/MCP认证。可以保留无需登录的UX，同时提供请求保护。读API也可能泄露路径/源码，不能只保护写API。

基座demo以nonce加载历史内联JS；正式Vite输出外置脚本，不复制其transport。CSP不允许任意远端script、不用unsafe-eval；生产样式可逐步收紧，当前原型保留style inline兼容。远端内容只文本/经过批准的sanitizer；禁止raw HTML/自动远端图像加载。

生产补齐：请求body限额、速率/扫描并发、会话更新、多标签页竞争、重启恢复、日志脱敏、错误不暴露stack/secret、静态资源防路径穿越、依赖审计。当前测试不是安全认证。

## 5. 文件边界与不可变副本

新实现必须保留原则而不是复制旧代码：canonical父目录、lstat/fstat文件种类与身份、相对路径验证、符号链接决策、完整内容指纹、执行前后复验。

初期外部Skill只读；普通安装先导入受管不可变快照。对整个技能目录（含scripts/references/assets）生成版本化排序manifest，记录文件种类、relativePath、大小、mode、link text、bytes hash。不能只Hash SKILL.md就声称整包版本一致。默认拒绝越界symlink和特殊设备/FIFO/socket；安全内部链接是否支持需单独测试。

Store在Agent自动发现路径之外。禁止让Store和目标项目互为祖先/后代。先应用自有staging复制，逐项检查，完成指纹验证后publish；发布成功不自动移动/删除外部源。旧迁移隔离原入口不是本轮任务。

TOCTOU需要明确处理：执行前复验、每步身份核对、锁、最小原子操作；但Node普通路径API无法凭几次realpath提供对抗同用户恶意并发的完整沙箱保证。遇到无法证明的路径变化中止并报告，不用字符串startsWith当安全边界。

## 6. 持久化与事务

首次真实索引阶段建立新schema v1。元数据建议SQLite（小项目避免大型ORM/外部服务），驱动在固定Node版本上确认后锁定；builtin node:sqlite 的稳定性/同步行为按所选版本核验，不能把最新文档版本直接当Node24合同。大扫描/hash不阻塞服务。当前starter没有数据库，不虚构已持久化。

建议表：sources/grants、skills、versions、projects、bindings、plans、operations、operation_steps、evidence、preferences。正文保留在文件系统；DB只存引用/摘要。应用目录默认单独命名（如~/.habitat-web/），不读取旧Habitat Store和localStorage。

数据库事务≠文件系统事务。写能力必须有durable journal：生成只读计划→全部预检→保存计划与展示摘要→确认→持久记录操作开始→逐步记录before/expected/intent→有界执行→after回读→落结果→最终标记。幂等键、源快照版本、plan hash、expiry、项目/Store锁均需校验。

状态示意：planned→ready→confirmed→running→verifying→succeeded；失败可failed/partial→recovery-required→compensating→rolled-back/rollback-partial。HTTP超时不等于失败：客户端用operationId查询，禁止重复施工。取消只在安全点执行，关页不取消。

目标已存在真实目录/普通文件/外来链接/失效链接时不覆盖。幂等仅对仍匹配本事务期望的受管目标。失败补偿仅删除本事务创建且身份未漂移的对象；其他对象保留并列出。

重启先加载未完成journal，重新检查，不盲目继续或假设全部成功。撤销也产生有界计划，检查后续引用和内容变化；无法证明安全恢复时blocked。新项目不兼容旧manifest，但自己的schema变更从v1起必须版本化。

## 7. 来源网络与外部进程（后续）

GitHub先仅明确用户发起的公开HTTPS仓库：仓库/commit与子路径可追溯，限制大小、时间、redirect与目的地址；防localhost/私网/metadata SSRF，限制跨host重定向。clone不执行hooks、子模块、LFS任意smudge/filter，不继承未知Git配置；无shell字符串拼接。私有认证独立开发，日志不留token。

压缩包禁止../、绝对路径、越界link、异常膨胀/文件数；先隔离再预览。任何下载完成不代表内容安全。

Agent调用走固定签名的受限适配器，不让HTTP传任意command。以工具版本、cwd、具体内容、时间和原始回执区分“发现”和“执行”；网络/付费检查需明确提示。未实现则capability=false。

## 8. 部署

开发：Vite5173→受限Node4173。生产本地：Node同源服务apps/web/dist。用户可按README启动/停止，无需桌面壳；后续再做npm发行或单文件分发，不在本轮发布到任何远端。

服务无法启动/端口占用明确退出，不回退到随机公网接口。暂不提供暴露用户目录的Docker compose。要远程部署必须重新定义用户认证、TLS、租户隔离、连接器配对和目录授予，不是把host改成0.0.0.0。
