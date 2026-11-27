import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {CalendarDays,RefreshCw,ExternalLink,LocateFixed} from 'lucide-react';
import {normalizeCalendar,calendarTimeline,nearestCalendarItem,type CalendarData} from '../shared/model-calendar.mjs';
import './model-calendar.css';
const labels={released:'已发布',announced:'已官宣',predicted:'预测 · 非官宣'};
export function ModelCalendar(){
 const localDay=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
 const [today,setToday]=useState(localDay),[selectedId,setSelectedId]=useState<string|null>(null);
 const timeline=useRef<HTMLDivElement>(null),todayMarker=useRef<HTMLElement>(null),detailPane=useRef<HTMLDivElement>(null),pendingToday=useRef(true);
 useEffect(()=>{const timer=setInterval(()=>setToday(localDay()),30000);return()=>clearInterval(timer)},[]);
 function goToday(){const box=timeline.current,marker=todayMarker.current;if(box&&marker)box.scrollTop=Math.max(0,box.scrollTop+marker.getBoundingClientRect().top-box.getBoundingClientRect().top-box.clientHeight*.32)}
 const [data,setData]=useState<CalendarData|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const failedCursor=useRef(''),active=useRef<AbortController|null>(null),cursors=useRef(new Set<string>());
 async function load(before=''){
  if(!before)pendingToday.current=true;failedCursor.current=before;active.current?.abort();const controller=new AbortController();active.current=controller;setBusy(true);setError('');
  try{const r=await fetch('/api/model-calendar?'+new URLSearchParams({before}),{signal:controller.signal});const raw=await r.json();if(!r.ok)throw Error(raw.error||'日历加载失败');const next=normalizeCalendar(raw);if(controller.signal.aborted)return;
   if(before)cursors.current.add(before);else cursors.current.clear();
   if(next.nextCursor&&cursors.current.has(next.nextCursor))next.nextCursor=null;
   if(!before)setSelectedId(id=>next.items.some(item=>item.id===id)?id:nearestCalendarItem(next.items,today));
   setData(old=>before&&old?{...next,items:[...new Map([...old.items,...next.items].map(i=>[i.id,i])).values()]}:next);
  }catch(e){if(!controller.signal.aborted)setError((e as Error).message)}finally{if(!controller.signal.aborted)setBusy(false)}
 }
 useEffect(()=>{void load();return()=>active.current?.abort()},[]);
 const items=data?.items||[];
 const groups=calendarTimeline(items,today),selected=items.find(item=>item.id===selectedId)||items.find(item=>item.id===nearestCalendarItem(items,today));
 useLayoutEffect(()=>{if(!data||!pendingToday.current)return;const frame=requestAnimationFrame(()=>{goToday();pendingToday.current=false});return()=>cancelAnimationFrame(frame)},[data,today]);
 useEffect(()=>{if(detailPane.current)detailPane.current.scrollTop=0},[selected?.id]);

 function open(url:string){const desktop=(window as any).desktop;if(desktop)void desktop.openVisitLink(url);else window.open(url,'_blank','noopener,noreferrer')}
 return <section className="model-calendar" aria-label="模型发布日历"><header className="calendar-heading"><div><small>WEARIT · MODEL RADAR</small><h1><CalendarDays size={24}/>模型发布日历</h1><p>模型新动态、官方预告与发布历史，一眼看清。</p></div><button disabled={busy} onClick={()=>void load()}><RefreshCw size={14}/>{busy?'加载中…':'刷新'}</button></header>
 <div className="calendar-meta"><span>预测是来源判断，不代表官方发布时间；未定日期保持待定。</span>{data?.updatedAt&&<time>来源更新 {new Date(data.updatedAt).toLocaleString('zh-CN')}</time>}</div>
 {data?.stale&&<p className="calendar-warning" role="status">WearIT 标记当前资料可能过期，请结合官方来源核对。</p>}
 {error&&<div className="calendar-error" role="alert"><p>{error}</p><button disabled={busy} onClick={()=>void load(failedCursor.current)}>重试</button></div>}
 <div className="calendar-split">
 <div className="calendar-axis-column"><div className="calendar-axis-heading"><span>未发布 ↑ · 已发布 ↓</span><button onClick={goToday}><LocateFixed size={13}/>回到今天</button></div><div className="calendar-timeline" ref={timeline} role="navigation" aria-label="模型发布时间轴">
 {busy&&!data&&<p className="calendar-empty">正在获取模型日历…</p>}
 {groups.map(group=><section key={group.key} ref={group.today?todayMarker:undefined} className={'calendar-day '+group.phase+(group.today?' is-today':'')+(group.day?'':' is-undated')} data-today={group.today||undefined}><header><i/><time>{group.day?`${group.day.slice(5).replace('-',' / ')} · ${group.day.slice(0,4)}`:'时间待定'}</time>{group.today?<b>今天</b>:group.phase==='pending'?<em>未发布</em>:null}</header>
 {group.today&&!group.items.length&&<p className="calendar-day-empty">今天暂无发布</p>}
 {group.items.map(item=><button key={item.id} className={'calendar-node '+item.status+(selected?.id===item.id?' selected':'')} aria-label={item.model+' · '+labels[item.status]} aria-current={selected?.id===item.id?'true':undefined} onClick={()=>setSelectedId(item.id)}><span>{item.provider}</span><strong>{item.model}</strong><small>{labels[item.status]}</small></button>)}</section>)}
 {!busy&&data&&!items.length&&<p className="calendar-empty">暂无模型发布记录</p>}
 {data?.nextCursor&&<button className="calendar-more" disabled={busy} onClick={()=>void load(data.nextCursor!)}>{busy?'正在加载…':'加载更多发布历史'}</button>}
 </div></div>
 <div className="calendar-detail-pane" ref={detailPane} role="region" aria-label="模型详情" aria-live="polite">{selected?<article className={'calendar-card '+selected.status}><div className="calendar-card-top"><span className="calendar-provider">{selected.provider}</span><span className="calendar-status">{labels[selected.status]}</span></div><h2>{selected.model}</h2><div className="calendar-date">{selected.windowStart?selected.windowStart+(selected.windowEnd&&selected.windowEnd!==selected.windowStart?' — '+selected.windowEnd:''):'日期未定'}{selected.status==='predicted'&&<small>预测可信度：{({low:'低',medium:'中',high:'高'})[selected.confidence]}</small>}</div><h3>概览</h3><p>{selected.summary||'来源暂未提供摘要。'}</p>{selected.rationale&&<><h3>{selected.status==='predicted'?'预测依据':'背景说明'}</h3><p>{selected.rationale}</p></>}{selected.sources.length>0&&<div className="calendar-sources"><h3>来源与依据</h3>{selected.sources.map((source,index)=><button key={source.url+index} title={source.url} onClick={()=>open(source.url)}><ExternalLink size={12}/><span>{source.official?'官方 · ':''}{source.title}</span>{source.date&&<time>{source.date}</time>}</button>)}</div>}</article>:<div className="calendar-detail-empty"><CalendarDays size={32}/><h2>从左侧选择一个模型</h2><p>这里显示发布时间、介绍和来源依据。</p></div>}</div>
 </div></section>;
}
