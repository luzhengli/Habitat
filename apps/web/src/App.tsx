import React, { useEffect, useRef, useState } from 'react';
import Diagnostics from './Diagnostics';
import { CommandPalette } from './CommandPalette';
import LibraryControls, { type LibraryFilter, type LibrarySort, type LibraryView } from './LibraryControls';
import GitSources from './GitSources';
import Management from './Management';
import Icon from './components/Icon';
import { Button, Badge, Empty, Modal, Notice } from './components/UI';
import { request } from './client';
import type { Inventory, Skill, Source } from './types';
const pages: Record<string, string[]> = { library: ['技能库', 'grid'], projects: ['项目', 'folder'], issues: ['需要处理', 'alert'], history: ['操作记录', 'clock'], settings: ['设置', 'settings'] };
export default function App() {
  const [url, setUrl] = useState(location.pathname);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [projects, setProjects] = useState<{id:string;name:string;count:number}[]>([]);
  const [projectAddRequest, setProjectAddRequest] = useState(0);
  const [commandOpen, setCommandOpen] = useState(false);
  const commandReturnFocus = useRef<HTMLElement | null>(null);
  const grantReturnFocus = useRef<HTMLElement | null>(null);
  const [issueCount, setIssueCount] = useState(0);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('all');
  const [libraryView, setLibraryView] = useState<LibraryView>('grid');
  const [librarySort, setLibrarySort] = useState<LibrarySort>('recent');
  const [category, setCategory] = useState('全部分类');
  const page = url.split('/')[1] || 'library';
  const navigate = (value: string) => { history.pushState(null, '', value); setUrl(value); setMobileMenu(false); };
  useEffect(() => { const pop = () => setUrl(location.pathname); addEventListener('popstate', pop); return () => removeEventListener('popstate', pop); }, []);
  const [data, setData] = useState<Inventory | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [query, setQuery] = useState('');
  const [pageIndex,setPageIndex]=useState(0);
  const [fileItems,setFileItems]=useState<{id:string;path:string;type:string}[]>([]),[fileError,setFileError]=useState('');
  const [useSkill,setUseSkill]=useState<Skill|null>(null);
  const [sources, setSources] = useState<Source[]>([]), [grantOpen, setGrantOpen] = useState(false), [sourcePath,setSourcePath] = useState(''), [confirmed,setConfirmed] = useState(false);
  const [detail, setDetail] = useState<Skill | null>(null), [body, setBody] = useState(''), [mobileMenu, setMobileMenu] = useState(false);
  async function refresh() { setBusy(true); setError(''); try { const inventory = await request<Inventory>('inventory'); const sourceItems = (await request<{items:Source[]}>('sources')).items; const registered = (await request<{items:{id:string;name:string}[]}>('projects')).items; const projectFacts = await Promise.all(registered.map(async project => ({...project, items:(await request<{items:{skillId:string;configured:boolean}[]}>(`projects/${project.id}/exposures`)).items}))); setProjects(projectFacts.map(p => ({...p,count:p.items.length}))); const counts:Record<string,number> = {}; for(const p of projectFacts) for(const id of new Set(p.items.map(b => b.skillId))) counts[id]=(counts[id]??0)+1; setUsage(counts); setIssueCount(inventory.diagnostics.length + projectFacts.reduce((count, project) => count + project.items.filter(binding => !binding.configured).length, 0)); setData(inventory); setSources(sourceItems); } catch(e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } }
  async function scan() { setBusy(true); try { await request('scans','POST',{}); await refresh(); } catch(e) { setError(String(e)); } finally { setBusy(false); } }
  async function grant() { setBusy(true); try { await request('sources','POST',{absolutePath:sourcePath,permission:'read-only',confirm:confirmed}); setGrantOpen(false); setSourcePath(''); setConfirmed(false); await scan(); } catch(e) { setError(String(e)); } finally { setBusy(false); } }
  async function favorite(skill: Skill) { try { await request(`skills/${skill.id}/preferences`,'PATCH',{favorite:!skill.favorite}); await refresh(); } catch(e) {setError(String(e));} }
  async function inspect(skill: Skill) { navigate(`/library/${skill.id}`); setDetail(skill); setBody('正在读取…'); try { const content = await request<{text: string}>(`skills/${skill.id}`); setBody(content.text); } catch(e) { setBody(`未完成：${e instanceof Error ? e.message : String(e)}`); } }
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229 || !data) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        // A global shortcut must not interrupt a confirmation or executing transaction.
        if (document.querySelector('[role="dialog"]') && !commandOpen) return;
        event.preventDefault();
        if (!commandOpen) commandReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setCommandOpen(open => !open);
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [commandOpen, data]);
  useEffect(() => { const id = url.split('/')[2]; if (!id) { setDetail(null); return; } if (page === 'library' && data) { const skill = data.skills.find(s => s.id === id); if (!skill) { setError('技能不存在或不在当前授权范围'); return; } setDetail(skill); setFileItems([]);setFileError('');request<{items:{id:string;path:string;type:string}[]}>(`skills/${id}/files`).then(r=>setFileItems(r.items)).catch(e=>setFileError(String(e))); request<{text: string}>(`skills/${id}`).then(r => setBody(r.text)).catch(e => setBody(String(e))); } }, [url, data]);
  const textMetadata = (skill: Skill, key: string) => typeof skill.metadata?.[key] === 'string' ? skill.metadata[key] as string : '';
  const allSkills = data?.skills ?? [];
  const matched = allSkills.filter(skill => `${skill.declaredName ?? skill.directoryName} ${skill.description ?? ''} ${skill.path} ${textMetadata(skill,'title')}`.toLowerCase().includes(query.toLowerCase()) && (libraryFilter === 'all' || libraryFilter === 'favorite' && skill.favorite || libraryFilter === 'managed' && !!usage[skill.id] || libraryFilter === 'observed' && !usage[skill.id]) && (category === '全部分类' || textMetadata(skill,'category') === category)).sort((a,b) => librarySort === 'name' ? (a.declaredName??a.directoryName).localeCompare(b.declaredName??b.directoryName) : librarySort === 'usage' ? (usage[b.id]??0)-(usage[a.id]??0) : (b.firstIndexedAt??'').localeCompare(a.firstIndexedAt??''));
  const visible = matched.slice(pageIndex*50,(pageIndex+1)*50);
  return <div className={`app-shell web-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} data-shell="web">
    {mobileMenu && <button className="mobile-nav-backdrop" aria-label="关闭导航" onClick={() => setMobileMenu(false)}/>}
    <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
      <a className="brand" href="/library" aria-label="Habitat 首页"><span className="brand-symbol"><Icon name="box" size={21}/></span><span className="brand-word">Habitat</span></a>
      <div className="workspace-label">个人技能工作台</div><div className="nav-label">工作空间</div>
      <nav className="main-nav" aria-label="主导航">{Object.entries(pages).filter(([id]) => id !== 'settings').map(([id, [label, icon]]) => <a href={`/${id}`} aria-label={label} title={label} key={id} className={`nav-item ${id === page ? 'active' : ''}`}><Icon name={icon}/><span>{label}</span>{id === 'issues' && issueCount > 0 && <span className="nav-count warm">{issueCount}</span>}</a>)}</nav>
      <div className="nav-label projects-label"><span>最近项目</span><button className="sidebar-mini" onClick={() => { navigate('/projects'); setProjectAddRequest(v => v + 1); }} aria-label="添加项目"><Icon name="plus" size={12}/></button></div>
      <nav className="project-nav" aria-label="项目导航">{projects.map(project => <button className={`nav-project ${page === 'projects' && url.split('/')[2] === project.id ? 'current' : ''}`} title={project.name} key={project.id} onClick={() => { navigate(`/projects/${project.id}`); window.dispatchEvent(new PopStateEvent('popstate')); }}><span className="project-nav-icon"><Icon name="folder" size={15}/></span><span>{project.name}</span><span className="project-count">{project.count}</span></button>)}</nav>
      <div className="sidebar-spacer"/><div className="local-status"><Icon name="lock" size={13}/><span>本地服务<span>仅授权目录 · 不上传</span></span></div><a href="/settings" aria-label="设置" title="设置" className={`nav-item settings-nav ${page === 'settings' ? 'active' : ''}`}><Icon name="settings"/><span>设置</span></a>
    </aside><div className="workspace"><header className="topbar"><div className="breadcrumbs"><button className="icon-btn desktop-sidebar-toggle" aria-label={sidebarCollapsed ? '展开侧栏' : '收起侧栏'} title={sidebarCollapsed ? '展开侧栏' : '收起侧栏'} onClick={() => setSidebarCollapsed(v => !v)}><Icon name="sidebar" size={17}/></button><button className="icon-btn mobile-toggle" aria-label="展开导航" onClick={() => setMobileMenu(true)}><Icon name="menu"/></button><span>本地空间</span><Icon name="chevron" size={9}/><strong>{pages[page]?.[0] ?? '页面不存在'}</strong></div><div className="topbar-right"><button className="global-search-button" disabled={!data} onClick={event => { commandReturnFocus.current = event.currentTarget; setCommandOpen(true); }}><Icon name="search" size={14}/><span>搜索</span><kbd>⌘ K</kbd></button><Badge>本地技能工作台</Badge></div></header>
      <main className="main-content">
        <div className="page-heading"><div><h1>{pages[page]?.[0] ?? '页面不存在'}</h1><p>{page === 'library' ? '你的 Agent 技能，一处看清，按需使用。' : '按项目配置，变更先预览，结果可回读。'}</p></div>{page === 'library' && <div className="heading-actions"><Button icon="refresh" disabled={busy} onClick={scan}>{busy ? '正在扫描…' : '扫描授权目录'}</Button><Button icon="plus" variant="primary" onClick={event => { grantReturnFocus.current = event.currentTarget; setGrantOpen(true); }}>添加本地来源</Button></div>}</div>
        {error && <Notice tone="warning" title="读取未完成">{error}<Button small onClick={refresh}>重试</Button></Notice>}
        {useSkill || page === 'projects' || page === 'history' ? <Management onAddRequestHandled={() => setProjectAddRequest(0)} addRequest={projectAddRequest} onProjectsChange={refresh} onOperationChange={refresh} page={useSkill?'projects':page} skills={data?.skills??[]} initialSkill={useSkill??undefined} onDone={useSkill?()=>setUseSkill(null):undefined}/> : page === 'settings' ? <><GitSources sources={sources} onChange={refresh}/><Button onClick={async()=>{try{const data=await request('export');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='habitat-metadata.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError(String(e));}}}>导出本机元数据</Button><Button variant="primary" onClick={event => { grantReturnFocus.current = event.currentTarget; setGrantOpen(true); }}>添加本地来源</Button><p>只读授权仅允许读取指定目录。撤销不删除源文件。</p>{sources.map(source => <div className="source-row" key={source.id}><code>{source.path}</code><Badge>{source.revokedAt ? '已撤销' : '只读授权'}</Badge>{!source.revokedAt && <Button small onClick={async () => {try {await request(`sources/${source.id}`,'DELETE',{});await refresh();}catch(e){setError(String(e));}}}>撤销授权</Button>}</div>)}</> : page === 'issues' ? <Diagnostics inventory={data}/> : page !== 'library' ? <Empty icon={pages[page]?.[1] ?? 'info'} title={pages[page] ? '能力尚待实现，不显示模拟结果' : '404 · 页面不存在'}>原型保留了完整交互示例。请依照 docs/06-实施计划与验收.md 接入真实服务，不要把演示状态当作用户数据。<a className="text-btn" href="/demo">查看 Air 原型 →</a></Empty> : <>
          <LibraryControls counts={{all:allSkills.length,favorite:allSkills.filter(s=>s.favorite).length,managed:allSkills.filter(s=>usage[s.id]).length,observed:allSkills.filter(s=>!usage[s.id]).length}} filter={libraryFilter} onFilter={value=>{setLibraryFilter(value);setPageIndex(0);}} view={libraryView} onView={setLibraryView} query={query} onQuery={value=>{setQuery(value);setPageIndex(0);}} category={category} categories={['全部分类','开发工程','数据分析','内容创作','效率工具']} onCategory={value=>{setCategory(value);setPageIndex(0);}} sort={librarySort} onSort={value=>{setLibrarySort(value);setPageIndex(0);}} count={matched.length}/>

          {!!data?.diagnostics.length && <Notice tone="warning" title="扫描范围不完整">{data.diagnostics.map((d,i) => <p key={i}>{d.code}：{d.root} — {d.message}</p>)}</Notice>}
          <div className={`skill-grid ${libraryView === 'list' ? 'list-view' : ''}`}>{visible.map(skill => <article className="skill-card" key={skill.id}><div className="card-top"><span className={`skill-mark color-${['blue','violet','amber','teal','rose','green','slate'].includes(textMetadata(skill,'color')) ? textMetadata(skill,'color') : 'blue'}`}><Icon name={textMetadata(skill,'icon') || 'file'} size={21}/></span><button className="card-title" onClick={() => inspect(skill)}><h3>{textMetadata(skill,'title') || skill.declaredName || skill.directoryName}</h3><span className="origin" title={sources.find(source=>source.id===skill.sourceId)?.path}>{sources.find(source=>source.id===skill.sourceId)?.path.split('/').pop() || '本地来源'}</span></button><button className={`favorite-button ${skill.favorite ? 'saved' : ''}`} aria-label={skill.favorite ? "取消收藏" : "收藏技能"} aria-pressed={skill.favorite} onClick={() => favorite(skill)}><Icon name={skill.favorite ? "starSolid" : "star"} size={15}/></button></div><button className="card-content" onClick={() => inspect(skill)}><p>{skill.description ?? "来源未提供用途说明"}</p></button><div className="card-meta"><span className="ownership">{usage[skill.id] ? '已托管' : '仅收录'}</span><button className="card-use" onClick={() => setUseSkill(skill)}>使用<Icon name="arrow" size={12}/></button></div></article>)}</div>
          {matched.length>50&&<div className="draft-bar"><Button disabled={pageIndex===0} onClick={()=>setPageIndex(pageIndex-1)}>上一页</Button><span>第 {pageIndex+1} / {Math.ceil(matched.length/50)} 页</span><Button disabled={(pageIndex+1)*50>=matched.length} onClick={()=>setPageIndex(pageIndex+1)}>下一页</Button></div>}
          {!busy && data && !visible.length && <Empty title={allSkills.length ? '没有找到相关技能' : '从一个目录开始'}>{allSkills.length ? <Button small onClick={() => {setQuery('');setLibraryFilter('all');setCategory('全部分类');setPageIndex(0);}}>清除筛选</Button> : <>授权一个本机技能目录，即可只读查看；不移动原件，无需创建 Store。</>}</Empty>}
          <p className="web-scope">当前范围：直接子目录中的 SKILL.md；不递归、不跟随链接、不扫描全盘。这不是 Agent 完整可见范围。</p>
        </>}
      </main></div>
      {commandOpen && <CommandPalette returnFocusRef={commandReturnFocus} skills={allSkills.map(skill => ({id:skill.id,name:skill.declaredName ?? skill.directoryName,title:textMetadata(skill,'title') || skill.declaredName || skill.directoryName,icon:textMetadata(skill,'icon') || 'file',color:['blue','violet','amber','teal','rose','green','slate'].includes(textMetadata(skill,'color')) ? textMetadata(skill,'color') : 'blue'}))} projects={projects} issueCount={issueCount} onClose={() => setCommandOpen(false)} onSkill={id => { const skill = allSkills.find(item => item.id === id); if (skill) { setCommandOpen(false); setUseSkill(null); inspect(skill); } }} onProject={id => { setCommandOpen(false); setUseSkill(null); navigate(`/projects/${id}`); window.dispatchEvent(new PopStateEvent('popstate')); }} onPage={page => {setCommandOpen(false);setUseSkill(null);navigate(`/${page}`);}} onAdd={() => {grantReturnFocus.current = commandReturnFocus.current;setCommandOpen(false);setGrantOpen(true);}}/>}
      {grantOpen && <Modal returnFocusRef={grantReturnFocus} title="添加本地来源" onClose={() => setGrantOpen(false)} footer={<><Button onClick={() => setGrantOpen(false)}>取消</Button><Button variant="primary" disabled={!confirmed || !sourcePath || busy} onClick={grant}>只读授权并扫描</Button></>}><Notice>输入服务所在电脑的绝对目录。仅读取直接子目录中的 SKILL.md，不移动原件、不执行脚本。</Notice><label className="field">本机来源路径<input value={sourcePath} onChange={e=>setSourcePath(e.target.value)} placeholder="/absolute/path/to/skills"/></label><label className="field"><span><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> 我允许 Habitat 只读访问此目录</span></label>{error && <Notice tone="warning">{error}</Notice>}</Modal>}
      {detail && <Modal drawer title={detail.declaredName ?? detail.directoryName} eyebrow="真实只读内容" onClose={() => navigate('/library')} footer={<Button onClick={() => navigate('/library')}>关闭</Button>}><Notice>只预览，不执行 Markdown、HTML 或脚本。</Notice><p className="path-code">{detail.path}</p><details><summary>文件与内容指纹</summary><p className="path-code">{detail.fingerprint}</p>{fileError&&<Notice tone="warning">{fileError}</Notice>}{fileItems.map(file=><div key={file.id}>{file.type==='file'?<button className="text-btn" onClick={async()=>{try{setBody((await request<{text:string}>(`skills/${detail.id}/files/${file.id}`)).text);}catch(e){setBody(String(e));}}}>{file.path}</button>:<span>{file.path}/</span>}</div>)}</details><pre className="web-skill-text">{body}</pre></Modal>}
  </div>;
}
