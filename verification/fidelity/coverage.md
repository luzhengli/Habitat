# 高保真覆盖矩阵（持续更新，未通过验收）

基线 A0 校验值：`A0-hashes.json`。候选 A1 未获确认，不是生产基线。
环境 macOS / 内嵌 Chromium；标准 CSS viewport 1440×960、1280×820、960×640、390×844。不能将 Safari 的窗口截图当作已校准 CSS viewport 的像素证据。

证据等级：`initial/` 是初始双页签结构审计（DPR 2/1 不同，不能像素验收）；`states/` 是 A0 可达状态原图；`library-restoration/` 是第一共享布局切片的同页签四尺寸对照；`library-slice-name-sort/` 是新增完整库控件后的切片。凡数据/状态不同仅用于发现差异，不标通过。

| 页面/状态 | A0证据 | 生产/当前缺口 | 当前结论 |
|---|---|---|---|
| 全局壳展开/折叠/最近项目 | initial/library；library-slice-name-sort | 侧栏折叠84px、真实项目3/3/2计数已接；品牌位置差30px，帮助待还原；全局搜索已接真实数据并通过Safari部分交互 | 部分实现，未验收 |
| 库标准卡片 | library-slice-name-sort/1440x960 | 全部9张卡片含内部样式/逐行文字及滚动520px对照已采；来源本地source，管理7/2与A0的6/3不相同；缺用量入口/更新标识 | 核心几何一致，内容/交互未齐 |
| 库列表 | library-list-name-sort/1440x960 | 真实列表切换已测，卡片元信息未齐 | 待完整对照 |
| 收藏/分类/排序 | A0 tabs与toolbar | 已实际验证3收藏、1数据分析、名称及用量排序接真实数据 | 缺逐状态截图 |
| 空库/无搜索结果 | A1状态入口；A0 Empty | 未授权空库保留旧实现；无结果恢复原型清除筛选 | A1新增状态待确认 |
| 范围不完整/元数据缺失/来源变化 | A1可切换状态 | 未接A1生产 | 待确认与采证 |
| 详情概览/使用位置/文件/版本 | states/detail-* | initial/detail-overview-populated：仍为旧简化详情；受控外框已准备、未接线 | 待V2 |
| 详情技术路径/长文件/读取错误 | A0源码；A1部分覆盖 | 实际API保留；缺对应同状态原型和生产双侧截图 | 待补候选/证据 |
| 添加来源三步/取消 | states/add-source、add-collection、add-target | 生产旧授权表单；A1独立本地/Git授权流、zip禁用 | 待确认 |
| 添加来源错误/部分/配额/二进制 | A1只覆盖部分 | 不能把全局状态notice视为全部具体错误态完成 | 未覆盖项待新候选 |
| 项目默认工作台 | initial/projects-populated | 项目当前旧简化配置；A1保留完整表格与工具边界 | 待确认后还原 |
| 项目其他范围 | states/project-other-scope；A1未知范围 | A1未知不是0，不生成假列表 | 待确认 |
| 项目添加选择/草稿/离开保护 | states/project-draft；A0选择器源码 | 服务草稿保留，完整toggle/选技modal/guard待还原 | 未完成 |
| 添加/移除/更新确认 | states/change-review；initial/change-review-populated | 真实预检存在，数量摘要/完整影响层级待A1 | 未完成 |
| 执行中/成功/失败/补偿/人工恢复 | A1部分恢复状态 | fixture通过真实计划执行回读形成8绑定；不等于全部UI覆盖 | 未完成 |
| 诊断列表/详情/全局影响 | initial/issues；states/diagnostic-detail、global-impact | A0全局写不可实现；A1只读范围候选 | 待确认 |
| 更新列表/差异/受影响项目/回退 | states/updates-list、update-preview | A1两阶段候选；实际Git API保留，尚未本轮浏览器重验 | 未完成 |
| 操作记录/撤销/不可撤销 | initial/history；A1恢复状态 | 真实事务与撤销测试保留；完整时间线待还原 | 未完成 |
| 设置/授权/导出 | initial/settings；A1设置 | A1来源管理分组待确认 | 未完成 |
| 长中文/路径/多变体 | fixture源路径；A1元数据缺失 | 缺专门逐状态对照 | 未完成 |
| Tab/Esc/焦点/IME/禁用/加载/reduced-motion | A0 Modal/CSS | Chromium折叠/库控件；Safari添加入口和Esc实测，焦点恢复未证明；IME未测 | 未完成 |
| 1440/1280/960/390 | library-restoration四尺寸有原图/叠加/diff | 首切片与最新库控件四尺寸同条件证据已补，仍有内容与交互差异 | 不代表全站覆盖 |
| 真实Safari | safari-slice/projects-after-esc.* | 已实际打开与交互；未完成同viewport原型对照 | 不代表视觉通过 |

合成fixture：`scripts/fidelity-fixture.mjs`；本次目录见 `fixture-plan.md`。旧service4175使用无绑定fixture；新service4176使用真实8绑定、3收藏fixture，不能混作同一状态。全部API操作只针对这些临时目录。

最终用户视觉验收：未通过、尚不可请求整体验收。M4保持reopened。

全局搜索补充：command-acceptance.md记录实际Safari搜索/跳转/Esc证据；Chromium新截图因四分之一画布异常作废，Tab/IME和校准像素对照未完成。当前Mac已锁定，等待用户手动解锁。

恢复轮补充：Mac已解锁；Safari普通Tab逃逸已修复，15控件完整循环、禁用控件跳过、嵌套弹窗返回焦点已实测。IME和所有指定视口的整体像素验收仍待完成。
