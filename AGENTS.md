# Habitat Web — Agent 工作合同

## 目标与依据
- 这是全新 Web 项目，不是 luzhengli/Habitat 的增量重构。不要克隆旧仓库、迁入 Rust、继承旧数据格式或添加 Tauri/Electron。
- 保留已选 Air 视觉：浅银灰、白色、克制蓝色、适度留白、稳定文字入口。不要重新发起视觉探索。
- 默认本地优先：React Web UI + 本机服务。公网部署/云同步/账号体系不是首发范围。
- 规则优先级：用户最新指令 > 本文件 + docs/00 的变更基线 > docs/01–07 > 截图/参考原型 > verification/historical-*。

## 每次进入
1. 读 README、PLAN、JOURNAL 和当前阶段对应文档；按需要读取组件/证据，不每轮全量重读参考包。
2. 检查当前目录、git status、分支和已有代码。保留用户未提交文件，不 reset/clean/自动 stash。
3. 本包可以就是仓库根。无 Git 时可 `git init -b main`；有 Git 则在当前项目继续。不要嵌套克隆旧仓库，不擅自 push/发布。
4. 首次执行 CODEX-START。后续从 PLAN 的 next_action 继续，不重复 bootstrap。

## 工程与真实性
- apps/web 是真实前端；reference/air 是 mock 设计参照，不能导入其 model.js/模拟事务进入真实页面。
- 本包服务目前仅只读；API capabilities 是当前实现事实。未实现保持禁用/明确错误，不返回 success=true。
- 扫描默认无授权；所有读写限于用户明确授权的 canonical 边界。脚本/Markdown 不执行，内容不自动上传。
- 操作链：用户意图 → 服务端计划 → 预检 → 明确确认 → 持久事务 → 执行 → 回读 → 可恢复结果。
- 管理关系、配置状态、预计发现、实测发现分开；目录存在和 UI 勾选不能证明 Agent 实测发现。
- 不提供任意 shell、任意文件读取/写入 HTTP 接口。localhost 不等于无须请求保护。
- 会话、Host/Origin/CSRF、请求大小、路径与内容安全在开放写能力前必须有测试。不要把端口改成 0.0.0.0。
- 生产元数据和事务归后端；localStorage 仅浏览偏好。模拟数据单独 `/demo`，不静默回退。
- 依赖安装首次用 setup:web 或等价受控操作，锁定实际版本；已有 lockfile 用 ci，不用 --force 掩盖冲突。
- 当前 JSX 是起点，allowJs 不等于通过严格 TypeScript；M0/M1 按真实切片逐步类型化。服务 HTTP 实现可保留 Node 内建模块；不要为框架重写消耗首个闭环。

## 验证与续跑
- 当前 npm run check 是测试与源边界 gate，不含尚未安装的 Vite build。完成 M0 后加入 build/typecheck，补完所需浏览器 gate。
- 每项功能有单元/临时目录集成/失败路径与必要浏览器证据。禁止在用户真实技能上做破坏性验收。
- 大规模安装、更新、迁移与远程访问不属于无条件授权；默认使用合成 fixture。
- 阶段完成需实际结果，不能用计划、启动成功或 HTTP 200 代替验收。无法运行如实写阻塞。
- 更新 PLAN、JOURNAL、tasks.json 的当前阶段、最后命令、失败与 next_action。保留可重放证据，不堆砌主提示词。
- 工作中断写检查点；不假定后台自动继续。结束报告完成范围、测试证据和下一步。
