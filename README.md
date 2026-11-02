# Habitat Web

本地优先的 Skills 工作台。React Web + 同机 Node 服务，全新独立项目，不依赖旧 Habitat、Rust 或桌面壳。

**当前状态：高保真还原进行中，A1/A2 候选待用户确认。** 已有 V0 差异盘点和 A0 不变范围首切片；整体视觉验收未通过，M4 保持重新打开。按 [PLAN](PLAN.md) 的下一步续跑；[候选审阅入口](design/prototype-revisions/REVIEW.md)、[覆盖矩阵](verification/fidelity/coverage.md) 和 [高保真合同](docs/10-原型先行与高保真还原合同.md) 分别提供确认材料、缺口与验收要求。

后续 UI/交互设计变化必须先改独立原型候选，由用户确认后再做像素级实现。已有明确批准的设计可直接还原，不需要重复确认。生产 CSS 和既有实现不能替代 [已确认原型基线](design/prototype-baselines.md)。A1/A2 候选与生产实现独立，未获确认的变化不能进入生产。

## 安装与运行

推荐 **Node 24.14.0**（已实测），也已验证 Node 25.6.1。仅绑定 `127.0.0.1`，默认端口 4173。

```bash
npm ci
npm --prefix apps/web ci
npm run check
npm start
```

打开 http://127.0.0.1:4173/library 。`check` 包含 Node 单元/临时目录/HTTP 测试、源边界、严格 TypeScript 和 Vite build。首次安装不要使用 `--force`；提交的两个 lockfile 是实际解析结果。

开发：停止生产进程后运行 `npm run dev`，打开 http://127.0.0.1:5173 。端口占用会报错，不换成公网地址。终端 **Ctrl+C** 停服。`/demo` 仅为冻结 Air 原型，正式页面不导入原型模拟状态。

## 当前实现的功能用法（不代表目标界面已验收）

1. 在技能库点击“添加本地来源”，输入服务所在电脑的绝对目录，明确勾选只读授权。
2. 扫描该目录直接子目录中的 `SKILL.md`。来源不会移动，脚本不会执行；不自动扫描 home、全盘或 Agent 全局目录。
3. 查看用途、收藏、详情与范围问题。正文只作为文本，不加载远程图片或 HTML。
4. 在项目页登记已有目录，明确授权 `.claude/skills` 容器和受管入口。登记不自动安装。
5. 选择技能 → 服务端预览 → 确认。服务复制完整包到固定快照，再创建项目入口并回读。取消预览无文件施工。
6. 在操作记录预览撤销。旧 revision、目标占用、外来链接、个人修改或无法证明的状态会阻断，不强制覆盖。

库中“使用”与项目添加共用同一计划/事务。草稿保存在服务端并带并发版本。已配置不等于 Agent 已发现；首发适配 Claude Code 项目路径，其他作用域与运行时发现保持未知。适配依据见 [记录](verification/adapter-evidence.md)。

## 来源、更新与边界

设置页可撤销只读来源，导出元数据，添加公开 GitHub 来源。Git 下载仅使用 `api.github.com`，不读取凭据，不运行 git、hooks、子模块、LFS 或技能代码。先隔离下载并校验 blob，再确认收录。更新产生完整文件差异候选，保留旧来源；项目选择对应新版本后预览切换，操作记录可回退固定版本。GitHub 匿名配额耗尽时明确失败，稍后重试，不伪造下载成功。

当前限额：8 个有效来源，每个来源 500 个直接子项；SKILL.md/文本预览 256 KiB；托管包 1000 项、单文件 4 MiB、总共 20 MiB。托管拒绝符号链接和特殊文件。来源扫描中的链接列为覆盖缺口，不跟随。Git 仓库树最多 2000 项，所选目录最多 1000 项；单请求 15 秒，整体下载 90 秒。

## 数据、备份与恢复

默认 `~/.habitat-web/`：`catalog.sqlite`（schema v1，SQLite WAL、FULL）、`store/` 固定快照、`downloads/` 隔离候选、`git-collections/` 已收录 Git 内容。可用 `HABITAT_DATA_DIR=/absolute/path` 指定新的独立应用目录；不要放在 Agent 自动发现路径或项目/来源内部。一个数据目录只允许一个服务。

备份时先 Ctrl+C 停服，再复制**整个数据目录**；恢复时停服后使用备份目录启动。项目 symlink 指向原 Store 绝对路径，因此恢复到其他位置需要重新授权和配置，不能仅复制数据库后宣称入口恢复。设置中的 JSON 导出用于查看/保留元数据，不含快照正文，也不是自动恢复导入。

启动自动检查中断事务：只补偿有完整身份回读的对象。`recovery-required` 表示状态无法安全证明，会阻断新写入；保留文件和 journal，检查实际对象后人工处理，不提供 force 覆盖。空项目容器与无引用快照可能留存，不自动清理未知数据。schema 高于服务支持版本时拒绝启动，不降级覆盖；当前没有历史 Habitat 数据迁移。

SQLite 使用已测试 Node 内建 `node:sqlite`，该 Node 版本仍有 experimental 提示。仅本地单用户服务；安全边界不对抗已能以同一 OS 用户执行代码的恶意进程。

## 合成验收与平台

```bash
HABITAT_DATA_DIR=/private/tmp/habitat-demo-data npm run start:fixture
```

此命令仅明确读取本仓库 `fixtures/skills`，与正式默认无授权区分。生产失败不会回退为演示数据。

上一轮实测平台与截图、测试结果见 `verification/`；当前待办见 `PLAN.md`。这些记录不证明高保真还原通过。Chromium 内嵌浏览器与真实 Safari 分别验收；Windows/Linux 文件语义和 Firefox 未验收，不声称支持。没有公网部署、云账号、私有 Git 凭据或 Agent 付费运行集成。未经用户指令不 push、发布 npm 或部署。
