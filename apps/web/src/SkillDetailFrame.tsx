import type { ReactNode } from 'react';
import Icon from './components/Icon';
import { Badge, Button, Modal, SkillMark } from './components/UI';

export type SkillDetailTab = 'overview' | 'usage' | 'files' | 'versions';

export interface SkillDetailOverview {
  whenToUse: ReactNode;
  example: ReactNode;
  onCopyExample: () => void;
  origin: ReactNode;
  management: ReactNode;
  version: ReactNode;
  sourcePath: ReactNode;
  showTechnicalPath?: boolean;
}

export interface SkillDetailFrameProps {
  name: string;
  title: string;
  description: string;
  origin: string;
  icon: string;
  color: string;
  version?: ReactNode;
  managementLabel: string;
  managementTone: string;
  favorite: boolean;
  usageCount: number;
  detailTab: SkillDetailTab;
  onDetailTab: (tab: SkillDetailTab) => void;
  onClose: () => void;
  onFavorite: () => void;
  onUseProject: () => void;
  overview: SkillDetailOverview;
  children?: ReactNode;
}

export default function SkillDetailFrame({
  name,
  title,
  description,
  icon,
  color,
  version,
  managementLabel,
  managementTone,
  favorite,
  usageCount,
  detailTab,
  onDetailTab,
  onClose,
  onFavorite,
  onUseProject,
  overview,
  children
}: SkillDetailFrameProps) {
  return <Modal drawer title={title} eyebrow="技能详情" onClose={onClose} footer={<><Button icon="star" onClick={onFavorite}>{favorite ? '已收藏' : '收藏'}</Button><Button variant="primary" icon="plus" onClick={onUseProject}>用于项目</Button></>}>
    <div className="detail-hero"><SkillMark skill={{ icon, color }} size="large"/><div><div className="detail-slug">{name}</div>{version && <span>{version}</span>}<Badge tone={managementTone}>{managementLabel}</Badge></div></div><p className="detail-description">{description}</p>
    <div className="tabs detail-tabs">{[['overview', '概览'], ['usage', '使用位置'], ['files', '文件'], ['versions', '版本']].map(([id, tabTitle]) => <button className={detailTab === id ? 'active' : ''} key={id} onClick={() => onDetailTab(id as SkillDetailTab)}>{tabTitle}{id === 'usage' && <span>{usageCount}</span>}</button>)}</div>
    {detailTab === 'overview' ? <><section className="detail-section"><h3>什么时候使用</h3><p>{overview.whenToUse}</p></section><section className="detail-section"><h3>试着这样开始<span>用法示例</span></h3><div className="prompt-box"><p>{overview.example}</p><button onClick={overview.onCopyExample}><Icon name="copy" size={12}/>复制示例</button></div><small className="muted">这是示例提示词，不会启动 Agent 或保证技能被调用。</small></section><section className="detail-section"><h3>来源与管理</h3><dl className="detail-facts"><div><dt>收录来源</dt><dd>{overview.origin}</dd></div><div><dt>管理关系</dt><dd>{overview.management}</dd></div><div><dt>内容版本</dt><dd>{overview.version}</dd></div></dl><details open={overview.showTechnicalPath || undefined}><summary>查看技术路径 <Icon name="down" size={9}/></summary><code className="path-code">{overview.sourcePath}</code></details></section></> : children}
  </Modal>;
}
