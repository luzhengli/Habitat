export type Skill = {
  name: string;
  description: string;
  version: string;
  sourcePath: string;
  sourceKind: string;
  modifiedAt: number;
};

export type StoreScan = { root: string; name: string; skills: Skill[] };

export type LinkState = "available" | "valid" | "broken" | "conflict" | "outside_store";

export type ProjectSkill = {
  name: string;
  targetPath: string;
  relativeTarget: string | null;
  state: LinkState;
  detail: string;
};

export type ProjectScan = {
  root: string;
  name: string;
  skillsDirectory: string;
  links: ProjectSkill[];
};

export type CheckItem = {
  id: string;
  label: string;
  status: "pass" | "warning" | "fail";
  detail: string;
  recovery: string | null;
};

export type Preflight = {
  sourcePath: string;
  targetPath: string;
  relativeLink: string;
  canLink: boolean;
  alreadyLinked: boolean;
  checks: CheckItem[];
};

export type CommandResult = {
  program: string;
  args: string[];
  cwd: string;
  status: number | null;
  success: boolean;
  stdout: string;
  stderr: string;
};

export type AppError = {
  code?: string;
  message?: string;
  stderr?: string;
  recovery?: string;
};
