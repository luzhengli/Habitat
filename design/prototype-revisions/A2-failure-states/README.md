# A2 失败与恢复状态候选

状态：`awaiting-user-confirmation`，已展示范围见[基线登记](../../prototype-baselines.md)，未获用户确认。本目录不是生效基线，不能导入生产。父候选是仍待确认的 `A1-web-real`，A0/A1 原件与生产文件均未修改。

## 入口与边界

- 源入口：`index.html`；构建入口：`dist/index.html`。
- 自包含审阅文件：`dist/Habitat-A2-failure-states.html`。
- 自包含文件 SHA-256：`fb14fb3abb64c1c9b9a4ddaccc9c6f9ca1111bfd767639649791abc23cc3a243`。
- 预览配置：`http://127.0.0.1:5192/`，只绑定 loopback，`strictPort: true`，并显式设置 `hmr: false`、`ws: false`，不启动 HMR/WebSocket。
- 右上角“状态”按钮可直接打开每个具体流程画面；按钮分支只修改浏览器内合成状态。
- 候选不请求 Habitat API、不联网、不读取或写入本机文件、不执行 Skill/Agent，也不把失败标成生产成功。

## 具体状态

| 流程 | 可直达状态 | 真实语义依据 |
|---|---|---|
| 来源与下载 | 来源授权撤销、网络失败、Git 配额可能性、技能包被拒绝 | `GRANT_REVOKED`、对外 HTTP 500 `INTERNAL_ERROR`、`GIT_LIMIT` / `UNSAFE_GIT_ENTRY` 默认 HTTP 422 |
| 详情读取 | 二进制不预览、文本超限、来源发生漂移 | `UNSUPPORTED_BINARY`、`FILE_TOO_LARGE`、`SOURCE_CHANGED` / `FILE_CHANGED` |
| 项目预检 | 计划过期、并发 revision、目标占用、个人修改 | `PLAN_EXPIRED`、`REVISION_CHANGED` / `DRAFT_CHANGED`、`TARGET_CONFLICT` / `TARGET_CHANGED`、`PERSONAL_MODIFICATION` |
| 执行与恢复 | `running`、回读成功、`rolled-back`、`recovery-required` | 持久步骤、回读、反向补偿与恢复阻断状态 |
| 撤销与版本 | 撤销被阻断、固定版本回退 | `LATER_CHANGE` / `UNDO_UNAVAILABLE`、`undo-operation` 新计划 |

每个画面使用 A1 已有的 modal、drawer、notice、状态事实与列表层级。主要动作会在当前浮层内实际打开授权/下载表单、可点击文件清单、草稿比较、预检摘要、项目配置或恢复步骤证据；不是只用一条 notice 声称已跳转。固定版本回退先确认计划影响，再进入单独执行确认。运行中安全取消会短暂锁定 Esc/背景关闭，完成持久记录后只显示 `cancel-requested`，不会伪造 `rolled-back` 或成功。来源/详情/项目/执行错误不依赖一条全局 notice 承载。

## 构建

复用 `apps/web/node_modules` 中已锁定的 React/Vite，不安装依赖、不修改 lockfile：

```bash
cd design/prototype-revisions/A2-failure-states
node build.mjs
node verify.mjs
```

## 未覆盖与待确认

- 这是失败/恢复状态候选，不替代 A1 的 Web 顶栏、来源授权、工具边界、两阶段更新和设置确认。
- GitHub 非 200、超时或普通网络错误当前都对外返回 HTTP 500 `INTERNAL_ERROR`，且消息被替换为通用失败；API 不提供上游 HTTP 状态或限流证据。“Git 配额可能性”只是合成审阅场景，不能据此判断账号状态。
- 网络或技能包下载失败时没有持久 `git-candidate` / 来源记录，但 `downloads/<uuid>` 隔离目录可能残留并需要服务清理；候选不承诺失败后目录不存在。
- 二进制预览在严格 UTF-8 解码失败或检测到空字节后返回 `UNSUPPORTED_BINARY` HTTP 422；没有把“未解码”描述成实现事实。
- 不新增强制覆盖、任意来源重定位、一键全局修复、下载超限文件或恢复写入能力。
- 960/390 下的最终视觉、焦点恢复、IME、Safari 和与生产实现的截图 diff 仍由后续冻结版本验收承担。
- 内容 hash 已冻结并展示，当前为 `awaiting-user-confirmation`；只有用户明确确认具体版本/范围才可提升为基线。
