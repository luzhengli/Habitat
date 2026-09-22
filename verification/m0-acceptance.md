# M0 实测记录 · 2026-09-22

- macOS arm64，Node 25.6.1，npm 11.9.0；当前实际验证版本，Node 24 LTS 留到发布矩阵复验。
- 已有精确 package.json 和真实 lockfile，setup:web 正确拒绝重新解析，随后 npm --prefix apps/web ci 成功（24 packages）。
- React/ReactDOM 19.3.0，Vite 8.3.0，TypeScript 7.0.2；所有生产 React 组件迁为 TSX，allowJs=false。
- npm run check：27 tests、源边界、严格类型与 Vite build 全通过。记录 m0-check.log。
- 生产入口 127.0.0.1:4173/library 真浏览器无授权空态；1440×960、960×640 截图已留存。
- 开发服务 127.0.0.1:5173 实际启动；先前占用端口明确失败，停止重复服务后重启成功。
- 原型 CSP nonce 全局替换破坏脚本字符串：改为仅匹配主 script 标签，原型原件保留。
- 详情采用 URL 深链和 popstate；所有合同页面有入口，未来能力明确禁用；未知静态路径 HTTP 404。
- 安全测试需沙箱外监听 loopback；不开放公网，不扫描用户目录。
