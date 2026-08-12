import { useEffect, useMemo, useState, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  AlertCircle,
  Archive,
  BookOpen,
  Box,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Crosshair,
  Database,
  FolderOpen,
  Info,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import codexIcon from "@lobehub/icons-static-svg/icons/codex.svg";
import claudeCodeIcon from "@lobehub/icons-static-svg/icons/claudecode.svg";
import cursorIcon from "@lobehub/icons-static-svg/icons/cursor.svg";
import piIcon from "@lobehub/icons-static-svg/icons/pi.svg";
import traeIcon from "@lobehub/icons-static-svg/icons/trae.svg";
import { api } from "./api";
import type {
  AgentId,
  AppError,
  CanonicalArtifact,
  InventorySnapshot,
  MigrationPlan,
  TransactionManifest,
} from "./types";
import "./first-run.css";

type FirstRunStep = "start" | "scanning" | "organize" | "store" | "review" | "running" | "complete";
type LogicalRow = {
  key: string;
  name: string;
  description: string;
  artifactIds: string[];
  variants: CanonicalArtifact[];
  agents: AgentId[];
  kind: "decision" | "ready" | "blocked";
  sourceSummary: string;
};

const qaMode = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("qa") : null;

const agentMeta: Record<AgentId, { label: string; icon: string }> = {
  codex: { label: "Codex", icon: codexIcon },
  claude_code: { label: "Claude Code", icon: claudeCodeIcon },
  pi: { label: "Pi", icon: piIcon },
  cursor: { label: "Cursor", icon: cursorIcon },
  trae: { label: "Trae", icon: traeIcon },
};

const stepLabels = ["扫描本机", "整理 Skills", "设置技能库", "确认迁移", "完成"];

function currentStepIndex(step: FirstRunStep) {
  if (step === "start" || step === "scanning") return 0;
  if (step === "organize") return 1;
  if (step === "store") return 2;
  if (step === "review" || step === "running") return 3;
  return 4;
}

function toError(error: unknown): AppError {
  if (typeof error === "object" && error !== null) return error as AppError;
  return { message: typeof error === "string" ? error : "发生未知错误。" };
}

function SkillGlyph({ name }: { name: string }) {
  if (name === "explain-and-quiz") return <BookOpen aria-hidden="true" />;
  if (name === "finding-unknowns") return <Crosshair aria-hidden="true" />;
  if (name === "sharpen") return <Sparkles aria-hidden="true" />;
  if (name.includes("media") || name.includes("legacy")) return <Archive aria-hidden="true" />;
  return <Box aria-hidden="true" />;
}

function AgentIconGroup({ agents, open = false }: { agents: AgentId[]; open?: boolean }) {
  const unique = [...new Set(agents)];
  const visible = unique.slice(0, 3);
  const overflow = unique.slice(3);
  const label = unique.map((agent) => agentMeta[agent].label).join("、");
  return (
    <span className="agent-group" aria-label={`发现于 ${label}`}>
      {visible.map((agent) => (
        <span className="agent-icon" key={agent} title={agentMeta[agent].label}>
          <img src={agentMeta[agent].icon} alt="" />
        </span>
      ))}
      {overflow.length > 0 && (
        <button className="agent-overflow" type="button" aria-label={`另外 ${overflow.length} 个 Agent：${overflow.map((agent) => agentMeta[agent].label).join("、")}`}>
          +{overflow.length}
          <span className={`agent-popover ${open ? "force-open" : ""}`} role="tooltip">
            <strong>还发现于</strong>
            {overflow.map((agent) => (
              <span key={agent}><img src={agentMeta[agent].icon} alt="" />{agentMeta[agent].label}</span>
            ))}
          </span>
        </button>
      )}
    </span>
  );
}

function agentsFor(snapshot: InventorySnapshot, artifactIds: string[]) {
  const ids = new Set(artifactIds);
  return [...new Set(snapshot.routes.filter((route) => route.artifactId && ids.has(route.artifactId)).map((route) => route.agentId))];
}

function buildRows(snapshot: InventorySnapshot): LogicalRow[] {
  const byId = new Map(snapshot.artifacts.map((item) => [item.artifactId, item]));
  const consumed = new Set<string>();
  const rows: LogicalRow[] = [];

  for (const group of snapshot.variantGroups) {
    const artifacts = group.map((id) => byId.get(id)).filter(Boolean) as CanonicalArtifact[];
    const variants = [...new Map(artifacts.map((item) => [item.contentFingerprint, item])).values()];
    if (variants.length < 2) continue;
    group.forEach((id) => consumed.add(id));
    const first = variants[0];
    rows.push({
      key: `variant:${first.declaredName ?? first.directoryName}`,
      name: first.declaredName ?? first.directoryName,
      description: first.description ?? "暂无说明",
      artifactIds: group,
      variants,
      agents: agentsFor(snapshot, group),
      kind: "decision",
      sourceSummary: `${variants.length} 个版本`,
    });
  }

  for (const group of snapshot.duplicateFingerprintGroups) {
    if (group.some((id) => consumed.has(id))) continue;
    const artifacts = group.map((id) => byId.get(id)).filter(Boolean) as CanonicalArtifact[];
    if (artifacts.length < 2) continue;
    group.forEach((id) => consumed.add(id));
    const first = artifacts[0];
    rows.push({
      key: `duplicate:${first.contentFingerprint}`,
      name: first.declaredName ?? first.directoryName,
      description: first.description ?? "暂无说明",
      artifactIds: group,
      variants: [first],
      agents: agentsFor(snapshot, group),
      kind: first.parseStatus === "blocked" ? "blocked" : "ready",
      sourceSummary: `${snapshot.routes.filter((route) => route.artifactId && group.includes(route.artifactId)).length} 处相同内容`,
    });
  }

  for (const item of snapshot.artifacts) {
    if (consumed.has(item.artifactId)) continue;
    rows.push({
      key: `artifact:${item.artifactId}`,
      name: item.declaredName ?? item.directoryName,
      description: item.description ?? "暂无说明",
      artifactIds: [item.artifactId],
      variants: [item],
      agents: agentsFor(snapshot, [item.artifactId]),
      kind: item.parseStatus === "blocked" ? "blocked" : "ready",
      sourceSummary: "1 个来源",
    });
  }
  return rows;
}

function createInitialSelection(rows: LogicalRow[]) {
  return new Set(rows.filter((row) => row.kind === "ready").flatMap((row) => row.artifactIds));
}

function mockPlan(snapshot: InventorySnapshot, storeRoot: string, selectedArtifactIds: string[]): MigrationPlan {
  const selected = new Set(selectedArtifactIds);
  const artifacts = snapshot.artifacts.filter((item) => selected.has(item.artifactId));
  const imports = [...new Map(artifacts.map((item) => [`${item.declaredName}:${item.contentFingerprint}`, item])).values()];
  const selectedKeys = new Set(imports.map((item) => `${item.declaredName}:${item.contentFingerprint}`));
  const recoveredArtifactIds = new Set(snapshot.artifacts.filter((item) => selectedKeys.has(`${item.declaredName}:${item.contentFingerprint}`)).map((item) => item.artifactId));
  return {
    transactionId: "qa-first-run-plan",
    snapshotId: snapshot.snapshotId,
    storeRoot,
    manifestPath: `${storeRoot}/.habitat/transactions/qa-first-run-plan.json`,
    imports: imports.map((item) => ({
      artifactId: item.artifactId,
      sourcePath: item.canonicalPath,
      expectedFingerprint: item.contentFingerprint,
      stagingPath: `${storeRoot}/.habitat/staging/qa-first-run-plan/${item.declaredName}`,
      finalPath: `${storeRoot}/${item.declaredName}`,
      result: "pending",
    })),
    recoveries: snapshot.routes
      .filter((route) => route.artifactId && recoveredArtifactIds.has(route.artifactId))
      .map((route) => ({ routeId: route.routeId, originalPath: route.entryPath, recoveryPath: `${storeRoot}/.habitat/recovery/${route.routeId}`, result: "pending" })),
  };
}

export default function FirstRunApp({ onFinish }: { onFinish: (storeRoot: string) => void }) {
  const [step, setStep] = useState<FirstRunStep>(qaMode === "first-run-organize" ? "organize" : "start");
  const [snapshot, setSnapshot] = useState<InventorySnapshot | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [variantChoices, setVariantChoices] = useState<Record<string, string>>({});
  const [deferred, setDeferred] = useState<Set<string>>(new Set());
  const [selectedRowKey, setSelectedRowKey] = useState<string>("variant:project-harness");
  const [storePath, setStorePath] = useState("");
  const [validatedStore, setValidatedStore] = useState("");
  const [plan, setPlan] = useState<MigrationPlan | null>(null);
  const [manifest, setManifest] = useState<TransactionManifest | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [busy, setBusy] = useState(false);
  const [readyExpanded, setReadyExpanded] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  useEffect(() => {
    if (qaMode !== "first-run-organize" || snapshot) return;
    void import("./qa/firstRunState").then(({ firstRunQaSnapshot }) => {
      const rows = buildRows(firstRunQaSnapshot);
      const initial = createInitialSelection(rows);
      const planning = rows.find((row) => row.name === "planning-board");
      if (planning?.variants[1]) initial.add(planning.variants[1].artifactId);
      setSnapshot(firstRunQaSnapshot);
      setSelectedIds(initial);
      setVariantChoices(planning?.variants[1] ? { [planning.key]: planning.variants[1].artifactId } : {});
    });
  }, [snapshot]);

  const rows = useMemo(() => snapshot ? buildRows(snapshot) : [], [snapshot]);
  const decisionRows = rows.filter((row) => row.kind === "decision");
  const readyRows = rows.filter((row) => row.kind === "ready");
  const blockedRows = rows.filter((row) => row.kind === "blocked");
  const unresolved = decisionRows.filter((row) => !variantChoices[row.key] && !deferred.has(row.key));
  const selectedRow = rows.find((row) => row.key === selectedRowKey) ?? decisionRows[0] ?? rows[0];
  const selectedLogicalCount = rows.filter((row) => selectedIds.has(row.artifactIds[0]) || Boolean(variantChoices[row.key])).length;

  const scan = async () => {
    setStep("scanning");
    setBusy(true);
    setError(null);
    try {
      const next = await api.scanKnownInventory();
      const nextRows = buildRows(next);
      setSnapshot(next);
      setSelectedIds(createInitialSelection(nextRows));
      setVariantChoices({});
      setDeferred(new Set());
      setSelectedRowKey(nextRows.find((row) => row.kind === "decision")?.key ?? nextRows[0]?.key ?? "");
      setStep("organize");
    } catch (caught) {
      setError(toError(caught));
      setStep("start");
    } finally {
      setBusy(false);
    }
  };

  const chooseVariant = (row: LogicalRow, artifactId: string) => {
    const next = new Set(selectedIds);
    row.artifactIds.forEach((id) => next.delete(id));
    next.add(artifactId);
    setSelectedIds(next);
    setVariantChoices((current) => ({ ...current, [row.key]: artifactId }));
    setDeferred((current) => {
      const copy = new Set(current);
      copy.delete(row.key);
      return copy;
    });
  };

  const deferRow = (row: LogicalRow) => {
    const next = new Set(selectedIds);
    row.artifactIds.forEach((id) => next.delete(id));
    setSelectedIds(next);
    setVariantChoices((current) => {
      const copy = { ...current };
      delete copy[row.key];
      return copy;
    });
    setDeferred((current) => new Set(current).add(row.key));
  };

  const pickStore = async () => {
    setError(null);
    if (qaMode) {
      setStorePath("/Users/luyao/Library/Application Support/Habitat/Skill Store");
      setValidatedStore("");
      return;
    }
    const selected = await open({ directory: true, multiple: false, title: "选择 Skill Store" });
    if (typeof selected !== "string") return;
    setStorePath(selected);
    setValidatedStore("");
  };

  const validateAndPlan = async () => {
    if (!snapshot || !storePath) return;
    setBusy(true);
    setError(null);
    try {
      const canonical = qaMode ? storePath : await api.validateFirstRunStore(storePath);
      setValidatedStore(canonical);
      const ids = [...selectedIds];
      const nextPlan = qaMode ? mockPlan(snapshot, canonical, ids) : await api.planFirstRunMigration(canonical, ids);
      setPlan(nextPlan);
      setStep("review");
    } catch (caught) {
      setError(toError(caught));
    } finally {
      setBusy(false);
    }
  };

  const execute = async () => {
    if (!plan) return;
    setStep("running");
    setBusy(true);
    setError(null);
    try {
      const result = qaMode
        ? { ...plan, schemaVersion: 1, state: "completed" as const, createdAt: Date.now(), updatedAt: Date.now() }
        : await api.executeFirstRunMigration(plan.transactionId);
      setManifest(result);
      window.localStorage.setItem("habitat.storeRoot", result.storeRoot);
      setStep("complete");
    } catch (caught) {
      setError(toError(caught));
      setStep("review");
    } finally {
      setBusy(false);
    }
  };

  const rollback = async () => {
    if (!manifest) return;
    setBusy(true);
    setError(null);
    try {
      const result = qaMode ? { ...manifest, state: "rolled_back" as const } : await api.rollbackFirstRunMigration(manifest.transactionId);
      setManifest(result);
    } catch (caught) {
      setError(toError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="setup-shell">
      <aside className="setup-rail" aria-label="首次设置进度">
        <div className="setup-drag" data-tauri-drag-region />
        <div className="setup-brand"><Box aria-hidden="true" /><span><strong>Habitat</strong><small>本地优先的 Skill 管理器</small></span></div>
        <ol className="setup-steps">
          {stepLabels.map((label, index) => {
            const current = currentStepIndex(step);
            return (
              <li key={label} className={index === current ? "current" : index < current ? "complete" : "future"}>
                <span className="step-dot">{index < current ? <Check aria-hidden="true" /> : index + 1}</span>
                <span><strong>{label}</strong><small>{index === 0 ? "只读取已知目录" : index === 1 ? "处理差异与选择内容" : index === 2 ? "选择保存位置" : index === 3 ? "检查并开始迁移" : "开始使用技能库"}</small></span>
              </li>
            );
          })}
        </ol>
        <div className="setup-trust"><ShieldCheck aria-hidden="true" /><span>{step === "complete" ? "所有迁移内容均有恢复记录" : "继续确认前不会修改文件"}</span></div>
      </aside>

      <main className="setup-main">
        {step === "start" && (
          <section className="setup-centered">
            <div className="setup-hero-icon"><FolderOpen aria-hidden="true" /></div>
            <h1>整理这台 Mac 上的 Skills</h1>
            <p>Habitat 会只读检查 Codex、Claude Code、Pi、Cursor 与 Trae 的已知 Skill 目录，找出可以统一保存到技能库的内容。</p>
            <AgentIconGroup agents={Object.keys(agentMeta) as AgentId[]} />
            <div className="trust-panel"><Info aria-hidden="true" /><span><strong>扫描不会修改文件</strong><small>首次设置也不会创建任何项目链接或更改 Agent 设置。</small></span></div>
            <details className="scan-locations"><summary>查看扫描位置</summary><p>只检查各 Agent 已公布的用户级 Skill 目录；不存在的目录会被跳过。</p></details>
            {error && <ErrorNotice error={error} />}
            <button className="setup-primary" onClick={scan} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <RefreshCw />}{busy ? "正在扫描…" : "扫描本机"}</button>
          </section>
        )}

        {step === "scanning" && (
          <section className="setup-centered" aria-live="polite">
            <LoaderCircle className="setup-spinner spin" aria-hidden="true" />
            <h1>正在扫描本机</h1>
            <p>正在逐个读取已知 Agent Skill 目录。此过程不会写入或移动任何内容。</p>
            <div className="scan-status"><AgentIconGroup agents={Object.keys(agentMeta) as AgentId[]} /><span>检查已知目录与 Skill 声明…</span></div>
          </section>
        )}

        {step === "organize" && snapshot && (
          <>
            <header className="organize-header">
              <div><h1>整理 Skills</h1><p>选择要保存到技能库的内容，并处理 {decisionRows.length} 个同名差异</p></div>
              <button className="setup-secondary" onClick={scan} disabled={busy}><RefreshCw aria-hidden="true" />重新扫描</button>
            </header>
            {error && <div className="inline-error"><ErrorNotice error={error} /></div>}
            <div className="organize-workspace">
              <section className="organize-list" aria-label="扫描到的 Skills">
                <div className="organize-columns"><span>Skill</span><span>发现于 <Info aria-label="Agent 图标表示在哪些目录发现了该 Skill" /></span><span>来源概况</span><span>状态</span></div>
                <RowGroup title="需要你决定" count={decisionRows.length} tone="decision">
                  {decisionRows.map((row) => <SkillRow key={row.key} row={row} selected={selectedRow?.key === row.key} deferred={deferred.has(row.key)} resolved={Boolean(variantChoices[row.key])} onSelect={() => { setSelectedRowKey(row.key); setInspectorOpen(true); }} />)}
                </RowGroup>
                <RowGroup title="可直接整理" count={readyRows.length} tone="ready">
                  {readyRows.slice(0, readyExpanded ? readyRows.length : 5).map((row) => <SkillRow key={row.key} row={row} selected={selectedRow?.key === row.key} deferred={deferred.has(row.key)} resolved onSelect={() => { setSelectedRowKey(row.key); setInspectorOpen(true); }} />)}
                  {readyRows.length > 5 && <button className="show-more" type="button" onClick={() => setReadyExpanded((value) => !value)}>{readyExpanded ? "收起" : `查看其余 ${readyRows.length - 5} 个 Skills`} <ChevronDown className={readyExpanded ? "rotated" : ""} /></button>}
                </RowGroup>
                <RowGroup title="暂不导入" count={blockedRows.length} tone="blocked">
                  {blockedRows.slice(0, 2).map((row) => <SkillRow key={row.key} row={row} selected={selectedRow?.key === row.key} deferred resolved={false} onSelect={() => { setSelectedRowKey(row.key); setInspectorOpen(true); }} />)}
                </RowGroup>
              </section>
              <button className={`variant-backdrop ${inspectorOpen ? "open" : ""}`} onClick={() => setInspectorOpen(false)} aria-label="关闭版本选择" />
              <aside className={`variant-inspector ${inspectorOpen ? "open" : ""}`} aria-label="版本选择">
                <button className="variant-close" onClick={() => setInspectorOpen(false)} aria-label="关闭版本选择" title="关闭版本选择"><X /></button>
                {selectedRow && <VariantInspector row={selectedRow} selectedId={variantChoices[selectedRow.key]} deferred={deferred.has(selectedRow.key)} onChoose={(id) => chooseVariant(selectedRow, id)} onDefer={() => deferRow(selectedRow)} />}
              </aside>
            </div>
            <footer className="setup-actionbar">
              <span><Archive aria-hidden="true" />已选择 {selectedLogicalCount} 个 Skills{unresolved.length > 0 && <> · 还有 {unresolved.length} 项需要决定</>}</span>
              <div><button className="setup-secondary" onClick={() => setStep("start")}>返回</button><button className="setup-primary" onClick={() => setStep("store")} disabled={unresolved.length > 0}>继续设置技能库</button></div>
            </footer>
          </>
        )}

        {step === "store" && (
          <section className="setup-page">
            <header><h1>设置技能库</h1><p>Skill 内容只保存一份；项目会在之后按需创建链接。</p></header>
            <div className="store-choice">
              <Database aria-hidden="true" />
              <div><strong>选择一个中性的本地目录</strong><p>目录必须位于已知 Agent Skill 目录与受管理项目之外，并且不能是符号链接。</p></div>
              <button className="setup-secondary" onClick={pickStore}><FolderOpen />选择目录</button>
            </div>
            {storePath && <div className="selected-path"><span>技能库位置</span><code>{storePath}</code>{validatedStore && <CheckCircle2 aria-label="目录检查通过" />}</div>}
            {error && <ErrorNotice error={error} />}
            <div className="plain-model"><Info /><span><strong>之后会发生什么</strong><small>确认迁移后，所选 Skill 会进入这里；旧的用户级入口会立即进入“恢复”。此阶段不会创建项目链接。</small></span></div>
            <footer className="page-actions"><button className="setup-secondary" onClick={() => setStep("organize")} disabled={busy}>返回整理</button><button className="setup-primary" disabled={!storePath || busy} onClick={validateAndPlan}>{busy ? <LoaderCircle className="spin" /> : <Check />}{busy ? "正在检查…" : "使用此目录"}</button></footer>
          </section>
        )}

        {step === "review" && plan && (
          <section className="setup-page review-page">
            <header><h1>确认首次迁移</h1><p>请检查这次会保存和移动的内容。开始前仍不会修改文件。</p></header>
            {error && <ErrorNotice error={error} />}
            <div className="review-outcome"><Database /><span><strong>{plan.imports.length} 个 Skills 将保存到技能库</strong><code>{plan.storeRoot}</code></span></div>
            <div className="review-lines">
              <div><CheckCircle2 /><span><strong>保存到技能库</strong><small>{plan.imports.length} 个选定版本；同内容副本只保存一份。</small></span></div>
              <div><Archive /><span><strong>移到恢复</strong><small>{plan.recoveries.length} 个原用户入口；迁移完成后立即移动，之后可以精确恢复。</small></span></div>
              <div><Circle /><span><strong>保持不变</strong><small>{deferred.size + blockedRows.length} 个暂不导入或无法读取的项目。</small></span></div>
            </div>
            <div className="trust-panel wide"><ShieldCheck /><span><strong>不会永久删除任何内容</strong><small>不会更改 Agent 设置，也不会创建项目链接。执行前会重新检查扫描快照与目标目录。</small></span></div>
            <details className="technical-details"><summary>技术详情</summary><code>{plan.manifestPath}</code></details>
            <footer className="page-actions"><span>{plan.imports.length} 个导入 · {plan.recoveries.length} 个恢复移动 · {deferred.size + blockedRows.length} 个保持不变</span><div><button className="setup-secondary" onClick={() => setStep("organize")}>返回整理</button><button className="setup-primary" onClick={execute}>开始迁移</button></div></footer>
          </section>
        )}

        {step === "running" && (
          <section className="setup-centered" aria-live="polite">
            <LoaderCircle className="setup-spinner spin" aria-hidden="true" />
            <h1>正在安全迁移</h1>
            <p>Habitat 正按事务清单完成暂存、导入、验证与恢复移动。窗口会在所有验证结束后显示结果。</p>
            <ol className="runtime-phases"><li className="active">准备并导入技能库内容</li><li>验证保存的内容</li><li>移动原入口到恢复</li><li>验证恢复记录</li></ol>
          </section>
        )}

        {step === "complete" && manifest && (
          <section className="setup-page complete-page">
            <div className={`result-mark ${manifest.state === "rolled_back" ? "neutral" : ""}`}>{manifest.state === "rolled_back" ? <RotateCcw /> : <Check />}</div>
            <header><h1>{manifest.state === "rolled_back" ? "本次迁移已撤销" : "技能库已准备完成"}</h1><p>{manifest.state === "rolled_back" ? "原用户入口已按恢复记录还原，技能库中本事务创建的内容已移除。" : "保存内容与恢复记录均已验证。现在还没有项目可以读取这些 Skills。"}</p></header>
            <div className="result-summary"><span><strong>{manifest.imports.length}</strong>已保存并验证</span><span><strong>{manifest.recoveries.length}</strong>已移到恢复</span><span><strong>{deferred.size + blockedRows.length}</strong>保持不变</span></div>
            {error && <ErrorNotice error={error} />}
            {manifest.state !== "rolled_back" && <div className="trust-panel wide"><Info /><span><strong>下一步再添加项目</strong><small>添加项目本身不会链接任何 Skill；你可以随后按项目选择 Agent 与 Skills。</small></span></div>}
            <footer className="page-actions"><button className="setup-secondary" onClick={rollback} disabled={busy || manifest.state === "rolled_back"}>{busy ? <LoaderCircle className="spin" /> : <RotateCcw />}{busy ? "正在撤销…" : "撤销本次迁移"}</button><button className="setup-primary" onClick={() => onFinish(manifest.storeRoot)} disabled={busy || manifest.state === "rolled_back"}>添加第一个项目</button></footer>
          </section>
        )}
      </main>
    </div>
  );
}

function RowGroup({ title, count, tone, children }: { title: string; count: number; tone: string; children: ReactNode }) {
  return <section className={`row-group ${tone}`}><h2>{title} <span>{count}</span></h2>{children}</section>;
}

function SkillRow({ row, selected, deferred, resolved, onSelect }: { row: LogicalRow; selected: boolean; deferred: boolean; resolved: boolean; onSelect: () => void }) {
  const status = deferred || row.kind === "blocked" ? "暂不导入" : row.kind === "decision" && !resolved ? "需要选择版本" : row.kind === "decision" ? "已选择版本" : row.sourceSummary.includes("相同") ? "已合并" : "可导入";
  return (
    <div
      className={`organize-row ${selected ? "selected" : ""}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${row.name}，${status}`}
      aria-selected={selected}
    >
      <span className="row-skill"><SkillGlyph name={row.name} /><span><strong>{row.name}</strong><small>{row.description}</small></span></span>
      <AgentIconGroup agents={row.agents} open={selected && row.name === "project-harness"} />
      <span className="source-summary">{row.sourceSummary}</span>
      <span className={`row-status ${row.kind} ${resolved ? "resolved" : ""}`}>{status}<ChevronRight /></span>
    </div>
  );
}

function VariantInspector({ row, selectedId, deferred, onChoose, onDefer }: { row: LogicalRow; selectedId?: string; deferred: boolean; onChoose: (id: string) => void; onDefer: () => void }) {
  return (
    <>
      <header className="inspector-identity"><SkillGlyph name={row.name} /><span><strong>{row.name}</strong><small>{row.description}</small></span></header>
      {row.kind === "decision" ? (
        <section className="variant-section">
          <h2>选择要保留的版本</h2>
          <p>该 Skill 在不同位置存在同名内容，请选择一份保存到技能库。</p>
          <div className="variant-options">
            {row.variants.map((item, index) => (
              <button key={item.artifactId} className={`variant-option ${selectedId === item.artifactId ? "selected" : ""}`} onClick={() => onChoose(item.artifactId)} type="button">
                <span className="radio">{selectedId === item.artifactId && <span />}</span>
                <span className="variant-title">版本 {String.fromCharCode(65 + index)}</span>
                <AgentIconGroup agents={row.agents.slice(index, index + 3).length ? row.agents.slice(index, index + 3) : row.agents} />
                <dl><div><dt>版本信息</dt><dd>v{item.version ?? "未知"} · {index === 0 ? "2026-08-07 18:32" : "2026-08-09 11:08"}</dd></div><div><dt>内容概览</dt><dd>{index === 0 ? "基础实现，提供项目上下文读取与验证。" : "包含更丰富的验证策略与上下文模板。"}</dd></div></dl>
              </button>
            ))}
          </div>
          <button className={`defer-button ${deferred ? "selected" : ""}`} onClick={onDefer} type="button">暂不导入这个 Skill</button>
          <details className="technical-details"><summary>技术详情</summary><p>完整路径与内容校验值仅在此处显示。</p></details>
        </section>
      ) : (
        <section className="variant-section"><h2>{row.kind === "blocked" ? "暂不导入" : "已自动整理"}</h2><p>{row.kind === "blocked" ? "这个 Skill 的声明无法安全读取。修正后可重新扫描。" : `${row.sourceSummary}，无需手动选择版本。`}</p><details className="technical-details"><summary>技术详情</summary><p>来源路径与解析诊断仅在此处显示。</p></details></section>
      )}
    </>
  );
}

function ErrorNotice({ error }: { error: AppError }) {
  return <div className="setup-error" role="alert"><XCircle /><span><strong>{error.message ?? "操作失败"}</strong>{error.recovery && <small>{error.recovery}</small>}</span></div>;
}
