# 原型基线与确认登记

## 现有基线 A0

- 来源：用户提供并已认可的 Air 原型，本次用户再次明确要求以其为高保真还原目标。
- HTML：`reference/air/Habitat-Air.html`。
- 源码与样式：`reference/air/src/`（只复用设计，不导入模拟业务模型）。
- 截图：`design/01–12` PNG，具体索引见 `design/00-截图索引.md`。
- 定位：A0 是原始设计基线，不是当前生产 UI；未声明新的 Web 改版获得用户确认。
- 一致性：文件 hash 已记录于 [A0-hashes.json](../verification/fidelity/A0-hashes.json)，源码/截图关系见 [source-audit](../verification/fidelity/source-audit.md)，逐页覆盖见 [coverage](../verification/fidelity/coverage.md)；已有盘点不代表全部状态验收。

## 候选与生效规则

修订保存在 `design/prototype-revisions/<revision>/`，包含可运行原型、源码/构建说明、变更清单和必要视口截图，保留 A0 原件。

每次登记以下字段：revision、父基线、候选入口、文件 hash/commit、涉及页面/状态、修改原因、截图、确认状态、用户确认消息/日期、确认范围、被替代的版本。状态仅按真实过程使用 `draft` → `awaiting-user-confirmation` → `approved`（或 `rejected`/`superseded`）。

未获确认的字段填写“待确认”，不编造时间或确认依据。批准以具体内容 hash 为准；批准后有设计变更需创建新修订，不能悄悄覆盖该版本。明确确认的页面范围之外仍沿用原有效基线。

当前无已确认的新修订。原型先行、还原与验收规则见 `docs/10-原型先行与高保真还原合同.md`。

## 本轮核验与 A1 候选（2026-09-22）

A0 原始文件未修改，完整 SHA-256 见 verification/fidelity/A0-hashes.json。HTML/源码/PNG 的视口与状态区别见 source-audit.md；PNG 04–10 高 1000，不能混作 960 图。

- revision：A1-web-real；父基线 A0；状态：awaiting-user-confirmation。
- 入口：design/prototype-revisions/A1-web-real/dist/Habitat-A1-web-real.html。
- 内容 SHA-256：f5386425ea0968c958206875037677d6b96b4d343a01ff65719e5893d46293a4。
- 范围：候选 README 所列已展示的 Web 顶部、来源授权、工具边界、两阶段更新、设置及部分恢复/元数据缺失状态。不是全部 docs/10 失败矩阵。
- 审阅：[自包含 HTML](prototype-revisions/A1-web-real/dist/Habitat-A1-web-real.html)；临时预览启动方式见 [REVIEW](prototype-revisions/REVIEW.md)，不假定端口仍存活；截图：verification/fidelity/A1-web-real/。
- 确认消息/日期/范围：待用户确认；本轮已展示并明确请求确认。
- 被替代版本：无；批准前 A0 继续有效。

## A2 独立失败/恢复补充候选（2026-09-22）

- revision：A2-failure-states；基于仍待确认的A1复制，A1内容hash保持不变。
- 状态：awaiting-user-confirmation；不替代A1，不进入生产。
- 入口：design/prototype-revisions/A2-failure-states/dist/Habitat-A2-failure-states.html。
- SHA-256：fb14fb3abb64c1c9b9a4ddaccc9c6f9ca1111bfd767639649791abc23cc3a243。
- 范围：17个来源/详情/项目预检/执行补偿/撤销与版本状态，以及README记录的具体合成分支。
- 审阅：[自包含 HTML](prototype-revisions/A2-failure-states/dist/Habitat-A2-failure-states.html)；临时预览见 [REVIEW](prototype-revisions/REVIEW.md)，右上角“标准工作区”进入状态选择器。
- 浏览器证据：verification/fidelity/A2-failure-states/；API语义复核：verification/fidelity/a2-api-contract-review.md。
- 确认消息、日期、范围：待用户确认；Agent构建/浏览器检查不构成批准。
- 未完成：完整Safari、全状态全部尺寸、IME、生产实现与最终视觉验收。
