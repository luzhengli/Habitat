# V0-B：真实服务与合成 fixture 采证方案

日期：2026-09-22。范围仅为高保真 V0 的同内容状态准备；本文件不构成原型修订或用户确认，也不授权扫描真实目录、执行项目写入或联网。

## 结论

生产页面必须由真实服务响应驱动。可在独立临时根目录中构造两项或更多合成 Skill，再由正式的来源授权、扫描、项目登记、计划和操作接口生成页面状态。`reference/air/src/model.js` 的九项技能、三项目、issues、版本、分类、颜色和“模拟已发现”均为演示模型；不能复制到 `apps/web`、Catalog 或 fixture 数据库来凑画面。

当前真实服务可以可靠构造：空库、已授权且已索引的技能库、详情正文与文件树、收藏、项目空态、项目已登记、草稿、计划确认、成功操作记录、撤销，以及“入口已回读 / Agent 未运行实测”的诊断。它不能按 A0 原样构造分类、来源标签、九项卡片、跨工具共享入口、Agent 发现成功、预置问题、远端更新或“开发版本”等状态。这些可见差异属于 V0 gap，若仍要保留 A0 的表现，先制作原型候选并取得用户确认，生产中也必须显示真实能力边界。

## 受保护的 API 会话合同

所有 `/api/v1/*` 请求都要求精确的本机 Host、`X-Habitat-Client: habitat-web`。先调用 `GET /api/v1/session`；响应设置 `habitat_session`（HttpOnly、SameSite=Strict、Path=/api）并返回仅内存保存的 `csrfToken`。后续**包括读请求**均携带 cookie 与 `X-Habitat-CSRF`；有 JSON body 的 `POST`、`PATCH`、`DELETE` 再携带 `Content-Type: application/json`。

服务仅接受同源 `Origin`；开发模式额外精确接受 `http://127.0.0.1:5173`。无 CORS/OPTIONS 放行，跨站/null Origin、Host 不匹配、错误客户端头、缺 session 或 CSRF 都应保留为失败状态。会话一小时过期、服务重启失效；前端客户端会为 GET 的 session/CSRF 失败重试一次。JSON body 上限 16 KiB，必须为对象。

## 可用于采证的接口与状态

| 目标状态 | 真实接口（按会话合同） | 服务事实与页面应呈现 |
| --- | --- | --- |
| 能力与空库 | `GET capabilities`、`GET inventory`、`GET sources` | 无授权时 `authorizedRoots: 0`，`skills: []`；不得显示 A0 的九项技能或“已扫描”。 |
| 授权来源与有数据列表 | `POST sources` `{absolutePath, permission:"read-only", confirm:true}` → `POST scans` `{}` → `GET inventory` 或 `GET skills?q=&offset=0&limit=50` | 只接受绝对、可访问、真实目录，且不是 `/` 或链接；授权为只读。扫描解析 frontmatter，返回真实 declaredName、description、path、fingerprint、warnings。 |
| 搜索、详情、文件、收藏 | `GET skills?...`、`GET skills/:skillId`、`GET skills/:skillId/files`、`GET skills/:skillId/files/:fileId`、`PATCH skills/:skillId/preferences` | 仅能读返回的 ID；正文/文件只作为文本预览，不执行。收藏是真实 Catalog 元数据，适合同状态截图。 |
| 项目与草稿 | `POST projects` `{directory, writeScope:".claude/skills", confirm:true}`；`GET projects`；`GET/PATCH projects/:id/draft` | 项目写入需单独明确授权。PATCH 必须带当前 project `revision`、draft `generation`、最多 50 changes；仅保存草稿，尚不写项目。 |
| 预览、确认、成功与回读 | `POST plans` `{projectId, revision, changes:[{action:"add",skillId}]}` → `POST operations` `{planId,hash,idempotencyKey,confirm:true}` → `GET operations/:id` / `GET projects/:id/exposures` | 计划十分钟过期；执行创建 Store 快照和 `.claude/skills/<name>` 符号链接，前后预检及回读。成功仅表示入口已回读，`discovery` 必须仍为 `unknown`。 |
| 撤销、失败边界、撤销授权 | `POST plans` `{kind:"undo-operation",operationId}` → 确认执行；`POST operations/:id/cancel`；`DELETE sources/:id` / `DELETE projects/:id` | 撤销也走计划与确认。漂移、个人修改、版本变化、授权撤销、过期计划或取消应显式失败/补偿，不能显示成功。 |
| 真实状态导出 | `GET export` | 仅用于保存本次合成采证元数据；导出不含来源正文，不能替代截图或用于生成演示内容。 |

