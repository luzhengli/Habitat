# 验证记录的层级

current-* 是2026-09-22本次操作；historical-*是原Air包附带历史。两者不能相加后声称全是新Web测试。

current-node-check.log：27项通过（14服务、13原型模型）。
current-contract-typecheck.log：仅领域合同，TS5.8.3。
current-jsx-syntax.log：4份JSX可转译语法，不证明npm依赖/Vite/React类型。
current-npm-registry.log：安装前置网络检查失败，EAI_AGAIN。
current-browser.log：ERR_BLOCKED_BY_ADMINISTRATOR；没有生成本轮通过结果或截图。
reference-preservation.json：HTML和设计PNG的SHA-256与原包比对。

无需前端依赖即可跑npm start和npm run check；依赖安装、Vite和正式浏览器测试必须由Codex M0补齐。
