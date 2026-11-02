import Icon from './components/Icon';
import { SkillMark } from './components/UI';

export interface SkillCardProps {
  name: string;
  title: string;
  description: string;
  origin: string;
  icon: string;
  color: string;
  favorite: boolean;
  managementLabel: string;
  usageCount: number;
  updateLabel?: string;
  onOpen: () => void;
  onFavorite: () => void;
  onUsage: () => void;
  onUseProject: () => void;
  onUpdate?: () => void;
}

export default function SkillCard({
  name,
  title,
  description,
  origin,
  icon,
  color,
  favorite,
  managementLabel,
  usageCount,
  updateLabel,
  onOpen,
  onFavorite,
  onUsage,
  onUseProject,
  onUpdate
}: SkillCardProps) {
  return <article className={`skill-card ${updateLabel ? 'has-update' : ''}`}>
    <div className="card-top"><SkillMark skill={{ icon, color }}/><button className="card-title" onClick={onOpen}><h3>{title}</h3><span className="origin" title={origin}>{origin}</span></button><button className={`favorite-button ${favorite ? 'saved' : ''}`} aria-label={`${favorite ? '取消收藏' : '收藏'} ${name}`} aria-pressed={favorite} onClick={onFavorite}><Icon name={favorite ? 'starSolid' : 'star'} size={15}/></button></div>
    <button className="card-content" aria-label={`查看 ${name} 详情`} onClick={onOpen}><span className="sr-only skill-slug">{name}</span><p>{description}</p></button>
    <div className="card-meta"><button className="usage-count" onClick={onUsage}><Icon name="folder" size={13}/>{usageCount ? `${usageCount} 个项目` : '尚未用于项目'}</button><span className="metadata-dot">·</span>{updateLabel ? <button className="update-badge" onClick={onUpdate}>{updateLabel}</button> : <span className="ownership">{managementLabel}</span>}<button className="card-use" onClick={onUseProject} aria-label={`将 ${name} 用于项目`}>使用<Icon name="arrow" size={12}/></button></div>
  </article>;
}
