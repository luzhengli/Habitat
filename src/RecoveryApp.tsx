import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Box,
  Check,
  CheckCircle2,
  Copy,
  FolderOpen,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { api } from "./api";
import type { AppError, RecoveryPlan, RecoveryProjectAudit } from "./types";
import "./recovery.css";

const qaMode = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("qa") : null;

const qaPlan = (ready = false, rollingBack = false): RecoveryPlan => ({
  transactionId: "64b7e8a1-0000-4000-8000-000000000000",
  auditRevision: ready ? "ready-revision" : "blocked-revision",
  storeRoot: "/Users/luyao/Library/Application Support/Habitat/Skill Store",
  state: rollingBack ? "rolling_back" : "completed",
  createdAt: Date.now() - 86_400_000,
  updatedAt: Date.now(),
  importCount: rollingBack ? 16 : 43,
  recoveryCount: rollingBack ? 0 : 2,
  projectLinks: ready ? [] : [
    "/Users/luyao/Project/Habitat/.agents/skills/finding-unknowns",
    "/Users/luyao/Project/media/.agents/skills/browser",
    "/Users/luyao/Project/media/.claude/skills/browser",
  ],
  coverage: ready
    ? { expected: 4, inspected: 4, passed: 4, blocked: 0, unknown: 0 }
    : { expected: 4, inspected: 3, passed: 1, blocked: 2, unknown: 1 },
  projects: [
    { projectId: "habitat", projectRoot: "/Users/luyao/Project/Habitat", provenance: ["registry", "project_transaction"], state: ready ? "passed" : "blocked", relatedLinks: ready ? [] : ["/Users/luyao/Project/Habitat/.agents/skills/finding-unknowns"], blocker: null },
    { projectId: "media", projectRoot: "/Users/luyao/Project/media", provenance: ["registry", "project_transaction"], state: ready ? "passed" : "blocked", relatedLinks: ready ? [] : ["/Users/luyao/Project/media/.agents/skills/browser", "/Users/luyao/Project/media/.claude/skills/browser"], blocker: null },
    { projectId: "blog", projectRoot: "/Users/luyao/Project/blog", provenance: ["registry"], state: "passed", relatedLinks: [], blocker: null },
    { projectId: "archive", projectRoot: "/Volumes/Archive/archive-lab", provenance: ["project_transaction"], state: ready ? "passed" : "unknown", relatedLinks: [], blocker: ready ? null : { code: "managed_project_unavailable", message: "项目所在磁盘未连接。", path: "/Volumes/Archive/archive-lab", recovery: "重新连接磁盘后检查。" } },
  ],
  blockers: ready ? [] : [
    { code: "managed_project_link_active", message: "受管项目仍有相关链接。", path: "/Users/luyao/Project/Habitat/.agents/skills/finding-unknowns", recovery: "前往项目解除链接。" },
    { code: "managed_project_unavailable", message: "项目所在磁盘未连接。", path: "/Volumes/Archive/archive-lab", recovery: "重新连接磁盘后检查。" },
  ],
  ready,
});

function toError(error: unknown): AppError {
  if (typeof error === "object" && error !== null) return error as AppError;
  if (typeof error === "string") {
    try { return JSON.parse(error) as AppError; } catch { return { message: error }; }
  }
  return { message: "发生未知错误。" };
}

function projectName(root: string) {
  return root.split("/").filter(Boolean).at(-1) ?? "未命名项目";
}

function Brand() {
  return <div className="recovery-brand"><Box /><span><strong>Habitat</strong><small>本地优先 · Skill 管理器</small></span></div>;
}

