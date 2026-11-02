import React, { useEffect, useRef } from 'react';
import Icon from './Icon';
export function Button({ children, icon, onClick, variant = 'secondary', small = false, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {icon?: string; variant?: string; small?: boolean}) { return <button className={`btn btn-${variant} ${small ? 'btn-small' : ''} ${className}`} onClick={onClick} {...props}>{icon && <Icon name={icon}/>}<span>{children}</span></button>; }
export function Badge({ children, tone = 'neutral', dot = false }: {children?: React.ReactNode; tone?: string; dot?: boolean}) { return <span className={`badge badge-${tone}`}>{dot && <i />}{children}</span>; }
export function SkillMark({ skill, size = '' }: {skill: {color: string; icon: string}; size?: string}) { return <div className={`skill-mark color-${skill.color} ${size}`}><Icon name={skill.icon} size={size === 'large' ? 28 : 21}/></div>; }
export function Empty({ icon = 'search', title = '没有找到相关技能', children, action }: {icon?: string; title?: string; children?: React.ReactNode; action?: React.ReactNode}) { return <div className="empty"><div className="empty-icon"><Icon name={icon} size={27}/></div><h3>{title}</h3><div>{children}</div>{action}</div>; }
export function Toggle({ checked, onChange, label, disabled = false }: {checked: boolean; onChange: () => void; label: string; disabled?: boolean}) { return <button className={`toggle ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onChange}><span /></button>; }
export function Modal({ title, eyebrow, children, onClose, footer, wide = false, drawer = false, busy = false, contentKey = null, className = '', returnFocusRef }: {title: string; eyebrow?: string; children?: React.ReactNode; onClose: () => void; footer?: React.ReactNode; wide?: boolean; drawer?: boolean; busy?: boolean; contentKey?: string | null; className?: string; returnFocusRef?: React.RefObject<HTMLElement | null>}) {
    const ref = useRef<HTMLElement>(null), bodyRef = useRef<HTMLDivElement>(null), close = useRef(onClose);
    useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [contentKey]);
    close.current = onClose;
    useEffect(() => {
        const prev = document.activeElement;
        const scroll = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const el = ref.current;
        if (!el) return;
        const focusables = () => [...el.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]),select,textarea,[tabindex="0"]')].filter(x => x.offsetParent !== null);
        (focusables()[0] || el).focus();
        const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) {
            e.stopPropagation();
            close.current();
        } if (e.key === 'Tab') {
            const list = focusables();
            e.preventDefault();
            if (!list.length) {
                el.focus();
            } else {
                const index = list.indexOf(document.activeElement as HTMLElement);
                const next = index < 0
                    ? (e.shiftKey ? list.length - 1 : 0)
                    : (index + (e.shiftKey ? -1 : 1) + list.length) % list.length;
                list[next].focus();
            }
        } };
        document.addEventListener('keydown', key);
        return () => { document.removeEventListener('keydown', key); document.body.style.overflow = scroll; const target = returnFocusRef?.current ?? prev; if (target instanceof HTMLElement && target.isConnected) target.focus(); };
    }, [busy]);
    return <div className={`overlay ${drawer ? 'drawer-overlay' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget && !busy)
        onClose(); }}><section ref={ref} className={`modal ${wide ? 'modal-wide' : ''} ${drawer ? 'drawer' : ''} ${className}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabIndex={-1}><header className="modal-header"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2 id="dialog-title">{title}</h2></div><button className="icon-btn close-button" aria-label="关闭对话框" disabled={busy} onClick={onClose}><Icon name="close" size={18}/></button></header><div ref={bodyRef} className="modal-body">{children}</div>{footer && <footer className="modal-footer">{footer}</footer>}</section></div>;
}
export function Notice({ tone = 'info', children, title }: {tone?: string; children?: React.ReactNode; title?: string}) { return <div className={`notice notice-${tone}`}><Icon name={tone === 'warning' ? 'alert' : tone === 'success' ? 'checkCircle' : 'info'} size={16}/><div>{title && <strong>{title}</strong>}{children}</div></div>; }
