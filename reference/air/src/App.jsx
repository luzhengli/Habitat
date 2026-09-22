import React, { useState, useMemo, useEffect, useRef } from 'react';
import Icon from './components/Icon';
import { AddWizard, ScanModal, AddProject, ChooseSkills, AssignModal, DiagnoseModal, UpdateModal, CommandPalette } from './components/Flows';
import { Button, Badge, SkillMark, AgentChips, Empty, Toggle, Modal, Notice } from './components/UI';
import { initialState, loadState, STORAGE_KEY, GROUPS, countUsage, transact, applyProject, addSkill, canUndo, undo } from './model';
const NAV = { library: '技能库', projects: '项目', issues: '需要处理', history: '操作记录', settings: '设置' };
const CATEGORIES = ['全部分类', '开发工程', '数据分析', '内容创作', '效率工具'];
const dateLabel = time => new Date(time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
const getBase = (s, pid) => s.bindings.filter(b => b.projectId === pid).map(b => b.skillId);
export default function App({ shellMode = 'browser-preview' } = {}) {
    const [state, setState] = useState(() => { try {
        return loadState(window.localStorage);
    }
    catch {
        return initialState();
    } });
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [page, setPage] = useState('library'), [pid, setPid] = useState('habitat');
    const [filter, setFilter] = useState('all'), [category, setCategory] = useState('全部分类'), [query, setQuery] = useState(''), [sort, setSort] = useState('recent'), [view, setView] = useState('grid');
    const [detail, setDetail] = useState(null), [detailTab, setDetailTab] = useState('overview'), [modal, setModal] = useState(null), [toast, setToast] = useState(null), [mobileMenu, setMobileMenu] = useState(false);
    useEffect(() => { if (!state.projects.some(p => p.id === pid) && state.projects[0])
        setPid(state.projects[0].id); }, [state.projects, pid]);
    const [draft, setDraft] = useState(() => getBase(state, 'habitat')), [projectTab, setProjectTab] = useState('configured'), [checking, setChecking] = useState(false), [issueTab, setIssueTab] = useState('issues');
    const toastTimer = useRef(null), persistWarning = useRef(false);
    const notify = (text, tone = 'success') => { clearTimeout(toastTimer.current); setToast({ text, tone }); toastTimer.current = setTimeout(() => setToast(null), 4500); };
    useEffect(() => { try {
        if (state.preferences.remember)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        else
            localStorage.removeItem(STORAGE_KEY);
    }
    catch {
        if (!persistWarning.current) {
            persistWarning.current = true;
            notify('浏览器不允许保存数据。本次仍可体验，刷新后将重置。', 'warning');
        }
    } }, [state]);
    useEffect(() => () => clearTimeout(toastTimer.current), []);
    const project = state.projects.find(p => p.id === pid) || state.projects[0];
    const base = getBase(state, pid);
    const dirty = base.filter(id => !draft.includes(id)).length + draft.filter(id => !base.includes(id)).length;
    useEffect(() => { setDraft(getBase(state, pid)); }, [pid, state.bindings]);
    const go = (next, projectId = pid) => { const run = () => { setPage(next); setPid(projectId); setDetail(null); setModal(null); setMobileMenu(false); setDraft(getBase(state, projectId)); }; if (dirty && page === 'projects') {
        setModal({ type: 'guard', run });
    }
    else
        run(); };
    const openDetail = id => { setDetail(id); setDetailTab('overview'); };
    const toggleFavorite = id => setState(s => ({ ...s, skills: s.skills.map(x => x.id === id ? { ...x, favorite: !x.favorite } : x) }));
    useEffect(() => { const handle = e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setDetail(null);
        setModal(m => m?.type === 'command' ? null : { type: 'command' });
    } }; window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle); }, []);
    useEffect(() => {
        const handle = e => {
            const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
            if ((e.metaKey || e.ctrlKey) && e.key === ',') { e.preventDefault(); if (!modal && !detail) go('settings'); }
            if ((e.metaKey || e.ctrlKey) && /^[1-4]$/.test(e.key) && !modal && !detail) { e.preventDefault(); go(['library','projects','issues','history'][Number(e.key)-1]); }
            if (e.key === '?' && !typing && !modal && !detail) setModal({type:'help'});
        };
        window.addEventListener('keydown',handle); return () => window.removeEventListener('keydown',handle);
    },[modal,detail,dirty,page,pid,state.bindings]);
    const updateCount = state.skills.filter(s => s.update).length;
    const favorites = state.skills.filter(s => s.favorite).length;
    const skills = useMemo(() => state.skills.filter(s => (filter === 'all' || filter === 'favorite' && s.favorite || filter === 'managed' && s.managed || filter === 'observed' && !s.managed) && (category === '全部分类' || s.category === category) && (!query || `${s.name} ${s.title} ${s.description} ${s.origin}`.toLowerCase().includes(query.toLowerCase()))).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'usage' ? countUsage(state, b.id) - countUsage(state, a.id) : 0), [state, filter, category, query, sort]);
    const selected = state.skills.find(s => s.id === detail);
    const selectedIssues = selected ? state.issues.filter(i => i.skillId === selected.id) : [];
    const currentIssues = state.issues.filter(i => i.projectId === pid);
    const inheritedSkills = state.skills.filter(s => !s.managed && (s.origin.includes('Claude') ? project?.groups.includes('claude') : project?.groups.includes('shared')));
    const mutate = (next, message) => { setState(next); setModal(null); notify(message); };
    const checkProject = () => { setChecking(true); setTimeout(() => { setState(s => transact(s, { bindings: s.bindings.map(b => b.projectId === pid ? { ...b, checked: !s.issues.some(i => i.projectId === pid && i.skillId === b.skillId) } : b) }, `完成 ${project.name} 的模拟发现检查`, '仅运行演示状态机，未调用真实 Agent。', 'check')); setChecking(false); notify(currentIssues.length ? '模拟检查完成，仍有配置问题需要处理。' : '模拟发现检查完成，不代表真实 Agent 可用。', currentIssues.length ? 'warning' : 'success'); }, 700); };
    const copy = async (value) => { try {
        await navigator.clipboard.writeText(value);
        notify('已复制到剪贴板');
    }
    catch {
        setDetail(null);
        setModal({ type: 'copy', value });
    } };
    return <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} data-shell={shellMode}>
  {mobileMenu && <button className="mobile-nav-backdrop" aria-label="关闭导航" onClick={() => setMobileMenu(false)}/>}
  <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
   <div className="native-titlebar-space" data-tauri-drag-region><span>DESKTOP PREVIEW</span></div>
   <button className="brand" onClick={() => go('library')} aria-label="Habitat 首页"><span className="brand-symbol"><Icon name="box" size={21}/></span><span className="brand-word">Habitat</span></button>
   <div className="workspace-label">个人技能工作台</div>
   <div className="nav-label">工作空间</div>
   <nav className="main-nav" aria-label="主导航">
    {Object.entries(NAV).filter(([id]) => id !== 'settings').map(([id, label]) => <button key={id} title={label} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => go(id)}><Icon name={{ library: 'grid', projects: 'folder', issues: 'alert', history: 'clock' }[id]}/><span>{label}</span>{id === 'issues' && state.issues.length > 0 && <span className="nav-count warm">{state.issues.length}</span>}</button>)}
   </nav>
   <div className="nav-label projects-label"><span>最近项目</span><button className="sidebar-mini" onClick={() => setModal({ type: 'projectAdd' })} aria-label="添加项目"><Icon name="plus" size={12}/></button></div>
   <nav className="project-nav" aria-label="项目导航">{state.projects.map(p => <button className={`nav-project ${page === 'projects' && pid === p.id ? 'current' : ''}`} title={p.name} key={p.id} onClick={() => go('projects', p.id)}><span className="project-nav-icon"><Icon name="folder" size={15}/></span><span>{p.name}</span><span className="project-count">{state.bindings.filter(b => b.projectId === p.id).length}</span></button>)}</nav>
   <div className="sidebar-spacer"/>
   <div className="local-status"><Icon name="lock" size={13}/><span>本地空间<span>无需登录 · 不上传内容</span></span></div>
   <button title="设置" className={`nav-item settings-nav ${page === 'settings' ? 'active' : ''}`} onClick={() => go('settings')}><Icon name="settings"/><span>设置</span></button>
   <button className="nav-item help-nav" title="关于这个原型" onClick={() => setModal({ type: 'help' })}><Icon name="help"/><span>帮助与说明</span><kbd>?</kbd></button>
  </aside>
  <div className="workspace">
   <header className="topbar">
    <div className="breadcrumbs"><button className="icon-btn desktop-sidebar-toggle" aria-label={sidebarCollapsed ? '展开侧栏' : '收起侧栏'} title={sidebarCollapsed ? '展开侧栏' : '收起侧栏'} onClick={() => setSidebarCollapsed(v => !v)}><Icon name="sidebar" size={17}/></button><button className="icon-btn mobile-toggle" aria-label="展开导航" onClick={() => setMobileMenu(true)}><Icon name="menu"/></button><span>本地空间</span><Icon name="chevron" size={9}/><strong>{NAV[page]}</strong>{page === 'projects' && <><Icon name="chevron" size={9}/><span>{project?.name}</span></>}</div>
    <div className="toolbar-drag-space" data-tauri-drag-region />
    <div className="topbar-right"><button className="global-search-button" onClick={() => setModal({ type: 'command' })}><Icon name="search" size={14}/><span>搜索</span><kbd>⌘ K</kbd></button><span className="demo-badge">演示原型</span></div>
   </header>
   <main className={`main-content page-${page}`} key={page}>
    {page === 'library' && <>
     <div className="page-heading"><div><h1>技能库</h1><p>你的 Agent 技能，一处看清，按需使用。</p></div><div className="heading-actions"><Button icon="refresh" onClick={() => setModal({ type: 'scan' })}>扫描本机</Button><Button icon="plus" variant="primary" onClick={() => setModal({ type: 'add' })}>添加 Skill</Button></div></div>
     <div className="library-tabs"><div className="tabs" role="tablist" aria-label="技能范围">{[['all', '全部技能', state.skills.length], ['favorite', '已收藏', favorites], ['managed', '已托管', state.skills.filter(s => s.managed).length], ['observed', '仅收录', state.skills.filter(s => !s.managed).length]].map(([id, label, count]) => <button role="tab" aria-selected={filter === id} className={filter === id ? 'active' : ''} key={id} onClick={() => setFilter(id)}>{label}<span>{count}</span></button>)}</div><div className="segmented"><button className={view === 'grid' ? 'active' : ''} aria-label="卡片视图" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Icon name="grid" size={14}/></button><button className={view === 'list' ? 'active' : ''} aria-label="列表视图" aria-pressed={view === 'list'} onClick={() => setView('list')}><Icon name="list" size={14}/></button></div></div>
     <div className="library-toolbar"><label className="search-input"><Icon name="search" size={14}/><input placeholder="搜索名称、用途或来源…" aria-label="搜索技能" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button aria-label="清空搜索" onClick={() => setQuery('')}><Icon name="close" size={12}/></button>}</label><label className="select-wrap"><Icon name="filter" size={12}/><select aria-label="筛选分类" value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select><Icon name="down" size={9}/></label><span className="result-count">{skills.length} 项技能</span><label className="sort-wrap"><select aria-label="技能排序" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">最近收录</option><option value="name">名称排序</option><option value="usage">项目使用最多</option></select><Icon name="down" size={9}/></label></div>
     <div className={`skill-grid ${view === 'list' ? 'list-view' : ''}`}>
      {skills.map(skill => <article className={`skill-card ${skill.update ? 'has-update' : ''}`} key={skill.id}>
       <div className="card-top"><SkillMark skill={skill}/><button className="card-title" onClick={() => openDetail(skill.id)}><h3>{skill.title}</h3><span className="origin" title={skill.origin}>{skill.origin.replace('GitHub · ', '').replace('本地 · ', '')}</span></button><button className={`favorite-button ${skill.favorite ? 'saved' : ''}`} aria-label={`${skill.favorite ? '取消收藏' : '收藏'} ${skill.name}`} aria-pressed={skill.favorite} onClick={() => toggleFavorite(skill.id)}><Icon name={skill.favorite ? 'starSolid' : 'star'} size={15}/></button></div>
       <button className="card-content" aria-label={`查看 ${skill.name} 详情`} onClick={() => openDetail(skill.id)}><span className="sr-only skill-slug">{skill.name}</span><p>{skill.description}</p></button>
       <div className="card-meta"><button className="usage-count" onClick={() => { openDetail(skill.id); setDetailTab('usage'); }}><Icon name="folder" size={13}/>{countUsage(state, skill.id) ? `${countUsage(state, skill.id)} 个项目` : '尚未用于项目'}</button><span className="metadata-dot">·</span>{skill.update ? <button className="update-badge" onClick={() => setModal({ type: 'update', skillId: skill.id })}>有更新</button> : <span className="ownership">{skill.managed ? '已托管' : '仅收录'}</span>}<button className="card-use" onClick={() => setModal({ type: 'assign', skillId: skill.id })} aria-label={`将 ${skill.name} 用于项目`}>使用<Icon name="arrow" size={12}/></button></div>
      </article>)}
     </div>
     {!skills.length && <Empty>换个关键词，或清除筛选看看。<Button small onClick={() => { setQuery(''); setFilter('all'); setCategory('全部分类'); }}>清除筛选</Button></Empty>}
     <div className="library-bottom"><span><Icon name="info" size={13}/>收录不会自动启用，也不会移动原文件。</span><button className="text-btn" onClick={() => setModal({ type: 'help' })}>了解管理方式<Icon name="arrow" size={11}/></button></div>
    </>}

    {page === 'projects' && project && <>
     <div className="page-heading"><div><h1>项目</h1><p>为当前工作配上需要的技能，其他项目不受打扰。</p></div><Button icon="plus" variant="primary" onClick={() => setModal({ type: 'projectAdd' })}>添加项目</Button></div>
     <div className="project-cards">{state.projects.map(p => <button className={`project-card ${pid === p.id ? 'selected' : ''}`} key={p.id} onClick={() => go('projects', p.id)}><span className="project-square"><Icon name="folder" size={18}/></span><strong>{p.name}</strong><span>{state.bindings.filter(b => b.projectId === p.id).length} 项技能 · {p.groups.length} 类入口</span>{pid === p.id && <Icon name="checkCircle" className="project-selected-check" size={16}/>}</button>)}</div>
     <section className="project-workbench"><div className="project-title"><div><h2>{project.name}</h2><p><Icon name="folder" size={12}/>{project.path}</p></div><Button icon={checking ? 'spinner' : 'refresh'} className={checking ? 'loading' : ''} onClick={checkProject} disabled={checking || !!dirty}>{checking ? '检查中…' : '模拟发现检查'}</Button></div><div className="project-context"><span>项目默认工具</span><AgentChips groups={project.groups}/><button className="text-btn" onClick={() => setModal({ type: 'agentInfo' })}><Icon name="info" size={12}/>共享入口说明</button></div>
      {currentIssues.length > 0 && <button className="project-warning" onClick={() => { go('issues'); setIssueTab('issues'); }}><Icon name="alert" size={14}/><span>{currentIssues.length} 项配置需要检查，查看原因与建议操作。</span><Icon name="arrow" size={12}/></button>}
      <div className="project-table-toolbar"><div className="tabs"><button className={projectTab === 'configured' ? 'active' : ''} onClick={() => setProjectTab('configured')}>本项目配置<span>{base.length}</span></button><button className={projectTab === 'inherited' ? 'active' : ''} onClick={() => setProjectTab('inherited')}>其他范围可见<span>{inheritedSkills.length}</span></button></div>{projectTab === 'configured' && <Button small icon="plus" variant="primary" onClick={() => setModal({ type: 'chooseSkills' })}>添加技能</Button>}</div>
      {projectTab === 'inherited' && <div className="inherited-notice"><Notice>下面是按演示路径规则推断的全局来源，不受项目开关控制。项目内移除入口并不保证 Agent 不再看到它。</Notice></div>}
      <div className="project-table"><div className="table-head"><span>技能</span><span>{projectTab === 'configured' ? '使用方式' : '来源范围'}</span><span>发现状态</span><span>{projectTab === 'configured' ? '配置' : ''}</span></div>{state.skills.filter(s => projectTab === 'inherited' ? inheritedSkills.some(x => x.id === s.id) : base.includes(s.id) || draft.includes(s.id)).map(skill => {
                const binding = state.bindings.find(b => b.projectId === pid && b.skillId === skill.id);
                const problem = currentIssues.find(i => i.skillId === skill.id);
                const changed = base.includes(skill.id) !== draft.includes(skill.id);
                return <div className={`project-row ${changed ? 'changed' : ''}`} key={skill.id}><button className="table-skill" onClick={() => openDetail(skill.id)}><SkillMark skill={skill} size="small"/><span><strong>{skill.title}</strong><small>{skill.name}</small></span></button><span className="mode-label"><Icon name={binding?.mode === 'development' ? 'code' : projectTab === 'inherited' ? 'globe' : 'lock'} size={11}/>{projectTab === 'inherited' ? '用户级来源' : binding?.mode === 'development' ? '开发目录（演示）' : '固定快照'}</span><span>{changed ? <Badge tone="amber">{draft.includes(skill.id) ? '待添加' : '待移除'}</Badge> : projectTab === 'inherited' ? <Badge>预计可见</Badge> : problem ? <button className="text-btn" onClick={() => setModal({ type: 'diagnose', issueId: problem.id })}><Badge tone={problem.kind === 'broken' ? 'rose' : 'amber'}>{problem.kind === 'broken' ? '入口失效' : '同名冲突'}</Badge></button> : binding?.checked ? <Badge tone="green">模拟已发现</Badge> : <Badge dot>已配置 · 未检查</Badge>}</span><span>{projectTab === 'configured' ? <Toggle checked={draft.includes(skill.id)} label={`${draft.includes(skill.id) ? '移除' : '添加'} ${skill.name} 的项目配置`} onChange={() => setDraft(d => d.includes(skill.id) ? d.filter(x => x !== skill.id) : [...d, skill.id])}/> : <Icon name="eye" size={14}/>}</span></div>;
            })}</div>
      {projectTab === 'configured' && !base.length && !draft.length && <Empty icon="folder" title="从一项技能开始">添加项目不会自动启用任何技能。<Button icon="plus" onClick={() => setModal({ type: 'chooseSkills' })}>选择技能</Button></Empty>}
      <div className="table-footnote"><Icon name="info" size={12}/>这里的状态来自演示数据。发现检查不会调用真实 Agent，也不评价 Skill 的执行效果。</div>
     </section>
     {dirty > 0 && <div className="pending-bar"><span className="pending-symbol"><Icon name="layers" size={18}/></span><div><strong>{dirty} 项待应用的更改</strong><span>仅是草稿，还没有改变项目配置。</span></div><Button small onClick={() => setDraft(base)}>放弃更改</Button><Button icon="arrow" variant="primary" onClick={() => setModal({ type: 'review' })}>检查并应用</Button></div>}
    </>}

    {page === 'issues' && <>
     <div className="page-heading"><div><h1>需要处理{state.issues.length > 0 && <span className="heading-count warm">{state.issues.length}</span>}</h1><p>看懂原因，再决定如何修复。</p></div><Button icon="refresh" onClick={() => { notify('演示问题清单已刷新。未扫描真实环境。'); }}>重新检查</Button></div>
     <div className="tabs issues-tabs"><button className={issueTab === 'issues' ? 'active' : ''} onClick={() => setIssueTab('issues')}>配置问题<span>{state.issues.length}</span></button><button className={issueTab === 'updates' ? 'active' : ''} onClick={() => setIssueTab('updates')}>可用更新<span>{updateCount}</span></button></div>
     <div className="issue-list">{issueTab === 'issues' ? state.issues.map(issue => { const skill = state.skills.find(s => s.id === issue.skillId); const p = state.projects.find(p => p.id === issue.projectId); return <article className="issue-card" key={issue.id}><span className={`issue-symbol ${issue.kind}`}><Icon name={issue.kind === 'broken' ? 'unlink' : 'layers'} size={21}/></span><div className="issue-content"><div className="issue-title"><h3>{issue.title}</h3><Badge tone={issue.kind === 'broken' ? 'rose' : 'amber'}>{issue.kind === 'broken' ? '需要修复' : '可能被遮蔽'}</Badge></div><p>{issue.description}</p><div className="issue-meta"><span><Icon name="folder" size={11}/>{p.name}</span><span><Icon name={skill.icon} size={11}/>{skill.name}</span><span>演示检查</span></div></div><Button onClick={() => setModal({ type: 'diagnose', issueId: issue.id })}>查看并处理<Icon name="arrow" size={11}/></Button></article>; }) : state.skills.filter(s => s.update).map(skill => <article className="issue-card" key={skill.id}><SkillMark skill={skill}/><div className="issue-content"><div className="issue-title"><h3>{skill.title}</h3><Badge tone="green">{skill.update} 可用</Badge></div><p>增加安全检查与回归测试指引。先查看变更和影响项目，再决定是否更新。</p><div className="issue-meta"><span>{skill.version} → {skill.update}</span><span>{countUsage(state, skill.id)} 个项目使用</span><span>示例更新</span></div></div><Button icon="download" onClick={() => setModal({ type: 'update', skillId: skill.id })}>查看更新</Button></article>)}</div>
     {(issueTab === 'issues' && !state.issues.length || issueTab === 'updates' && !updateCount) && <Empty icon="checkCircle" title={issueTab === 'issues' ? '一切井然有序' : '没有待更新的技能'}>这是当前演示工作空间的状态。<Button small onClick={() => go('library')}>返回技能库</Button></Empty>}
     <div className="care-note"><Icon name="lightbulb" size={17}/><span>文件链接正常，只能说明配置完成。<strong> 它并不证明 Agent 已发现技能，也不代表技能内容安全。</strong></span></div>
    </>}

    {page === 'history' && <>
     <div className="page-heading"><div><h1>操作记录</h1><p>发生了什么、影响了哪里，都有迹可循。</p></div><Badge dot>仅此浏览器</Badge></div>
     <Notice title="撤销一次操作，不是重置整个工作空间。">原型按逆序撤销变更，避免覆盖后续操作。所有记录都是本次演示操作，不是本机审计日志。</Notice>
     <div className="history-date">本次工作空间 <span>{state.events.length} 条操作</span></div>
     <div className="history-list">{state.events.map(e => <article className={`history-item ${e.undone ? 'undone' : ''}`} key={e.id}><span className="history-icon"><Icon name={e.undone ? 'undo' : e.kind === 'collect' ? 'plus' : e.kind === 'repair' ? 'shield' : e.kind === 'check' ? 'eye' : e.kind === 'update' ? 'download' : 'layers'} size={16}/></span><div><div className="history-item-title"><h3>{e.title}</h3>{e.undone ? <Badge>已撤销</Badge> : <Badge tone="green">模拟完成</Badge>}</div><p>{e.description}</p><span className="history-time">{dateLabel(e.time)} · 仅改变演示数据</span></div><Button small icon="undo" disabled={!canUndo(state, e.id) || e.undone} onClick={() => setModal({ type: 'undo', eventId: e.id })}>撤销操作</Button></article>)}</div>
     {!state.events.length && <Empty icon="clock" title="你的下一次操作，会留在这里。">试着给项目添加一项技能，或处理一个配置问题。<Button variant="primary" onClick={() => go('projects')}>配置一个项目</Button></Empty>}
     <div className="history-origin"><span /><div><strong>演示工作空间已准备好</strong><p>9 项技能 · 3 个项目 · 没有读取或改动任何真实文件</p></div></div>
    </>}

    {page === 'settings' && <>
     <div className="page-heading"><div><h1>工作空间设置</h1><p>少一些负担，多一些掌控。</p></div><Badge>Air · v0.2</Badge></div>
     <div className="settings-panel"><h2>浏览偏好</h2><div className="settings-row"><div><strong>显示完整来源路径</strong><p>在技能详情中默认展开技术路径。</p></div><Toggle label="显示完整来源路径" checked={state.preferences.showPaths} onChange={() => setState(s => ({ ...s, preferences: { ...s.preferences, showPaths: !s.preferences.showPaths } }))}/></div><div className="settings-row"><div><strong>记住演示工作空间</strong><p>将操作保存在当前浏览器，刷新后继续。关闭会移除已保存的数据。</p></div><Toggle label="记住演示工作空间" checked={state.preferences.remember} onChange={() => setState(s => ({ ...s, preferences: { ...s.preferences, remember: !s.preferences.remember } }))}/></div></div>
     <div className="settings-panel"><h2>管理方式</h2><div className="setting-detail"><Icon name="eye"/><div><h3>先收录，不搬动</h3><p>原型中的「扫描本机」和「解析来源」均使用固定样例，不会请求文件系统权限。</p></div></div><div className="setting-detail"><Icon name="layers"/><div><h3>配置可预览，变更可撤销</h3><p>项目开关只产生草稿，应用前显示入口变化。已托管、已配置、模拟发现分别展示。</p></div></div><div className="setting-detail"><Icon name="lock"/><div><h3>不上传、不执行、不代管账号</h3><p>没有后端、Agent 运行时或真实 Git 集成。React 与图标均已本地打包，不依赖 CDN。</p></div></div></div>
     <div className="settings-panel"><h2>演示数据</h2><div className="settings-row"><div><strong>导出当前工作空间</strong><p>导出 JSON，便于记录评审时的配置状态。不包含任何真实文件。</p></div><Button icon="download" onClick={() => { const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'habitat-demo-workspace.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify('演示数据已导出'); }}>导出演示数据</Button></div><div className="settings-row"><div><strong>重新开始体验</strong><p>清除浏览器中的演示变更，恢复初始样例。不会影响你的项目和文件。</p></div><Button variant="danger" icon="undo" onClick={() => setModal({ type: 'reset' })}>重置演示</Button></div></div>
    </>}
   </main>
  </div>

  {selected && <Modal drawer title={selected.title} eyebrow="技能详情" onClose={() => setDetail(null)} footer={<><Button icon="star" onClick={() => toggleFavorite(selected.id)}>{selected.favorite ? '已收藏' : '收藏'}</Button><Button variant="primary" icon="plus" onClick={() => { setDetail(null); setModal({ type: 'assign', skillId: selected.id }); }}>用于项目</Button></>}>
   <div className="detail-hero"><SkillMark skill={selected} size="large"/><div><div className="detail-slug">{selected.name}</div><span>{selected.version}</span><Badge tone={selected.managed ? 'green' : 'neutral'}>{selected.managed ? 'Habitat 管理' : '仅收录'}</Badge></div></div><p className="detail-description">{selected.description}</p>
   <div className="tabs detail-tabs">{[['overview', '概览'], ['usage', '使用位置'], ['files', '文件'], ['versions', '版本']].map(([id, t]) => <button className={detailTab === id ? 'active' : ''} key={id} onClick={() => setDetailTab(id)}>{t}{id === 'usage' && <span>{countUsage(state, selected.id)}</span>}</button>)}</div>
   {detailTab === 'overview' && <><section className="detail-section"><h3>什么时候使用</h3><p>{selected.id === 'warehouse' ? '收到上游业务系统的变更需求时，梳理公共数仓的影响范围、兼容动作与待确认事项。' : selected.id === 'frontend' ? '需要搭建产品界面、重构页面，或把设计方案转为前端实现时。' : selected.description}</p></section><section className="detail-section"><h3>试着这样开始<span>用法示例</span></h3><div className="prompt-box"><p>{selected.id === 'warehouse' ? '使用 rd-change-solution，评估这次上游变更对公共数仓的影响。先确认范围，再给出兼容方案。' : `请使用 ${selected.name} 帮我处理当前任务。开始前先确认目标、已有材料与约束。`}</p><button onClick={() => copy(`请使用 ${selected.name} 帮我处理当前任务。开始前先确认目标、已有材料与约束。`)}><Icon name="copy" size={12}/>复制示例</button></div><small className="muted">这是示例提示词，不会启动 Agent 或保证技能被调用。</small></section><section className="detail-section"><h3>来源与管理</h3><dl className="detail-facts"><div><dt>收录来源</dt><dd>{selected.origin}</dd></div><div><dt>管理关系</dt><dd>{selected.managed ? '独立托管副本（演示）' : '原位置保留 · 只读收录'}</dd></div><div><dt>内容版本</dt><dd>{selected.version === '未声明' ? '原内容没有声明版本' : selected.version}</dd></div></dl><details open={state.preferences.showPaths || undefined}><summary>查看技术路径 <Icon name="down" size={9}/></summary><code className="path-code">{selected.sourcePath}</code></details></section>{selected.needs.length > 0 && <section className="detail-section"><h3>环境要求<span>声明内容 · 未检查</span></h3>{selected.needs.map(n => <div className="requirement" key={n}><Icon name="terminal" size={12}/>{n}<Badge>待确认</Badge></div>)}</section>}{selectedIssues.length > 0 && <Notice tone="warning">此技能存在 {selectedIssues.length} 项配置问题。<button className="text-btn" onClick={() => { setDetail(null); go('issues'); }}>查看问题 <Icon name="arrow" size={10}/></button></Notice>}</>}
   {detailTab === 'usage' && <><section className="detail-section"><h3>正在这些项目中配置</h3>{state.bindings.filter(b => b.skillId === selected.id).map(b => { const p = state.projects.find(p => p.id === b.projectId); return <button className="usage-project" key={p.id} onClick={() => go('projects', p.id)}><span className={`project-square color-${p.color}`}><Icon name="folder"/></span><span><strong>{p.name}</strong><small>{b.checked ? '模拟已发现' : '已配置 · 尚未检查'}</small></span><Icon name="chevron" size={11}/></button>; })}{!countUsage(state, selected.id) && <Empty icon="folder" title="还没有用于任何项目">收录并不会自动启用，准备好再添加。</Empty>}</section>{!selected.managed && <Notice>这项技能保留在用户级目录。即使没有项目配置，也可能被工具从全局范围发现；原型未检测真实环境。</Notice>}<div className="scope-card"><Icon name="eye"/><div><strong>配置不是访问权限</strong><p>共享入口、用户级来源和工具自身规则，都可能影响最终的可见范围。</p></div></div></>}
   {detailTab === 'files' && <section className="detail-section"><Notice>文件树为演示结构。此网页没有读取 Skill 源文件。</Notice><div className="file-tree">{selected.files.map((f, i) => <div key={f}><Icon name={f.includes('/') ? 'folder' : 'file'} size={13}/><code>{f}</code><span>{i === 0 ? '入口文件' : '辅助材料'}</span></div>)}</div><div className="code-preview"><div><span /><span /><span /><small>SKILL.md · 演示预览</small></div><pre>{`---\nname: ${selected.name}\ndescription: ${selected.description}\n---\n\n# ${selected.title}\n\n请先确认任务目标、约束与输入材料。\n在信息缺失时明确说明，不虚构事实。\n\n# 使用边界\n本内容仅用于展示原型文件预览。`}</pre></div></section>}
   {detailTab === 'versions' && <section className="detail-section"><h3>当前内容</h3><div className="version-box"><Icon name="branch" size={20}/><div><strong>{selected.version}</strong><p>{selected.version === '开发版本' ? '开发目录会随修改变化，请留意所有关联项目。' : '已记录的演示版本，不代表远程仓库当前版本。'}</p></div><Badge tone="green">当前</Badge></div>{selected.update ? <><Notice tone="success">有新版本 {selected.update}。更新前可以查看差异与项目影响。</Notice><Button variant="primary" icon="download" onClick={() => { setDetail(null); setModal({ type: 'update', skillId: selected.id }); }}>查看更新</Button></> : <Notice>原型没有访问远程来源。这里只展示当前样例记录，不代表已检查最新版本。</Notice>}</section>}
  </Modal>}

  {modal?.type === 'help' && <Modal title="关于这个原型" eyebrow="关于 Habitat" onClose={() => setModal(null)} footer={<Button variant="primary" onClick={() => setModal(null)}>关闭说明 <Icon name="arrow" size={12}/></Button>}><div className="help-logo"><Icon name="box" size={30}/></div><p className="modal-intro">Habitat Air 是面向桌面应用的 React 设计原型。轻量浏览、按项目配置，必要时再查看细节。</p>{[['eye', '01', '先看清', '在技能库浏览、搜索和收藏。不必先迁移任何文件。'], ['folder', '02', '按项目配置', '选好需要的技能，预览更改，再应用到演示项目。'], ['shield', '03', '放心地维护', '比较来源、处理冲突、查看更新，并从操作记录撤销。']].map(([icon, n, t, d]) => <div className="help-step" key={n}><Icon name={icon} size={19}/><div><strong><span>{n}</span>{t}</strong><p>{d}</p></div></div>)}<Notice>所有 Skills、来源、版本和兼容状态均为演示数据。不访问本机文件，不安装技能，不执行 Agent。可用 ⌘ K / Ctrl K 搜索，Esc 关闭浮层。</Notice></Modal>}
  {modal?.type === 'agentInfo' && <Modal title="入口共享，不是独立权限。" eyebrow="工具与发现范围" onClose={() => setModal(null)} footer={<Button variant="primary" onClick={() => setModal(null)}>明白了</Button>}><p className="modal-intro">项目配置针对目录入口，不控制 Agent 的访问权限。这份原型沿用前面方案中的适配分组，但没有检测你安装的工具版本。</p><div className="agent-info-row"><AgentChips groups={['shared']}/><code>.agents/skills/&lt;skill&gt;</code><p>这三个工具在本原型中共用一组开关，不能承诺单独启用或隔离其中一个。</p></div><div className="agent-info-row"><AgentChips groups={['claude']}/><code>.claude/skills/&lt;skill&gt;</code><p>独立的目标目录，不代表其他工具一定看不到这个入口。</p></div><Notice tone="warning">真实的发现、优先级和重新加载行为，需要绑定具体工具版本重新验证。原型不支持真实运行时检查。</Notice></Modal>}
  {modal?.type === 'add' && <AddWizard state={state} onClose={() => setModal(null)} onComplete={(config, target) => { try {
        let next = addSkill(state, config);
        if (target) {
            const id = next.skills[0].id;
            next = applyProject(next, target, [...getBase(next, target), id]);
        }
        mutate(next, target ? '已模拟收录并配置到项目。尚未执行发现检查。' : '已收录到演示技能库，没有启用任何项目。');
        setPage('library');
        setFilter('all');
        setQuery('');
        setCategory('全部分类');
    }
    catch (e) {
        return e.message;
    } }}/>}
  {modal?.type === 'scan' && <ScanModal state={state} onClose={() => setModal(null)} onComplete={() => { setState(s => ({ ...s, scanDone: true })); setModal(null); setPage('library'); setFilter('all'); notify('演示清单已刷新。没有移动或修改任何文件。'); }}/>}
  {modal?.type === 'projectAdd' && <AddProject onClose={() => setModal(null)} state={state} onComplete={(name, path, groups) => { const id = 'project-' + Date.now(); const next = transact(state, { projects: [...state.projects, { id, name, path, groups, color: 'green', description: '新建演示工作空间' }] }, `添加项目 ${name}`, '只记录项目与工具范围，没有自动安装任何技能。', 'collect'); mutate(next, '演示项目已添加，没有自动启用技能。'); setPid(id); setPage('projects'); }}/>}
  {modal?.type === 'chooseSkills' && <ChooseSkills state={state} initial={draft} onClose={() => setModal(null)} onComplete={ids => { setDraft(ids); setModal(null); notify('技能选择已存为草稿，检查后才会应用。'); }}/>}
  {modal?.type === 'review' && <Modal wide title={`应用到 ${project.name}`} eyebrow="变更预览" onClose={() => setModal(null)} footer={<><span className="footer-note"><Icon name="shield" size={12}/>仅修改演示数据</span><Button onClick={() => setModal(null)}>继续编辑</Button><Button variant="primary" icon="check" onClick={() => { try {
        mutate(applyProject(state, pid, draft), '项目配置已模拟应用。可以在操作记录中撤销。');
    }
    catch (e) {
        notify(e.message, 'warning');
    } }}>确认应用</Button></>}><p className="modal-intro">这些更改只作用于当前项目的入口。技能源内容保留，其他项目的配置不变。</p><div className="review-summary"><span><strong>{draft.filter(id => !base.includes(id)).length}</strong>项添加</span><span><strong>{base.filter(id => !draft.includes(id)).length}</strong>项移除</span><span><strong>0</strong>个源文件删除</span></div><div className="review-list">{state.skills.filter(s => base.includes(s.id) !== draft.includes(s.id)).map(s => <div key={s.id}><span className={`change-icon ${draft.includes(s.id) ? 'added' : 'removed'}`}><Icon name={draft.includes(s.id) ? 'plus' : 'minus'} size={13}/></span><div><strong>{s.name}</strong>{project.groups.map(g => <code key={g}>{GROUPS[g].path}/{s.name}</code>)}</div><Badge tone={draft.includes(s.id) ? 'green' : 'rose'}>{draft.includes(s.id) ? '添加入口' : '移除入口'}</Badge></div>)}</div><Notice>移除项目入口，不会关闭用户级来源或其他共享目录。应用成功只表示配置完成，不代表 Agent 已发现技能。</Notice></Modal>}
  {modal?.type === 'assign' && <AssignModal state={state} skillId={modal.skillId} onClose={() => setModal(null)} onComplete={id => { const s = state.skills.find(s => s.id === modal.skillId); mutate(applyProject(state, id, [...new Set([...getBase(state, id), s.id])]), '已模拟配置到项目，未调用真实 Agent。'); setPid(id); setPage('projects'); }}/>}
  {modal?.type === 'diagnose' && <DiagnoseModal state={state} issueId={modal.issueId} onClose={() => setModal(null)} onComplete={(id, newPath) => { const issue = state.issues.find(i => i.id === id); const next = transact(state, { issues: state.issues.filter(i => i.id !== id), skills: newPath ? state.skills.map(s => s.id === issue.skillId ? { ...s, sourcePath: newPath } : s) : state.skills, bindings: state.bindings.map(b => b.skillId === issue.skillId ? { ...b, checked: false } : b) }, issue.kind === 'broken' ? '已重新定位技能来源（模拟）' : '已停用同名用户级入口（模拟）', issue.kind === 'broken' ? '只更新示例来源映射，源文件保留。' : '全局来源的变化影响全部示例项目；项目配置与技能内容不变。', 'repair'); mutate(next, '修复已模拟完成。请到项目页重新进行模拟发现检查。'); }}/>}
  {modal?.type === 'update' && <UpdateModal state={state} skillId={modal.skillId} onClose={() => setModal(null)} onComplete={id => { const skill = state.skills.find(s => s.id === id); const next = transact(state, { skills: state.skills.map(s => s.id === id ? { ...s, version: s.update, update: undefined } : s), bindings: state.bindings.map(b => b.skillId === id ? { ...b, checked: false } : b) }, `已将 ${skill.name} 更新至 ${skill.update}`, `影响 ${countUsage(state, id)} 个示例项目。已保存演示旧版本，可以逆序撤销。`, 'update'); mutate(next, '更新已模拟应用。旧版本已记录，可从操作记录撤销。'); }}/>}
  {modal?.type === 'undo' && <Modal title="撤销这次操作？" eyebrow="撤销操作" onClose={() => setModal(null)} footer={<><Button onClick={() => setModal(null)}>保留操作</Button><Button variant="primary" icon="undo" onClick={() => { try {
        mutate(undo(state, modal.eventId), '已恢复到这次操作前的演示状态。');
    }
    catch (e) {
        notify(e.message, 'warning');
    } }}>确认撤销</Button></>}><p className="modal-intro">{state.events.find(e => e.id === modal.eventId)?.title}</p><Notice>恢复这次操作前的演示快照，保留审计记录。原型只允许逆序撤销，不会处理真实文件或跨事务漂移。</Notice></Modal>}
  {modal?.type === 'guard' && <Modal title="项目里还有未应用的更改。" onClose={() => setModal(null)} footer={<><Button variant="primary" onClick={() => setModal(null)}>返回继续编辑</Button><Button onClick={() => { const fn = modal.run; setDraft(base); fn(); }}>放弃草稿并离开</Button></>}><p className="modal-intro">你有 {dirty} 项待应用变更。离开前可以保留当前编辑，或明确放弃它们。没有任何配置被自动应用。</p></Modal>}
  {modal?.type === 'reset' && <Modal title="重新开始这次体验？" onClose={() => setModal(null)} footer={<><Button onClick={() => setModal(null)}>取消</Button><Button variant="danger" onClick={() => { setState(initialState()); setPid('habitat'); setPage('library'); setFilter('all'); setQuery(''); setCategory('全部分类'); setDetail(null); setModal(null); notify('演示已重置，真实文件不受影响。'); }}>重置演示数据</Button></>}><p className="modal-intro">你的演示收藏、项目配置与操作记录将被清除，恢复为最初的 9 项技能和 3 个项目。</p><Notice>只影响当前浏览器中的演示数据，不读取、删除或恢复真实文件。</Notice></Modal>}
  {modal?.type === 'copy' && <Modal title="复制文本" onClose={() => setModal(null)} footer={<Button onClick={() => setModal(null)}>完成</Button>}><p>浏览器未授权剪贴板，请选中文本后复制。</p><textarea className="copy-text" readOnly value={modal.value} onFocus={e => e.target.select()}/></Modal>}
  {modal?.type === 'command' && <CommandPalette state={state} onClose={() => setModal(null)} onSkill={id => { setModal(null); openDetail(id); }} onPage={p => go(p)} onProject={id => go('projects', id)} onAdd={() => setModal({ type: 'add' })}/>}
  {toast && <div className={`toast ${toast.tone}`} role="status"><Icon name={toast.tone === 'warning' ? 'info' : 'checkCircle'} size={17}/><span>{toast.text}</span><button aria-label="关闭提示" onClick={() => setToast(null)}><Icon name="close" size={13}/></button></div>}
 </div>;
}
