import type {
  AgentId,
  CanonicalArtifact,
  ExposureRoute,
  InventorySnapshot,
  ParseStatus,
} from "../types";

const agents: AgentId[] = ["codex", "claude_code", "pi", "cursor", "trae"];

function artifact(
  artifactId: string,
  name: string,
  description: string,
  fingerprint: string,
  parseStatus: ParseStatus = "valid",
): CanonicalArtifact {
  return {
    artifactId,
    canonicalPath: `/private/tmp/habitat-first-run/${artifactId}/${name}`,
    declaredName: name,
    directoryName: name,
    description,
    version: "1.0.0",
    manifest: [],
    contentFingerprint: fingerprint,
    parseStatus,
    diagnostics: parseStatus === "blocked"
      ? [{ code: "invalid_declaration", message: "SKILL.md 描述无法读取。", blocking: true }]
      : [],
  };
}

const variants = [
  artifact("project-harness-a", "project-harness", "项目上下文与验证助手架", "project-harness-a"),
  artifact("project-harness-b", "project-harness", "项目上下文与验证助手架", "project-harness-b"),
  artifact("planning-board-a", "planning-board", "项目计划看板", "planning-board-a"),
  artifact("planning-board-b", "planning-board", "项目计划看板", "planning-board-b"),
];

const duplicateDefinitions = [
  ["explain-and-quiz", "解释概念并生成测验"],
  ["finding-unknowns", "发现信息缺口与验证路径"],
  ["sharpen", "精炼方案与优化建议"],
  ["habit-store", "技能库存储与管理"],
  ["project-review", "检查项目交付质量"],
  ["release-notes", "整理版本说明"],
] as const;

const duplicateArtifacts = duplicateDefinitions.flatMap(([name, description], index) => [
  artifact(`${name}-a`, name, description, `duplicate-${index}`),
  artifact(`${name}-b`, name, description, `duplicate-${index}`),
]);

const readyDefinitions = [
  ["media-kit", "媒体资源工具集"],
  ["research-notes", "整理研究笔记"],
  ["release-check", "发布前检查"],
  ["design-audit", "检查界面体验"],
  ["git-helper", "辅助 Git 工作流"],
  ["test-planner", "生成测试计划"],
  ["code-review", "审查代码风险"],
  ["docs-writer", "编写产品文档"],
  ["prompt-library", "管理常用提示"],
  ["issue-triage", "整理问题优先级"],
  ["data-check", "检查数据质量"],
  ["demo-builder", "准备演示内容"],
  ["accessibility", "检查可访问性"],
  ["copy-editor", "优化界面文案"],
  ["dependency-audit", "检查依赖变化"],
  ["security-review", "检查安全边界"],
  ["retro-notes", "整理复盘结论"],
  ["product-brief", "编写产品简报"],
  ["changelog", "维护变更记录"],
  ["localization", "检查本地化文案"],
  ["performance-check", "检查性能风险"],
] as const;

const readyArtifacts = readyDefinitions.map(([name, description], index) =>
  artifact(name, name, description, `ready-${index}`),
);

const blockedArtifacts = [
  artifact("legacy-helper", "legacy-helper", "声明缺少必要信息", "blocked-0", "blocked"),
  artifact("broken-skill", "broken-skill", "描述无法读取", "blocked-1", "blocked"),
];

const artifacts = [...variants, ...duplicateArtifacts, ...readyArtifacts, ...blockedArtifacts];

function route(item: CanonicalArtifact, index: number, suffix = ""): ExposureRoute {
  const agentId = agents[index % agents.length];
  return {
    routeId: `route-${index}${suffix}`,
    rootId: `${agentId}:${index % 2}`,
    agentId,
    edition: agentId === "trae" ? "china" : null,
    entryPath: `/private/tmp/habitat-first-run/${agentId}/${item.directoryName}${suffix}`,
    entryKind: index % 4 === 0 ? "symlink" : "directory",
    canonicalTarget: item.canonicalPath,
    artifactId: item.artifactId,
    identity: { device: 1, inode: index + 10, mode: 16877 },
    linkText: index % 4 === 0 ? `../../sources/${item.directoryName}` : null,
    diagnostic: null,
  };
}

const routes = artifacts.map((item, index) => route(item, index));
for (let index = 0; index < 5; index += 1) routes.push(route(artifacts[0], 40 + index, `-extra-${index}`));

export const firstRunQaSnapshot: InventorySnapshot = {
  snapshotId: "qa-first-run-organize",
  capturedAt: Date.UTC(2026, 7, 10, 1, 28),
  artifacts,
  routes,
  duplicateFingerprintGroups: duplicateDefinitions.map(([name]) => [`${name}-a`, `${name}-b`]),
  variantGroups: [
    ["project-harness-a", "project-harness-b"],
    ["planning-board-a", "planning-board-b"],
  ],
  diagnostics: blockedArtifacts.flatMap((item) => item.diagnostics),
};
