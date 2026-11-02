"""Replay this harness snapshot audit; read-only, no service or browser needed."""
import hashlib
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "docs/archive/harness/2026-11-02-pre-audit"


def read(relative):
    return (ROOT / relative).read_text()


def git_blob(revision, relative):
    return subprocess.run(
        ["git", "show", f"{revision}:{relative}"], cwd=ROOT,
        check=True, capture_output=True,
    ).stdout


def sha(data):
    return hashlib.sha256(data).hexdigest()


manifest = json.loads((ARCHIVE / "snapshots.json").read_text())
baseline = manifest["sourceCommit"]
for item in manifest["files"]:
    data = (ARCHIVE / item["snapshot"]).read_bytes()
    assert sha(data) == item["sha256"], item["snapshot"]
    assert data == git_blob(baseline, item["source"]), item["source"]

state = json.loads(read("tasks.json"))
old = json.loads(read(state["archivedTaskLedger"]))
active = {task["id"]: task for task in state["tasks"]}
assert len(active) == len(state["tasks"]), "Duplicate active task ID"
all_tasks = {task["id"]: task for task in old["tasks"]} | active
assert state["current"] in active
assert set(state["activePhases"]) <= active.keys()


def visit(ident, stack):
    assert ident in all_tasks, f"Missing task: {ident}"
    assert ident not in stack, f"Dependency cycle: {stack} -> {ident}"
    for dependency in all_tasks[ident].get("dependsOn", []):
        visit(dependency, stack + [ident])


for ident, task in active.items():
    visit(ident, [])
    for field in ("evidence", "historicalEvidence"):
        for reference in task.get(field, []):
            assert (ROOT / reference).exists(), reference
assert active["M4"]["status"] == "reopened"
assert active["V3"]["status"] != "done"
for ident in ("V1-A", "V1-B"):
    assert active[ident]["status"] == "awaiting_user_confirmation"
assert "V1-A" not in active["V1-B"]["dependsOn"]
assert active["V1-B"]["basedOnRevision"] == "A1-web-real"
assert read("PLAN.md").count("\nnext_action：") == 1
assert "next_action：" + state["next_action"] in read("PLAN.md")

original_plan = (ARCHIVE / "06-original-plan.md").read_text()
for start, end in (("## M4 — Web 发布门槛\n", "\n## 核心验收用例映射"),
                   ("## 核心验收用例映射\n", "\n## 完成格式与续跑")):
    assert original_plan.split(start, 1)[1].split(end, 1)[0].strip() in read("docs/06-实施计划与验收.md")
original_contract = git_blob(baseline, "docs/10-原型先行与高保真还原合同.md").decode()
core = original_contract.split("## 哪份材料有决定权", 1)[1].split("## 状态与证据纪律", 1)[0]
assert core in read("docs/10-原型先行与高保真还原合同.md")

a0 = json.loads(read("verification/fidelity/A0-hashes.json"))
for relative, digest in a0.items():
    assert sha((ROOT / relative).read_bytes()) == digest, relative
registry = read("design/prototype-baselines.md")
for revision, filename in (("A1-web-real", "Habitat-A1-web-real.html"),
                           ("A2-failure-states", "Habitat-A2-failure-states.html")):
    digest = sha((ROOT / "design/prototype-revisions" / revision / "dist" / filename).read_bytes())
    assert digest in registry, revision
    assert "`awaiting-user-confirmation`" in read(f"design/prototype-revisions/{revision}/README.md")

markdown = [ROOT / name for name in ("AGENTS.md", "README.md", "PLAN.md", "JOURNAL.md", "CODEX-START.md")]
markdown += list((ROOT / "docs").glob("*.md"))
markdown += [ROOT / name for name in (
    "docs/archive/README.md", "docs/archive/harness/2026-11-02-pre-audit/README.md",
    "design/prototype-baselines.md", "design/prototype-revisions/REVIEW.md",
    "design/prototype-revisions/A1-web-real/README.md", "design/prototype-revisions/A2-failure-states/README.md",
    "verification/README.md", "verification/fidelity/coverage.md", "verification/harness-audit-2026-11-03.md",
)]
link_count = 0
for file in markdown:
    for target in re.findall(r"\[[^\]]*\]\(([^\s)]+)\)", file.read_text()):
        if re.match(r"[a-zA-Z][\w+.-]*:", target) or target.startswith("#"):
            continue
        relative = unquote(target.split("#", 1)[0])
        assert (file.parent / relative).exists(), f"{file}: {target}"
        link_count += 1

assert not (ROOT / "tests/browser-smoke.py").exists()
assert b"browser-smoke.py" not in (ROOT / "package.json").read_bytes()
for unchanged in ("package.json", "MANIFEST.json", "SHA256SUMS"):
    assert (ROOT / unchanged).read_bytes() == git_blob(baseline, unchanged)
subprocess.run(["git", "diff", "--check"], cwd=ROOT, check=True)
entrypoints = ("AGENTS.md", "README.md", "CODEX-START.md", "PLAN.md", "JOURNAL.md", "tasks.json")
count = lambda text: len(re.sub(r"\s", "", text))
before = sum(count(git_blob(baseline, name).decode()) for name in entrypoints)
after = sum(count(read(name)) for name in entrypoints)
print(json.dumps({"result": "passed", "archive_snapshots": len(manifest["files"]),
                  "active_tasks": len(active), "a0_hashes": len(a0), "candidate_hashes": 2,
                  "local_links": link_count, "entrypoint_chars_before": before,
                  "entrypoint_chars_after": after, "reduction_pct": round((1-after/before)*100, 1)}, ensure_ascii=False))
