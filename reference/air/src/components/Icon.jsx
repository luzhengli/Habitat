import React from 'react';
import icons from '../icon-data.json';
export default function Icon({ name, size = 16, className = '', ...rest }) {
    const [w, h, paths] = icons[name] || icons.box;
    return <svg width={size} height={size} viewBox={`0 0 ${w} ${h}`} fill="currentColor" aria-hidden="true" className={`icon ${className}`} {...rest}>{(Array.isArray(paths) ? paths : [paths]).map((d, i) => <path d={d} key={i}/>)}</svg>;
}
