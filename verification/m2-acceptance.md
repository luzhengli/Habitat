# M2 本地项目配置闭环

实际生产 API 与浏览器完成：只读收录 → 登记空临时项目 /private/tmp/habitat-acceptance-project → 持久草稿 → 服务端预览 → 取消（项目无文件） → 重新预览/确认 → 受管完整快照与 .claude/skills/review-code 符号链接 → 文件字节比较通过 → 历史撤销预览 → 确认 → 入口不存在的真实回读。

截图：m2-preview-1440.png、m2-readback-1440.png、m2-undo-1440.png。应用数据仅临时验收目录；原始 fixture 未改。Agent 状态始终未知。

自动化：完整包 manifest（路径/类型/mode/size/hash）、幂等、冲突/源漂移/授权撤销零施工、旧 revision、错误 hash、失败补偿、外来内容保留、真实 SIGKILL 后恢复、固定版本更新与回退、个人修改保护。包含真实生产 HTTP 会话/CSRF/Origin/body 限额和端到端事务。

工程修复：canonical 化应用数据目录处理 macOS /var→/private/var；移除经典 JSX 强制配置；执行成功后再刷新草稿，避免请求竞争显示旧草稿。保留同机恶意进程 TOCTOU 边界；未知状态标 recovery-required 并锁住新写操作。

应用独占数据目录锁防止第二服务同时操作同一索引。失败补偿只移除身份完全匹配的受管入口；空容器可以保留，不删除外来对象。快照留存用于固定版本和撤销。
