# 05 · 领域模型与 API 合同

> 2026-09-22 实现更新：下文“当前基座/尚未实现”描述为交付时快照。现有真实实现与能力以 README、PLAN、/api/v1/capabilities 和 verification/m0–m4 验收为准；安全约束仍有效。
## 当前接口与目标接口必须分开

`contracts/bootstrap.ts` 描述本包现在的只读结果；`contracts/domain.ts` 是 M1+ 实施基线。当前扫描的ID由根与相对路径导出、无持久数据库，不能冒充目标域稳定UUID。HTTP输入的运行时schema校验需M0/M1补充，TypeScript interface本身不校验请求。

现有接口（除session外均需session cookie + X-Habitat-CSRF；所有API还需X-Habitat-Client）：

| 路径 | 当前真实行为 |
|---|---|
| GET /api/v1/session | 创建本地短期会话；可读取响应csrf，不把cookie交给JS |
| GET /api/v1/capabilities | 描述已经实现/未实现能力，不是产品路线图 |
| GET /api/v1/sources | 返回启动时已授权的只读目录 |
| GET /api/v1/inventory | 有界扫描直接子目录，保留缺口；不解析frontmatter |
| GET /api/v1/skills/:id | 只读返回最近扫描ID对应SKILL.md；变化则409 |
| 认证后的任意非GET API | 501 NOT_IMPLEMENTED，无文件副作用 |

bootstrap的GET inventory不写用户文件或持久索引，仅刷新内存观测。正式异步扫描使用POST jobs，轮询结果另行GET。session是访问本地服务的请求保护，不是云账号。

## 目标域实体

Source与Grant分开：来源描述内容在哪里、如何获取；授权描述允许读写的范围。Skill稳定id与name分开；SkillVersion按完整内容manifest识别。Project有稳定id、root身份和revision；Binding指向固定版本和被管理的具体入口。

Exposure是观察结果，不是用户期望开关：包含Agent、项目、scope、路径、配置与发现状态、证据时间。相同内容多路可见不能重复算多项技能；同名异内容仍是不同版本/变体。

Plan是待执行的不可变预览；Operation是有durable journal的执行过程；Evidence证明某一步的当前事实。分离用户意图、规则推断和真实回读。

## 目标 API（M1–M3；全部尚待实现）

| 阶段 | 方法与路径 | 输入核心 | 输出与副作用 |
|---|---|---|---|
| M1 | POST /api/v1/sources | absolutePath、明确read授权 | 校验后持久sourceId/grantId；不改源 |
| M1 | POST /api/v1/scans | sourceIds | jobId；有界只读，产生snapshot |
| M1 | GET /api/v1/jobs/:id | opaque id | progress、coverage、结果/错误 |
| M1 | GET /api/v1/skills | 搜索/过滤/游标 | 可分页库，不暴露所有正文 |
| M1 | GET /api/v1/skills/:id/files/:fileId | 文件ID | 有界文本或明确unsupported |
| M1 | PATCH /api/v1/skills/:id/preferences | 收藏/注释 | 只更新本应用元数据 |
| M2 | POST /api/v1/projects | directory、defaultAgentIds | 登记身份/范围；不自动安装 |
| M2 | GET /api/v1/projects/:id/exposures | projectId | 配置与其他范围可见分开 |
| M2 | POST /api/v1/plans | typed Intent | planId/hash/expiry/steps/diagnostics |
| M2 | POST /api/v1/operations | planId/hash/idempotencyKey | 202 operationId；确认后持久执行 |
| M2 | GET /api/v1/operations/:id | operationId | 当前状态/步骤/回读/恢复要求 |
| M2 | POST /api/v1/operations/:id/cancel | id | 仅安全边界接受，不承诺立即回滚 |
| M2 | POST /api/v1/plans | undo-operation意图 | 撤销也先预检预览，不直接执行 |
| M3 | POST /api/v1/diagnostics | projectId、requestedChecks | 只读解释/可选受控运行检查 |
| M3 | POST /api/v1/source-checks | sourceId | 受限Git检查/更新候选，不立即覆盖 |

普通请求不接收任意shell或绝对文件读写列表。未来来源授权是明确的少量绝对路径入口，之后一律opaque ID引用。idempotencyKey同key异payload必须409；同key同payload返回原操作。

Plan步骤至少记录before身份/内容、期望目标、拟执行动作和影响。用户确认hash不匹配、snapshot过期、权限撤销或目标漂移时409/412，要求重新预检。不要通过复用旧confirm弹窗把已变化计划偷偷执行。

## 错误合同

```json
{
  "error": {
    "code": "SOURCE_CHANGED",
    "message": "来源在预览后发生变化，请重新检查。",
    "requestId": "opaque-request-id"
  }
}
```

生产扩展字段：phase、operationId、boundedPath、expected/actual摘要、retryable、recovery。源内容/密钥不写错误日志。401是会话过期；403是请求/范围不允许；404未知ID；409状态漂移/幂等冲突；413超限；422结构错误；501尚未实现；500服务内部失败。不同原因不能都变成“没有技能”。

## HTTP 与文件事件并发

多个标签页共享后端状态，不各自拥有真相。项目编辑携带revision，后发旧revision应冲突；可提供草稿恢复，但不得覆盖他人或另一标签的新变化。

执行采用202+operationId；重试/刷新先查询。不要求WebSocket，先受控轮询，之后有实际需要再加SSE。query不能隐式重发mutation。服务停止/连接重置不代表操作终止。

## 标准与适配

SKILL.md元数据用规范YAML解析器，不用本包目录名或旧prototype模拟值。保留未知字段、诊断缺失/无效必填、限制输入大小/别名展开等资源。首发不根据内容自动生成AI描述。

AgentAdapter注册表是版本化产品知识：路径、优先级、共享入口、支持等级、实测日期。首发先少量已验证工具。不能把历史Code样例中的Codex/Pi/Cursor、Claude、Trae分组当成所有当前版本的绝对事实。
