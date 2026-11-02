# Habitat Web 进度

当前状态：**高保真还原进行中（V0/V1；V2 已确认范围首切片）**。A1 候选等待用户确认，整体尚未完成。此前“M0–M4 全部完成”仅保留为上一轮工程记录；M4 的 WEB-15 视觉验收仍重新打开。

## 已有工程基线

| 阶段 | 状态 | 保留的证据边界 |
|---|---|---|
| B0 交付基座 | done | 原始 Air/设计素材与交付历史 |
| M0 正式 Web 工程基线 | done | lockfile、严格 TSX、Vite、URL 与测试基线 |
| M1 真实只读技能库 | done（工程基线） | 来源/授权/索引/解析/详情等已有实现；不代表 UI 达到原型 |
| M2 本地配置闭环 | done（工程基线） | 真实计划/事务/回读/撤销与安全测试，改造时保持 |
| M3 诊断与能力扩展 | done（工程基线） | 真实诊断/Git/维护链，不以演示替代 |
| M4 Web 发布验收 | reopened | 历史功能/浏览器结果保留；像素级还原和用户视觉验收未通过 |

## 当前实施轮：原型先行的高保真还原

| 阶段 | 状态 | 退出条件 |
|---|---|---|
| V0 原型基线与差异盘点 | in_progress | 实际打开双方；同视口/同内容/同状态截图与测量；完整页面状态映射及差异分类 |
| V1 原型修订与确认 | awaiting_user_confirmation（已展示范围） | 必要 Web 适配/新增状态在独立候选中呈现；用户明确确认版本与范围。无需改设计的范围引用既有批准基线 |
| V2 高保真实现 | in_progress（A0 不变范围） | 基于有效已确认原型逐页像素级还原；接回真实 API，保留功能和安全边界 |
| V3 对照验收与回归 | todo | 双侧原图、叠加/diff、测量、交互与浏览器证据；无未解释的实质差异；check/build 通过，用户最终视觉验收 |

next_action: A1-web-real（f5386425…93a4）已展示并待用户确认。继续 A0 不变范围还原和同条件采证；确认后仅解锁获批范围。V0 完整矩阵、V2 逐页实现、V3 全浏览器及最终视觉验收均未完成。

原始基线：reference/air/Habitat-Air.html、对应源码/CSS、design/01–12 PNG。生产 UI/旧实现截图不是设计标准。有效原型确认登记见 design/prototype-baselines.md。

协作方式：依 AGENTS.md 的 Orchestration 合同拆分有界工作包，按依赖/文件所有权派发 subagent，选择适合的模型与思考强度；主代理统一原型确认、共享组件、集成与验收。并行不绕过 V1 用户确认门槛；任务粒度或共享资源不适合时串行。

执行规则：既有已确认设计可直接还原；任何设计变化先改独立原型候选，请用户确认后再落生产。逐页连续推进已确认范围，只在真实设计分歧/待确认候选或不可绕过阻塞处暂停依赖工作，不在每页之后重复请求开工许可。

完成条件：V0–V3 退出条件全部满足，M4 视觉门槛关闭；不能仅凭此前 52 项测试或截图存在再次写“全部完成”。功能不支持/安全约束与原型冲突时先修订原型并确认，不伪造成功、不静默删除设计结构。

历史记录：verification/m0–m4-acceptance.md；上一轮实现 23cccdd、验收记录 89047db。保留工程事实，视觉完成结论已更正。Agent 实测发现、Windows/Linux/Firefox 等既有边界继续明确记录。

## 2026-09-22 实施检查点（覆盖上方待实施状态）

V0、V1、V2 当前进行中；V1 已展示范围等待用户确认。完整记录见 verification/fidelity/coverage.md、gap-inventory.md、source-audit.md。

已还原 A0 主内容间距、侧栏折叠/真实最近项目、收藏样式、库范围 tabs/分类/排序/grid-list，以及来源声明的 title/icon/color。SkillCard/SkillDetailFrame 是受控呈现准备，尚未路由接线。未导入原型 model。

合成 9 技能、3 项目、8 真实绑定、3 收藏由真实 Catalog 和计划/执行/回读生成；Agent 发现全部 unknown。新增 firstIndexedAt 保留首次真实索引时间，旧记录不伪造历史。

