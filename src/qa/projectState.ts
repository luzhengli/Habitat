import type {
  AgentId,
  AgentExposureInspection,
  ProjectExposureInspection,
  ProjectWorkspaceInspection,
  StoreScan,
  SupportTier,
} from "../types";

const definitions = [
  ["explain-and-quiz", "解释概念并生成测验", "1.0.4"],
  ["finding-unknowns", "发现信息缺口与验证路径", "1.2.3"],
  ["project-harness", "项目上下文与验证助手架", "1.0.0"],
  ["sharpen", "精炼方案与优化建议", "1.1.0"],
  ["habit-store", "技能库存储与管理", "0.9.1"],
  ["media-kit", "媒体资源工具集", "1.3.0"],
] as const;

export const projectQaStore: StoreScan = {
  root: "/private/tmp/habitat-project-v2/Skill Store",
  name: "Skill Store",
  skills: definitions.map(([name, description, version], index) => ({
    name,
    description,
    version,
    sourcePath: `/private/tmp/habitat-project-v2/Skill Store/${name}`,
    sourceKind: "directory",
    modifiedAt: Date.UTC(2026, 7, 10, 1, index),
  })),
};

const linked: Record<string, AgentId[]> = {
  "explain-and-quiz": ["codex", "pi", "cursor", "claude_code", "trae"],
  "finding-unknowns": ["codex", "pi", "cursor", "claude_code", "trae"],
  "project-harness": [],
  sharpen: ["codex", "pi", "cursor", "claude_code", "trae"],
  "habit-store": [],
  "media-kit": ["codex", "pi", "cursor", "claude_code", "trae"],
};

function agentState(skillName: string, agentId: AgentId): AgentExposureInspection {
  const expectedSatisfied = linked[skillName].includes(agentId);
  const groupRoot = agentId === "claude_code" ? ".claude/skills" : agentId === "trae" ? ".trae/skills" : ".agents/skills";
  const supportTier: SupportTier = agentId === "cursor" || agentId === "trae" ? "path_compatible" : "runtime_verified";
  const conflict = skillName === "media-kit" && agentId === "claude_code";
  return {
    agentId,
    targeted: true,
    expectedTarget: `/private/tmp/habitat-project-v2/media/${groupRoot}/${skillName}`,
    expectedSatisfied,
    effectiveState: conflict ? "conflict" : expectedSatisfied ? "available" : "unavailable",
    supportTier,
    runtimeVerified: supportTier === "runtime_verified",
    routes: [{
      scope: "project",
      relativeRoot: groupRoot,
      entryPath: `/private/tmp/habitat-project-v2/media/${groupRoot}/${skillName}`,
      condition: "active",
      state: conflict ? "conflicting" : expectedSatisfied ? "matching" : "absent",
      canonicalTarget: expectedSatisfied ? `${projectQaStore.root}/${skillName}` : null,
      detail: conflict ? "同名入口指向其他内容。" : expectedSatisfied ? "入口指向当前 Store Skill。" : "入口不存在。",
    }],
  };
}

const agentIds: AgentId[] = ["codex", "claude_code", "pi", "cursor", "trae"];

export const projectQaWorkspace: ProjectWorkspaceInspection = {
  registryVersion: "1",
  projectRoot: "/private/tmp/habitat-project-v2/media",
  skills: definitions.map(([skillName]): ProjectExposureInspection => ({
    registryVersion: "1",
    projectRoot: "/private/tmp/habitat-project-v2/media",
    skillName,
    sourcePath: `${projectQaStore.root}/${skillName}`,
    agents: agentIds.map((agentId) => agentState(skillName, agentId)),
  })),
};
