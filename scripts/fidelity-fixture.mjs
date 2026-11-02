#!/usr/bin/env node
/**
 * Creates a disposable, real Catalog + Operations fixture for fidelity evidence.
 * It intentionally does not import the Air model or start HTTP.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Catalog } from '../apps/server/catalog.mjs';
import { Operations } from '../apps/server/operations.mjs';

const fixtureRoot = await fs.mkdtemp('/private/tmp/habitat-fidelity-');
const sourceRoot = path.join(fixtureRoot, 'source');
const dataDirectory = path.join(fixtureRoot, 'data');
const projectRoot = path.join(fixtureRoot, 'projects');

// These literals are explicit synthetic frontmatter inputs, copied from A0's
// visible display text. Catalog persists arbitrary frontmatter as metadata; that
// does not turn A0's display fields into production defaults or source facts.
const a0Skills = [
  { name: 'frontend-design', title: '界面设计', description: '把产品想法转化为精致、可交付的前端界面。', category: '开发工程', icon: 'pen', color: 'violet', version: 'v1.4.0', favorite: true },
  { name: 'rd-change-solution', title: '数仓影响评估', description: '分析研发变更的下游影响，生成可执行的兼容方案。', category: '数据分析', icon: 'database', color: 'blue', version: '开发版本', favorite: true },
  { name: 'doc-writing', title: '文档写作', description: '从零散材料出发，写出结构清晰、可行动的文档。', category: '内容创作', icon: 'file', color: 'amber', version: '未声明', favorite: false },
  { name: 'code-review', title: '代码审查', description: '在合并代码之前，检查质量、风险与潜在回归。', category: '开发工程', icon: 'code', color: 'green', version: 'v2.1.0', favorite: true },
  { name: 'web-research', title: '网络研究', description: '交叉核实来源，把复杂问题整理为有依据的结论。', category: '效率工具', icon: 'globe', color: 'teal', version: 'v1.2.0', favorite: false },
  { name: 'systematic-debugging', title: '系统化调试', description: '从复现到根因，用可验证的步骤解决棘手问题。', category: '开发工程', icon: 'bolt', color: 'rose', version: 'v1.0.3', favorite: false },
  { name: 'skill-creator', title: '技能创作', description: '把重复工作沉淀为能被 Agent 稳定复用的技能。', category: '效率工具', icon: 'sprout', color: 'green', version: 'v1.3.0', favorite: false },
  { name: 'git-workflow', title: 'Git 工作流', description: '规范分支与提交，让协作中的每次变更清晰可追溯。', category: '开发工程', icon: 'branch', color: 'slate', version: '未声明', favorite: false },
  { name: 'find-skills', title: '技能发现', description: '根据手头任务，找到值得尝试的新技能。', category: '效率工具', icon: 'compass', color: 'amber', version: 'v0.6.0', favorite: false }
];
const a0Projects = [
  ['habitat', 'Habitat'],
  ['warehouse-core', 'warehouse-core'],
  ['personal-site', 'personal-site']
];

const a0Bindings = {
  habitat: ['frontend-design', 'code-review', 'skill-creator'],
  'warehouse-core': ['rd-change-solution', 'systematic-debugging', 'doc-writing'],
  'personal-site': ['frontend-design', 'web-research']
};
const sourceDocument = skill => `---\nname: ${skill.name}\ndescription: ${skill.description}\ntitle: ${skill.title}\ncategory: ${skill.category}\nicon: ${skill.icon}\ncolor: ${skill.color}\nversion: ${skill.version}\n---\n\n# ${skill.title}\n\n这是用于 Habitat 高保真采证的合成、静态 Skill 内容。\n\n- 仅供本地只读索引与文本预览。\n- 不执行任何脚本，也不声明 Agent 已发现。\n`;

let catalog;
try {
  await fs.mkdir(sourceRoot, { recursive: true, mode: 0o700 });
  await fs.mkdir(projectRoot, { recursive: true, mode: 0o700 });
  for (const skill of a0Skills) {
    const skillDirectory = path.join(sourceRoot, skill.name);
    await fs.mkdir(path.join(skillDirectory, 'references'), { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(skillDirectory, 'SKILL.md'), sourceDocument(skill), { encoding: 'utf8', mode: 0o600 });
    await fs.writeFile(path.join(skillDirectory, 'references', 'guide.md'), `# ${skill.title} 参考\n\n合成 fixture；不执行。\n`, { encoding: 'utf8', mode: 0o600 });
  }

  catalog = new Catalog(dataDirectory);
  const source = await catalog.authorize({ absolutePath: sourceRoot, permission: 'read-only', confirm: true });
  const scan = await catalog.scan();
  const inventory = catalog.inventory();
  if (scan.status !== 'succeeded' || inventory.skills.length !== a0Skills.length) {
    throw new Error(`Expected ${a0Skills.length} indexed Skills, got ${inventory.skills.length} with scan status ${scan.status}.`);
  }

  const operations = new Operations(catalog);
  const projects = [];
  for (const [slug, a0Name] of a0Projects) {
    const directory = path.join(projectRoot, slug);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const project = await operations.project({ directory, writeScope: '.claude/skills', confirm: true });
    projects.push({ id: project.id, a0Id: slug, a0Name, name: project.name, path: project.path, writeScope: project.writeScope, revision: project.revision });
  }
  if (catalog.list('project').length !== a0Projects.length) throw new Error('Expected three registered projects.');

  for (const skill of inventory.skills.filter(skill => a0Skills.find(input => input.name === skill.declaredName)?.favorite)) {
    catalog.preferences(skill.id, { favorite: true });
  }
  const indexed = new Map(catalog.inventory().skills.map(skill => [skill.declaredName, skill]));
  const operationsByProject = [];
  for (const project of projects) {
    const names = a0Bindings[project.a0Id];
    const current = catalog.get('project', project.id);
    const plan = await operations.plan({ projectId: project.id, revision: current.revision, changes: names.map(name => ({ action: 'add', skillId: indexed.get(name)?.id })) });
    const operation = await operations.execute({ planId: plan.id, hash: plan.hash, idempotencyKey: `fidelity-${project.a0Id}-${randomUUID()}`, confirm: true });
    if (operation.status !== 'succeeded' || operation.steps.length !== names.length) throw new Error(`Expected ${names.length} successful bindings for ${project.a0Id}.`);
    const exposures = await operations.exposures(project.id);
    if (exposures.items.length !== names.length || !exposures.items.every(item => item.configured && item.discovery === 'unknown')) throw new Error(`Expected configured, discovery-unknown bindings for ${project.a0Id}.`);
    operationsByProject.push({ projectId: project.id, a0Id: project.a0Id, planId: plan.id, planHash: plan.hash, operationId: operation.id, status: operation.status, bindings: exposures.items.map(item => ({ skillId: item.skillId, name: item.name, target: item.target, configured: item.configured, discovery: item.discovery, message: item.message })) });
  }
  const configuredProjects = projects.map(project => ({ ...project, revision: catalog.get('project', project.id).revision }));
  const configuredInventory = catalog.inventory();
  const favorites = configuredInventory.skills.filter(skill => skill.favorite).map(skill => skill.declaredName);
  if (operationsByProject.flatMap(result => result.bindings).length !== 8 || favorites.length !== 3) throw new Error('Expected eight bindings and three favorites.');
  const manifest = {
    schemaVersion: 1,
    kind: 'habitat-fidelity-synthetic-fixture',
    createdAt: new Date().toISOString(),
    fixtureRoot,
    dataDirectory,
    roots: [sourceRoot],
    projectsRoot: projectRoot,
    serviceEnvironment: {
      HABITAT_DATA_DIR: dataDirectory,
      HABITAT_ROOTS: JSON.stringify([sourceRoot])
    },
    source: { id: source.id, path: source.path, permission: source.permission, kind: 'authorized-local-directory' },
    skills: a0Skills.map(input => {
      const skill = indexed.get(input.name);
      if (!skill || !skill.metadata || Object.keys(skill.metadata).length !== 7) throw new Error(`Missing complete metadata for ${input.name}.`);
      return {
        a0Name: input.name,
        a0Title: input.title,
        description: input.description,
        skillId: skill.id,
        sourceId: skill.sourceId,
        path: skill.path,
        fingerprint: skill.fingerprint,
        metadataStatus: skill.metadataStatus,
        metadata: skill.metadata,
        favorite: skill.favorite,
        honestMapping: 'title/category/icon/color/version are explicitly declared synthetic frontmatter. They are not verified origin, Git state, managed state, or an approved production presentation contract.'
      };
    }),
    projects: configuredProjects,
    operations: operationsByProject,
    favorites,
    honestLimitations: [
      'All nine Skills are one authorized local read-only source; this does not prove A0 GitHub, Claude Code, Codex, or shared-directory origins.',
      'Projects are registered with the only current adapter, Claude Code .claude/skills; no A0 shared/.agents groups or Agent discovery are created.',
      'Eight bindings were created only through Operations.plan and Operations.execute, then read back through Operations.exposures; discovery remains unknown.',
      'Three favorites were set through Catalog.preferences. No update, diagnostic, GitHub, Claude Code, Codex, or shared-directory source fact is preseeded.',
      'This fixture proves only synthetic material handled by the real Catalog and Operations modules.'
    ],
    runId: randomUUID()
  };
  const manifestPath = path.join(fixtureRoot, 'manifest.json');
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ manifestPath, dataDirectory, roots: [sourceRoot], projects: configuredProjects.map(project => project.path), bindings: operationsByProject.flatMap(result => result.bindings).length, favorites: favorites.length })}\n`);
} finally {
  catalog?.close();
}