`GET diagnostics` 的项目入口检查与 `GET projects/:id/exposures` 能证明入口/快照一致性；它明确返回其他个人、企业、父目录范围为 unknown，且不运行 Agent。

## 最小可复现的合成内容

使用临时目录（例如测试框架的 `mkdtemp` 目录），而不是任何用户技能或项目目录。结构应保持在一次采证内稳定：

```text
<temp>/
  source/
    write-brief/SKILL.md
    review-code/SKILL.md
  project-habitat/
  data/
```

可复制仓库已提供的**内容格式**，但运行副本必须在临时目录：`fixtures/skills/write-brief/SKILL.md` 与 `fixtures/skills/review-code/SKILL.md`。这会生成 `write-brief`、`review-code` 两张真实卡片；其目录名和 YAML `name` 必须一致，`description` 为可见说明。若需要文件页，再在其中一项下新增静态纯文本 `references/guide.md`；不放脚本、链接、二进制或大文件。Catalog/服务数据目录也设为 `<temp>/data`，不得使用真实 `~/.habitat-web`。

已提供可重复准备器：`node scripts/fidelity-fixture.mjs`。每次运行新建一个 `/private/tmp/habitat-fidelity-*` 目录，使用真实 `Catalog` 和 `Operations` 注册九项合成 Skill 与三项项目；Skill frontmatter 明确声明 A0 的 `title`、`category`、`icon`、`color`、`version` 展示文字。它通过 `Operations.plan` → `Operations.execute` → `Operations.exposures` 创建并回读 A0 对应的八条 Claude Code 绑定，并通过 `Catalog.preferences` 设置三项收藏；所有 discovery 仍为 unknown。stdout 与 `<temp>/manifest.json` 返回 `HABITAT_DATA_DIR`、`HABITAT_ROOTS`、project 路径、真实索引 ID/fingerprint/metadata、计划和操作证据及不能匹配 A0 的声明。它不导入 `reference/air/src/model.js`、不启动服务；这些字段是合成输入，不是生产默认或 Git/来源事实。

为确保同内容的原型/实现对照，V0 记录每个临时 `SKILL.md` 的 SHA-256、绝对但脱敏的临时根标识、服务版本/commit、时间、响应中的 skill ID、fingerprint、project ID、plan hash、operation ID。ID 与临时绝对路径每次都会变化，不能把它们当成像素对照的固定文案；截图可显示经批准的、固定的测试路径占位方式，但这若改变 A0 可见设计需先走 V1。

## 推荐采证顺序

1. 建立全新临时根，写入上述两项 UTF-8 文本 fixture 和空项目目录；记录内容 hash。启动服务时仅把此临时根作为来源/数据目录，固定 127.0.0.1；不传真实 `HABITAT_ROOTS`，不使用 `--fixture` 指向工作区 fixture 作为“真实目录”。
2. 建立受保护会话，截图空库与 capabilities；随后调用 `POST sources`（明确 `confirm:true`）、`POST scans`，保存 job ID 与 `GET inventory` 响应。截图两张卡片、搜索命中/无结果、详情正文和文件树。
3. 对其中一项调用 `PATCH preferences` 设为收藏，重新读取 inventory；只把返回的真实 favorite 状态用于收藏筛选截图。
4. 用临时 `project-habitat` 调用 `POST projects`（`.claude/skills`、`confirm:true`），保存一项 add 草稿并截图未应用状态。调用 `POST plans`，截图服务返回的影响和物理目标；只在需要成功/历史状态的已批准 V0 采证中，再以 `confirm:true`、新幂等键执行。
5. 轮询 `GET operations/:id` 至终态，接着调用 `GET projects/:id/exposures`。成功截图必须使用“入口已回读；Agent 未运行实测”事实，不能标注 A0 的“模拟已发现”。如采集撤销状态，另建 undo plan 并执行，保存回读结果。
6. 每个状态结束后保存 API 摘要、截图与 fixture manifest 到 `verification/fidelity/` 的本次证据目录。清理临时目录只在所有截图、hash 与必要摘要已保存后进行；清理不得触及工作区或用户目录。

