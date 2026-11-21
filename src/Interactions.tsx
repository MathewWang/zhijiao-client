import {PlayComposer} from './PlayComposer';
import React,{useEffect,useRef,useState} from 'react';
import {Flower2,Sparkles,X,Play} from 'lucide-react';
import {CompanionAvatar} from './CompanionAvatar';
import type {CloudState} from './CloudPanel';
import './interactions.css';
export type Interaction={id:string;from:string;to:string;status:string;attempt:number;expiresAt:number;reply?:string;plan:{protocol:string;version:number;intent:{kind:string;message:string;brief:string};presentation:{durationSeconds:number};artifact?:{html:string;sha256:string}}};
export type Effect={id:string;attempt:number;status:string;error?:string};
type Screen={id:string;html:string;duration:number;preview?:boolean;repair?:boolean};
const labels:Record<string,string>={pending:'等待接收',accepted:'正在处理',ready:'等待展示',playing:'正在展示',completed:'展示结束',declined:'已拒绝',cancelled:'已撤回',expired:'已过期',failed:'运行失败'};
const catalog=[{id:'gift.flowers',name:'送花',icon:Flower2,brief:'一束花缓缓展开，搭配柔和花瓣与祝福文字。'},{id:'celebration.fireworks',name:'烟花',icon:Sparkles,brief:'深色夜空中绽放几束绚丽烟花，最后出现祝福文字。'}];
export function Interactions({cloud,effects,initialKind,act,disabled,onChooseFriends,historyOpen=false,onCloseHistory}:{cloud?:CloudState;effects:Effect[];initialKind:string;act:(path:string,data:unknown)=>Promise<boolean>;disabled:boolean;onChooseFriends?:()=>void;historyOpen?:boolean;onCloseHistory?:()=>void}){
 const [kind,setKind]=useState(initialKind||catalog[0].id),[to,setTo]=useState(''),[message,setMessage]=useState(''),[brief,setBrief]=useState(''),[cost,setCost]=useState(false),[plan,setPlan]=useState<Interaction['plan']|null>(null),[key,setKey]=useState(''),[working,setWorking]=useState(false),[error,setError]=useState(''),[screen,setScreen]=useState<Screen|null>(null),[reply,setReply]=useState(''),[previewed,setPreviewed]=useState(false);
 const [acceptCost,setAcceptCost]=useState<Record<string,boolean>>({});const frame=useRef<HTMLIFrameElement>(null);const finishing=useRef(false);const activeScreen=useRef<Screen|null>(null);const failing=useRef(false);
 const friends=cloud?.directory.filter(p=>cloud.friends.includes(p.id))||[],self=cloud?.deviceId;
 const items=[...(cloud?.interactions||[])].reverse(),selected=catalog.find(c=>c.id===kind)||catalog[0];
 function resetPlan(){setPlan(null);setPreviewed(false);setError('')}
 useEffect(()=>{setKind(initialKind||catalog[0].id);resetPlan();setBrief('')},[initialKind]);
 useEffect(()=>{if(!friends.some(p=>p.id===to&&(p.interactionProtocol||0)>=2))setTo(friends.find(p=>(p.interactionProtocol||0)>=2)?.id||'')},[friends.map(p=>p.id+':'+p.interactionProtocol).join(','),to]);
 useEffect(()=>{activeScreen.current=screen},[screen]);
 useEffect(()=>()=>{const s=activeScreen.current;if(s&&!s.preview)void act('interactions/action',{id:s.id,action:'complete'});},[]);
 async function request(path:string,body:unknown){const r=await fetch('/api/interactions/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error);return data;}
 async function draft(){setWorking(true);resetPlan();try{const data=await request('draft',{kind,message,brief:brief||selected.brief,confirmCost:cost});setPlan(data.plan);setKey(crypto.randomUUID());}catch(e){setError((e as Error).message)}finally{setWorking(false)}}
 async function preview(){if(!plan)return;setWorking(true);setError('');try{const data=await request('preview',{plan,to});finishing.current=false;failing.current=false;setScreen({id:'preview',html:data.html,duration:plan.presentation.durationSeconds,preview:true});setPreviewed(true);}catch(e){setError((e as Error).message)}finally{setWorking(false)}}
 async function show(i:Interaction,repair=false){const r=await fetch('/api/interactions/artifact?id='+encodeURIComponent(i.id));const data=await r.json();if(!r.ok)throw Error(data.error);setReply('');finishing.current=false;failing.current=false;setScreen({id:i.id,html:data.html,duration:i.plan.presentation.durationSeconds,repair});}
 async function start(i:Interaction,action='accept',allowRepair=false){setWorking(true);setError('');try{if(!await act('interactions/action',{id:i.id,action,confirmCost:action==='repair'||i.plan.version===1}))return;if(action==='repair'&&!await act('interactions/action',{id:i.id,action:'play'}))return;if(i.plan.version===2||action==='play')await show(i,allowRepair);}catch(e){setError((e as Error).message)}finally{setWorking(false)}}
 async function finish(text=''){const s=activeScreen.current;if(!s||finishing.current)return;finishing.current=true;activeScreen.current=null;setScreen(null);if(!s.preview)await act('interactions/action',{id:s.id,action:'complete',reply:text});finishing.current=false;}
 useEffect(()=>{if(!screen)return;const handler=(event:MessageEvent)=>{
  if(event.source!==frame.current?.contentWindow||event.data?.type!=='zhijiao.effect-error'||failing.current)return;
  failing.current=true;const s=screen;activeScreen.current=null;setScreen(null);const detail=String(event.data.error||'脚本运行失败').slice(0,600);
  if(s.preview){setPreviewed(false);setError('预览运行出错，请重新制作效果。'+detail);return;}
  void(async()=>{setWorking(true);try{if(!await act('interactions/action',{id:s.id,action:'fail',error:detail}))return;if(s.repair){setError('效果运行出错，Agent 正在尝试修复…');if(await act('interactions/action',{id:s.id,action:'repair',error:detail,confirmCost:true})){const i=items.find(i=>i.id===s.id);if(i&&await act('interactions/action',{id:s.id,action:'play'})){setError('');await show(i,false);}}}else setError('效果运行出错，可授权 Agent 修复后再播放。');}catch(e){setError((e as Error).message)}finally{setWorking(false)}})();
 };window.addEventListener('message',handler);return()=>window.removeEventListener('message',handler)},[screen?.id,screen?.html]);
 useEffect(()=>{if(!screen)return;const t=setTimeout(()=>void finish(''),screen.duration*1000);return()=>clearTimeout(t)},[screen]);
 async function submit(){if(!plan){if(cost&&to&&message.trim())void draft();return;}if(!previewed)return;setWorking(true);try{if(await act('interactions/send',{to,key,plan})){resetPlan();setMessage('')}}finally{setWorking(false)}}
 return <div className="interaction-panel">
 {!historyOpen&&<PlayComposer title={selected.name} icon={<selected.icon size={18}/>} recipients={friends.map(p=>({id:p.id,name:p.profile?.name||p.name,skin:p.profile?.skin,online:p.online,unavailable:(p.interactionProtocol||0)<2?'需升级客户端':undefined}))} to={to} onSelect={id=>{setTo(id);setPreviewed(false)}} message={message} onMessage={text=>{setMessage(text);resetPlan()}} maxLength={500} disabled={disabled||working} onChooseFriends={onChooseFriends} onSubmit={()=>void submit()} hint={plan?'完整效果随邀请发出，对方同意后立即播放。':'先在本机制作并预览，再发送给好友。'} actions={<>{plan&&<button type="button" disabled={working||disabled} onClick={()=>void preview()}><Play size={14}/>{previewed?'再次预览':'预览效果'}</button>}<button type="submit" className="play-submit" disabled={disabled||working||!to||!message.trim()||(!plan&&!cost)||!!plan&&!previewed}>{working?'正在处理…':plan?'发送效果':'制作效果'}</button></>}>
 <details className="play-extra"><summary>创作要求</summary><textarea aria-label="互动创作要求" maxLength={2000} placeholder={selected.brief} value={brief} onChange={e=>{setBrief(e.target.value);resetPlan()}} disabled={working}/></details>
 {!plan&&<label className="play-cost"><input type="checkbox" checked={cost} onChange={e=>setCost(e.target.checked)} disabled={working}/><span>同意让 Agent 制作完整效果，可能消耗模型额度。</span></label>}
 {plan&&<div className="interaction-plan"><strong>效果已制作</strong><p>{plan.intent.message}</p><small>{previewed?'已打开预览，请确认效果满意后发送。':'先预览效果，再确认发送。'}</small><button type="button" onClick={resetPlan} disabled={working}>重新制作</button></div>}
 </PlayComposer>}
 {error&&<p role="alert" className="lite-error">{error}</p>}
 {historyOpen&&<><div className="compact-row"><strong>往来记录</strong><button type="button" className="secondary-action" onClick={onCloseHistory}>返回</button></div>
 {!items.length&&<p className="lite-hint">收到的心意和发送结果会留在这里，也会在聊天中提醒你。</p>}
 {items.map(i=>{const incoming=i.to===self,prepared=i.plan.version===2,peer=cloud?.directory.find(p=>p.id===(incoming?i.from:i.to)),local=effects.find(e=>e.id===i.id&&e.attempt===i.attempt),generating=local?.status==='generating',finished=local?.status==='completed';return <article className="interaction-card" key={i.id}>
 <header><CompanionAvatar skin={peer?.profile?.skin} name={peer?.profile?.name||peer?.name||'好友'}/><div><strong>{incoming?'来自':'送给'} {peer?.profile?.name||peer?.name||'好友'}</strong><small>{catalog.find(c=>c.id===i.plan.intent.kind)?.name||'互动'} · {finished&&i.status==='playing'?'结果等待同步':labels[i.status]}</small></div></header>
 <p>{i.plan.intent.message}</p><details><summary>查看创作说明</summary><p>{i.plan.intent.brief}</p></details>
 {local?.error&&!finished&&<p className="lite-error">{local.error}</p>}
 {incoming&&(i.status==='pending'||i.status==='failed'||!prepared&&i.status==='accepted'&&!local)&&<>
 {(i.status==='pending'||i.attempt<2||!prepared)&&<label className="interaction-check"><input type="checkbox" checked={!!acceptCost[i.id]} onChange={e=>setAcceptCost({...acceptCost,[i.id]:e.target.checked})}/><span>{prepared?'运行报错时允许本机 Agent 尝试修复一次（可能消耗模型额度）。':'旧版邀请：允许本机 Agent 创作效果（可能消耗模型额度）。'}</span></label>}
 <small>{prepared?'效果已由发送方制作，仅在隔离容器运行；同意后直接播放。':'这是旧版方案邀请，接收后仍需等待创作。'}</small>
 <div className="interaction-actions">{i.status==='failed'&&prepared?i.attempt<2?<button disabled={disabled||working||!acceptCost[i.id]} onClick={()=>void start(i,'repair')}>修复后播放</button>:<small>已尝试修复，请让发送方重新制作。</small>:<button disabled={disabled||working||!prepared&&!acceptCost[i.id]||generating} onClick={()=>void start(i,'accept',!!acceptCost[i.id])}>{prepared?'同意并播放':i.status==='failed'?'重新创作':'接收并创作'}</button>}{i.status==='pending'&&<button disabled={disabled||working} onClick={()=>act('interactions/action',{id:i.id,action:'decline'})}>拒绝</button>}</div>
 </>}
 {incoming&&i.status==='accepted'&&<div className="interaction-actions">{generating?<button onClick={()=>act('interactions/action',{id:i.id,action:'stop'})}>停止{prepared?'修复':'创作'}</button>:<small>处理结果同步中…</small>}</div>}
 {incoming&&i.status==='ready'&&<button className="primary-action" disabled={disabled||working} onClick={()=>void start(i,'play')}><Play size={14}/>播放效果</button>}
 {incoming&&i.status==='playing'&&!screen&&!finished&&<div className="interaction-actions"><button disabled={disabled||working} onClick={async()=>{try{await show(i,false)}catch(e){setError((e as Error).message)}}}>继续查看</button><button disabled={disabled} onClick={()=>act('interactions/action',{id:i.id,action:'complete'})}>结束展示</button></div>}
 {!incoming&&['pending','accepted','ready','failed'].includes(i.status)&&<button disabled={disabled} onClick={()=>act('interactions/action',{id:i.id,action:'cancel'})}>撤回</button>}{i.reply&&<p>回复：{i.reply}</p>}
 </article>})}</>}
 {screen&&<div className="interaction-overlay" role="dialog" aria-modal="true" aria-label={screen.preview?'效果预览':'互动效果'}><header><span>{screen.preview?'发送前预览':'来自好友的心意'}</span><button aria-label="结束互动展示" onClick={()=>finish('')}><X size={20}/></button></header><iframe ref={frame} title="隔离的互动效果" sandbox="allow-scripts" onLoad={()=>frame.current?.contentWindow?.postMessage({type:'zhijiao.check-errors'},'*')} referrerPolicy="no-referrer" srcDoc={screen.html}/><footer>{screen.preview?<button onClick={()=>finish('')}>预览完成</button>:<><input aria-label="互动回复" value={reply} maxLength={500} placeholder="回一句话（选填）" onChange={e=>setReply(e.target.value)}/><button onClick={()=>finish(reply)}>收下并结束</button></>}</footer></div>}
 </div>;
}
