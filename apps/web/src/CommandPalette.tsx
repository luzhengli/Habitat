import { useState, type RefObject } from 'react';
import Icon from './components/Icon';
import { Badge, Empty, Modal, SkillMark } from './components/UI';

export interface CommandPaletteSkill {
  id: string;
  name: string;
  title: string;
  icon: string;
  color: string;
}

export interface CommandPaletteProject {
  id: string;
  name: string;
}

export interface CommandPaletteProps {
  returnFocusRef?: RefObject<HTMLElement | null>;
  skills: CommandPaletteSkill[];
  projects: CommandPaletteProject[];
  issueCount: number;
  onClose: () => void;
  onSkill: (id: string) => void;
  onProject: (id: string) => void;
  onPage: (page: 'issues') => void;
  onAdd: () => void;
}

export function CommandPalette({
  returnFocusRef,
  skills: allSkills,
  projects: allProjects,
  issueCount,
  onClose,
  onSkill,
  onPage,
  onProject,
  onAdd,
}: CommandPaletteProps) {
  const [q, setQ] = useState('');
  const match = (text: string) => !q || text.toLowerCase().includes(q.toLowerCase());
  const skills = allSkills.filter((skill) => match(`${skill.name} ${skill.title}`));
  const projects = allProjects.filter((project) => match(project.name));

  return <Modal title="去你想去的地方" eyebrow="快速查找" className="command-modal" onClose={onClose} returnFocusRef={returnFocusRef}>
    <label className="command-search">
      <Icon name="search" size={17}/>
      <input autoFocus aria-label="全局搜索" placeholder="搜索技能、项目或操作…" value={q} onChange={(event) => setQ(event.target.value)}/>
      <kbd>ESC</kbd>
    </label>
    <div className="command-results">
      {!q && <>
        <h4>快捷操作</h4>
        <button onClick={onAdd}><Icon name="plus"/><span>添加一个 Skill</span><Icon name="arrow" size={10}/></button>
        <button onClick={() => onPage('issues')}><Icon name="alert"/><span>处理配置问题</span><Badge>{issueCount}</Badge></button>
      </>}
      {skills.length > 0 && <h4>技能</h4>}
      {skills.map((skill) => <button key={skill.id} onClick={() => onSkill(skill.id)}>
        <SkillMark skill={skill} size="tiny"/>
        <span>{skill.title}<small>{skill.name}</small></span>
        <Icon name="arrow" size={10}/>
      </button>)}
      {projects.length > 0 && <h4>项目</h4>}
      {projects.map((project) => <button key={project.id} onClick={() => onProject(project.id)}>
        <Icon name="folder"/>
        <span>{project.name}</span>
        <Icon name="arrow" size={10}/>
      </button>)}
      {!skills.length && !projects.length && q && <Empty title="没有匹配项">试试 Skill 名称或项目名。</Empty>}
    </div>
  </Modal>;
}
