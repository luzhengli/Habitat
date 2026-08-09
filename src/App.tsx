import { useCallback, useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  AlertCircle,
  ArrowRight,
  Box,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clipboard,
  ClipboardCheck,
  Code2,
  Database,
  FileCode2,
  Folder,
  FolderGit2,
  FolderOpen,
  GitBranch,
  Info,
  Link2,
  LoaderCircle,
  Menu,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Unlink,
  X,
  XCircle,
} from "lucide-react";
import { api } from "./api";
import type {
  AppError,
  CommandResult,
  LinkState,
  Preflight,
  ProjectScan,
  Skill,
  StoreScan,
} from "./types";

type Notice = { tone: "success" | "error" | "info"; title: string; detail?: string };
type BusyAction = "store" | "project" | "scan" | "link" | "unlink" | "npx" | "git" | null;

type QaCaptureState = {
  store: StoreScan;
  project: ProjectScan;
  preflight: Preflight;
  gitStatus: CommandResult;
};

const qaMode = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("qa") : null;

const stateLabels: Record<LinkState, string> = {
  available: "未链接",
  valid: "已链接",
  broken: "失效链接",
  conflict: "名称冲突",
  outside_store: "技能库外链接",
};

function toError(error: unknown): AppError {
  if (typeof error === "object" && error !== null) return error as AppError;
  if (typeof error === "string") {
    try {
      return JSON.parse(error) as AppError;
    } catch {
      return { message: error };
    }
  }
  return { message: "发生未知错误。" };
}

function formatTime(value: number) {
  if (!value) return "未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function commandTitle(result: CommandResult | null) {
  if (!result) return "尚未运行";
  if (result.success) return `完成 · 退出码 ${result.status ?? 0}`;
  return `失败 · 退出码 ${result.status ?? "未知"}`;
}

function CopyPath({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div className="path-box">
      <code>{value}</code>
      <button className="icon-button path-copy" onClick={copy} aria-label={`复制${label}`} title={`复制${label}`}>
        {copied ? <ClipboardCheck aria-hidden="true" /> : <Clipboard aria-hidden="true" />}
      </button>
      {copied && <span className="copy-feedback" role="status">已复制</span>}
    </div>
  );
}

function StatusIcon({ state }: { state: LinkState }) {
  if (state === "valid") return <CheckCircle2 className="status-success" aria-hidden="true" />;
  if (state === "available") return <Plus className="status-accent" aria-hidden="true" />;
  if (state === "broken") return <XCircle className="status-danger" aria-hidden="true" />;
  return <AlertCircle className="status-warning" aria-hidden="true" />;
}

