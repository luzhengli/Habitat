# V2-C 前端切片只读审查

日期：2026-09-22。审查范围为 `apps/web/src/App.tsx`、`Management.tsx`、`web.css`、`styles.css` 与新增受控呈现组件；未操作浏览器、未启动服务、未运行全量 gate，也未审查待确认的 A1 设计范围。

## 结论

发现 1 个会阻断移动端项目导航的回归，及 1 个 URL/焦点一致性问题。项目登记、草稿、计划和执行仍通过 `request()` 进入受保护 API；本次切片没有发现绕过 session、CSRF、明确项目写入确认或服务端计划确认的路径。

## 可操作问题

### P1：移动端选择最近项目后侧栏仍覆盖新页面

触发：在窄窗口打开导航，点“最近项目”的任一项目行。`App.tsx:40` 仅 `navigate('/projects/:id')` 并手动派发 `popstate`，没有 `setMobileMenu(false)`；项目行是同页路由按钮，不会像现有 `<a>` 导航那样重新加载并重置 state。`styles.css:572-582` 保持 `.sidebar.mobile-open` 为可见的 z-index 80 抽屉，并保留 z-index 70 遮罩，因此用户仍无法操作刚切换的项目内容。

修复建议：在项目行的 click handler 中、调用 `navigate` 前后关闭 `mobileMenu`；侧栏“添加项目”同样应关闭菜单，再请求 dialog。修复后应在 800px 以下验证项目行与加号：内容可操作、Esc/关闭 dialog 后焦点回到触发按钮、遮罩不残留。

### P2：侧栏新增项目成功后 URL 不指向该项目

触发：从最近项目加号打开“添加项目”，完成明确授权。`Management.tsx:35` 只 `setSelected(p.id)` 和 `load()`，保留之前由加号写入的 `/projects`；`App.tsx:40` 的当前态又依据 `url.split('/')[2]`，因此新项目在侧栏不会显示 current，刷新/复制 URL 也不能回到刚登记的项目。

修复建议：登记成功后通过单一的项目导航回调把 URL 写为 `/projects/:id`，而不是仅设置 Management 内部 selected state。该回调应同时完成父层 URL state 更新，避免依赖手工 `PopStateEvent`。

## 已核对的状态与安全边界

- `onAddRequestHandled` 对当前正常路径有效：`App.tsx:39` 增量 `projectAddRequest`，Management mount/update 时在 `useEffect` 中打开 dialog 并回调将请求重置为 0（`Management.tsx:15`）；取消后不会因保留正数而再次打开。它不是上述移动端抽屉问题的修复。
- 最近项目计数由 `GET projects/:id/exposures` 的真实 items 长度取得；项目登记完成后 `onProjectsChange → refresh` 会重新读取列表。所有调用均通过 `client.ts:3-18` 的同源 cookie、`X-Habitat-Client` 与 CSRF 请求链。
- 项目登记仍要求 `writeScope: '.claude/skills'` 和用户勾选 `confirm`；真实写入仍保留在 `plans`、`operations` 与服务端预检/确认链，未见客户端伪造成功或直接写 binding。
- `LibraryControls`、`SkillCard` 与 `SkillDetailFrame` 仍未接入 App，因而不改变当前运行时 API/URL/焦点行为。其 props 由父层提供；`SkillDetailFrameProps.origin` 当前未使用，接入时应移除或用于已确认呈现位置，避免把未渲染字段误当作契约。

## 检查证据

已执行：针对切片的 `git diff`、源码/样式逐行检查、`git diff --check`。未运行浏览器或 build；上述 P1/P2 是由现有 React state、同页路由和 CSS 层级直接推导，待主代理修复后用浏览器验证。
