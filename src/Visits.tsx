import {PlayComposer} from './PlayComposer';
import React,{useState,useEffect} from 'react';
import {Creature} from './Creature';
import {Plus,Link as LinkIcon,DoorOpen} from 'lucide-react';
import './visits.css';
export type Visit={id:string;from:string;to:string;note:string;url:string;status:string;createdAt:number;expiresAt:number;reply?:string};
type Person={id:string;name:string;ownerName:string;skin:string};
const labels:Record<string,string>={pending:'等候回应',active:'正在串门',declined:'已婉拒',cancelled:'已取消',ended:'已告别',expired:'已到期'};
export function Visits({agent,agents,contacts,visits,act,disabled,initialTo='',onChooseFriends,historyOpen=false,onCloseHistory}:{agent:Person;agents:Person[];contacts:Person[];visits:Visit[];act:(path:string,data:unknown)=>Promise<boolean>;disabled:boolean;initialTo?:string;onChooseFriends?:()=>void;historyOpen?:boolean;onCloseHistory?:()=>void}){
 const [to,setTo]=useState(initialTo);const [showLink,setShowLink]=useState(false);const [note,setNote]=useState('');const [url,setUrl]=useState('');const [key,setKey]=useState(()=>crypto.randomUUID());const [reply,setReply]=useState('');
 useEffect(()=>{if(initialTo){setTo(initialTo);setComposing(true);setKey(crypto.randomUUID())}},[initialTo]);
 const mine=visits.filter(v=>v.from===agent.id||v.to===agent.id);const incoming=mine.filter(v=>v.to===agent.id&&v.status==='pending');const active=mine.find(v=>v.to===agent.id&&v.status==='active');const outgoing=mine.filter(v=>v.from===agent.id&&['pending','active'].includes(v.status));
 const [composing,setComposing]=useState(false);
 useEffect(()=>{setReply('')},[active?.id]);
 const person=(id:string)=>agents.find(a=>a.id===id);const action=(v:Visit,action:string,reply='')=>act('visits/action',{id:v.id,actor:agent.id,action,reply});
 const link=(v:Visit)=>v.url?<a href={v.url} target="_blank" rel="noopener noreferrer" onClick={e=>{if((window as any).desktop?.openVisitLink){e.preventDefault();void (window as any).desktop.openVisitLink(v.url)}}}>打开带来的链接 ↗</a>:null;
 const selected=contacts.find(c=>c.id===to)||contacts[0];
 const showCompose=composing||(!active&&!incoming.length&&!outgoing.length);
 if(historyOpen)return <div className="visits-panel visit-history-view"><div className="compact-row"><strong>往来记录</strong><button className="secondary-action" onClick={onCloseHistory}>返回</button></div>{!mine.length&&<p className="panel-empty">还没有往来记录。</p>}{mine.slice().reverse().slice(0,30).map(v=><article className="visit-record" key={v.id}><div className="compact-row"><strong>{v.from===agent.id?'拜访':'来自'}{person(v.from===agent.id?v.to:v.from)?.name||'好友'}</strong><small>{labels[v.status]||v.status}</small></div><p className="visit-note">{v.note}</p>{v.reply&&<p className="visit-reply">{v.reply}</p>}</article>)}</div>;
 return <div className="visits-panel">
 {active&&<article className="visit-active"><div className="visit-person"><Creature skin={person(active.from)?.skin||'taotao'} small/><div><strong>{person(active.from)?.name||'好友'}正在做客</strong><small>最多停留 5 分钟</small></div></div><p className="visit-note">{active.note}</p>{link(active)}<form onSubmit={async e=>{e.preventDefault();if(await action(active,'end',reply))setReply('')}}><textarea aria-label="捎回一句话" maxLength={1000} value={reply} onChange={e=>setReply(e.target.value)} placeholder="捎回一句话（选填）"/><button disabled={disabled}>送客</button></form></article>}
 {incoming.map(v=><article className="visit-item" key={v.id}><strong>{person(v.from)?.name||'好友'}来敲门</strong><p className="visit-note">{v.note}</p>{link(v)}<div className="visit-buttons"><button disabled={disabled||!!active} onClick={()=>action(v,'accept')}>请进</button><button disabled={disabled} onClick={()=>action(v,'decline')}>改天吧</button></div>{active&&<small>请先送走当前访客。</small>}</article>)}
 {outgoing.map(v=><article className="visit-item" key={v.id}><strong>{v.status==='active'?'正在拜访':'等待'}{person(v.to)?.name||'好友'}{v.status==='pending'?'回应':''}</strong><p className="visit-note">{v.note}</p><button className="secondary-action" disabled={disabled} onClick={()=>action(v,'cancel')}>{v.status==='active'?'叫助理回来':'取消敲门'}</button></article>)}
 {showCompose?<PlayComposer title="串门" icon={<DoorOpen size={18}/>} recipients={contacts} to={selected?.id||''} onSelect={id=>{setTo(id);setKey(crypto.randomUUID())}} message={note} onMessage={text=>{setNote(text);setKey(crypto.randomUUID())}} maxLength={1000} disabled={disabled} onChooseFriends={onChooseFriends} hint={`${selected?.name||'朋友'}开门后，${agent.name}会出现在对方桌面`} onSubmit={async()=>{if(!selected||!note.trim()||disabled)return;if(await act('visits',{from:agent.id,to:selected.id,note,url,key})){setNote('');setUrl('');setKey(crypto.randomUUID());setComposing(false)}}} actions={<><button type="button" aria-expanded={showLink} onClick={()=>setShowLink(!showLink)}><Plus size={13}/>{url?'已附链接':'链接'}{url&&<LinkIcon size={12}/>}</button><button type="submit" className="play-submit" disabled={disabled||!selected||!note.trim()}>敲门</button></>}>{showLink&&<div className="play-extra"><input aria-label="拜访链接" type="url" maxLength={2000} value={url} onChange={e=>{setUrl(e.target.value);setKey(crypto.randomUUID())}} placeholder="https://…"/></div>}</PlayComposer>:contacts.length>0&&<button className="secondary-action visit-another" onClick={()=>setComposing(true)}>去朋友那里坐坐</button>}

 </div>;
}
