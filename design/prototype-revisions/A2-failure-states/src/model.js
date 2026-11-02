/** All content is fixture data. No filesystem, git, or Agent process is accessed. */
export const STORAGE_KEY = 'habitat.prototype.a1.web-real.v1';
export const GROUPS = { shared: { label: '未支持项目适配', agents: ['Codex', 'Pi', 'Cursor'], path: '.agents/skills' }, claude: { label: 'Claude Code', agents: ['Claude Code'], path: '.claude/skills' } };
const makeSkill = (id, name, title, description, icon, color, category, managed, origin, version, favorite = false) => ({ id, name, title, description, icon, color, category, managed, origin, version, favorite, updated: '09-10', sourcePath: origin.includes('GitHub') ? `/Users/me/Habitat/git-sources/${name}` : `/Users/me/skills/${name}`, needs: [], files: ['SKILL.md', 'references/guide.md', 'assets/template.md'] });
export function initialState() {
    return { schema: 1,
        skills: [
            makeSkill('frontend', 'frontend-design', '界面设计', '把产品想法转化为精致、可交付的前端界面。', 'pen', 'violet', '开发工程', true, 'GitHub · design-kit', 'v1.4.0', true),
            { ...makeSkill('warehouse', 'rd-change-solution', '数仓影响评估', '分析研发变更的下游影响，生成可执行的兼容方案。', 'database', 'blue', '数据分析', true, '本地 · 我的技能仓库', '开发版本', true), needs: ['Python 3.11+', 'lark-cli（涉及飞书交付时）'], files: ['SKILL.md', 'workflow.md', 'scripts/workflow.py', 'templates/简报.md'] },
            makeSkill('writing', 'doc-writing', '文档写作', '从零散材料出发，写出结构清晰、可行动的文档。', 'file', 'amber', '内容创作', false, '发现于 Claude Code', '未声明'),
            { ...makeSkill('review', 'code-review', '代码审查', '在合并代码之前，检查质量、风险与潜在回归。', 'code', 'green', '开发工程', true, 'GitHub · engineering-kit', 'v2.1.0', true), update: 'v2.2.0' },
            makeSkill('research', 'web-research', '网络研究', '交叉核实来源，把复杂问题整理为有依据的结论。', 'globe', 'teal', '效率工具', true, 'GitHub · research-kit', 'v1.2.0'),
            makeSkill('debug', 'systematic-debugging', '系统化调试', '从复现到根因，用可验证的步骤解决棘手问题。', 'bolt', 'rose', '开发工程', true, 'GitHub · engineering-kit', 'v1.0.3'),
            makeSkill('creator', 'skill-creator', '技能创作', '把重复工作沉淀为能被 Agent 稳定复用的技能。', 'sprout', 'green', '效率工具', true, '本地 · 我的技能仓库', 'v1.3.0'),
            makeSkill('git', 'git-workflow', 'Git 工作流', '规范分支与提交，让协作中的每次变更清晰可追溯。', 'branch', 'slate', '开发工程', false, '发现于 Codex', '未声明'),
            makeSkill('find', 'find-skills', '技能发现', '根据手头任务，找到值得尝试的新技能。', 'compass', 'amber', '效率工具', false, '发现于共享目录', 'v0.6.0')
        ],
        projects: [{ id: 'habitat', name: 'Habitat', path: '/Users/me/Projects/Habitat', description: '让 Skills 管理更简单的本地工作台', color: 'green', groups: ['shared', 'claude'] }, { id: 'warehouse-core', name: 'warehouse-core', path: '/Users/me/Projects/warehouse-core', description: '公共数仓与数据质量工作空间', color: 'blue', groups: ['shared', 'claude'] }, { id: 'personal-site', name: 'personal-site', path: '/Users/me/Projects/personal-site', description: '个人网站、写作与内容发布', color: 'violet', groups: ['shared', 'claude'] }],
        bindings: [['habitat', 'frontend'], ['habitat', 'review'], ['habitat', 'creator'], ['warehouse-core', 'warehouse'], ['warehouse-core', 'debug'], ['warehouse-core', 'writing'], ['personal-site', 'frontend'], ['personal-site', 'research']].map(([projectId, skillId]) => ({ projectId, skillId, groups: projectId === 'personal-site' ? ['shared'] : ['shared', 'claude'], checked: false, mode: skillId === 'warehouse' ? 'development' : 'snapshot' })),
        issues: [{ id: 'conflict', kind: 'conflict', skillId: 'review', projectId: 'habitat', title: '同名 Skill 存在两个来源', description: 'Claude Code 的用户级目录还有另一份 code-review，可能遮蔽项目版本。', severity: 'warning' }, { id: 'broken', kind: 'broken', skillId: 'research', projectId: 'personal-site', title: '来源位置已变化', description: 'web-research 的原目录已移动，当前项目入口无法解析。', severity: 'error' }], events: [], preferences: { showPaths: false, remember: true }, scanDone: false };
}
export function validState(s) { return s?.schema === 1 && Array.isArray(s.skills) && Array.isArray(s.projects) && Array.isArray(s.bindings) && Array.isArray(s.issues) && Array.isArray(s.events) && s.preferences && s.skills.every(x => x.id && x.name) && s.projects.every(x => x.id && Array.isArray(x.groups)); }
export function loadState(storage) { try {
    const raw = storage.getItem(STORAGE_KEY);
    const s = raw && JSON.parse(raw);
    return validState(s) ? s : initialState();
}
catch {
    return initialState();
} }
export function countUsage(state, id) { return state.bindings.filter(b => b.skillId === id).length; }
export function projectIds(state, id) { return state.bindings.filter(b => b.skillId === id).map(b => b.projectId); }
export function snapshot(s) { return JSON.parse(JSON.stringify({ skills: s.skills, projects: s.projects, bindings: s.bindings, issues: s.issues, scanDone: s.scanDone })); }
export function transact(s, patch, title, description, kind = 'configure') {
    const before = snapshot(s);
    const next = { ...s, ...patch };
    const event = { id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title, description, kind, time: new Date().toISOString(), before, after: snapshot(next), undone: false };
    return { ...next, events: [event, ...s.events].slice(0, 30) };
}
export function applyProject(s, pid, ids) {
    ids = [...new Set(ids)];
    const p = s.projects.find(p => p.id === pid);
    if (!p)
        throw new Error('项目不存在');
    if (ids.some(id => !s.skills.some(x => x.id === id)))
        throw new Error('技能不存在');
    const previous = s.bindings.filter(b => b.projectId === pid);
    const next = ids.map(skillId => previous.find(b => b.skillId === skillId) || { projectId: pid, skillId, groups: p.groups, checked: false, mode: 'snapshot' });
    if (JSON.stringify(previous) === JSON.stringify(next))
        return s;
    const adds = next.filter(n => !previous.some(b => b.skillId === n.skillId)).length;
    const removes = previous.filter(n => !next.some(b => b.skillId === n.skillId)).length;
    return transact(s, { bindings: [...s.bindings.filter(b => b.projectId !== pid), ...next] }, `已更新 ${p.name} 的技能配置（合成）`, `添加 ${adds} 项，移除 ${removes} 项。候选只改变浏览器 fixture，保留源内容。`);
}
export function canUndo(s, id) { const first = s.events.find(e => !e.undone); return first?.id === id; }
export function undo(s, id) { if (!canUndo(s, id))
    throw new Error('请先撤销更新的操作，避免覆盖后续变更'); const event = s.events.find(e => e.id === id); const restored = { ...event.before, skills: event.before.skills.map(x => ({ ...x, favorite: s.skills.find(v => v.id === x.id)?.favorite ?? x.favorite })) }; return { ...s, ...restored, events: s.events.map(e => e.id === id ? { ...e, undone: true } : e) }; }
export function addSkill(s, { name, title, source, managed }) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))
        throw new Error('使用小写字母、数字和连字符命名');
    if (s.skills.some(x => x.name === name))
        throw new Error('技能库中已存在同名技能，请选择不同名称');
    const id = 'custom-' + Date.now();
    const skill = makeSkill(id, name, title || name, '从你提供的来源收录。候选预览未读取真实内容。', 'box', 'green', '效率工具', managed, source, '未声明');
    return transact(s, { skills: [skill, ...s.skills] }, `已收录 ${name}（合成）`, '仅记录合成来源位置，不移动文件，不启用任何项目。', 'collect');
}
