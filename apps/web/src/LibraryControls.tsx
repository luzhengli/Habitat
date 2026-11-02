import Icon from './components/Icon';

export type LibraryFilter = 'all' | 'favorite' | 'managed' | 'observed';
export type LibraryView = 'grid' | 'list';
export type LibrarySort = 'recent' | 'name' | 'usage';

export interface LibraryControlsProps {
  counts: Record<LibraryFilter, number>;
  filter: LibraryFilter;
  onFilter: (filter: LibraryFilter) => void;
  view: LibraryView;
  onView: (view: LibraryView) => void;
  query: string;
  onQuery: (query: string) => void;
  category: string;
  categories: readonly string[];
  onCategory: (category: string) => void;
  sort: LibrarySort;
  onSort: (sort: LibrarySort) => void;
  count: number;
}

export default function LibraryControls({
  counts,
  filter,
  onFilter,
  view,
  onView,
  query,
  onQuery,
  category,
  categories,
  onCategory,
  sort,
  onSort,
  count
}: LibraryControlsProps) {
  return <>
    <div className="library-tabs"><div className="tabs" role="tablist" aria-label="技能范围">{[['all', '全部技能', counts.all], ['favorite', '已收藏', counts.favorite], ['managed', '已托管', counts.managed], ['observed', '仅收录', counts.observed]].map(([id, label, tabCount]) => <button role="tab" aria-selected={filter === id} className={filter === id ? 'active' : ''} key={id} onClick={() => onFilter(id as LibraryFilter)}>{label}<span>{tabCount}</span></button>)}</div><div className="segmented"><button className={view === 'grid' ? 'active' : ''} aria-label="卡片视图" aria-pressed={view === 'grid'} onClick={() => onView('grid')}><Icon name="grid" size={14}/></button><button className={view === 'list' ? 'active' : ''} aria-label="列表视图" aria-pressed={view === 'list'} onClick={() => onView('list')}><Icon name="list" size={14}/></button></div></div>
    <div className="library-toolbar"><label className="search-input"><Icon name="search" size={14}/><input placeholder="搜索名称、用途或来源…" aria-label="搜索技能" value={query} onChange={event => onQuery(event.target.value)}/>{query && <button aria-label="清空搜索" onClick={() => onQuery('')}><Icon name="close" size={12}/></button>}</label><label className="select-wrap"><Icon name="filter" size={12}/><select aria-label="筛选分类" value={category} onChange={event => onCategory(event.target.value)}>{categories.map(value => <option key={value}>{value}</option>)}</select><Icon name="down" size={9}/></label><span className="result-count">{count} 项技能</span><label className="sort-wrap"><select aria-label="技能排序" value={sort} onChange={event => onSort(event.target.value as LibrarySort)}><option value="recent">最近收录</option><option value="name">名称排序</option><option value="usage">项目使用最多</option></select><Icon name="down" size={9}/></label></div>
  </>;
}
