# 候选审阅入口

两个候选均未获确认，不能直接视为生产基线。

- [A1 自包含 HTML](A1-web-real/dist/Habitat-A1-web-real.html)，hash `f5386425ea0968c958206875037677d6b96b4d343a01ff65719e5893d46293a4`。
- [A2 自包含 HTML](A2-failure-states/dist/Habitat-A2-failure-states.html)，hash `fb14fb3abb64c1c9b9a4ddaccc9c6f9ca1111bfd767639649791abc23cc3a243`。

这些是自包含HTML，可在本机浏览器直接打开，不依赖Node服务或CDN。localhost预览是临时进程，运行环境重启后可能停止；文件本身仍可审阅。A2右上角“标准工作区”进入17个失败/恢复状态。

启动后可用的临时入口（使用前检查，非运行状态声明）：

- http://127.0.0.1:5191/Habitat-A1-web-real.html
- http://127.0.0.1:5192/Habitat-A2-failure-states.html

如需重新启动，在仓库根分别运行（仅提供候选静态文件）：

```bash
python3 -m http.server 5191 --bind 127.0.0.1 --directory design/prototype-revisions/A1-web-real/dist
python3 -m http.server 5192 --bind 127.0.0.1 --directory design/prototype-revisions/A2-failure-states/dist
```

确认只覆盖用户明确认可的具体hash/页面/状态；打开页面或自动续跑都不构成确认。
