# V0–V2 差异清单

完整页面/交互清单见 source-audit.md；实际采证覆盖见 coverage.md。本清单不把源码盘点或截图存在当作验收通过。

| ID | 实测/代码证据 | 分类 | 当前处理 |
|---|---|---|---|
| G01 | 主内容上padding32而A0为43，页头上移11px | 直接还原 | 已移除覆盖；1440同DPR同排序主内容/页头坐标尺寸一致 |
| G02 | A0品牌y52，生产y22 | Web候选 | 差30px保留待A1确认；候选保留52px并LOCAL WORKSPACE |
| G03 | 四范围tabs/分类/排序/grid-list缺失 | 直接还原 | 已接真实metadata/收藏/active bindings；库tabs/toolbar/grid几何与A0一致 |
| G04 | 最近项目与侧栏折叠缺失 | 直接还原 | 已接真实project与exposure，折叠宽84；Safari/Chromium实际操作 |
| G05 | 卡片收藏为通用32px图标，全部file/blue | 直接还原 | 收藏恢复A0 15px星与saved类，读取来源声明icon/color/title；缺声明沿用旧默认待A1 |
| G06 | 卡片缺用量入口/更新，来源统一硬编码 | 直接还原+数据约束 | 来源来自授权source路径名，管理来自active binding；用量点击/更新待详情及A1衔接 |
| G07 | 默认详情整篇原文，无四tab/hero | 直接还原+缺失状态候选 | SkillDetailFrame/SkillCard受控组件已准备，未接路由；不能报完成 |
| G08 | 项目简化checkbox列表，缺项目表格/toggle/chips/draft guard | 直接还原+能力候选 | A1完整候选，生产仍待还原；真实事务不变 |
| G09 | 添加Skill/本地授权/Git隔离下载/zip边界冲突 | 候选 | A1三步授权流已可运行，未获批准 |
| G10 | 诊断全局修复/多工具/模拟发现与真实API冲突 | 候选/能力缺口 | A1保留结构，禁用未支持工具；未知范围显示未知而非0 |
| G11 | 原型更新一步覆盖与真实候选收录+单项目切换不等价 | 候选 | A1两阶段展示，生产未迁入候选 |
| G12 | 历史/设置生产为技术表单与JSON，原型演示语义不适用 | 候选 | A1真实设置与恢复示例；未覆盖所有失败态 |
| G13 | 新增最近项目移动点击未关侧栏；新增项目URL不更新 | 代码审查 | 已修复navigate关闭mobileMenu，登记成功historyRoute；待完整移动端回归 |
| G14 | 折叠后links无可访问名称 | Safari实测 | 已增加aria-label/title，待最终Safari重验 |
| G15 | 数据异步分批提交时短暂把托管显示0 | 实测 | refresh在inventory/source/project facts全部成功后提交，避免先显示错误关系 |
| G16 | 最近收录无法用字母序证明 | 数据真实性 | 新增真实firstIndexedAt；重扫保留，旧数据null不伪造；新增2项语义测试 |
| G17 | 两页签DPR2/1；切换尺寸瞬间截图高度未稳定 | 环境缺口 | 原始批保留仅作结构审计；同页签重采，diff脚本拒绝尺寸/DPR不符，不缩放修图 |

## 已量化的1440×960切片

`A0/library-slice-name-sort/1440x960/comparison.json`：sidebar/topbar/main-content/page-heading/library-tabs/library-toolbar/skill-grid/首卡的 x/y/width/height delta=0；brand y delta=-30。这只证明这些测量项，不证明字体/卡片全部内容/所有交互通过。A0原型6托管3仅收录，真实合成fixture为7个有active binding的Skill与2个纯收录，不能通过改业务事实凑数。

## 尚待确认或验证

A1 hash `f5386425ea0968c958206875037677d6b96b4d343a01ff65719e5893d46293a4` 已展示并请求确认。用户未回复不构成批准。完整Safari同视口对照、全部功能状态、IME/焦点、所有viewport逐页面矩阵与最终用户视觉验收尚未完成。V0–V3/M4均不能关闭。

## 全部9卡与内部文字复核

证据：A0/library-full-card-audit/1440x960 及 library-scrolled-card-audit/1440x960。测量不再截断前12元素；同卡片scope配对避免可选更新状态串位。9个标题及9个描述的内容、字体与逐行文字矩形全部一致，9个来源标签内容不同。缺少9个usage-count和9个metadata-dot；因此管理标签实际左偏81.66–106.34px，不是渲染噪声。原型更新标签与生产普通ownership也不能互相当同状态。

未获批准的A1仍未接入。A2作为独立失败/恢复状态候选开发中，不能把其中示例当实际服务结果。
