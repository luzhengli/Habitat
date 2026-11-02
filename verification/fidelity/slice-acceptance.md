# A0 不变范围首切片：实施结果（不是整体验收）

## 实际修改

- `App.tsx`：恢复侧栏折叠和最近项目、范围tabs、分类/排序/两种视图、A0收藏按钮；title/icon/color只来自已授权来源解析的metadata。项目数取真实exposures，托管筛选目前指active项目绑定的固定副本关系，不推断Agent发现，不将遗留无引用快照当作独立托管实体。
- `LibraryControls.tsx`：A0逐字DOM/classes的受控控件。`SkillCard.tsx`、`SkillDetailFrame.tsx`：后续呈现组件准备，尚未进入路由；不是已完成详情。
- `web.css`：移除主内容padding-top=32覆盖，恢复A0所有现有断点；未擅自采用A1顶部方案。
- `Management.tsx`：最近项目添加入口复用原授权表单；消费打开请求，避免重新挂载误弹；登记后URL同步，事务后更新导航事实。授权/plan/execute/readback/undo保留。
- `catalog.mjs`：记录真实firstIndexedAt，重扫稳定，旧数据null不伪造历史；新增2个语义测试。
- `Icon.tsx`：不将来源声明的__proto__/constructor当成图标路径；未知名称按现有box回退。

## 真实验证

`check.log`：54/54测试、源边界、strict TSX、Vite build通过。随后Icon own-property防护使用实际React SSR验证file/__proto__/constructor/missing-icon四项（icon-render.json，禁用网络），再次typecheck/build通过。首次试验SSR工具误尝试默认WebSocket监听，被沙箱拒绝；随后显式ws:false/hmr:false，无公网监听。

Chromium：9项真实技能；3收藏筛选→3卡；数据分析→1卡；grid/list类真实切换；最近项目3/3/2由8绑定聚合；折叠宽84；添加modal Esc后dialog数0、焦点回.sidebar-mini；mobile-nav.json证明点最近项目后overlay=0/mobile-open=false，URL含对应项目ID。来源/项目/事务全部是独立合成tmp，不触碰真实技能。

Safari：实际打开现有生产列表、折叠/展开、最近项目添加、Esc关闭，截图/AX在safari-slice。Safari后续被用户用于查看A1候选，停止控制该页面；不能将这部分检查写成最终Safari视觉或焦点验收。

## 对照结论

最新 `A0/library-slice-name-sort/{1440x960,1280x820,960x640,390x844}` 保存同Chromium、DPR1、同CSS视口、同名称排序的原型/生产原图、环境测量、叠加、差异、并排和comparison.json。四尺寸的主内容/页头/tabs/toolbar/grid/首卡几何一致；brand y仍-30px（待A1）。原图不修改/不缩放。

存在未消除差异：卡片用量入口/更新标识、来源内容、A0管理6/3与真实7/2、帮助/搜索、顶部Web文案、详情与其余全页结构。列表视图也有同条件图，但不能据此宣称完整。不同业务文本/状态明确记录，不能用总像素百分比替代局部审查。

A0原始22项文件hash核查未变化。原始12PNG的不同高度与历史状态保留，详见source-audit.md。

## 当前门槛

A1 hash f5386425ea0968c958206875037677d6b96b4d343a01ff65719e5893d46293a4 已向用户展示，尚未确认。未确认候选未进入生产。A1只覆盖已经可交互展示的状态；完整失败、恢复、IME、长内容、多变体、Safari同条件和最终用户视觉验收仍待完成。V0/V2不能按此切片全部关闭，V3/M4保持未完成。

证据工具复核：重复卡片现按组件出现次序一一对应，不重复使用第一张；3项专项测试通过。9组报告已重算，详见 evidence-tool-recheck.json。当前DOM测量仅前12个元素（含4张卡片），不能推论未采样卡片。
