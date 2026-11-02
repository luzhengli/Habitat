# A1 Web 真实能力适配候选

状态：`draft`，未获用户确认。本目录不是生效基线，不能导入生产。

## 目的

保留 A0 的完整信息结构、布局、组件和交互，把桌面宿主与固定演示业务语义改成当前 Habitat Web 的真实能力边界。候选只使用合成数据和浏览器内状态，不请求 Habitat API、不读取本机文件、不联网、不执行 Skill/Agent，也不写项目。

## 相对 A0 的可审阅变化

- 保留 52px 标题区空间；`DESKTOP PREVIEW` 改为 `LOCAL WORKSPACE`，移除拖拽属性；顶栏标记为 `A1 候选预览`。
- 保留库 tabs、筛选、排序、网格/列表、卡片与详情四 tab；“已托管/仅收录”继续表达管理关系，Git/本地只在来源字段中表达；增加可切换的未授权、部分扫描、元数据不完整、来源漂移、恢复待处理状态。
- 添加 Skill 仍为三步流，但明确拆分本地只读授权、公开 GitHub 联网授权与项目写入确认；zip 和独立“托管副本”明确禁用。
- 项目保留工具 chips、项目卡、配置表、toggle、草稿栏和确认 modal；Claude Code 为当前可配置 adapter，Codex/Pi/Cursor 保留位置并明确禁用。检查只核对受管入口/快照，Agent 发现保持未知。
- 诊断改为只读授权范围和可执行动作，不再提供未授权全局修复或任意来源重定位。
- 更新改为两阶段语义：先隔离下载并仅收录完整包候选，之后在各项目中单独预览固定版本切换。
- 历史补充 `recovery-required` 合成状态；设置改为浏览偏好、管理方式、来源授权与元数据导出。
- 960px/390px 继续沿用 A0 既有响应式规则；本轮未创作新的布局断点。

## 仍待用户确认

- Web 保留 52px 顶部空间及 `LOCAL WORKSPACE` 文案是否合适。
- 禁用 adapter 的 chips、只读检查、未知范围与两阶段更新的信息层级。
- “其他范围可见”明确显示未知且不列假技能；元数据不完整状态展示目录名、来源名、用途和版本 fallback。
- 添加来源流程中，本地/Git 顺序、zip 禁用位置及“加入项目草稿”的衔接。
- `recovery-required`、来源漂移、部分扫描等错误状态的默认密度与操作入口。
- 960/390 下真实长中文、长路径、IME、键盘焦点和底栏滚动仍需浏览器证据。

## 构建与预览

复用已经锁定在 `apps/web/node_modules` 的 React/Vite，不安装依赖、不修改 lockfile：

```bash
cd design/prototype-revisions/A1-web-real
node build.mjs
../../../apps/web/node_modules/.bin/vite --config vite.config.mjs
```

构建入口：`dist/index.html`；自包含审阅文件：`dist/Habitat-A1-web-real.html`。开发预览仅绑定 `127.0.0.1:5191`。

## 文件来源

`src/App.jsx`、`src/model.js`、`src/components/*`、`src/styles.css`、`src/tokens.css` 和 `src/icon-data.json` 由 A0 展示源码复制后在本候选目录内修改。它们是原型 fixture，永远不能导入 `apps/web` 或充当真实业务数据。