54 项测试、源边界、严格 TSX 和 build 已通过。首切片四尺寸同 DPR 对照已保存；最新库主要容器在 1440 下几何一致，品牌差 30px 待 Web 候选确认。Safari 已实际操作，完整同视口视觉与焦点/IME 验收未完成。M4 保持 reopened；未提交、推送或发布。

对照证据复核：重复卡片配对与裁切图校验已修正，3项专项测试通过，9组报告重算；最新四尺寸前4张已采样卡片几何一致，不代表全部卡片及状态通过。见 verification/fidelity/evidence-tool-recheck.json。

补充检查点：A2-failure-states（fb14fb3a…3a243）已形成17个具体失败/恢复可运行状态，独立于A1，等待用户确认。浏览器分支与960/390回退证据已存；完整Safari/生产对照未完成。全部9卡片的1440内部排版审计已补，仍有实际用量入口/标签位移差异，不能判全库通过。

上轮阻塞检查点（锁屏已于恢复轮解除）：A0全局搜索已接真实数据，54 tests/typecheck/build通过，Safari已实测部分搜索/导航/Esc；详见verification/fidelity/command-acceptance.md。A1/A2审批持续缺失至少3目标轮；Mac当前已锁定，需要用户手动解锁。剩余真实状态设计与视觉验收无法据自动续跑绕过，目标进入blocked等待，M4仍reopened。

恢复轮检查点：已实测Mac解锁并恢复同一合成服务。Safari普通Tab逃逸已修复，15步完整循环/跳过禁用控件/搜索→授权→Esc焦点链实测通过；54tests/typecheck/build通过。当前目标active，A1/A2待确认；恢复后阻塞审计重新计数，不沿用上轮blocked计数。

恢复轮2：发现并恢复已终止的A1/A2预览进程，两个冻结自包含HTML已在浏览器实际打开；durable入口见design/prototype-revisions/REVIEW.md。设计内容与hash不变，仍待用户确认。

恢复轮3阻塞结论：A1/A2明确确认仍缺失，满足恢复后连续3轮的同一阻塞审计。锁屏已解除，预览入口已恢复；当前唯一关键门槛是设计批准。目标blocked等待用户确认或修改意见，保留全部实现与证据，不以继续打磨少量控件代替剩余逐页实现。M4仍reopened。

## 2026-10-10 — 按请求启动本地项目

已对当前工作区执行 `npm run build` 并启动 `npm start`，仅监听 `127.0.0.1:4173`，使用已有 `~/.habitat-web` 数据，未额外授权或扫描来源。`/library` 与带正确客户端头的 `/api/v1/session` 实测 HTTP 200。服务 PID 46591；终端 session 85876。此次仅启动，不改变 V0/M4 或 A1/A2 待确认状态；next_action 仍为取得具体候选确认后续跑。

2026-10-10 停服检查点：按用户“关闭项目”请求向终端 session 85876 发送 Ctrl+C，进程退出码 0；`lsof -nP -iTCP:4173 -sTCP:LISTEN` 确认无监听。未改变阶段与 next_action。

## 2026-11-02 — GitHub 同步准备

按用户要求准备同步当前项目。main 尚无 remote；GitHub luzhengli 登录有效，目标仓库链接/新建名称待用户提供。工程 check（54 tests、源边界、严格 TSX、build）及 git diff --check 通过；首次沙箱监听 EPERM 已通过允许本机监听后重跑解决。截图差异专项脚本缺 Pillow，未运行。GH-AUDIT 只读子代理完成上传内容检查，见 verification/github-sync.md；采用实际可用 gpt-6.1-terra/medium，替代表中不可用5.6版本。

next_action（同步）：取得目标仓库后配置远程、推送并核对 SHA。开发阶段和原型批准状态不变，A1/A2 仍待确认，M4 保持 reopened。

## 2026-11-02 — GitHub 首次同步完成

用户明确确认旧仓库改名 Habitat-archived、新项目使用公开 Habitat。旧仓库经临时解除归档完成改名后已立即恢复归档，ID/历史保留。新建独立公开仓库 https://github.com/luzhengli/Habitat，origin 使用 HTTPS，main 首次推送5524674成功并设置跟踪。详情见 verification/github-sync.md。本补充记录随提交同步；不改变原型确认和视觉验收状态。

next_action：开发仍等待 A1/A2 具体版本确认；后续仓库同步使用 git push origin main。
