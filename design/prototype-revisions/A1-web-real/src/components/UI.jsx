import React, { useEffect, useRef } from 'react';
import Icon from './Icon';
export function Button({ children, icon, onClick, variant = 'secondary', small = false, className = '', ...props }) { return <button className={`btn btn-${variant} ${small ? 'btn-small' : ''} ${className}`} onClick={onClick} {...props}>{icon && <Icon name={icon}/>}<span>{children}</span></button>; }
export function Badge({ children, tone = 'neutral', dot = false }) { return <span className={`badge badge-${tone}`}>{dot && <i />}{children}</span>; }
export function SkillMark({ skill, size = '' }) { return <div className={`skill-mark color-${skill.color} ${size}`}><Icon name={skill.icon} size={size === 'large' ? 28 : 21}/></div>; }
export function AgentChips({ groups = ['shared', 'claude'], small = false }) { return <div className={`agent-chips ${small ? 'small' : ''}`}>{groups.includes('shared') && <span className="agent-chip unsupported" title="首发尚未实现这些项目适配"><Icon name="terminal" size={11}/>{small ? '其他工具 · 未支持' : 'Codex / Pi / Cursor · 未支持'}</span>}{groups.includes('claude') && <span className="agent-chip claude"><Icon name="bolt" size={11}/>Claude Code · 可配置</span>}</div>; }
export function Empty({ icon = 'search', title = '没有找到相关技能', children, action }) { return <div className="empty"><div className="empty-icon"><Icon name={icon} size={27}/></div><h3>{title}</h3><p>{children}</p>{action}</div>; }
export function Toggle({ checked, onChange, label, disabled = false }) { return <button className={`toggle ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onChange}><span /></button>; }
export function Modal({ title, eyebrow, children, onClose, footer, wide = false, drawer = false, busy = false, contentKey = null, className = '' }) {
    const ref = useRef(null), bodyRef = useRef(null), close = useRef(onClose);
    useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [contentKey]);
    close.current = onClose;
    useEffect(() => {
        const prev = document.activeElement;
        const scroll = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const el = ref.current;
        const focusables = () => [...el.querySelectorAll('button:not([disabled]), input:not([disabled]),select,textarea,[tabindex="0"]')].filter(x => x.offsetParent !== null);
        (focusables()[0] || el).focus();
        const key = e => { if (e.key === 'Escape' && !busy) {
            e.stopPropagation();
            close.current();
        } if (e.key === 'Tab') {
            const list = focusables();
            const first = list[0], last = list[list.length - 1];
            if (!first) {
                e.preventDefault();
                el.focus();
            }
            else if (!el.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
            else if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
            else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        } };
        document.addEventListener('keydown', key);
        return () => { document.removeEventListener('keydown', key); document.body.style.overflow = scroll; prev?.focus?.(); };
    }, [busy]);
    return <div className={`overlay ${drawer ? 'drawer-overlay' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget && !busy)
        onClose(); }}><section ref={ref} className={`modal ${wide ? 'modal-wide' : ''} ${drawer ? 'drawer' : ''} ${className}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabIndex={-1}><header className="modal-header"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2 id="dialog-title">{title}</h2></div><button className="icon-btn close-button" aria-label="关闭对话框" disabled={busy} onClick={onClose}><Icon name="close" size={18}/></button></header><div ref={bodyRef} className="modal-body">{children}</div>{footer && <footer className="modal-footer">{footer}</footer>}</section></div>;
}
export function Notice({ tone = 'info', children, title }) { return <div className={`notice notice-${tone}`}><Icon name={tone === 'warning' ? 'alert' : tone === 'success' ? 'checkCircle' : 'info'} size={16}/><div>{title && <strong>{title}</strong>}{children}</div></div>; }
