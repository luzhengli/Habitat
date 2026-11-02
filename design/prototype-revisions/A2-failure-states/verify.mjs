import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const requiredStates = [
  '来源授权撤销', '网络失败', 'Git 配额响应', '技能包被拒绝',
  '二进制不预览', '文本超限', '来源发生漂移',
  '计划已过期', '并发 revision', '目标已被占用', '检测到个人修改',
  '执行中', '回读成功', '已补偿回滚', '需要人工恢复',
  '撤销被阻断', '固定版本回退'
];
const requiredBranchScreens = [
  '重新授权本地来源', '确认这次重试范围', '缩小公开仓库范围',
  '受限文件清单', '重新扫描前的范围确认', '新的预检摘要',
  '选择要继续审阅的草稿', '编辑被阻断的项目草稿', '只读变化位置',
  'Habitat 项目配置', '保留草稿并重新预检', '持久恢复步骤证据',
  '阻断撤销的后续操作', '固定版本回退的新计划', 'cancel-requested'
];
const requiredContractMarkers = [
  'HTTP 500 INTERNAL_ERROR · 原因未细分',
  'GIT_LIMIT / UNSAFE_GIT_ENTRY · HTTP 422',
  '隔离下载目录可能需要服务清理',
  '严格 UTF-8 解码失败后拒绝正文预览'
];

async function sources(directory) {
  const output = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await sources(target));
    else if (/\.(?:jsx|js|css)$/.test(entry.name)) output.push(target);
  }
  return output;
}

const htmlPath = path.join(root, 'dist/Habitat-A2-failure-states.html');
const html = await fs.readFile(htmlPath, 'utf8');
const readme = await fs.readFile(path.join(root, 'README.md'), 'utf8');
const sourceFiles = await sources(path.join(root, 'src'));
const sourceText = (await Promise.all(sourceFiles.map(file => fs.readFile(file, 'utf8')))).join('\n');
const config = await fs.readFile(path.join(root, 'vite.config.mjs'), 'utf8');

const failures = [];
if (/<script[^>]+src=|<link[^>]+rel=["']stylesheet|<img[^>]+src=["']https?:/i.test(html)) failures.push('self-contained HTML references an external asset');
if (!/<style>[\s\S]+<\/style>/.test(html) || !/<script type="module">[\s\S]+<\/script>/.test(html)) failures.push('self-contained HTML is missing inline CSS or JS');
if (/\bfetch\s*\(|XMLHttpRequest|\bWebSocket\s*\(|\bEventSource\s*\(|\/api\//.test(sourceText)) failures.push('prototype source contains an API/network primitive');
if (!/host:\s*'127\.0\.0\.1'/.test(config) || !/port:\s*5192/.test(config) || !/strictPort:\s*true/.test(config) || !/hmr:\s*false/.test(config) || !/ws:\s*false/.test(config)) failures.push('preview host/port/HMR/WebSocket boundary is incorrect');
for (const state of requiredStates) if (!sourceText.includes(`short: '${state}'`) || !html.includes(state)) failures.push(`state is not mapped into source and build: ${state}`);
for (const screen of requiredBranchScreens) if (!sourceText.includes(screen) || !html.includes(screen)) failures.push(`primary branch screen is missing from source or build: ${screen}`);
for (const marker of requiredContractMarkers) if (!sourceText.includes(marker) || !html.includes(marker)) failures.push(`API contract marker is missing from source or build: ${marker}`);
const hash = createHash('sha256').update(html).digest('hex');
if (!readme.includes(hash)) failures.push('README does not record the current self-contained HTML hash');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`verified ${requiredStates.length} reachable state labels`);
  console.log(`verified ${requiredBranchScreens.length} concrete primary-branch screen markers`);
  console.log(`verified ${requiredContractMarkers.length} API contract boundary markers`);
  console.log('verified self-contained inline CSS/JS');
  console.log('verified no API/fetch/XHR/WebSocket/EventSource in prototype source');
  console.log('verified preview 127.0.0.1:5192, strict port, HMR and WebSocket disabled');
  console.log(`sha256 ${hash}`);
}
