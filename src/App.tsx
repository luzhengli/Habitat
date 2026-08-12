import { useCallback, useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  AlertCircle,
  BookOpen,
  Box,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Crosshair,
  Database,
  Folder,
  FolderOpen,
  Info,
  LoaderCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import codexIcon from "@lobehub/icons-static-svg/icons/codex.svg";
import claudeCodeIcon from "@lobehub/icons-static-svg/icons/claudecode.svg";
import cursorIcon from "@lobehub/icons-static-svg/icons/cursor.svg";
import piIcon from "@lobehub/icons-static-svg/icons/pi.svg";
import traeIcon from "@lobehub/icons-static-svg/icons/trae.svg";
import { api } from "./api";
import { projectQaStore, projectQaWorkspace } from "./qa/projectState";
import type {
  AgentId,
  AppError,
  ProjectDraftSelection,
  ProjectExposureInspection,
  ProjectExposurePlan,
  StoreScan,
  TargetGroupId,
} from "./types";
import "./project.css";

type GroupState = Record<TargetGroupId, boolean>;
type DraftMap = Record<string, GroupState>;
type Filter = "all" | "linked" | "available" | "pending" | "attention";
type SkillSectionId = "linked" | "available";
type Notice = { tone: "error" | "success"; title: string; detail: string };
type ManagedProject = { root: string; groups: TargetGroupId[] };

const qaMode = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("qa") : null;
const agentMeta: Record<AgentId, { label: string; icon: string }> = {
  codex: { label: "Codex", icon: codexIcon },
  claude_code: { label: "Claude Code", icon: claudeCodeIcon },
  pi: { label: "Pi", icon: piIcon },
  cursor: { label: "Cursor", icon: cursorIcon },
  trae: { label: "Trae", icon: traeIcon },
};

const groupAgents: Record<TargetGroupId, AgentId[]> = {
  agents_shared: ["codex", "pi", "cursor"],
  claude: ["claude_code"],
  trae: ["trae"],
};

const groupLabels: Record<TargetGroupId, string> = {
  agents_shared: "Codex、Pi 与 Cursor",
  claude: "Claude Code",
  trae: "Trae",
};

function toError(error: unknown): AppError {
  if (typeof error === "object" && error !== null) return error as AppError;
  if (typeof error === "string") {
    try { return JSON.parse(error) as AppError; } catch { return { message: error }; }
  }
  return { message: "发生未知错误。" };
}

function SkillGlyph({ name }: { name: string }) {
  if (name === "explain-and-quiz") return <BookOpen aria-hidden="true" />;
  if (name === "finding-unknowns") return <Crosshair aria-hidden="true" />;
  if (name === "sharpen") return <Sparkles aria-hidden="true" />;
  if (name === "habit-store") return <Database aria-hidden="true" />;
  return <Box aria-hidden="true" />;
}

function deriveBase(workspace: ProjectExposureInspection[]): DraftMap {
  return Object.fromEntries(workspace.map((skill) => {
    const satisfied = (agentId: AgentId) => skill.agents.find((agent) => agent.agentId === agentId)?.expectedSatisfied ?? false;
    return [skill.skillName, {
      agents_shared: satisfied("codex") || satisfied("pi") || satisfied("cursor"),
      claude: satisfied("claude_code"),
      trae: satisfied("trae"),
    }];
  }));
}

function draftSelections(draft: DraftMap): ProjectDraftSelection[] {
  return Object.entries(draft).map(([name, groups]) => ({
    name,
    selectedAgents: (Object.keys(groups) as TargetGroupId[])
      .filter((group) => groups[group])
      .flatMap((group) => groupAgents[group]),
  }));
}

function groupHasProblem(skill: ProjectExposureInspection, group: TargetGroupId) {
  return groupAgents[group].some((agentId) => {
    const agent = skill.agents.find((item) => item.agentId === agentId);
    return agent?.routes.some((route) => ["conflicting", "broken", "unsafe"].includes(route.state));
  });
}

function AgentGroupButton({
  group,
  current,
  verified,
  blocked,
  disabled = false,
  forceHelp = false,
  onToggle,
}: {
  group: TargetGroupId;
  current: boolean;
  verified: boolean;
  blocked: boolean;
  disabled?: boolean;
  forceHelp?: boolean;
  onToggle: () => void;
}) {
  const pending = current !== verified;
  const state = blocked ? "blocked" : pending ? (current ? "pending-add" : "pending-remove") : current ? "verified" : "off";
  const action = current ? "停用" : "启用";
  return (
    <button
      type="button"
      className={`agent-toggle ${group === "agents_shared" ? "shared" : "single"} ${state} ${forceHelp ? "force-help" : ""}`}
      onClick={onToggle}
      disabled={disabled}
      aria-label={`${action}${groupLabels[group]}读取此 Skill；当前${pending ? "有待应用更改" : current ? "已启用" : "未启用"}`}
      title={blocked ? `${groupLabels[group]}存在需要先处理的问题` : `${action}${groupLabels[group]}`}
    >
      {groupAgents[group].map((agentId) => (
        <img key={agentId} src={agentMeta[agentId].icon} alt="" aria-hidden="true" />
      ))}
      <span className="toggle-state" aria-hidden="true">
        {blocked ? <AlertCircle /> : pending ? <CircleDot /> : current ? <Check /> : <span />}
      </span>
      {group === "agents_shared" && <span className="agent-help">通用入口：Codex、Pi、Cursor 共享一个项目入口，点击会同步切换。</span>}
    </button>
  );
}

export default function App({ onOpenRecovery, recoveryLinks = [], onReturnRecovery }: {
  onOpenRecovery: () => void;
  recoveryLinks?: string[];
  onReturnRecovery?: () => void;
}) {
  const projectQaActive = Boolean(qaMode?.startsWith("project-") || (qaMode?.startsWith("recovery-") && recoveryLinks.length));
  const qaProjectRoot = recoveryLinks.length
    ? window.localStorage.getItem("habitat.projectRoot") ?? projectQaWorkspace.projectRoot
    : projectQaWorkspace.projectRoot;
  const [store, setStore] = useState<StoreScan | null>(projectQaActive ? projectQaStore : null);
  const [workspace, setWorkspace] = useState<ProjectExposureInspection[]>(projectQaActive ? projectQaWorkspace.skills : []);
  const [projectRoot, setProjectRoot] = useState(projectQaActive ? qaProjectRoot : "");
  const [projects, setProjects] = useState<ManagedProject[]>(() => {
    if (projectQaActive) return [{ root: qaProjectRoot, groups: ["agents_shared", "claude", "trae"] }];
    try {
      const saved = JSON.parse(window.localStorage.getItem("habitat.projects") ?? "[]") as ManagedProject[];
      if (Array.isArray(saved)) return saved;
    } catch { /* ignore malformed legacy state */ }
    const legacy = window.localStorage.getItem("habitat.projectRoot");
    return legacy ? [{ root: legacy, groups: ["agents_shared", "claude", "trae"] }] : [];
  });
  const [activeGroups, setActiveGroups] = useState<TargetGroupId[]>(["agents_shared", "claude", "trae"]);
  const [projectCandidate, setProjectCandidate] = useState<string | null>(qaMode === "project-add" ? "/private/tmp/habitat-project-v2/blog" : null);
  const [candidateGroups, setCandidateGroups] = useState<TargetGroupId[]>(["agents_shared", "claude", "trae"]);
  const [base, setBase] = useState<DraftMap>(() => deriveBase(projectQaActive ? projectQaWorkspace.skills : []));
  const [draft, setDraft] = useState<DraftMap>(() => {
    const initial = deriveBase(projectQaActive ? projectQaWorkspace.skills : []);
    if (qaMode?.startsWith("project-") && qaMode !== "project-grouped" && initial["project-harness"]) {
      initial["project-harness"] = { ...initial["project-harness"], agents_shared: true, claude: true };
      initial["media-kit"] = { ...initial["media-kit"], trae: false };
    }
    return initial;
  });
  const [selectedName, setSelectedName] = useState(qaMode === "project-grouped" ? "explain-and-quiz" : projectQaActive ? "project-harness" : "");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [collapsedSections, setCollapsedSections] = useState<Record<SkillSectionId, boolean>>({ linked: false, available: false });
  const [busy, setBusy] = useState<"load" | "plan" | "apply" | null>(null);
  const [reviewPlan, setReviewPlan] = useState<ProjectExposurePlan | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const projectName = projectRoot.split("/").filter(Boolean).at(-1) ?? "未选择项目";
  const inspectionByName = useMemo(() => new Map(workspace.map((item) => [item.skillName, item])), [workspace]);
  const selected = selectedName ? store?.skills.find((skill) => skill.name === selectedName) ?? null : null;
  const selectedInspection = selectedName ? inspectionByName.get(selectedName) : undefined;
  const dirty = useMemo(() => Object.entries(draft).flatMap(([name, groups]) =>
    (Object.keys(groups) as TargetGroupId[])
      .filter((group) => groups[group] !== base[name]?.[group])
      .map((group) => ({
        name,
        group,
        action: (groups[group] ? "create" : "remove") as "create" | "remove",
      }))), [draft, base]);
  const blockingCount = useMemo(() => dirty.filter(({ name, group, action }) => action === "create" && groupHasProblem(inspectionByName.get(name)!, group)).length, [dirty, inspectionByName]);

  const refresh = useCallback(async (nextStore = store, nextProject = projectRoot) => {
    if (!nextStore || !nextProject) return;
    setBusy("load");
    setNotice(null);
    try {
      const [freshStore, inspection] = projectQaActive
        ? [projectQaStore, projectQaWorkspace]
        : await Promise.all([api.scanStore(nextStore.root), api.inspectProjectWorkspace(nextStore.root, nextProject)]);
      const nextBase = deriveBase(inspection.skills);
      setStore(freshStore);
      setWorkspace(inspection.skills);
      setProjectRoot(inspection.projectRoot);
      setBase(nextBase);
      setDraft(nextBase);
      setCollapsedSections({ linked: false, available: false });
      setSelectedName((current) => freshStore.skills.some((skill) => skill.name === current) ? current : freshStore.skills[0]?.name ?? "");
    } catch (error) {
      const detail = toError(error);
      setNotice({ tone: "error", title: detail.message ?? "无法检查项目", detail: detail.recovery ?? detail.stderr ?? "请重新选择项目。" });
    } finally {
      setBusy(null);
    }
  }, [store, projectRoot]);

  useEffect(() => {
    if (projectQaActive || store) return;
    const storeRoot = window.localStorage.getItem("habitat.storeRoot");
    if (!storeRoot) return;
    setBusy("load");
    api.scanStore(storeRoot)
      .then((value) => {
        setStore(value);
        const savedProject = window.localStorage.getItem("habitat.projectRoot");
        if (savedProject) {
          setActiveGroups(projects.find((item) => item.root === savedProject)?.groups ?? ["agents_shared", "claude", "trae"]);
          return refresh(value, savedProject);
        }
      })
      .catch((error) => {
        const detail = toError(error);
        setNotice({ tone: "error", title: detail.message ?? "无法打开 Skill Store", detail: detail.recovery ?? "请重新完成首次设置。" });
      })
      .finally(() => setBusy(null));
  }, [store, refresh, projects]);

  useEffect(() => {
    if (!store || projectQaActive || projects.length === 0) return;
    void Promise.allSettled(projects.map((project) => api.registerManagedProject(store.root, project.root, project.groups)));
  }, [store, projects]);

  useEffect(() => {
    if (!recoveryLinks.length || workspace.length === 0) return;
    const affected = new Map<string, Set<TargetGroupId>>();
    for (const link of recoveryLinks) {
      const name = link.split("/").filter(Boolean).at(-1);
      if (!name) continue;
      const group: TargetGroupId = link.includes("/.claude/skills/") ? "claude" : link.includes("/.trae/skills/") ? "trae" : "agents_shared";
      const groups = affected.get(name) ?? new Set<TargetGroupId>();
      groups.add(group);
      affected.set(name, groups);
    }
    setDraft((current) => {
      const next = structuredClone(current);
      for (const [name, groups] of affected) {
        if (!next[name]) continue;
        for (const group of groups) next[name][group] = false;
      }
      return next;
    });
    setFilter("pending");
    setSelectedName(affected.keys().next().value ?? "");
  }, [recoveryLinks, workspace]);

  const chooseProject = async () => {
    const path = await open({ directory: true, multiple: false, title: "选择要管理的项目" });
    if (typeof path !== "string" || !store) return;
    setProjectCandidate(path);
    setCandidateGroups(["agents_shared", "claude", "trae"]);
  };

  const confirmProject = async () => {
    if (!projectCandidate || candidateGroups.length === 0 || !store) return;
    if (!projectQaActive) {
      try {
        await api.registerManagedProject(store.root, projectCandidate, candidateGroups);
      } catch (error) {
        const detail = toError(error);
        setNotice({ tone: "error", title: detail.message ?? "无法登记项目", detail: detail.recovery ?? "检查项目路径后重试。" });
        return;
      }
    }
    const nextProjects = [...projects.filter((item) => item.root !== projectCandidate), { root: projectCandidate, groups: candidateGroups }];
    setProjects(nextProjects);
    setActiveGroups(candidateGroups);
    window.localStorage.setItem("habitat.projects", JSON.stringify(nextProjects));
    window.localStorage.setItem("habitat.projectRoot", projectCandidate);
    setProjectCandidate(null);
    await refresh(store, projectCandidate);
  };

  const selectProject = async (item: ManagedProject) => {
    if (item.root === projectRoot) return;
    if (dirty.length > 0) {
      setNotice({ tone: "error", title: "当前项目还有待应用更改", detail: "请先应用或撤销这些更改，再切换项目。" });
      return;
    }
    setActiveGroups(item.groups);
    window.localStorage.setItem("habitat.projectRoot", item.root);
    await refresh(store, item.root);
  };

  const toggle = (name: string, group: TargetGroupId) => {
    const inspection = inspectionByName.get(name);
    if (inspection && groupHasProblem(inspection, group) && !draft[name]?.[group]) {
      setSelectedName(name);
      setInspectorOpen(true);
      return;
    }
    setDraft((current) => ({ ...current, [name]: { ...current[name], [group]: !current[name][group] } }));
    setSelectedName(name);
  };

  const visibleSkills = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const dirtyNames = new Set(dirty.map((item) => item.name));
    return (store?.skills ?? []).filter((skill) => {
      const groups = base[skill.name];
      const inspection = inspectionByName.get(skill.name);
      const isLinked = groups && Object.values(groups).some(Boolean);
      const attention = inspection && (Object.keys(groups ?? {}) as TargetGroupId[]).some((group) => groupHasProblem(inspection, group));
      const matchesFilter = filter === "all"
        || (filter === "linked" && isLinked)
        || (filter === "available" && !isLinked)
        || (filter === "pending" && dirtyNames.has(skill.name))
        || (filter === "attention" && attention);
      return matchesFilter && (!query || `${skill.name} ${skill.description}`.toLocaleLowerCase().includes(query));
    });
  }, [store, base, dirty, filter, search, inspectionByName]);

  const skillSections = useMemo(() => {
    const linked = visibleSkills.filter((skill) => Object.values(base[skill.name] ?? {}).some(Boolean));
    const available = visibleSkills.filter((skill) => !Object.values(base[skill.name] ?? {}).some(Boolean));
    return [
      { id: "linked" as const, title: "当前可用", description: null, skills: linked },
      { id: "available" as const, title: "尚未添加", description: "从 Skill Store 选择并添加", skills: available },
    ].filter((section) => section.skills.length > 0);
  }, [visibleSkills, base]);

  const toggleSection = (section: SkillSectionId) => {
    setCollapsedSections((current) => ({ ...current, [section]: !current[section] }));
  };

  const review = async () => {
    if (!store || !projectRoot || dirty.length === 0 || blockingCount > 0) return;
    setBusy("plan");
    setNotice(null);
    try {
      const plan = projectQaActive
        ? {
            transactionId: "qa-project-plan",
            registryVersion: "1",
            storeRoot: store.root,
            projectRoot,
            manifestPath: `${store.root}/.habitat/transactions/qa.project.json`,
            operations: dirty.map((item, index) => ({
              skillName: item.name,
              targetGroup: item.group,
              action: item.action,
              sourcePath: `${store.root}/${item.name}`,
              targetPath: `${projectRoot}/${item.group === "agents_shared" ? ".agents" : item.group === "claude" ? ".claude" : ".trae"}/skills/${item.name}`,
              relativeLink: `../../../Skill Store/${item.name}`,
              result: "pending" as const,
              sourceIdentity: { device: 1, inode: index + 1, mode: 16877 },
            })),
          }
        : await api.planProjectSettings(store.root, projectRoot, draftSelections(draft));
      setReviewPlan(plan);
    } catch (error) {
      const detail = toError(error);
      setNotice({ tone: "error", title: detail.message ?? "项目设置预检失败", detail: detail.recovery ?? "处理冲突后重新检查。" });
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    if (!reviewPlan) return;
    setBusy("apply");
    try {
      if (!projectQaActive) await api.applyProjectSettings(reviewPlan.transactionId);
      setReviewPlan(null);
      if (projectQaActive) {
        setBase(structuredClone(draft));
      } else {
        await refresh();
      }
      setNotice({ tone: "success", title: "项目设置已应用", detail: "只更新了当前项目中的相对 Skill 链接。" });
    } catch (error) {
      const detail = toError(error);
      setNotice({ tone: "error", title: detail.message ?? "项目设置未完成", detail: detail.recovery ?? "请保留现场并重新检查。" });
    } finally {
      setBusy(null);
    }
  };

  if (!projectRoot) {
    return (
      <div className="project-empty-shell">
        <aside><Brand /><StoreNav store={store} onOpenRecovery={onOpenRecovery} /></aside>
        <main>
          <FolderOpen aria-hidden="true" />
          <h1>添加第一个项目</h1>
          <p>选择项目目录后，再决定每个 Skill 可供哪些 Agent 使用。添加项目不会自动创建任何链接。</p>
          <button className="project-primary" onClick={chooseProject} disabled={!store || busy !== null}><Plus />添加项目</button>
          {notice && <NoticeBanner notice={notice} />}
        </main>
        {projectCandidate && <AddProjectDialog path={projectCandidate} groups={candidateGroups} onGroupsChange={setCandidateGroups} onCancel={() => setProjectCandidate(null)} onConfirm={confirmProject} busy={busy !== null} />}
      </div>
    );
  }

  return (
    <div className="project-shell">
      <aside className="project-sidebar">
        <Brand />
        <div className="sidebar-label">项目</div>
        {projects.map((item) => <button key={item.root} className={`project-nav ${item.root === projectRoot ? "selected" : ""}`} onClick={() => selectProject(item)} title={item.root}>
          <Folder /><span><strong>{item.root.split("/").filter(Boolean).at(-1) ?? "未命名"}</strong><small>{item.root}</small></span>
        </button>)}
        <button className="sidebar-action" onClick={chooseProject}><Plus />添加项目</button>
        <StoreNav store={store} onOpenRecovery={onOpenRecovery} />
      </aside>

      <main className="project-main">
        {onReturnRecovery && <div className="project-recovery-context"><span><strong>正在处理 Recovery 阻断</strong><small>{recoveryLinks.length} 个链接仍依赖首次迁移 Store 内容</small></span><button className="project-secondary" onClick={onReturnRecovery}>返回恢复检查</button></div>}
        <header className="project-header">
          <div><h1>{projectName}</h1><code>{projectRoot}</code><p>管理此项目中的 Skills 与 Agent 入口</p></div>
          <button className="project-secondary" onClick={() => refresh()} disabled={busy !== null}><RefreshCw className={busy === "load" ? "spin" : ""} />重新检查</button>
        </header>
        <div className="project-toolbar">
          <label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索 Skill 名称或描述..." /></label>
          <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} aria-label="筛选 Skill">
            <option value="all">全部状态</option><option value="linked">当前可用</option><option value="available">尚未添加</option><option value="pending">待应用</option><option value="attention">需要处理</option>
          </select>
        </div>
        {notice && <NoticeBanner notice={notice} onClose={() => setNotice(null)} />}
        <div className="skill-columns"><span>Skill</span><span>适用于 <Info /></span><span>来源与版本</span><span>状态</span></div>
        <div className="skill-list">
          {skillSections.map((section) => {
            const collapsed = collapsedSections[section.id];
            const contentId = `skill-section-${section.id}`;
            return <section className="skill-section" key={section.id}>
              <button className="skill-section-toggle" type="button" onClick={() => toggleSection(section.id)} aria-expanded={!collapsed} aria-controls={contentId}>
                <ChevronDown className={collapsed ? "collapsed" : ""} aria-hidden="true" />
                <strong>{section.title}</strong>
                <span>{section.skills.length}</span>
                {section.description && <small>{section.description}</small>}
              </button>
              <div id={contentId} hidden={collapsed}>
                {section.skills.map((skill) => {
                  const groups = draft[skill.name];
                  const verified = base[skill.name];
                  const inspection = inspectionByName.get(skill.name)!;
                  const skillDirty = dirty.filter((item) => item.name === skill.name);
                  const hasProblem = (Object.keys(groups) as TargetGroupId[]).some((group) => groupHasProblem(inspection, group));
                  return (
                    <div key={skill.name} className={`skill-row ${selectedName === skill.name ? "selected" : ""}`} onClick={() => { setSelectedName(skill.name); setInspectorOpen(true); }}>
                      <div className="skill-name"><SkillGlyph name={skill.name} /><span><strong>{skill.name}</strong><small>{skill.description}</small></span></div>
                      <div className="skill-agents" onClick={(event) => event.stopPropagation()}>
                        {(["agents_shared", "claude", "trae"] as TargetGroupId[]).map((group) => <AgentGroupButton key={group} group={group} current={groups[group]} verified={verified[group]} blocked={groupHasProblem(inspection, group)} disabled={!activeGroups.includes(group)} forceHelp={Boolean(qaMode?.startsWith("project-") && qaMode !== "project-grouped" && selectedName === skill.name && group === "agents_shared")} onToggle={() => toggle(skill.name, group)} />)}
                      </div>
                      <div className="skill-source"><span>Skill Store</span><small>v{skill.version}</small></div>
                      <div className={`skill-status ${skillDirty.length ? "pending" : hasProblem ? "warning" : Object.values(groups).some(Boolean) ? "ok" : "off"}`} title={skillDirty.length ? "有待应用更改" : hasProblem ? "需要处理" : Object.values(groups).some(Boolean) ? "已验证" : "未添加"}>
                        {skillDirty.length ? <CircleDot /> : hasProblem ? <AlertCircle /> : Object.values(groups).some(Boolean) ? <CheckCircle2 /> : <span>—</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>;
          })}
          {skillSections.length === 0 && <div className="skill-list-empty">没有符合当前搜索和筛选条件的 Skill。</div>}
        </div>
        {dirty.length > 0 && <div className="pending-bar">
          <div><strong>待应用更改</strong><span>涉及 {new Set(dirty.map((item) => item.name)).size} 个 Skill · 添加 {dirty.filter((item) => item.action === "create").length} · 移除 {dirty.filter((item) => item.action === "remove").length}</span>{blockingCount > 0 && <small>{blockingCount} 项需要先处理</small>}</div>
          <button className="project-secondary" onClick={() => setDraft(structuredClone(base))}>撤销</button>
          <button className="project-primary" onClick={review} disabled={blockingCount > 0 || busy !== null}>{busy === "plan" ? <LoaderCircle className="spin" /> : <Check />}检查并应用</button>
        </div>}
      </main>

      <aside className={`project-inspector ${inspectorOpen ? "open" : ""}`}>
        {selected && selectedInspection ? <>
          <header><SkillGlyph name={selected.name} /><div><h2>{selected.name}</h2><small>v{selected.version}</small></div><button onClick={() => setInspectorOpen(false)} aria-label="关闭详情"><X /></button></header>
          <section><h3>本次更改</h3>{dirty.filter((item) => item.name === selected.name).length ? dirty.filter((item) => item.name === selected.name).map((item) => <div className="inspector-change" key={item.group}><AgentIcons group={item.group} /><span>{item.action === "create" ? "将添加" : "将移除"}</span><i /></div>) : <p className="quiet-copy">这个 Skill 没有待应用更改。</p>}<p className="quiet-copy">应用后，所选 Agent 可在当前项目中读取此 Skill。</p></section>
          <section><h3>检查结果</h3><CheckLine ok label="目标位置可用" /><CheckLine ok label="未发现同名占用" />{selectedInspection.agents.some((agent) => agent.supportTier === "path_compatible") && <CheckLine warning label="Cursor 与 Trae 应用后建议验证" />}</section>
          <section><h3>项目入口</h3>{(["agents_shared", "claude", "trae"] as TargetGroupId[]).filter((group) => draft[selected.name][group]).map((group) => <div className="target-line" key={group}><AgentIcons group={group} /><code>{group === "agents_shared" ? ".agents" : group === "claude" ? ".claude" : ".trae"}/skills/{selected.name}</code></div>)}</section>
          <details><summary>技术详情 <ChevronDown /></summary><dl><div><dt>Store 来源</dt><dd>{selected.sourcePath}</dd></div><div><dt>Registry</dt><dd>{selectedInspection.registryVersion}</dd></div></dl></details>
        </> : <div className="inspector-empty"><Info /><p>选择一个 Skill 查看项目入口与检查结果。</p></div>}
      </aside>
      <button className={`inspector-backdrop ${inspectorOpen ? "open" : ""}`} onClick={() => setInspectorOpen(false)} aria-label="关闭详情" />

      {reviewPlan && <div className="review-backdrop" role="presentation">
        <section className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-title">
          <header><div><small>项目设置</small><h2 id="review-title">检查后应用到 {projectName}</h2></div><button onClick={() => setReviewPlan(null)} aria-label="关闭"><X /></button></header>
          <div className="review-body">
            <p>将只增加或移除当前项目中的相对 Skill 链接；Skill 内容与 Agent 设置不会改变。</p>
            {reviewPlan.operations.filter((operation) => operation.action === "create").length > 0 && <ReviewGroup title="将添加" operations={reviewPlan.operations.filter((operation) => operation.action === "create")} />}
            {reviewPlan.operations.filter((operation) => operation.action === "remove").length > 0 && <ReviewGroup title="将移除" operations={reviewPlan.operations.filter((operation) => operation.action === "remove")} />}
            <div className="review-pass"><CheckCircle2 /><span><strong>预检通过</strong><small>{reviewPlan.operations.length} 个项目入口可以安全更新</small></span></div>
          </div>
          <footer><button className="project-secondary" onClick={() => setReviewPlan(null)}>返回调整</button><button className="project-primary" onClick={apply} disabled={busy === "apply"}>{busy === "apply" ? <LoaderCircle className="spin" /> : <Check />}应用项目设置</button></footer>
        </section>
      </div>}
      {projectCandidate && <AddProjectDialog path={projectCandidate} groups={candidateGroups} onGroupsChange={setCandidateGroups} onCancel={() => setProjectCandidate(null)} onConfirm={confirmProject} busy={busy !== null} />}
    </div>
  );
}

function Brand() {
  return <div className="project-brand"><Box /><span><strong>Habitat</strong><small>本地优先 · Skill 管理器</small></span></div>;
}

function StoreNav({ store, onOpenRecovery }: { store: StoreScan | null; onOpenRecovery: () => void }) {
  return <div className="store-nav"><div><Database /><span><strong>Skill Store</strong><small>{store ? `${store.skills.length} 个 Skills` : "尚未就绪"}</small></span><i /></div><button onClick={onOpenRecovery} disabled={!store}><RotateCcw />恢复</button><button><Settings />设置</button></div>;
}

function AgentIcons({ group }: { group: TargetGroupId }) {
  return <span className={`mini-agent-group ${group === "agents_shared" ? "shared" : ""}`}>{groupAgents[group].map((agentId) => <img key={agentId} src={agentMeta[agentId].icon} alt={agentMeta[agentId].label} />)}</span>;
}

function CheckLine({ ok, warning, label }: { ok?: boolean; warning?: boolean; label: string }) {
  return <div className={`check-line ${warning ? "warning" : ok ? "ok" : ""}`}>{warning ? <AlertCircle /> : <CheckCircle2 />}<span>{label}</span></div>;
}

function NoticeBanner({ notice, onClose }: { notice: Notice; onClose?: () => void }) {
  return <div className={`project-notice ${notice.tone}`} role="status">{notice.tone === "error" ? <AlertCircle /> : <CheckCircle2 />}<span><strong>{notice.title}</strong><small>{notice.detail}</small></span>{onClose && <button onClick={onClose} aria-label="关闭提示"><X /></button>}</div>;
}

function ReviewGroup({ title, operations }: { title: string; operations: ProjectExposurePlan["operations"] }) {
  return <section className="review-group"><h3>{title}（{operations.length}）</h3>{operations.map((operation) => <div key={`${operation.skillName}-${operation.targetGroup}`}><SkillGlyph name={operation.skillName} /><span><strong>{operation.skillName}</strong><small>{groupLabels[operation.targetGroup]}</small></span><code>{operation.targetPath}</code></div>)}</section>;
}

function AddProjectDialog({ path, groups, onGroupsChange, onCancel, onConfirm, busy }: {
  path: string;
  groups: TargetGroupId[];
  onGroupsChange: (groups: TargetGroupId[]) => void;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const toggleGroup = (group: TargetGroupId) => onGroupsChange(groups.includes(group) ? groups.filter((item) => item !== group) : [...groups, group]);
  return <div className="review-backdrop" role="presentation"><section className="review-dialog add-project-dialog" role="dialog" aria-modal="true" aria-labelledby="add-project-title">
    <header><div><small>项目</small><h2 id="add-project-title">添加项目</h2></div><button onClick={onCancel} aria-label="关闭"><X /></button></header>
    <div className="review-body">
      <p>选择这个项目会使用的 Agent 入口。添加项目只保存管理范围，不会自动链接任何 Skill。</p>
      <div className="candidate-path"><FolderOpen /><span><strong>{path.split("/").filter(Boolean).at(-1)}</strong><code>{path}</code></span></div>
      <h3 className="choice-title">项目使用的 Agent</h3>
      <div className="project-agent-choices">
        {(["agents_shared", "claude", "trae"] as TargetGroupId[]).map((group) => <button key={group} className={groups.includes(group) ? "selected" : ""} onClick={() => toggleGroup(group)} aria-pressed={groups.includes(group)}><AgentIcons group={group} /><span><strong>{group === "agents_shared" ? "通用入口" : groupLabels[group]}</strong><small>{group === "agents_shared" ? "Codex、Pi、Cursor 共享" : group === "trae" ? "预计兼容" : "已验证支持"}</small></span>{groups.includes(group) && <Check />}</button>)}
      </div>
      <div className="project-safety-note"><Info /><span><strong>现在不会创建链接</strong><small>添加后，请在项目 Skill 列表中逐项选择并统一应用。</small></span></div>
    </div>
    <footer><button className="project-secondary" onClick={onCancel}>取消</button><button className="project-primary" onClick={onConfirm} disabled={groups.length === 0 || busy}><Plus />添加项目</button></footer>
  </section></div>;
}
