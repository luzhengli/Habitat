# A0 全局搜索还原切片

## 实现与真实边界

CommandPalette.tsx复用A0的原始结构、classes、文案与匹配规则，数据全部来自现有真实inventory和projects。App恢复搜索入口与Cmd/Ctrl+K；输入组合中不触发快捷键，已有确认/执行modal不被全局快捷键打断。诊断数量由真实扫描diagnostics与未通过回读的项目入口计数，未引入原型model。快捷入口暂接现有真实来源授权页面，来源三步新设计仍待A1确认。

发现autoFocus在Modal effect前执行会使默认焦点恢复记到新input；现在打开搜索前捕获触发元素并通过returnFocusRef传入Modal。仅搜索显式使用此属性，其余Modal保持既有路径。

## 检查

- 初次集成default/named导出不匹配导致typecheck失败（command-check.log），已修正named import。
- 修正后command-check-final.log：54 tests、源边界、严格TSX和Vite build全部通过。
- Chromium实际打开搜索、输入“界面”、得到唯一frontend-design结果；初始输入焦点正确。之后CDP控制不稳定，截图出现四分之一画布异常，已明确作废其像素证据。
- Safari独立验收页签：搜索自动聚焦；Cmd+K打开；粘贴中文“界面”得到唯一结果；无结果提示；选择技能进入真实UUID URL和真实受限正文；选择warehouse-core进入对应真实项目URL。Esc后AX明确焦点回搜索按钮（escape-focus.txt）。这不是IME组合输入验收，中文使用的是paste。
- 同一Safari窗口、同查询的A0/生产原图已保存，并生成未对齐缩放的overlay/diff/side-by-side。截图为1224×768窗口图，CSS viewport/DPR未校准，不等于1440等合同视口通过。像素摘要只测一个白色结果区域，不能推论整个modal通过。
- 最后准备补测Tab循环时，Computer Use实际返回“The Mac is locked and automatic unlock could not unlock it. Ask the user to unlock the Mac manually before continuing.” 已停止GUI操作，没有尝试绕过。

## 未完成

命令框完整指定视口像素对照、Tab/IME及保护弹窗快捷键的实际回归仍待补。A1/A2审批仍空缺，生产未导入它们。M4/V3及总目标未完成。

## 恢复后的Safari焦点复测

本轮只读检查确认Mac已解锁。旧验收进程77204句柄不存在且4176未响应，重新启动同一合成数据目录服务（无真实目录扫描）。

Safari发现普通Tab从输入框逃逸到页面，虽然首尾反向循环通过。共享Modal改为显式推进每一个可用控件；实际连续15次Tab依次经过2个快捷操作、9个技能、3个项目后回输入框。授权表单也验证跳过禁用提交按钮；Ctrl/Cmd+K不替换现有授权弹窗。搜索关闭回原库输入框（保留code查询）通过。

继续修复搜索转授权表单的焦点链：取消授权表单回到最初搜索入口；实际AX验证通过。证据见command-safari-resumed/。最终command-focus-check.log的54项测试、类型检查和build通过。IME与指定视口完整像素验收依旧未完成；A1/A2未批准。
