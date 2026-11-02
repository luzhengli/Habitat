import React, { useState, useMemo, useEffect, useRef } from 'react';
import Icon from './components/Icon';
import { AddWizard, ScanModal, AddProject, ChooseSkills, AssignModal, DiagnoseModal, UpdateModal, CommandPalette } from './components/Flows';
import { Button, Badge, SkillMark, AgentChips, Empty, Toggle, Modal, Notice } from './components/UI';
import { initialState, loadState, STORAGE_KEY, GROUPS, countUsage, transact, applyProject, addSkill, canUndo, undo } from './model';
const NAV = { library: '技能库', projects: '项目', issues: '需要处理', history: '操作记录', settings: '设置' };
const CATEGORIES = ['全部分类', '开发工程', '数据分析', '内容创作', '效率工具'];
const dateLabel = time => new Date(time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
const getBase = (s, pid) => s.bindings.filter(b => b.projectId === pid).map(b => b.skillId);
const PREVIEW_STATES = {
    normal: { label: '标准工作区', tone: 'info', text: '合成数据用于审阅结构；候选不会读取本机、联网或写入项目。' },
    empty: { label: '未授权空库', tone: 'warning', text: '尚未授权任何来源。正式产品不会扫描主目录、全盘或 Agent 默认目录。' },
    partial: { label: '扫描范围不完整', tone: 'warning', text: '一个已授权根目录不可访问；已有结果保留，覆盖范围不能标成完整。' },
    metadata: { label: '元数据不完整', tone: 'warning', text: '来源未声明显示名称、用途或版本；使用目录名与来源类型回退，并明确标出未知字段。' },
    drift: { label: '来源已变化', tone: 'warning', text: '来源身份或内容指纹在读取前发生变化。刷新并重新确认前不展示过期正文。' },
    recovery: { label: '事务需要恢复', tone: 'warning', text: '入口已改变且无法安全补偿。保留文件与证据，阻断新写入并等待人工检查。' }
};
export default function App({ shellMode = 'web-candidate' } = {}) {
    const [state, setState] = useState(() => { try {
        return loadState(window.localStorage);
    }
    catch {
        return initialState();
    } });
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [page, setPage] = useState('library'), [pid, setPid] = useState('habitat');
    const [filter, setFilter] = useState('all'), [category, setCategory] = useState('全部分类'), [query, setQuery] = useState(''), [sort, setSort] = useState('recent'), [view, setView] = useState('grid');
    const [detail, setDetail] = useState(null), [detailTab, setDetailTab] = useState('overview'), [modal, setModal] = useState(null), [toast, setToast] = useState(null), [mobileMenu, setMobileMenu] = useState(false), [previewState, setPreviewState] = useState('normal');
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
            if (e.key === '?' && !typing && !modal && !detail) setModal({type:'help'});
        };
        window.addEventListener('keydown',handle); return () => window.removeEventListener('keydown',handle);
    },[modal,detail,dirty,page,pid,state.bindings]);
    const updateCount = state.skills.filter(s => s.update).length;
    const favorites = state.skills.filter(s => s.favorite).length;
    const skills = useMemo(() => state.skills.filter(s => (filter === 'all' || filter === 'favorite' && s.favorite || filter === 'managed' && s.managed || filter === 'observed' && !s.managed) && (category === '全部分类' || s.category === category) && (!query || `${s.name} ${s.title} ${s.description} ${s.origin}`.toLowerCase().includes(query.toLowerCase()))).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'usage' ? countUsage(state, b.id) - countUsage(state, a.id) : 0), [state, filter, category, query, sort]);
    const previewSkills = previewState === 'empty' ? [] : previewState === 'metadata' ? skills.map((skill, index) => index ? skill : { ...skill, title: skill.name, description: '来源未提供用途说明', origin: '来源未命名 · 已授权本地目录', version: '未声明', managed: false, metadataIncomplete: true }) : skills;
    const selected = previewSkills.find(s => s.id === detail);
    const selectedIssues = selected ? state.issues.filter(i => i.skillId === selected.id) : [];
    const currentIssues = state.issues.filter(i => i.projectId === pid);
    const inheritedSkills = [];
    const mutate = (next, message) => { setState(next); setModal(null); notify(message); };
    const checkProject = () => { setChecking(true); setTimeout(() => { setState(s => transact(s, { bindings: s.bindings.map(b => b.projectId === pid ? { ...b, checked: false } : b) }, `完成 ${project.name} 的只读入口检查`, '只核对受管入口与固定快照；未运行 Agent，发现状态保持未知。', 'check')); setChecking(false); notify(currentIssues.length ? '入口检查完成，仍有配置问题需要处理。' : '入口已回读；Agent 发现状态仍未知。', currentIssues.length ? 'warning' : 'success'); }, 700); };
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
	   <div className="native-titlebar-space"><span>LOCAL WORKSPACE</span></div>
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
	    <div className="toolbar-drag-space" />
	    <div className="topbar-right"><button className="global-search-button" onClick={() => setModal({ type: 'command' })}><Icon name="search" size={14}/><span>搜索</span><kbd>⌘/Ctrl K</kbd></button><button className="candidate-state-button" onClick={() => setModal({type:'previewStates'})}><Icon name="layers" size={13}/><span>{PREVIEW_STATES[previewState].label}</span></button><span className="demo-badge">A1 候选预览</span></div>
   </header>
	   <main className={`main-content page-${page}`} key={page}>
	    {previewState !== 'normal' && <Notice tone={PREVIEW_STATES[previewState].tone} title={`合成状态 · ${PREVIEW_STATES[previewState].label}`}>{PREVIEW_STATES[previewState].text}</Notice>}
    {page === 'library' && <>
	     <div className="page-heading"><div><h1>技能库</h1><p>你的 Agent 技能，一处看清，按需使用。</p></div><div className="heading-actions"><Button icon="refresh" onClick={() => setModal({ type: 'scan' })}>扫描授权目录</Button><Button icon="plus" variant="primary" onClick={() => setModal({ type: 'add' })}>添加 Skill</Button></div></div>
	     <div className="library-tabs"><div className="tabs" role="tablist" aria-label="技能范围">{[['all', '全部技能', previewState === 'empty' ? 0 : state.skills.length], ['favorite', '已收藏', previewState === 'empty' ? 0 : favorites], ['managed', '已托管', previewState === 'empty' ? 0 : state.skills.filter(s => s.managed).length], ['observed', '仅收录', previewState === 'empty' ? 0 : state.skills.filter(s => !s.managed).length]].map(([id, label, count]) => <button role="tab" aria-selected={filter === id} className={filter === id ? 'active' : ''} key={id} onClick={() => setFilter(id)}>{label}<span>{count}</span></button>)}</div><div className="segmented"><button className={view === 'grid' ? 'active' : ''} aria-label="卡片视图" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Icon name="grid" size={14}/></button><button className={view === 'list' ? 'active' : ''} aria-label="列表视图" aria-pressed={view === 'list'} onClick={() => setView('list')}><Icon name="list" size={14}/></button></div></div>
	     <div className="library-toolbar"><label className="search-input"><Icon name="search" size={14}/><input placeholder="搜索名称、用途或来源…" aria-label="搜索技能" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button aria-label="清空搜索" onClick={() => setQuery('')}><Icon name="close" size={12}/></button>}</label><label className="select-wrap"><Icon name="filter" size={12}/><select aria-label="筛选分类" value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select><Icon name="down" size={9}/></label><span className="result-count">{previewSkills.length} 项技能</span><label className="sort-wrap"><select aria-label="技能排序" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">最近收录</option><option value="name">名称排序</option><option value="usage">项目使用最多</option></select><Icon name="down" size={9}/></label></div>
     <div className={`skill-grid ${view === 'list' ? 'list-view' : ''}`}>
	      {previewSkills.map(skill => <article className={`skill-card ${skill.update ? 'has-update' : ''}`} key={skill.id}>
       <div className="card-top"><SkillMark skill={skill}/><button className="card-title" onClick={() => openDetail(skill.id)}><h3>{skill.title}</h3><span className="origin" title={skill.origin}>{skill.origin.replace('GitHub · ', '').replace('本地 · ', '')}</span></button><button className={`favorite-button ${skill.favorite ? 'saved' : ''}`} aria-label={`${skill.favorite ? '取消收藏' : '收藏'} ${skill.name}`} aria-pressed={skill.favorite} onClick={() => toggleFavorite(skill.id)}><Icon name={skill.favorite ? 'starSolid' : 'star'} size={15}/></button></div>
       <button className="card-content" aria-label={`查看 ${skill.name} 详情`} onClick={() => openDetail(skill.id)}><span className="sr-only skill-slug">{skill.name}</span><p>{skill.description}</p></button>
	       <div className="card-meta"><button className="usage-count" onClick={() => { openDetail(skill.id); setDetailTab('usage'); }}><Icon name="folder" size={13}/>{countUsage(state, skill.id) ? `${countUsage(state, skill.id)} 个项目` : '尚未用于项目'}</button><span className="metadata-dot">·</span>{skill.metadataIncomplete ? <span className="ownership metadata-warning">元数据不完整</span> : skill.update ? <button className="update-badge" onClick={() => setModal({ type: 'update', skillId: skill.id })}>有候选</button> : <span className="ownership">{skill.managed ? '已托管' : '仅收录'}</span>}<button className="card-use" onClick={() => setModal({ type: 'assign', skillId: skill.id })} aria-label={`将 ${skill.name} 用于项目`}>使用<Icon name="arrow" size={12}/></button></div>
      </article>)}
     </div>
	     {!previewSkills.length && <Empty icon={previewState === 'empty' ? 'folder' : 'search'} title={previewState === 'empty' ? '先授权一个技能目录' : '没有找到相关技能'}>{previewState === 'empty' ? 'Habitat 只读取你明确授权的绝对目录；不会自动扫描本机。' : <>换个关键词，或清除筛选看看。<Button small onClick={() => { setQuery(''); setFilter('all'); setCategory('全部分类'); }}>清除筛选</Button></>}</Empty>}
     <div className="library-bottom"><span><Icon name="info" size={13}/>收录不会自动启用，也不会移动原文件。</span><button className="text-btn" onClick={() => setModal({ type: 'help' })}>了解管理方式<Icon name="arrow" size={11}/></button></div>
    </>}

    {page === 'projects' && project && <>
     <div className="page-heading"><div><h1>项目</h1><p>为当前工作配上需要的技能，其他项目不受打扰。</p></div><Button icon="plus" variant="primary" onClick={() => setModal({ type: 'projectAdd' })}>添加项目</Button></div>
	     <div className="project-cards">{state.projects.map(p => <button className={`project-card ${pid === p.id ? 'selected' : ''}`} key={p.id} onClick={() => go('projects', p.id)}><span className="project-square"><Icon name="folder" size={18}/></span><strong>{p.name}</strong><span>{state.bindings.filter(b => b.projectId === p.id).length} 项技能 · 1 类可配置入口</span>{pid === p.id && <Icon name="checkCircle" className="project-selected-check" size={16}/>}</button>)}</div>
	     <section className="project-workbench"><div className="project-title"><div><h2>{project.name}</h2><p><Icon name="folder" size={12}/>{project.path}</p></div><Button icon={checking ? 'spinner' : 'refresh'} className={checking ? 'loading' : ''} onClick={checkProject} disabled={checking || !!dirty}>{checking ? '检查中…' : '只读入口检查'}</Button></div><div className="project-context"><span>项目默认工具</span><AgentChips groups={project.groups}/><button className="text-btn" onClick={() => setModal({ type: 'agentInfo' })}><Icon name="info" size={12}/>能力与范围</button></div>
      {currentIssues.length > 0 && <button className="project-warning" onClick={() => { go('issues'); setIssueTab('issues'); }}><Icon name="alert" size={14}/><span>{currentIssues.length} 项配置需要检查，查看原因与建议操作。</span><Icon name="arrow" size={12}/></button>}
	      <div className="project-table-toolbar"><div className="tabs"><button className={projectTab === 'configured' ? 'active' : ''} onClick={() => setProjectTab('configured')}>本项目配置<span>{base.length}</span></button><button className={projectTab === 'inherited' ? 'active' : ''} onClick={() => setProjectTab('inherited')}>其他范围可见<span title="未授权，范围未知">未知</span></button></div>{projectTab === 'configured' && <Button small icon="plus" variant="primary" onClick={() => setModal({ type: 'chooseSkills' })}>添加技能</Button>}</div>
	      {projectTab === 'inherited' && <div className="inherited-notice"><Notice>个人、企业与父目录没有读取授权，因此不能枚举技能或推断优先级。项目内移除入口也不代表全局禁用。</Notice></div>}
      <div className="project-table"><div className="table-head"><span>技能</span><span>{projectTab === 'configured' ? '使用方式' : '来源范围'}</span><span>发现状态</span><span>{projectTab === 'configured' ? '配置' : ''}</span></div>{state.skills.filter(s => projectTab === 'inherited' ? inheritedSkills.some(x => x.id === s.id) : base.includes(s.id) || draft.includes(s.id)).map(skill => {
                const binding = state.bindings.find(b => b.projectId === pid && b.skillId === skill.id);
                const problem = currentIssues.find(i => i.skillId === skill.id);
                const changed = base.includes(skill.id) !== draft.includes(skill.id);
	                return <div className={`project-row ${changed ? 'changed' : ''}`} key={skill.id}><button className="table-skill" onClick={() => openDetail(skill.id)}><SkillMark skill={skill} size="small"/><span><strong>{skill.title}</strong><small>{skill.name}</small></span></button><span className="mode-label"><Icon name={projectTab === 'inherited' ? 'globe' : 'lock'} size={11}/>{projectTab === 'inherited' ? '未授权范围' : '固定快照'}</span><span>{changed ? <Badge tone="amber">{draft.includes(skill.id) ? '待添加' : '待移除'}</Badge> : projectTab === 'inherited' ? <Badge>状态未知</Badge> : problem ? <button className="text-btn" onClick={() => setModal({ type: 'diagnose', issueId: problem.id })}><Badge tone={problem.kind === 'broken' ? 'rose' : 'amber'}>{problem.kind === 'broken' ? '入口失效' : '同名冲突'}</Badge></button> : <Badge dot>入口已回读 · Agent 未知</Badge>}</span><span>{projectTab === 'configured' ? <Toggle checked={draft.includes(skill.id)} label={`${draft.includes(skill.id) ? '移除' : '添加'} ${skill.name} 的项目配置`} onChange={() => setDraft(d => d.includes(skill.id) ? d.filter(x => x !== skill.id) : [...d, skill.id])}/> : <Icon name="eye" size={14}/>}</span></div>;
            })}</div>
      {projectTab === 'configured' && !base.length && !draft.length && <Empty icon="folder" title="从一项技能开始">添加项目不会自动启用任何技能。<Button icon="plus" onClick={() => setModal({ type: 'chooseSkills' })}>选择技能</Button></Empty>}
	      <div className="table-footnote"><Icon name="info" size={12}/>入口检查只核对受管链接与固定快照，不运行 Agent，也不证明技能已被发现。</div>
     </section>
     {dirty > 0 && <div className="pending-bar"><span className="pending-symbol"><Icon name="layers" size={18}/></span><div><strong>{dirty} 项待应用的更改</strong><span>仅是草稿，还没有改变项目配置。</span></div><Button small onClick={() => setDraft(base)}>放弃更改</Button><Button icon="arrow" variant="primary" onClick={() => setModal({ type: 'review' })}>检查并应用</Button></div>}
    </>}

    {page === 'issues' && <>
	     <div className="page-heading"><div><h1>需要处理{state.issues.length > 0 && <span className="heading-count warm">{state.issues.length}</span>}</h1><p>看懂证据与授权范围，再决定下一步。</p></div><Button icon="refresh" onClick={() => { notify('合成检查已刷新；未扫描真实环境。'); }}>重新检查</Button></div>
     <div className="tabs issues-tabs"><button className={issueTab === 'issues' ? 'active' : ''} onClick={() => setIssueTab('issues')}>配置问题<span>{state.issues.length}</span></button><button className={issueTab === 'updates' ? 'active' : ''} onClick={() => setIssueTab('updates')}>可用更新<span>{updateCount}</span></button></div>
	     <div className="issue-list">{issueTab === 'issues' ? state.issues.map(issue => { const skill = state.skills.find(s => s.id === issue.skillId); const p = state.projects.find(p => p.id === issue.projectId); return <article className="issue-card" key={issue.id}><span className={`issue-symbol ${issue.kind}`}><Icon name={issue.kind === 'broken' ? 'unlink' : 'layers'} size={21}/></span><div className="issue-content"><div className="issue-title"><h3>{issue.title}</h3><Badge tone={issue.kind === 'broken' ? 'rose' : 'amber'}>{issue.kind === 'broken' ? '需要检查' : '范围未知'}</Badge></div><p>{issue.description}</p><div className="issue-meta"><span><Icon name="folder" size={11}/>{p.name}</span><span><Icon name={skill.icon} size={11}/>{skill.name}</span><span>合成只读证据</span></div></div><Button onClick={() => setModal({ type: 'diagnose', issueId: issue.id })}>查看范围<Icon name="arrow" size={11}/></Button></article>; }) : state.skills.filter(s => s.update).map(skill => <article className="issue-card" key={skill.id}><SkillMark skill={skill}/><div className="issue-content"><div className="issue-title"><h3>{skill.title}</h3><Badge tone="green">{skill.update} 候选</Badge></div><p>先隔离下载并查看完整包差异；确认收录后，项目仍固定旧版本。</p><div className="issue-meta"><span>{skill.version} → {skill.update}</span><span>{countUsage(state, skill.id)} 个项目固定旧版</span><span>合成 Git 候选</span></div></div><Button icon="download" onClick={() => setModal({ type: 'update', skillId: skill.id })}>查看候选</Button></article>)}</div>
	     {(issueTab === 'issues' && !state.issues.length || issueTab === 'updates' && !updateCount) && <Empty icon="checkCircle" title={issueTab === 'issues' ? '当前授权范围内没有报告问题' : '没有已下载的更新候选'}>范围外状态与 Agent 发现仍未知。<Button small onClick={() => go('library')}>返回技能库</Button></Empty>}
     <div className="care-note"><Icon name="lightbulb" size={17}/><span>文件链接正常，只能说明配置完成。<strong> 它并不证明 Agent 已发现技能，也不代表技能内容安全。</strong></span></div>
    </>}

    {page === 'history' && <>
	     <div className="page-heading"><div><h1>操作记录</h1><p>发生了什么、影响了哪里，都有迹可循。</p></div><Badge dot>本机服务持久记录</Badge></div>
	     <Notice title="撤销一次操作，不是重置整个工作空间。">真实服务按项目 revision、目标身份与内容指纹判断能否撤销；后续变更或个人修改会阻断。</Notice>
	     {previewState === 'recovery' && <article className="history-item recovery-preview"><span className="history-icon"><Icon name="alert" size={16}/></span><div><div className="history-item-title"><h3>项目入口需要人工恢复</h3><Badge tone="rose">recovery-required</Badge></div><p>入口在执行后又被外部改变，服务无法安全补偿。新写入已阻断，文件与步骤证据保留。</p><span className="history-time">合成预览 · 不是本机真实事务</span></div><Button small disabled>查看恢复指引</Button></article>}
     <div className="history-date">本次工作空间 <span>{state.events.length} 条操作</span></div>
	     <div className="history-list">{state.events.map(e => <article className={`history-item ${e.undone ? 'undone' : ''}`} key={e.id}><span className="history-icon"><Icon name={e.undone ? 'undo' : e.kind === 'collect' ? 'plus' : e.kind === 'repair' ? 'shield' : e.kind === 'check' ? 'eye' : e.kind === 'update' ? 'download' : 'layers'} size={16}/></span><div><div className="history-item-title"><h3>{e.title}</h3>{e.undone ? <Badge>已撤销</Badge> : <Badge tone="green">合成回读完成</Badge>}</div><p>{e.description}</p><span className="history-time">{dateLabel(e.time)} · 候选预览，无真实写入</span></div><Button small icon="undo" disabled={!canUndo(state, e.id) || e.undone} onClick={() => setModal({ type: 'undo', eventId: e.id })}>预览撤销</Button></article>)}</div>
     {!state.events.length && <Empty icon="clock" title="你的下一次操作，会留在这里。">试着给项目添加一项技能，或处理一个配置问题。<Button variant="primary" onClick={() => go('projects')}>配置一个项目</Button></Empty>}
	     <div className="history-origin"><span /><div><strong>A1 合成工作区已准备好</strong><p>9 项技能 · 3 个项目 · 没有读取或改动任何真实文件</p></div></div>
    </>}

    {page === 'settings' && <>
	     <div className="page-heading"><div><h1>工作空间设置</h1><p>少一些负担，多一些掌控。</p></div><Badge>A1 · 待确认</Badge></div>
	     <div className="settings-panel"><h2>浏览偏好</h2><div className="settings-row"><div><strong>显示完整来源路径</strong><p>在技能详情中默认展开技术路径；只影响当前浏览器显示。</p></div><Toggle label="显示完整来源路径" checked={state.preferences.showPaths} onChange={() => setState(s => ({ ...s, preferences: { ...s.preferences, showPaths: !s.preferences.showPaths } }))}/></div><div className="settings-row"><div><strong>保留本机浏览偏好</strong><p>生产元数据与事务归本机服务；浏览器只保存显示偏好。</p></div><Toggle label="保留本机浏览偏好" checked={state.preferences.remember} onChange={() => setState(s => ({ ...s, preferences: { ...s.preferences, remember: !s.preferences.remember } }))}/></div></div>
	     <div className="settings-panel"><h2>管理方式</h2><div className="setting-detail"><Icon name="eye"/><div><h3>明确授权，再只读收录</h3><p>默认不扫描；本地来源只读取明确授权目录的直接子项，不跟随链接。</p></div></div><div className="setting-detail"><Icon name="layers"/><div><h3>项目变更先预检，再确认执行</h3><p>草稿由本机服务持久化；计划、目标身份、固定快照和回读结果分开显示。</p></div></div><div className="setting-detail"><Icon name="lock"/><div><h3>不上传、不执行、不代管账号</h3><p>首发只管理 Claude Code 项目入口；其他 Agent 与未授权范围保持未知。</p></div></div></div>
	     <div className="settings-panel"><h2>来源与数据</h2><div className="settings-row"><div><strong>本地来源授权</strong><p>只读访问明确授权的绝对目录；撤销授权不会删除源文件。</p></div><Button icon="plus" onClick={() => setModal({type:'add'})}>添加来源</Button></div><div className="settings-row"><div><strong>公开 GitHub 来源</strong><p>联网前单独确认，隔离下载完整包候选；不读取私有凭据。</p></div><Button onClick={() => {setModal({type:'add'});}}>检查来源</Button></div><div className="settings-row"><div><strong>导出本机元数据</strong><p>不包含 Store 快照正文，也不是自动恢复备份。</p></div><Button icon="download" onClick={() => notify('候选预览不会生成真实导出。')}>导出元数据</Button></div></div>
    </>}
   </main>
  </div>

  {selected && <Modal drawer title={selected.title} eyebrow="技能详情" onClose={() => setDetail(null)} footer={<><Button icon="star" onClick={() => toggleFavorite(selected.id)}>{selected.favorite ? '已收藏' : '收藏'}</Button><Button variant="primary" icon="plus" onClick={() => { setDetail(null); setModal({ type: 'assign', skillId: selected.id }); }}>用于项目</Button></>}>
	   <div className="detail-hero"><SkillMark skill={selected} size="large"/><div><div className="detail-slug">{selected.name}</div><span>{selected.version}</span><Badge tone={selected.managed ? 'green' : 'neutral'}>{selected.managed ? 'Habitat 管理' : '仅收录'}</Badge></div></div><p className="detail-description">{selected.description}</p>
   <div className="tabs detail-tabs">{[['overview', '概览'], ['usage', '使用位置'], ['files', '文件'], ['versions', '版本']].map(([id, t]) => <button className={detailTab === id ? 'active' : ''} key={id} onClick={() => setDetailTab(id)}>{t}{id === 'usage' && <span>{countUsage(state, selected.id)}</span>}</button>)}</div>
	   {detailTab === 'overview' && <><section className="detail-section"><h3>什么时候使用</h3><p>{selected.id === 'warehouse' ? '收到上游业务系统的变更需求时，梳理公共数仓的影响范围、兼容动作与待确认事项。' : selected.id === 'frontend' ? '需要搭建产品界面、重构页面，或把设计方案转为前端实现时。' : selected.description}</p></section><section className="detail-section"><h3>试着这样开始<span>用法示例</span></h3><div className="prompt-box"><p>{selected.id === 'warehouse' ? '使用 rd-change-solution，评估这次上游变更对公共数仓的影响。先确认范围，再给出兼容方案。' : `请使用 ${selected.name} 帮我处理当前任务。开始前先确认目标、已有材料与约束。`}</p><button onClick={() => copy(`请使用 ${selected.name} 帮我处理当前任务。开始前先确认目标、已有材料与约束。`)}><Icon name="copy" size={12}/>复制示例</button></div><small className="muted">这是合成示例提示词，不会启动 Agent 或保证技能被调用。</small></section><section className="detail-section"><h3>来源与管理</h3><dl className="detail-facts"><div><dt>收录来源</dt><dd>{selected.origin}</dd></div><div><dt>管理关系</dt><dd>{selected.managed ? '独立托管副本（合成状态）' : '原位置保留 · 只读收录'}</dd></div><div><dt>内容版本</dt><dd>{selected.version === '未声明' ? '原内容没有声明版本' : selected.version}</dd></div></dl><details open={state.preferences.showPaths || undefined}><summary>查看技术路径 <Icon name="down" size={9}/></summary><code className="path-code">{selected.sourcePath}</code></details></section>{selected.needs.length > 0 && <section className="detail-section"><h3>环境要求<span>来源声明 · 未检查</span></h3>{selected.needs.map(n => <div className="requirement" key={n}><Icon name="terminal" size={12}/>{n}<Badge>未知</Badge></div>)}</section>}{selectedIssues.length > 0 && <Notice tone="warning">此技能存在 {selectedIssues.length} 项配置问题。<button className="text-btn" onClick={() => { setDetail(null); go('issues'); }}>查看问题 <Icon name="arrow" size={10}/></button></Notice>}</>}
	   {detailTab === 'usage' && <><section className="detail-section"><h3>正在这些项目中配置</h3>{state.bindings.filter(b => b.skillId === selected.id).map(b => { const p = state.projects.find(p => p.id === b.projectId); return <button className="usage-project" key={p.id} onClick={() => go('projects', p.id)}><span className={`project-square color-${p.color}`}><Icon name="folder"/></span><span><strong>{p.name}</strong><small>入口已回读 · Agent 发现未知</small></span><Icon name="chevron" size={11}/></button>; })}{!countUsage(state, selected.id) && <Empty icon="folder" title="还没有用于任何项目">收录并不会自动启用，准备好再添加。</Empty>}</section>{!selected.managed && <Notice>来源仍在授权目录。未授权的个人、企业与父目录范围保持未知。</Notice>}<div className="scope-card"><Icon name="eye"/><div><strong>配置不是访问权限</strong><p>首发只管理 Claude Code 的项目入口；Agent 是否发现需要单独实测。</p></div></div></>}
	   {detailTab === 'files' && <section className="detail-section"><Notice>文件树和正文是合成内容；真实产品只用文本节点预览已授权文件，不加载 HTML、脚本或远程图片。</Notice><div className="file-tree">{selected.files.map((f, i) => <div key={f}><Icon name={f.includes('/') ? 'folder' : 'file'} size={13}/><code>{f}</code><span>{i === 0 ? '入口文件' : '辅助材料'}</span></div>)}</div><div className="code-preview"><div><span /><span /><span /><small>SKILL.md · 合成预览</small></div><pre>{`---\nname: ${selected.name}\ndescription: ${selected.description}\n---\n\n# ${selected.title}\n\n请先确认任务目标、约束与输入材料。\n在信息缺失时明确说明，不虚构事实。\n\n# 使用边界\n本内容仅用于展示候选文件预览。`}</pre></div></section>}
	   {detailTab === 'versions' && <section className="detail-section"><h3>当前收录内容</h3><div className="version-box"><Icon name="branch" size={20}/><div><strong>{selected.version}</strong><p>{selected.origin.includes('GitHub') ? 'Git 来源固定到已收录 commit；项目可继续固定旧快照。' : '本地来源可能变化，读取前会核对身份与指纹。'}</p></div><Badge tone="green">当前</Badge></div>{selected.update ? <><Notice tone="success">已下载合成候选 {selected.update}。先确认仅收录，再逐项目预览切换。</Notice><Button variant="primary" icon="download" onClick={() => { setDetail(null); setModal({ type: 'update', skillId: selected.id }); }}>查看完整包候选</Button></> : <Notice>没有联网检查结果不等于已是最新版本。</Notice>}</section>}
  </Modal>}

	  {modal?.type === 'help' && <Modal title="关于这份候选" eyebrow="A1 · 待用户确认" onClose={() => setModal(null)} footer={<Button variant="primary" onClick={() => setModal(null)}>关闭说明 <Icon name="arrow" size={12}/></Button>}><div className="help-logo"><Icon name="box" size={30}/></div><p className="modal-intro">A1 保留已确认的 Habitat Air 结构，用真实 Web 能力边界替换桌面与模拟业务语义。</p>{[['eye', '01', '先授权再收录', '不扫描全盘；只读来源与项目写入分别授权。'], ['folder', '02', '按项目计划变更', '首发只管理 Claude Code 项目入口，预检后再次确认。'], ['shield', '03', '回读与恢复', '配置、Agent 发现、事务结果和恢复状态分别表达。']].map(([icon, n, t, d]) => <div className="help-step" key={n}><Icon name={icon} size={19}/><div><strong><span>{n}</span>{t}</strong><p>{d}</p></div></div>)}<Notice>全部内容是合成候选，不访问 API、本机文件或网络，也不代表用户已经批准。可用 ⌘/Ctrl K 搜索，Esc 关闭浮层。</Notice></Modal>}
	  {modal?.type === 'agentInfo' && <Modal title="入口配置，不是 Agent 权限。" eyebrow="工具与发现范围" onClose={() => setModal(null)} footer={<Button variant="primary" onClick={() => setModal(null)}>明白了</Button>}><p className="modal-intro">真实首发只管理 Claude Code 项目的 `.claude/skills` 入口。入口回读成功仍不能证明 Agent 已发现。</p><div className="agent-info-row disabled-capability"><AgentChips groups={['shared']}/><code>.agents/skills/&lt;skill&gt;</code><p>Codex / Pi / Cursor 项目适配尚未实现；候选保留位置并明确禁用。</p></div><div className="agent-info-row"><AgentChips groups={['claude']}/><code>.claude/skills/&lt;skill&gt;</code><p>可创建受管固定快照入口；个人、企业和父目录范围仍未知。</p></div><Notice tone="warning">只读入口检查核对链接和指纹，不运行 Agent，也不判断技能执行效果。</Notice></Modal>}
	  {modal?.type === 'previewStates' && <Modal title="预览真实能力状态" eyebrow="合成状态切换" onClose={() => setModal(null)} footer={<><Button onClick={() => {setPreviewState('normal');setModal(null);}}>恢复标准</Button><Button variant="primary" onClick={() => setModal(null)}>查看当前状态</Button></>}><Notice>这些状态只改变候选画面，不读取或修改任何真实数据。</Notice><div className="preview-state-list">{Object.entries(PREVIEW_STATES).map(([id, item]) => <button key={id} className={`choice-card ${previewState === id ? 'selected' : ''}`} onClick={() => {setPreviewState(id); if(id === 'recovery') setPage('history'); if(id === 'empty' || id === 'partial' || id === 'metadata' || id === 'drift') setPage('library');}}><span className="radio"><i /></span><span><strong>{item.label}</strong><small>{item.text}</small></span></button>)}</div></Modal>}
	    {modal?.type === 'add' && <AddWizard state={state} onClose={() => setModal(null)} onComplete={(config, target) => { try {
	        const next = addSkill(state, config);
	        const newId = next.skills[0].id;
	        setState(next);
	        setModal(null);
	        notify(target ? '合成候选已进入项目草稿；真实产品仍需服务端预检和再次确认。' : '合成候选已只读收录，没有启用任何项目。');
	        if (target) { setPid(target); setPage('projects'); setDraft([...getBase(next, target), newId]); }
	        else setPage('library');
	        setFilter('all');
        setQuery('');
        setCategory('全部分类');
    }
    catch (e) {
        return e.message;
    } }}/>}
	  {modal?.type === 'scan' && <ScanModal state={state} onClose={() => setModal(null)} onComplete={() => { setState(s => ({ ...s, scanDone: true })); setModal(null); setPage('library'); setFilter('all'); notify('合成授权范围已刷新；未运行 Agent，也没有移动原文件。'); }}/>} 
	  {modal?.type === 'projectAdd' && <AddProject onClose={() => setModal(null)} state={state} onComplete={(name, path, groups) => { const id = 'project-' + Date.now(); const next = transact(state, { projects: [...state.projects, { id, name, path, groups, color: 'green', description: '新建合成工作区' }] }, `添加项目 ${name}（合成）`, '候选只记录项目和授权范围，没有自动安装任何技能。', 'collect'); mutate(next, '合成项目已登记，没有自动启用技能。'); setPid(id); setPage('projects'); }}/>} 
  {modal?.type === 'chooseSkills' && <ChooseSkills state={state} initial={draft} onClose={() => setModal(null)} onComplete={ids => { setDraft(ids); setModal(null); notify('技能选择已存为草稿，检查后才会应用。'); }}/>}
	  {modal?.type === 'review' && <Modal wide title={`应用到 ${project.name}`} eyebrow="服务端预检后的变更预览" onClose={() => setModal(null)} footer={<><span className="footer-note"><Icon name="shield" size={12}/>合成计划 · 10 分钟后失效</span><Button onClick={() => setModal(null)}>继续编辑</Button><Button variant="primary" icon="check" onClick={() => { try {
	        mutate(applyProject(state, pid, draft), '合成执行已回读；Agent 发现状态仍未知。');
    }
    catch (e) {
        notify(e.message, 'warning');
	    } }}>确认执行</Button></>}><p className="modal-intro">这些更改只作用于当前项目的受管入口。源包复制为固定快照，其他项目的配置不变。</p><div className="review-summary"><span><strong>{draft.filter(id => !base.includes(id)).length}</strong>项添加</span><span><strong>{base.filter(id => !draft.includes(id)).length}</strong>项移除</span><span><strong>0</strong>个源文件删除</span></div><div className="review-list">{state.skills.filter(s => base.includes(s.id) !== draft.includes(s.id)).map(s => <div key={s.id}><span className={`change-icon ${draft.includes(s.id) ? 'added' : 'removed'}`}><Icon name={draft.includes(s.id) ? 'plus' : 'minus'} size={13}/></span><div><strong>{s.name}</strong><code>.claude/skills/{s.name}</code><small>固定快照与目标身份将在执行前再次核对</small></div><Badge tone={draft.includes(s.id) ? 'green' : 'rose'}>{draft.includes(s.id) ? '添加入口' : '移除入口'}</Badge></div>)}</div><Notice>执行中会持久记录步骤并回读。移除项目入口不等于全局禁用；Agent 是否发现仍未知。</Notice></Modal>}
	  {modal?.type === 'assign' && <AssignModal state={state} skillId={modal.skillId} onClose={() => setModal(null)} onComplete={id => { const s = state.skills.find(s => s.id === modal.skillId); setPid(id); setDraft([...new Set([...getBase(state, id), s.id])]); setDetail(null); setModal(null); setPage('projects'); notify('已加入合成项目草稿；尚未预检或写入。'); }}/>} 
	  {modal?.type === 'diagnose' && <DiagnoseModal state={state} issueId={modal.issueId} onClose={() => setModal(null)} onComplete={() => setModal(null)}/>} 
	  {modal?.type === 'update' && <UpdateModal state={state} skillId={modal.skillId} onClose={() => setModal(null)} onComplete={id => { const skill = state.skills.find(s => s.id === id); const next = transact(state, { skills: state.skills.map(s => s.id === id ? { ...s, version: s.update, update: undefined } : s) }, `已收录 ${skill.name} 的新候选（合成）`, `${countUsage(state, id)} 个项目仍固定旧快照；需要逐项目另行预览。`, 'update'); mutate(next, '已仅收录合成候选，没有切换任何项目。'); }}/>} 
  {modal?.type === 'undo' && <Modal title="撤销这次操作？" eyebrow="撤销操作" onClose={() => setModal(null)} footer={<><Button onClick={() => setModal(null)}>保留操作</Button><Button variant="primary" icon="undo" onClick={() => { try {
	        mutate(undo(state, modal.eventId), '合成状态已恢复到这次操作之前。');
    }
    catch (e) {
        notify(e.message, 'warning');
	    } }}>确认预览撤销</Button></>}><p className="modal-intro">{state.events.find(e => e.id === modal.eventId)?.title}</p><Notice>候选恢复浏览器内 fixture 并保留记录。真实服务还会校验项目 revision、目标身份、后续变更和个人修改。</Notice></Modal>}
  {modal?.type === 'guard' && <Modal title="项目里还有未应用的更改。" onClose={() => setModal(null)} footer={<><Button variant="primary" onClick={() => setModal(null)}>返回继续编辑</Button><Button onClick={() => { const fn = modal.run; setDraft(base); fn(); }}>放弃草稿并离开</Button></>}><p className="modal-intro">你有 {dirty} 项待应用变更。离开前可以保留当前编辑，或明确放弃它们。没有任何配置被自动应用。</p></Modal>}
  {modal?.type === 'reset' && <Modal title="重新开始这次体验？" onClose={() => setModal(null)} footer={<><Button onClick={() => setModal(null)}>取消</Button><Button variant="danger" onClick={() => { setState(initialState()); setPid('habitat'); setPage('library'); setFilter('all'); setQuery(''); setCategory('全部分类'); setDetail(null); setModal(null); notify('演示已重置，真实文件不受影响。'); }}>重置演示数据</Button></>}><p className="modal-intro">你的演示收藏、项目配置与操作记录将被清除，恢复为最初的 9 项技能和 3 个项目。</p><Notice>只影响当前浏览器中的演示数据，不读取、删除或恢复真实文件。</Notice></Modal>}
  {modal?.type === 'copy' && <Modal title="复制文本" onClose={() => setModal(null)} footer={<Button onClick={() => setModal(null)}>完成</Button>}><p>浏览器未授权剪贴板，请选中文本后复制。</p><textarea className="copy-text" readOnly value={modal.value} onFocus={e => e.target.select()}/></Modal>}
  {modal?.type === 'command' && <CommandPalette state={state} onClose={() => setModal(null)} onSkill={id => { setModal(null); openDetail(id); }} onPage={p => go(p)} onProject={id => go('projects', id)} onAdd={() => setModal({ type: 'add' })}/>}
  {toast && <div className={`toast ${toast.tone}`} role="status"><Icon name={toast.tone === 'warning' ? 'info' : 'checkCircle'} size={17}/><span>{toast.text}</span><button aria-label="关闭提示" onClick={() => setToast(null)}><Icon name="close" size={13}/></button></div>}
 </div>;
}
