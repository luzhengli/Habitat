# Habitat Tauri 2 Feasibility Spike

## 结论

建议进入正式 MVP，但应先把本原型的路径安全内核保留为独立、可审计模块，并补充命令超时、权限错误矩阵和真实项目兼容性测试。本轮 Discovery 闭环已经成立，不建议在 Spike 内继续扩展产品功能。

## 已验证能力

- 在现有仓库根目录初始化 Tauri 2 + React + TypeScript + Vite + Rust，没有创建第二层 Habitat 目录。
- 在 macOS 原生 Tauri 窗口选择唯一 Skill Store 和项目目录。
- 扫描 Store 根目录与 `.agents/skills` 的有效 `SKILL.md`。
- 从真实临时文件系统得到 `此项目已链接（3）`、`可添加到此项目（1）`。
- 检查器展示真实名称、描述、版本、来源、项目路径、Store 源路径、目标路径与相对链接值。
- 真实预检验证 source/project canonical 路径、Store/项目边界、容器类型、目标冲突、名称和相对路径。
- 创建相对 symlink 后列表从 3/1 变为 4/0；解除后回到 3/1。
- 解除操作只调用项目目标上的 `remove_file`；实测 Store 中 `project-harness/SKILL.md` 仍存在。
- `npx skills list --project --json` 在真实 Tauri 命令中退出码为 0，stdout JSON 被保留并显示。
- `git status --short` 与 `git diff` 通过固定参数 Rust 命令运行；干净工作区与无文本差异状态均被真实显示。
- `npm run build`、9 个 Rust 路径/symlink 测试和 debug `.app` 构建通过。
- 1440×1024 三栏、1024px 抽屉、添加成功与真实目录冲突四类视觉状态已保存。

## 安全边界

- 前端不能提供程序名、命令字符串或任意参数；Rust 仅允许三个固定命令签名。
- 所有 Store 与项目入口先 `canonicalize` 并要求为真实目录。
- 容器和目标使用 `symlink_metadata`（lstat 语义）检查，不跟随未知容器链接。
- Store 内的 symlink skill 候选被忽略；不会跟随到 Store 外部。
- `.agents` 与 `.agents/skills` 必须是项目内真实目录；普通文件或 symlink 容器会阻断操作。
- 不覆盖普通文件、真实目录、失效 symlink 或指向其他位置的未知 symlink。
- 重复添加同一正确链接是幂等成功，不重写链接。
- 解除前再次解析并比对真实 source；未知或失效链接不会被猜测删除。
- dirty worktree 会明确显示警告；只有用户点击当前主操作才会发生项目链接变更。
- Store 源目录不会被删除、移动或修改。

## 未解决问题

- `std::process::Command::output` 尚无超时与取消；正式 MVP 应为 `npx` 和 Git 增加可取消、可配置上限的异步执行器。
- `npx skills` 的 JSON schema 和 agent 列表由外部 CLI 决定，可能随版本变化；本原型保留原始 stdout/stderr，未做版本锁定或语义迁移。
- `SKILL.md` frontmatter 解析器只处理本 Spike 所需的单行 `name`、`description`、`version`；正式 MVP 应使用明确 YAML frontmatter 规范并保留解析诊断。
- 当前不持久化 Store/项目选择，应用重启后需要重新选择；这是“不引入数据库”与 Spike 范围下的有意限制。
- macOS 文件权限、受保护目录、网络断开、npx 首次下载与超大 Git diff 仍需更完整的错误矩阵。
- 未实现 Finder 跳转、Git remote/更新比较、设置页、自动更新或任何 Marketplace 能力。

## 视觉偏差

- 原型图展示多个历史项目与设置入口；本轮只保留当前选择的唯一项目和唯一 Skill Store，因为多项目持久化与完整设置是非目标。
- 临时测试路径位于 `/private/var/...`，比原型图中的 `/Users/...` 更长，因此路径框换行更多；内容保持真实，没有为截图伪造短路径。
- 右侧增加了需求明确指定的 Git 与 npx 状态区；相较原型图内容更长。为保证主操作始终可见，安全说明和当前操作固定在检查器底部，正文独立滚动；规则及原因已回写 `DESIGN.md`。
- UI 使用单一 Lucide 线性图标库；没有逐个复刻原型图中的自定义 skill 图标。
- 原生窗口受当前显示器可用区域限制，补充保存了 1148×768 的真实 Tauri 截图；规定尺寸截图由同一 React 界面在 Vite QA 路由中渲染，数据由 Rust 从同一真实临时文件/symlink 状态生成。

## 是否建议进入正式 MVP

是，有条件建议。

进入条件：

1. 固化 Skill frontmatter 与 npx JSON schema 兼容策略；
2. 为外部命令增加超时、取消与输出上限；
3. 在只读真实项目样本上扩展权限、路径、Git dirty 与链接迁移测试；
4. 决定选择状态使用轻量配置文件还是系统偏好存储；
5. 保持“显式预检 → 明确确认 → 最小链接变更”的交互契约。

## 下一阶段建议（不在本轮实施）

- 将 `skills.rs` 拆分为纯路径策略、Store 扫描、项目链接、外部命令四个可审计模块。
- 加入异步命令任务、取消、超时、输出截断与重试说明。
- 用更多真实但只读的项目夹具做兼容性矩阵，不直接修改用户的真实 Skill Store。
- 为首次选择、权限拒绝、CLI 不存在和 schema 不兼容补充专门界面状态。
- 在正式数据模型确定后再实现选择持久化、Finder 跳转和 Git 更新比较。