function App() {
  const [store, setStore] = useState<StoreScan | null>(null);
  const [project, setProject] = useState<ProjectScan | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<BusyAction>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [gitStatus, setGitStatus] = useState<CommandResult | null>(null);
  const [gitDiff, setGitDiff] = useState<CommandResult | null>(null);
  const [npxStatus, setNpxStatus] = useState<CommandResult | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const linkedByName = useMemo(
    () => new Map((project?.links ?? []).map((link) => [link.name, link])),
    [project],
  );

  const annotatedSkills = useMemo(() => {
    return (store?.skills ?? []).map((skill) => {
      const link = linkedByName.get(skill.name);
      return { skill, state: link?.state ?? ("available" as LinkState), link };
    });
  }, [store, linkedByName]);

  const visibleSkills = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return annotatedSkills.filter(({ skill, state }) => {
      const matchesQuery = !query || `${skill.name} ${skill.description}`.toLocaleLowerCase().includes(query);
      const matchesFilter = filter === "all" || (filter === "linked" ? state !== "available" : state === "available");
      return matchesQuery && matchesFilter;
    });
  }, [annotatedSkills, search, filter]);

  const linked = visibleSkills.filter(({ state }) => state !== "available");
  const available = visibleSkills.filter(({ state }) => state === "available");
  const selected = store?.skills.find((skill) => skill.name === selectedName) ?? null;
  const selectedLink = selectedName ? linkedByName.get(selectedName) : undefined;

  useEffect(() => {
    if (!qaMode) return;
    fetch(`/docs/qa/state/${qaMode}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`QA state ${qaMode} is unavailable`);
        return response.json() as Promise<QaCaptureState>;
      })
      .then((capture) => {
        setStore(capture.store);
        setProject(capture.project);
        setPreflight(capture.preflight);
        setGitStatus(capture.gitStatus);
        setSelectedName("project-harness");
        setLastChecked(new Date());
        setDrawerOpen(new URLSearchParams(window.location.search).get("drawer") === "1");
        if (qaMode === "success") {
          setNotice({ tone: "success", title: "project-harness 已链接到 media", detail: "已创建相对符号链接；源文件没有被复制或修改。" });
        }
        if (qaMode === "conflict") {
          setNotice({ tone: "error", title: "目标位置存在冲突", detail: "目标已存在真实目录，Habitat 不会覆盖。" });
        }
      })
      .catch((error: Error) => setNotice({ tone: "error", title: "无法载入 QA 状态", detail: error.message }));
  }, []);

  useEffect(() => {
    if (qaMode || store) return;
    const savedStore = window.localStorage.getItem("habitat.storeRoot");
    if (!savedStore) return;
    setBusy("store");
    api.scanStore(savedStore)
      .then((nextStore) => setStore(nextStore))
      .catch((error) => {
        const detail = toError(error);
        setNotice({ tone: "error", title: "无法重新打开技能库", detail: detail.recovery ?? detail.message });
      })
      .finally(() => setBusy(null));
  }, [store]);

  const refreshProject = useCallback(async (
    storeRoot = store?.root,
    projectRoot = project?.root,
    skillName = selectedName,
  ) => {
    if (!storeRoot || !projectRoot) return;
    const [next, nextGit, nextPreflight] = await Promise.all([
      api.scanProject(projectRoot, storeRoot),
      api.inspectGitStatus(projectRoot),
      skillName ? api.preflightLink(storeRoot, projectRoot, skillName) : Promise.resolve(null),
    ]);
    setProject(next);
    setGitStatus(nextGit);
    setPreflight(nextPreflight);
  }, [store?.root, project?.root, selectedName]);

  const refreshAll = useCallback(async () => {
    if (!store || !project) return;
    setBusy("scan");
    setNotice(null);
    try {
      const [nextStore, nextProject, nextGit] = await Promise.all([
        api.scanStore(store.root),
        api.scanProject(project.root, store.root),
        api.inspectGitStatus(project.root),
      ]);
      setStore(nextStore);
      setProject(nextProject);
      setGitStatus(nextGit);
      setLastChecked(new Date());
      setNotice({ tone: "success", title: "已重新读取真实文件与链接状态。" });
    } catch (error) {
      const detail = toError(error);
      setNotice({ tone: "error", title: detail.message ?? "刷新失败", detail: detail.recovery ?? detail.stderr });
    } finally {
      setBusy(null);
    }
  }, [store, project]);

  useEffect(() => {
    if (qaMode) return;
    if (!store || !project || !selectedName) {
      setPreflight(null);
      return;
    }
    let cancelled = false;
    setPreflight(null);
    api.preflightLink(store.root, project.root, selectedName)
      .then((result) => { if (!cancelled) setPreflight(result); })
      .catch((error) => {
        if (!cancelled) {
          const detail = toError(error);
          setNotice({ tone: "error", title: detail.message ?? "预检失败", detail: detail.recovery ?? detail.stderr });
        }
      });
    return () => { cancelled = true; };
  }, [store?.root, project?.root, selectedName]);

  const chooseStore = async () => {
    setBusy("store");
    setNotice(null);
    try {
      const path = await open({ directory: true, multiple: false, title: "选择唯一 Skill Store" });
      if (typeof path !== "string") return;
      const nextStore = await api.scanStore(path);
      setStore(nextStore);
      setSelectedName(null);
      setPreflight(null);
      if (project) await refreshProject(nextStore.root, project.root, null);
      setNotice({ tone: "success", title: `已选择技能库 ${nextStore.name}`, detail: `读取到 ${nextStore.skills.length} 个有效 skills。` });
    } catch (error) {
      const detail = toError(error);
      setNotice({ tone: "error", title: detail.message ?? "无法选择技能库", detail: detail.recovery ?? detail.stderr });
    } finally {
      setBusy(null);
    }
  };

  const chooseProject = async () => {
    if (!store) {
      setNotice({ tone: "info", title: "请先选择唯一 Skill Store。" });
      return;
    }
    setBusy("project");
    setNotice(null);
    try {
      const path = await open({ directory: true, multiple: false, title: "选择当前项目" });
      if (typeof path !== "string") return;
      const [nextProject, nextGit] = await Promise.all([
        api.scanProject(path, store.root),
        api.inspectGitStatus(path),
      ]);
      setProject(nextProject);
      setGitStatus(nextGit);
      setGitDiff(null);
      setNpxStatus(null);
      setSelectedName(store.skills.at(-1)?.name ?? null);
      setNotice({ tone: "success", title: `已选择项目 ${nextProject.name}`, detail: "列表状态来自项目内真实符号链接。" });
    } catch (error) {
      const detail = toError(error);
      setNotice({ tone: "error", title: detail.message ?? "无法选择项目", detail: detail.recovery ?? detail.stderr });
    } finally {
      setBusy(null);
    }
  };

  const performLink = async () => {
    if (!store || !project || !selected) return;
    setBusy("link");
    setNotice(null);
    try {
      const result = await api.linkSkill(store.root, project.root, selected.name);
      await refreshProject();
      setPreflight(result);
      setNotice({ tone: "success", title: `${selected.name} 已链接到 ${project.name}`, detail: "已创建相对符号链接；源文件没有被复制或修改。" });
    } catch (error) {
      const detail = toError(error);
      setNotice({ tone: "error", title: detail.message ?? "创建链接失败", detail: detail.recovery ?? detail.stderr });
    } finally {
      setBusy(null);
    }
  };

  const performUnlink = async () => {
    if (!store || !project || !selected) return;
    setBusy("unlink");
    setNotice(null);
    try {
      await api.unlinkSkill(store.root, project.root, selected.name);
      await refreshProject();
      setNotice({ tone: "success", title: `${selected.name} 已从 ${project.name} 解除链接`, detail: "技能库中的源目录与 SKILL.md 保持不变。" });
    } catch (error) {
      const detail = toError(error);
      setNotice({ tone: "error", title: detail.message ?? "解除链接失败", detail: detail.recovery ?? detail.stderr });
    } finally {
      setBusy(null);
    }
  };

  const runNpx = async () => {
    if (!project) return;
    setBusy("npx");
    setNotice(null);
    try {
      const result = await api.listProjectSkills(project.root);
      setNpxStatus(result);
      setLastChecked(new Date());
      setNotice({
        tone: result.success ? "success" : "error",
        title: result.success ? "npx skills 状态已更新。" : "npx skills 返回失败状态。",
        detail: result.success ? "输出已保留在右侧 Git 与命令状态区。" : (result.stderr || "请检查 npx 输出。"),
      });
    } catch (error) {
      const detail = toError(error);
      setNotice({ tone: "error", title: detail.message ?? "npx skills 检查失败", detail: detail.recovery ?? detail.stderr });
    } finally {
      setBusy(null);
    }
  };

  const runGitDiff = async () => {
    if (!project) return;
    setBusy("git");
    try {
      const [status, diff] = await Promise.all([api.inspectGitStatus(project.root), api.previewGitDiff(project.root)]);
      setGitStatus(status);
      setGitDiff(diff);
      setNotice({ tone: diff.success ? "success" : "error", title: diff.success ? "已读取 Git 变更预览。" : "Git diff 返回失败状态。", detail: diff.stderr || undefined });
    } catch (error) {
      const detail = toError(error);
      setNotice({ tone: "error", title: detail.message ?? "Git 检查失败", detail: detail.recovery ?? detail.stderr });
    } finally {
      setBusy(null);
    }
  };

  const selectSkill = (skill: Skill) => {
    setSelectedName(skill.name);
    setDrawerOpen(true);
    setNotice(null);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="项目与技能库">
        <div className="window-drag" data-tauri-drag-region />
        <div className="brand">
          <Box aria-hidden="true" />
          <div><strong>技能管理</strong><span>本地 Git 技能仓库</span></div>
        </div>
        <div className="sidebar-rule" />
        <div className="sidebar-heading"><span>项目</span><button className="icon-button" onClick={chooseProject} disabled={!store || busy !== null} title="选择项目" aria-label="选择项目"><Plus /></button></div>
        <nav className="project-list" aria-label="当前项目">
          {project ? (
            <button className="project-item selected" onClick={chooseProject} disabled={busy !== null}>
              <FolderGit2 aria-hidden="true" />
              <span><strong>{project.name}</strong><small title={project.root}>{project.root}</small></span>
            </button>
          ) : (
            <button className="project-empty" onClick={chooseProject} disabled={!store || busy !== null}>
              <FolderOpen aria-hidden="true" />
              <span>{store ? "选择一个项目目录" : "先选择下方技能库"}</span>
            </button>
          )}
        </nav>
        <div className="sidebar-spacer" />
        <button className={`store-row ${store ? "connected" : ""}`} onClick={chooseStore} disabled={busy !== null}>
          {busy === "store" ? <LoaderCircle className="spin" aria-hidden="true" /> : <Database aria-hidden="true" />}
          <span><strong>技能库</strong><small title={store?.root}>{store ? store.name : "选择唯一 Skill Store"}</small></span>
          <i aria-hidden="true" />
        </button>
        <div className="sidebar-footer"><ShieldCheck aria-hidden="true" /><span>Codex-only · 本地优先</span></div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <h1>{project?.name ?? "选择当前项目"}</h1>
            <p>{project ? "管理此项目已链接的技能" : "从唯一技能库为项目创建可验证的符号链接"}</p>
          </div>
          <div className="topbar-actions">
            <button className="secondary-button inspector-trigger" onClick={() => setDrawerOpen(true)} disabled={!selected}>
              <Menu aria-hidden="true" />技能详情
            </button>
            <button className="secondary-button" onClick={runNpx} disabled={!project || busy !== null}>
              {busy === "npx" ? <LoaderCircle className="spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
              {busy === "npx" ? "正在检查…" : "检查技能库更新"}
            </button>
          </div>
        </header>

        <div className="toolbar" role="search">
          <label className="search-field">
            <Search aria-hidden="true" />
            <span className="sr-only">搜索技能</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索技能名称…" />
            {search && <button className="icon-button" onClick={() => setSearch("")} aria-label="清空搜索" title="清空搜索"><X /></button>}
          </label>
          <label className="select-field">
            <span className="sr-only">筛选链接状态</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">全部状态</option>
              <option value="linked">已链接</option>
              <option value="available">可添加</option>
            </select>
            <ChevronDown aria-hidden="true" />
          </label>
        </div>

        {notice && (
          <div className={`notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
            {notice.tone === "success" ? <CheckCircle2 aria-hidden="true" /> : notice.tone === "error" ? <AlertCircle aria-hidden="true" /> : <Info aria-hidden="true" />}
            <span><strong>{notice.title}</strong>{notice.detail && <small>{notice.detail}</small>}</span>
            <button className="icon-button" onClick={() => setNotice(null)} aria-label="关闭消息" title="关闭消息"><X /></button>
          </div>
        )}

        <div className="table-wrap">
          {!store || !project ? (
            <div className="onboarding-empty">
              <FolderOpen aria-hidden="true" />
              <h2>{store ? "选择当前项目" : "选择唯一 Skill Store"}</h2>
              <p>{store ? "Habitat 将读取项目内真实的 .agents/skills 链接。" : "扫描技能库根目录及 .agents/skills 下的有效 SKILL.md。"}</p>
              <button className="primary-button" onClick={store ? chooseProject : chooseStore} disabled={busy !== null}>
                {busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <FolderOpen aria-hidden="true" />}
                {store ? "选择项目目录" : "选择 Skill Store"}
              </button>
            </div>
          ) : (
            <table className="skills-table">
              <thead><tr><th>技能名称</th><th>来源</th><th>链接状态</th><th>验证</th><th>更新时间</th></tr></thead>
              <tbody>
                <tr className="group-row"><th colSpan={5}>此项目已链接（{linked.length}）</th></tr>
                {linked.map(({ skill, state, link }) => (
                  <tr key={skill.name} className={`skill-row ${selectedName === skill.name ? "selected" : ""}`} aria-selected={selectedName === skill.name} tabIndex={0} onClick={() => selectSkill(skill)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") selectSkill(skill); }}>
                    <td><div className="skill-name"><StatusIcon state={state} /><span><strong>{skill.name}</strong><small>{skill.description}</small></span></div></td>
                    <td><span className="cell-stack"><span>{skill.sourceKind}</span><small>v{skill.version}</small></span></td>
                    <td><span className={`cell-stack state ${state}`}><span>{stateLabels[state]}</span><small title={link?.relativeTarget ?? undefined}>{link?.relativeTarget ?? "—"}</small></span></td>
                    <td><span className="verified"><CircleDot aria-hidden="true" />{state === "valid" ? "目标已验证" : "需要处理"}</span></td>
                    <td>{formatTime(skill.modifiedAt)}</td>
                  </tr>
                ))}
                {linked.length === 0 && <tr className="empty-row"><td colSpan={5}>当前筛选下没有已链接 skills。</td></tr>}
                <tr className="group-row"><th colSpan={5}>可添加到此项目（{available.length}）</th></tr>
                {available.map(({ skill, state }) => (
                  <tr key={skill.name} className={`skill-row ${selectedName === skill.name ? "selected" : ""}`} aria-selected={selectedName === skill.name} tabIndex={0} onClick={() => selectSkill(skill)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") selectSkill(skill); }}>
                    <td><div className="skill-name"><StatusIcon state={state} /><span><strong>{skill.name}</strong><small>{skill.description}</small></span></div></td>
                    <td><span className="cell-stack"><span>{skill.sourceKind}</span><small>v{skill.version}</small></span></td>
                    <td><span className="cell-stack state available"><span>未链接</span><small>.agents/skills/{skill.name}</small></span></td>
                    <td><span className="verified"><CircleDot aria-hidden="true" />等待预检</span></td>
                    <td>{formatTime(skill.modifiedAt)}</td>
                  </tr>
                ))}
                {available.length === 0 && <tr className="empty-row"><td colSpan={5}>当前筛选下没有可添加 skills。</td></tr>}
              </tbody>
            </table>
          )}
        </div>

        <footer className="workspace-status">
          <span>{project ? `${project.name} 已链接 ${project.links.filter((link) => link.state === "valid").length} / 技能库共 ${store?.skills.length ?? 0}` : "等待选择项目"}</span>
          <span className="store-path" title={store?.root}>{store ? `技能库位置：${store.root}` : "尚未选择技能库"}</span>
          <button className="quiet-button" onClick={refreshAll} disabled={!store || !project || busy !== null} title="重新读取文件状态">
            {busy === "scan" ? <LoaderCircle className="spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}刷新
          </button>
        </footer>
      </main>

      <div className={`drawer-backdrop ${drawerOpen ? "open" : ""}`} onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      <aside className={`inspector ${drawerOpen ? "open" : ""}`} aria-label="技能详情">
        <div className="inspector-header">
          <span>技能详情</span>
          <button className="icon-button inspector-close" onClick={() => setDrawerOpen(false)} aria-label="关闭技能详情" title="关闭技能详情"><X /></button>
        </div>
        {!selected || !project || !store ? (
          <div className="inspector-empty"><FileCode2 aria-hidden="true" /><p>选择一个 skill 查看详情、真实路径和预检结果。</p></div>
        ) : (
          <div className="inspector-content">
            <section className="identity-section">
              <div className="identity-title"><Box aria-hidden="true" /><h2>{selected.name}</h2><span className="status-label">v{selected.version}</span></div>
              <p className="source-line">{selected.sourceKind} · {selectedLink ? stateLabels[selectedLink.state] : "可添加"}</p>
              <p className="description">{selected.description}</p>
            </section>

            <section>
              <h3>将添加到</h3>
              <div className="project-summary"><Folder aria-hidden="true" /><span><strong>{project.name}</strong><small>{project.root}</small></span></div>
            </section>

            <section>
              <h3>符号链接目标{selectedLink ? "（已存在）" : "（将创建）"}</h3>
              <CopyPath value={preflight?.targetPath ?? `${project.skillsDirectory}/${selected.name}`} label="符号链接目标" />
              {preflight && <div className="link-map"><code>{preflight.relativeLink}</code><ArrowRight aria-hidden="true" /><span>源技能</span></div>}
            </section>

            <section>
              <h3>源路径（技能库）</h3>
              <CopyPath value={selected.sourcePath} label="源路径" />
            </section>

            <section>
              <div className="section-heading"><h3>Git 与命令状态</h3><GitBranch aria-hidden="true" /></div>
              <div className="command-state">
                <div><span>git status --short</span><strong className={gitStatus?.success ? "ok" : gitStatus ? "bad" : ""}>{commandTitle(gitStatus)}</strong></div>
                {gitStatus && <pre>{gitStatus.stdout || gitStatus.stderr || "工作区干净（无输出）"}</pre>}
                <div><span>npx skills list --project --json</span><strong className={npxStatus?.success ? "ok" : npxStatus ? "bad" : ""}>{commandTitle(npxStatus)}</strong></div>
                {npxStatus && <pre>{npxStatus.stdout || npxStatus.stderr || "命令完成（无输出）"}</pre>}
                {gitDiff && <details open><summary>git diff 输出</summary><pre>{gitDiff.stdout || gitDiff.stderr || "无文本差异"}</pre></details>}
              </div>
              <button className="secondary-button compact" onClick={runGitDiff} disabled={busy !== null}>
                {busy === "git" ? <LoaderCircle className="spin" aria-hidden="true" /> : <Code2 aria-hidden="true" />}预览 Git 变更
              </button>
            </section>

            <section>
              <h3>预检结果</h3>
              {!preflight ? <div className="preflight-loading"><LoaderCircle className="spin" aria-hidden="true" />正在检查真实路径与链接…</div> : (
                <ul className="check-list">
                  {preflight.checks.map((check) => (
                    <li key={check.id} className={check.status}>
                      {check.status === "pass" ? <Check aria-hidden="true" /> : check.status === "warning" ? <AlertCircle aria-hidden="true" /> : <XCircle aria-hidden="true" />}
                      <span><strong>{check.label}</strong><small>{check.detail}</small>{check.recovery && <em>{check.recovery}</em>}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="action-section">
              <div className="safety-note"><Info aria-hidden="true" /><span>仅创建或解除符号链接，不复制文件，也不删除技能库源文件。</span></div>
              {selectedLink?.state === "valid" ? (
                <button className="unlink-button" onClick={performUnlink} disabled={busy !== null}>
                  {busy === "unlink" ? <LoaderCircle className="spin" aria-hidden="true" /> : <Unlink aria-hidden="true" />}
                  {busy === "unlink" ? "正在解除…" : `从 ${project.name} 解除链接`}
                </button>
              ) : (
                <button className="primary-button full" onClick={performLink} disabled={!preflight?.canLink || busy !== null} aria-describedby="preflight-summary">
                  {busy === "link" ? <LoaderCircle className="spin" aria-hidden="true" /> : <Link2 aria-hidden="true" />}
                  {busy === "link" ? "正在创建链接…" : `添加到 ${project.name}`}
                </button>
              )}
              <p id="preflight-summary" className="action-hint">{preflight?.canLink ? "预检通过；操作需要明确点击确认。" : "解决预检失败项后才能操作。"}</p>
            </section>
          </div>
        )}
      </aside>

      <div className="global-status" role="status" aria-live="polite">
        <span><i />{busy ? "正在处理真实本地状态…" : "就绪"}</span>
        <span>{lastChecked ? `最后检查：${lastChecked.toLocaleString("zh-CN")}` : "尚未检查 npx skills"}</span>
      </div>
    </div>
  );
}

export default App;