export default function RecoveryApp({
  storeRoot,
  onExit,
  onHandleProject,
  onComplete,
}: {
  storeRoot: string;
  onExit: () => void;
  onHandleProject: (projectRoot: string, links: string[]) => void;
  onComplete: () => void;
}) {
  const [plan, setPlan] = useState<RecoveryPlan | null>(null);
  const [busy, setBusy] = useState<"inspect" | "execute" | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [detailProject, setDetailProject] = useState<RecoveryProjectAudit | null>(null);

  const inspect = useCallback(async () => {
    setBusy("inspect");
    setError(null);
    setConfirming(false);
    try {
      if (qaMode === "recovery-empty") setPlan(null);
      else if (qaMode === "recovery-ready" || qaMode === "recovery-confirm") setPlan(qaPlan(true));
      else if (qaMode === "recovery-partial") setPlan(qaPlan(true, true));
      else if (qaMode === "recovery-fatal") throw { message: "发现多笔仍包含文件变更的迁移事务。", code: "multiple_recovery_transactions", recovery: "保留现场并人工检查事务报告。" };
      else if (qaMode?.startsWith("recovery-")) setPlan(qaPlan(false));
      else setPlan(await api.inspectRecovery(storeRoot));
    } catch (nextError) {
      setPlan(null);
      setError(toError(nextError));
    } finally {
      setBusy(null);
    }
  }, [storeRoot]);

  useEffect(() => { void inspect(); }, [inspect]);
  useEffect(() => { if (qaMode === "recovery-confirm" && plan?.ready) setConfirming(true); }, [plan]);

  const projectBlockers = useMemo(() => plan?.blockers.filter((blocker) => blocker.code.startsWith("managed_project")) ?? [], [plan]);
  const transactionBlockers = useMemo(() => plan?.blockers.filter((blocker) => !blocker.code.startsWith("managed_project")) ?? [], [plan]);

  const execute = async () => {
    if (!plan?.ready) return;
    setConfirming(false);
    setBusy("execute");
    setError(null);
    try {
      if (!qaMode?.startsWith("recovery-")) await api.executeRecovery(plan.transactionId, plan.auditRevision);
      setCompleted(true);
    } catch (nextError) {
      setError(toError(nextError));
      try {
        if (!qaMode?.startsWith("recovery-")) setPlan(await api.inspectRecovery(storeRoot));
      } catch { /* preserve the execution error */ }
    } finally {
      setBusy(null);
    }
  };

  if (completed || qaMode === "recovery-success") {
    return <div className="recovery-shell"><header><Brand /></header><main className="recovery-centered"><div className="recovery-state-icon success"><Check /></div><span className="recovery-eyebrow">RECOVERY COMPLETE</span><h1>已恢复到首次迁移前</h1><p>原用户入口已精确恢复，本事务导入的 Store 内容已移除。项目链接和 Agent 设置没有被自动修改。</p><section className="recovery-result-card"><div><span>原用户入口</span><strong>已恢复</strong></div><div><span>首次迁移 Store imports</span><strong>已移除</strong></div><div><span>项目注册与事务历史</span><strong>已保留</strong></div></section><button className="recovery-primary" onClick={onComplete}>重新开始设置</button></main></div>;
  }

  if (busy === "execute") {
    return <div className="recovery-shell"><header><Brand /></header><main><div className="recovery-page-head"><div><span className="recovery-eyebrow">ROLLBACK IN PROGRESS</span><h1>正在恢复到迁移前</h1><p>操作已经开始并逐项写入事务记录；现在不能取消或切换页面。</p></div></div><div className="recovery-running" aria-live="polite"><LoaderCircle className="spin" /><h2>正在执行整笔恢复</h2><p>请保持 Habitat 打开。即使应用意外退出，已持久化的事务也会在下次启动时继续显示。</p><section className="recovery-result-card"><div><span>待恢复原入口</span><strong>{plan?.recoveryCount ?? 0}</strong></div><div><span>待移除 Store imports</span><strong>{plan?.importCount ?? 0}</strong></div><div><span>当前状态</span><strong>rolling_back</strong></div></section></div></main></div>;
  }

  if (busy === "inspect" && !plan) {
    return <div className="recovery-shell"><header><Brand /><button className="recovery-secondary" onClick={onExit}>取消检查</button></header><main><div className="recovery-page-head"><div><span className="recovery-eyebrow">GLOBAL RECOVERY</span><h1>正在检查所有项目</h1><p>正在从项目注册表和历史项目事务建立权威审计集合。</p></div></div><div className="recovery-running" aria-live="polite"><LoaderCircle className="spin" /><h2>检查项目链接与迁移事务</h2><p>检查期间不会修改任何文件。</p></div></main></div>;
  }

  if (error && !plan) {
    return <div className="recovery-shell"><header><Brand /><button className="recovery-secondary" onClick={onExit}>返回项目管理</button></header><main><div className="recovery-page-head"><div><span className="recovery-eyebrow">RECOVERY BLOCKED</span><h1>迁移事务需要人工检查</h1><p>Habitat 无法信任当前事务边界，因此不会提供恢复按钮。</p></div><button className="recovery-secondary" onClick={() => navigator.clipboard.writeText(JSON.stringify(error, null, 2))}><Copy />复制诊断信息</button></div><div className="recovery-centered compact"><div className="recovery-state-icon danger"><AlertCircle /></div><h2>{error.message ?? "无法检查恢复事务"}</h2><p>{error.recovery ?? "保留现场并人工检查事务报告。"}</p><section className="recovery-result-card"><div><span>错误代码</span><strong>{error.code ?? "recovery_error"}</strong></div></section><button className="recovery-secondary" onClick={inspect}><RefreshCw />重新检查</button></div></main></div>;
  }

  if (!plan) {
    return <div className="recovery-shell"><header><Brand /><button className="recovery-secondary" onClick={onExit}>返回项目管理</button></header><main className="recovery-centered"><div className="recovery-state-icon"><RotateCcw /></div><span className="recovery-eyebrow">NO ACTIVE RECOVERY</span><h1>没有需要恢复的首次迁移</h1><p>当前 Skill Store 中没有仍包含文件变更的首次迁移事务。Habitat 没有修改任何文件。</p><button className="recovery-secondary" onClick={onExit}>返回项目管理</button></main></div>;
  }

  const partial = plan.state === "rolling_back";
  return <div className="recovery-shell">
    <header><Brand /><button className="recovery-secondary" onClick={onExit}>{partial ? "暂时退出" : "返回项目管理"}</button></header>
    <main>
      <div className="recovery-page-head"><div><span className="recovery-eyebrow">{partial ? "RECOVERY NEEDS ATTENTION" : "GLOBAL RECOVERY"}</span><h1>{partial ? "恢复未能完整完成" : "恢复到首次迁移前"}</h1><p>{partial ? "已完成的操作不会重复；重新检查后只继续剩余内容。" : "Habitat 必须检查所有已纳管和历史关联项目；未知状态不会被视为安全。"}</p></div><button className="recovery-secondary" onClick={inspect} disabled={busy !== null}><RefreshCw className={busy === "inspect" ? "spin" : ""} />重新检查全部项目</button></div>
      {error && <div className="recovery-inline-error" role="alert"><AlertCircle /><span><strong>{error.message ?? "恢复未能继续"}</strong><small>{error.recovery ?? "检查当前状态后重试。"}</small></span></div>}
      <div className="recovery-body">
        <div className="recovery-metrics"><div><strong>{plan.coverage.expected}</strong><span>必须检查的项目</span></div><div><strong className={plan.coverage.inspected === plan.coverage.expected ? "success" : ""}>{plan.coverage.inspected} / {plan.coverage.expected}</strong><span>已完成检查</span></div><div><strong className={plan.projectLinks.length ? "danger" : "success"}>{plan.projectLinks.length}</strong><span>相关项目链接</span></div><div><strong className={plan.blockers.length ? "danger" : "success"}>{plan.blockers.length}</strong><span>阻断原因</span></div></div>
        <div className="recovery-grid">
          <section className="recovery-table-panel"><div className="recovery-panel-head"><div><h2>全量项目审计</h2><p>来自项目注册表和历史项目事务；每个项目必须得到明确结果。</p></div><span className={`recovery-status ${plan.ready ? "success" : "warning"}`}>{plan.ready ? "全量通过" : "尚未完成"}</span></div><div className="recovery-table-head"><span>项目</span><span>可访问性</span><span>相关链接</span><span>结果</span><span>处理</span></div>{plan.projects.map((project) => <ProjectRow key={project.projectRoot} project={project} onDetail={setDetailProject} />)}</section>
          <aside className="recovery-summary"><div className="recovery-panel-head"><div><h2>{partial ? "继续恢复" : "整笔恢复"}</h2><p>事务 · {plan.transactionId.slice(0, 8)}</p></div><span className={`recovery-status ${plan.ready ? "success" : "danger"}`}>{plan.ready ? "已就绪" : "已阻断"}</span></div><section><h3>{partial ? "剩余操作" : "恢复后"}</h3><div><span>恢复原用户入口</span><strong>{plan.recoveryCount}</strong></div><div><span>移除本事务 Store 导入</span><strong>{plan.importCount}</strong></div><div><span>自动修改项目链接</span><strong>0</strong></div><div><span>修改 Agent 设置</span><strong>0</strong></div></section>{!plan.ready && <section><div className="recovery-blocker"><strong>还不能恢复</strong><p>{projectBlockers.length ? `还有 ${plan.projectLinks.length} 个项目链接或未知项目状态需要处理。` : transactionBlockers[0]?.message ?? "迁移事务检查未通过。"}</p></div></section>}<footer><button className="recovery-danger" disabled={!plan.ready} onClick={() => setConfirming(true)}>{partial ? "继续剩余恢复" : "恢复到迁移前"}</button><small>{plan.ready ? "下一步确认一次，不选择 Skills。" : "全部项目与迁移事务通过后才会启用。"}</small></footer></aside>
        </div>
      </div>
    </main>
    {detailProject && <div className="recovery-detail-backdrop"><section className="recovery-detail" role="dialog" aria-modal="true" aria-labelledby="recovery-detail-title"><header><div><small>相关项目链接</small><h2 id="recovery-detail-title">{projectName(detailProject.projectRoot)}</h2></div><button onClick={() => setDetailProject(null)} aria-label="关闭"><X /></button></header><code>{detailProject.projectRoot}</code>{detailProject.relatedLinks.length ? <div className="recovery-link-list">{detailProject.relatedLinks.map((link) => <div key={link}><FolderOpen /><code>{link}</code><span>仍在使用</span></div>)}</div> : <div className="recovery-blocker"><strong>{detailProject.blocker?.message ?? "项目尚未完成检查"}</strong><p>{detailProject.blocker?.recovery}</p></div>}<footer><button className="recovery-secondary" onClick={() => setDetailProject(null)}>返回</button>{detailProject.relatedLinks.length > 0 && <button className="recovery-primary" onClick={() => onHandleProject(detailProject.projectRoot, detailProject.relatedLinks)}>前往项目处理</button>}</footer></section></div>}
    {confirming && <div className="recovery-confirm-backdrop"><section className="recovery-confirm" role="dialog" aria-modal="true" aria-labelledby="recovery-confirm-title"><header><h2 id="recovery-confirm-title">确认恢复到首次迁移前？</h2><p>Habitat 会再次执行全量预检；任何状态变化都会停止操作。</p></header><div className="recovery-confirm-body"><div><b>1</b><span><strong>恢复 {plan.recoveryCount} 个原用户入口</strong><small>按事务记录恢复原目录或符号链接及原始身份。</small></span></div><div><b>2</b><span><strong>移除 {plan.importCount} 个本事务 Store 导入</strong><small>只移除指纹仍一致、由首次迁移创建的内容。</small></span></div><p>不会修改 Agent 设置，不会自动删除项目链接；项目注册记录和事务历史会保留。成功后 Habitat 返回首次设置。</p></div><footer><button className="recovery-secondary" onClick={() => setConfirming(false)}>取消</button><button className="recovery-danger" onClick={execute}>确认恢复到迁移前</button></footer></section></div>}
  </div>;
}

function ProjectRow({ project, onDetail }: { project: RecoveryProjectAudit; onDetail: (project: RecoveryProjectAudit) => void }) {
  const passed = project.state === "passed";
  const unknown = project.state === "unknown" || project.state === "replaced";
  return <div className={`recovery-project-row ${unknown ? "unknown" : ""}`}><div><strong>{projectName(project.projectRoot)}</strong><code>{project.projectRoot}</code>{project.provenance.includes("project_transaction") && !project.provenance.includes("registry") && <small>历史项目事务</small>}</div><span className={`recovery-chip ${passed || project.state === "blocked" ? "success" : "warning"}`}>{passed || project.state === "blocked" ? "可访问" : project.state === "replaced" ? "身份变化" : "无法访问"}</span><strong className={project.relatedLinks.length ? "danger" : ""}>{project.relatedLinks.length || (unknown ? "未知" : "0 个")}</strong><span className={`recovery-status ${passed ? "success" : unknown ? "warning" : "danger"}`}>{passed ? "通过" : unknown ? "未完成" : "阻断"}</span><button className="recovery-row-button" onClick={() => onDetail(project)}>{project.relatedLinks.length ? "处理链接" : "查看"}</button></div>;
}