步骤 1–5 是后续浏览器/服务负责人的执行计划；本 V0-B 工作包未启动服务、创建 fixture 或触发写事务。

## A0 内容到真实数据的映射与阻塞

| A0 可见内容/状态 | 真实构造结论 | 处理要求 |
| --- | --- | --- |
| 两张有名称、描述、来源路径、详情和文本文件的卡片 | 支持 | 由临时 Skill frontmatter、扫描和文件接口提供；Catalog 会持久化完整 frontmatter 为 `metadata`，但当前 `apps/web/src/types.ts` 尚未把它声明为前端契约。接入前只能使用已确认的字段；来源应标“本地只读授权/真实路径”，不伪造 GitHub 或 Claude 发现。 |
| 9 技能、3 项目及具体中文标题/彩色分类 | 不支持为真实事实 | 不把 model.js 数据移植进生产。若 A0 的固定数量/分类布局不可替换，做候选原型，明确演示与真实内容的展示规则后请用户确认。 |
| 收藏、搜索无结果、空库 | 支持 | 收藏落 Catalog；搜索只基于真实返回字段；空库用零授权的新数据目录。 |
| “独立托管副本”、项目配置、预览、历史、撤销 | 部分支持 | 真实服务支持 Claude Code `.claude/skills` 的快照+链接、计划/回读/撤销；页面必须反映实际步骤与 hash，不能称“仅模拟”。 |
| shared/Codex/Pi/Cursor 的分组、`.agents/skills` 开关 | 不支持 | 当前唯一适配器为 Claude Code；保留该 UI 将构成未实现能力，必须先有原型修订与用户确认。 |
| “模拟已发现”、实际 Agent 兼容性 | 不支持 | 只能显示 discovery unknown；不运行 Agent，也不从目录存在推断发现。 |
| A0 的 conflict/broken issues | 不支持作为预置数据 | 真正诊断只报告授权项目中实际入口/快照问题，范围外为 unknown。若需要空诊断之外的视觉状态，用合成可复现的漂移/撤销失败路径，并先确认对应原型。 |
| GitHub 版本、更新差异、`v1.x`/开发版本 | 部分支持，非本轮最小 fixture | 服务有显式网络确认的公开 Git 路径，但 V0 默认不联网。仅在独立、已授权的合成 transport/网络证据下采集；不把 A0 版本文案当作真实版本。 |
| 设置中的“记住演示工作空间”、重置演示 | 不支持为生产工作流 | 生产持久元数据在服务端；该交互改变信息架构，需原型候选与确认。 |

## 不可越过的安全与真实性约束

- 不能使用 `reference/air/src/model.js`、localStorage 或静态 JSON 作为生产 fallback，也不能因视觉需要返回 `success:true`。
- 只读来源授权和项目写授权是两次独立确认；项目实际变更还必须经过服务端计划、预检、`confirm:true` 与幂等键。采证时不跳过事务来手工创建链接。
- 合成源的扫描不会递归执行，也不运行 Markdown、HTML、脚本或 Agent；来源/目标的链接、指纹或权限漂移必须保留拒绝路径。
- 采证截图与 API 摘要必须注明“合成 fixture”。它证明真实服务处理该合成材料，不证明用户真实目录、外部 Agent 或 GitHub 的状态。

## 交接阻塞与下一步

当前阻塞不是服务 API，而是视觉语义：A0 的多数信息架构以纯模型数据和多工具假设呈现，而生产服务只有本地只读来源与 Claude Code 事务。V0 可先对上述可构造状态做同内容截图；凡需保留的不可构造 A0 状态，主代理应先将差异记录到 coverage/gap inventory，制作独立原型候选，并等待用户确认后才进入 V2。

依据：`apps/server/app.mjs`、`catalog.mjs`、`operations.mjs`、`index.mjs`、`apps/web/src/client.ts`、`tests/api-domain.test.mjs`、`tests/operations.test.mjs`、`reference/air/src/model.js`。本报告为代码阅读结果；尚未进行运行时 API 调用。
