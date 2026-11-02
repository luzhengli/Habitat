import React from 'react';
import iconData from '../icon-data.json';
const icons = iconData as unknown as Record<string, [number, number, string | string[]]>;
export default function Icon({ name, size = 16, className = '', ...rest }: React.SVGProps<SVGSVGElement> & {name: string; size?: number}) {
    const [w, h, paths] = Object.hasOwn(icons, name) ? icons[name] : icons.box;
    return <svg width={size} height={size} viewBox={`0 0 ${w} ${h}`} fill="currentColor" aria-hidden="true" className={`icon ${className}`} {...rest}>{(Array.isArray(paths) ? paths : [paths]).map((d, i) => <path d={d} key={i}/>)}</svg>;
}
