import {useEffect,useState} from 'react';
import {request} from './client';
import {Button,Empty,Notice} from './components/UI';
import type {Inventory} from './types';
export default function Diagnostics({inventory}:{inventory:Inventory|null}){
 const [items,setItems]=useState<{name:string;message:string;configured:boolean}[]>([]),[error,setError]=useState('');
 async function refresh(){try{const projects=await request<{items:{id:string;name:string}[]}>('projects');const result=[];for(const project of projects.items){const exposure=await request<{items:{name:string;message:string;configured:boolean}[]}>(`projects/${project.id}/exposures`);result.push(...exposure.items.map(b=>({...b,name:`${project.name} / ${b.name}`})));}setItems(result);}catch(e){setError(String(e));}}
 useEffect(()=>{refresh();},[]);
 return <><Button onClick={refresh}>重新检查项目入口</Button><Notice>检查只读文件和受管指纹，不运行 Agent。未授权的个人、企业及父目录范围保持未知。</Notice>{error&&<Notice tone="warning">{error}</Notice>}{inventory?.diagnostics.map((d,i)=><Notice key={i} tone="warning" title={d.code}><p>{d.message}</p><code>{d.root}</code><p>建议核对来源权限、名称或内容；不会自动覆盖或修复。</p></Notice>)}{items.map((i,n)=><Notice key={n} tone={i.configured?'info':'warning'} title={i.name}>{i.message}</Notice>)}{!items.length&&!inventory?.diagnostics.length&&<Empty title="当前检查范围内没有报告问题">Agent 实测发现：未知。范围外状态：未知。</Empty>}</>;
}
