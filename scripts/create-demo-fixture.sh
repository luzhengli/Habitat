#!/usr/bin/env bash
set -euo pipefail

fixture_root="$(mktemp -d "${TMPDIR:-/tmp}/habitat-demo.XXXXXX")"
test -n "${fixture_root:?}"
store_path="${fixture_root}/habitat-store"
project_path="${fixture_root}/media"
conflict_path="${fixture_root}/media-conflict"

mkdir -p "${store_path}/finding-unknowns" "${store_path}/sharpen"
mkdir -p "${store_path}/.agents/skills/explain-and-quiz" "${store_path}/.agents/skills/project-harness"

printf '%s\n' '---' 'name: finding-unknowns' 'description: 发现信息缺口与验证路径' 'version: 1.2.3' '---' > "${store_path}/finding-unknowns/SKILL.md"
printf '%s\n' '---' 'name: sharpen' 'description: 精炼方案与优化建议' 'version: 1.1.0' '---' > "${store_path}/sharpen/SKILL.md"
printf '%s\n' '---' 'name: explain-and-quiz' 'description: 解释概念并生成测验' 'version: 1.0.4' '---' > "${store_path}/.agents/skills/explain-and-quiz/SKILL.md"
printf '%s\n' '---' 'name: project-harness' 'description: 项目上下文与验证助手架' 'version: 1.0.0' '---' > "${store_path}/.agents/skills/project-harness/SKILL.md"

create_project() {
  local destination="$1"
  mkdir -p "${destination}/.agents/skills"
  printf '%s\n' '# Habitat temporary fixture' > "${destination}/README.md"
  ln -s ../../../habitat-store/finding-unknowns "${destination}/.agents/skills/finding-unknowns"
  ln -s ../../../habitat-store/sharpen "${destination}/.agents/skills/sharpen"
  ln -s ../../../habitat-store/.agents/skills/explain-and-quiz "${destination}/.agents/skills/explain-and-quiz"
  git -C "${destination}" init -q
  git -C "${destination}" config user.name "Habitat Fixture"
  git -C "${destination}" config user.email "fixture@habitat.local"
  git -C "${destination}" add README.md .agents/skills
  git -C "${destination}" commit -qm "Create Habitat fixture"
}

create_project "${project_path}"
create_project "${conflict_path}"
mkdir "${conflict_path}/.agents/skills/project-harness"

printf '{\n'
printf '  "root": "%s",\n' "${fixture_root}"
printf '  "store": "%s",\n' "${store_path}"
printf '  "project": "%s",\n' "${project_path}"
printf '  "conflictProject": "%s"\n' "${conflict_path}"
printf '}\n'
