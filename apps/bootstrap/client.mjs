let csrf;
const $ = id => document.getElementById(id);
async function api(route) {
  if (!csrf) {
    const response = await fetch('/api/v1/session', { headers: { 'X-Habitat-Client': 'habitat-web' }, credentials: 'same-origin' });
    const data = await response.json(); if (!response.ok) throw new Error(data.error?.message ?? 'Session unavailable'); csrf = data.csrfToken;
  }
  const response = await fetch(`/api/v1/${route}`, { headers: { 'X-Habitat-Client': 'habitat-web', 'X-Habitat-CSRF': csrf }, credentials: 'same-origin' });
  const data = await response.json(); if (!response.ok) { if (response.status === 401) csrf = undefined; throw new Error(data.error?.message ?? 'Request failed'); } return data;
}
async function refresh() {
  $('refresh').disabled = true; $('status').textContent = '正在只读检查…'; $('results').replaceChildren(); $('content').hidden = true;
  try {
    const data = await api('inventory');
    $('status').textContent = `${data.skills.length} 项 · ${data.diagnostics.length ? '部分覆盖' : '只读完成'}`;
    if (!data.coverage.grantedRoots) {
      const p = document.createElement('p'); p.textContent = '尚未授权目录。可先停止服务，用 npm run start:fixture 读取包内样例；真实目录通过启动环境变量 HABITAT_ROOTS 明确授权。'; $('results').append(p);
    }
    for (const skill of data.skills) {
      const row = document.createElement('div'); row.className = 'skill'; const label = document.createElement('div');
      const name = document.createElement('strong'); name.textContent = skill.directoryName; const meta = document.createElement('small'); meta.textContent = `${skill.path} · 仅发现 · 未解析元数据 · 未检查 Agent`;
      label.append(name, meta); const button = document.createElement('button'); button.textContent = '读取 SKILL.md';
      button.onclick = async () => { button.disabled = true; try { const result = await api(`skills/${skill.id}`); $('content').textContent = result.text; $('content').hidden = false; } catch(error) { $('status').textContent = error.message; } finally {button.disabled = false;} };
      row.append(label, button); $('results').append(row);
    }
    for (const item of data.diagnostics) { const p = document.createElement('p'); p.className = 'error'; p.textContent = `${item.code}: ${item.root} — ${item.message}`; $('results').append(p); }
  } catch(error) { $('status').textContent = `未完成：${error.message}`; }
  finally { $('refresh').disabled = false; }
}
$('refresh').onclick = refresh;
refresh();
