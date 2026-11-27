import {ErrorNotice} from './ErrorNotice';
import {AgentTools,type ScheduledTask} from './AgentTools';
import {NewsCard,NewsDetail} from './News';
import type {NewsArticle} from '../shared/news-messages.mjs';
import {useCharacterDrag} from './useCharacterDrag';
import {SocialActionConfirmation,type SocialActionRequest} from './SocialActionConfirmation';
import {isAgentMessage} from '../shared/conversations.mjs';
import {desktopVisitors} from '../shared/desktop-visitors.mjs';
import {DesktopVisitor} from './DesktopVisitor';
import {CloudPanel,type CloudState} from './CloudPanel';
import React,{useEffect,useLayoutEffect,useState,useRef} from 'react';
import {Send,Clock,X,ChevronDown,Settings,Wrench,Square,Pause,Play,GripHorizontal,Check,Mail,EyeOff,PanelRight,ArrowUpRight,Sparkles} from 'lucide-react';
import {Creature} from './Creature';
import {Registration} from './Registration';
import {CloudOnboarding} from './CloudOnboarding';
import type {Visit} from './Visits';
import './tokens.css';
import './lite.css';
import './companion-theme.css';

type Agent={id:string;name:string;ownerName:string;ownerId:string;shareableProfile:string;skin:string;enabled:boolean;engine?:string;model?:string;publicBio?:string;lastError?:string};
type Message={newsDigest?:{topic?:string;articles:NewsArticle[]};socialConfirmationId?:string;id:string;agentId:string;role:string;text:string;channel?:string;createdAt:number;updateVersion?:string};
type State={scheduledTasks?:ScheduledTask[];socialActions?:SocialActionRequest[];peerUnread?:Record<string,number>;updates?:{currentVersion:string;latestVersion:string|null;lastCheckedAt:number|null;error:string;progress?:{targetVersion:string;status:string;phase:string;updatedAt:number}|null};cloud?:CloudState;visits?:Visit[];registrationComplete?:boolean;cloudOnboarding?:'pending'|'skipped'|'connected';engines?:{id:string;installed:boolean;label:string}[];agents:Agent[];primaryAgentId?:string;messages:Message[];busy:string[]};
const desktop=(window as any).desktop;

async function post(path:string,body:unknown){
 const r=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const d=await r.json();
 if(!r.ok)throw Error(d.error);
 return d;
}

type LiteProps={
 embedded?:boolean;
 requestedTab?:'chat'|'settings'|null;
 onTabConsumed?:()=>void;
 inspectorOpen?:boolean;
 onToggleInspector?:()=>void;
};

export function LiteApp({embedded=false,requestedTab=null,onTabConsumed,inspectorOpen=false,onToggleInspector}:LiteProps={}){
 const [toolsOpen,setToolsOpen]=useState(false);
 const [newsDetail,setNewsDetail]=useState<NewsArticle|null>(null);
 const [quickText,setQuickText]=useState('');
 const [quickOpen,setQuickOpen]=useState(false);
 const characterDrag=useCharacterDrag();
 const [edge,setEdge]=useState<{phase:string;edge:string;direction:number;unread:number;transitionMs?:number}|null>(null);

 useEffect(()=>{if(embedded)return;void desktop?.getEdgePresence?.().then(setEdge);return desktop?.onEdgePresence?.(setEdge)},[embedded]);

 const params=new URLSearchParams(location.search),pinnedId=params.get('agent'),historyMode=params.has('history'),visitorMode=params.get('visit');
 const [panelSide,setPanelSide]=useState(params.get('panel')||'right');
 const [expanded,setExpanded]=useState(embedded);
 const [tab,setTab]=useState<'chat'|'friends'|'settings'>('chat');
 const [state,setState]=useState<State>({agents:[],messages:[],busy:[]});
 const [connected,setConnected]=useState(false);
 const [text,setText]=useState('');
 const [error,setError]=useState('');
 const [sending,setSending]=useState(false);
 const [engineDraft,setEngineDraft]=useState('codex');
 const [modelDraft,setModelDraft]=useState('');
 const [engineSaved,setEngineSaved]=useState(false);
 const [ownerName,setOwnerName]=useState('');
 const [profile,setProfile]=useState('');
 const [saved,setSaved]=useState(false);
 const [seen,setSeen]=useState(localStorage.getItem('companion-seen-'+(pinnedId||'primary'))||'');
 const [desktopStatus,setDesktopStatus]=useState<{agents:{id:string;unread:number}[]}|null>(null);
 const [clock,setClock]=useState(Date.now());
 const input=useRef<HTMLTextAreaElement>(null),messageViewport=useRef<HTMLDivElement>(null);

 useEffect(()=>{
  if(requestedTab){
   setTab(requestedTab);
   onTabConsumed?.();
  }
 },[requestedTab,onTabConsumed]);

 useEffect(()=>{const events=new EventSource('/api/events');events.onmessage=e=>{setState(JSON.parse(e.data));setConnected(true)};events.onerror=()=>setConnected(false);return()=>events.close()},[]);
 useEffect(()=>{if(!desktop)return;void desktop.getPanelSide?.().then(setPanelSide);return desktop.onPanelSide?.(setPanelSide)},[]);
 useEffect(()=>{if(!desktop)return;void desktop.getStatus?.().then(setDesktopStatus);return desktop.onStatus?.(setDesktopStatus)},[]);
 useEffect(()=>{if(embedded)return;return desktop?.onOpen?.((view:string)=>{if(view==='collapse'){setExpanded(false);setQuickOpen(false);return}setTab(view==='friends'?'friends':'chat');setError('');setExpanded(true)})},[embedded]);
 useEffect(()=>desktop?.onVisitorArrived?.(()=>{setExpanded(false);setQuickOpen(false)}),[]);
 useEffect(()=>{if(!visitorMode)return;const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer)},[visitorMode]);

 const agent=state.agents.find(a=>a.id===(pinnedId||state.primaryAgentId))||state.agents[0];
 const cloud=state.cloud?.agentId===agent?.id?state.cloud:undefined;
 const messages=state.messages.filter(m=>m.agentId===agent?.id&&isAgentMessage(m));
 const latest=messages.filter(m=>m.role!=='user').at(-1);
 const busy=!!agent&&state.busy.includes(agent.id);
 const desktopUnread=desktopStatus?.agents.find(a=>a.id===agent?.id)?.unread||0;
 const unread=desktop?desktopUnread>0:!!latest&&latest.id!==seen;
 const peerUnread=state.peerUnread||cloud?.direct?.unread||{};
 const friendUnread=Object.values(peerUnread).reduce((sum,n)=>sum+n,0);
 const friendPending=cloud?.requests.filter(r=>r.recipient===cloud.deviceId&&r.status==='pending').length||0;
 const myVisits=cloud?.registered?cloud.visits:state.visits||[];
 const self=cloud?.deviceId||agent?.id;
 const visitor=myVisits.find(v=>v.to===self&&v.status==='active');
 const incomingVisit=myVisits.find(v=>v.to===self&&v.status==='pending');
 const status=!connected?'连接中':!agent?.enabled?'休息中':busy?'处理中':cloud?.registered?(cloud.connected?'在线':'云端离线'):'本机在线';
 const engineLabel=({codex:'Codex',opencode:'OpenCode',trae:'TRAE',antigravity:'Antigravity'} as Record<string,string>)[agent?.engine||'codex']||'本地 CLI';

 useEffect(()=>{if(agent){setEngineDraft(agent.engine||'codex');setModelDraft(agent.model||'');setEngineSaved(false)}},[agent?.id,agent?.engine,agent?.model]);
 useEffect(()=>{if(agent){setOwnerName(agent.ownerName);setProfile(agent.shareableProfile)}},[agent?.id,agent?.ownerName,agent?.shareableProfile]);
 useEffect(()=>{if(!historyMode&&!embedded)desktop?.setExpanded?.(expanded||quickOpen)},[expanded,quickOpen,historyMode,embedded]);

 useEffect(()=>{
  const read=()=>{
   if(!latest||!((expanded&&tab==='chat')||historyMode)||document.visibilityState!=='visible'||!document.hasFocus())return;
   setSeen(latest.id);
   localStorage.setItem('companion-seen-'+(agent?.id||'primary'),latest.id);
   desktop?.markRead?.(agent?.id,latest.id);
  };
  read();
  window.addEventListener('focus',read);
  return()=>window.removeEventListener('focus',read);
 },[latest?.id,expanded,historyMode,tab,agent?.id,desktopUnread]);

 useLayoutEffect(()=>{
  if(!historyMode&&(!expanded||tab!=='chat'))return;
  const frame=requestAnimationFrame(()=>{if(messageViewport.current)messageViewport.current.scrollTop=messageViewport.current.scrollHeight});
  return()=>cancelAnimationFrame(frame);
 },[tab,expanded,historyMode,messages.length]);

 useEffect(()=>{
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!embedded){setExpanded(false);setQuickOpen(false)}};
  window.addEventListener('keydown',escape);
  return()=>window.removeEventListener('keydown',escape);
 },[embedded]);

 // Keep pet awake while user types in the desktop quick command bar
 useEffect(()=>{
  if(embedded||!quickOpen)return;
  desktop?.characterActivity?.();
  const keep=setInterval(()=>desktop?.characterActivity?.(),15000);
  return()=>clearInterval(keep);
 },[embedded,quickOpen]);

 async function act(path:string,data:unknown){
  setError('');setSending(true);
  try{await post(path,data);return true}catch(e){setError((e as Error).message);return false}finally{setSending(false)}
 }
 async function send(e:React.FormEvent){
  e.preventDefault();
  if(!text.trim()||sending||!agent)return;
  const value=text;
  if(await act('chat',{id:agent.id,text:value}))setText('');
 }
 async function sendQuick(e:React.FormEvent){
  e.preventDefault();
  if(!quickText.trim()||sending||!agent)return;
  const value=quickText;
  desktop?.characterActivity?.();
  if(await act('chat',{id:agent.id,text:value})){setQuickText('')}
 }
 async function copyUpdate(version:string){
  await navigator.clipboard.writeText(`请将知交信使客户端升级到 ${version}：在 zhijiao-client 目录运行 npm run desktop:update，保留 .data 数据。`);
 }
 function openFriend(id:string){
  if(desktop)desktop.openFriend(id);
  else location.assign('/?friend='+encodeURIComponent(id));
 }
 function openNotice(){
  if(desktop&&!embedded){
   if(incomingVisit){desktop.openFriend(incomingVisit.from);return}
   const peer=Object.keys(peerUnread).find(id=>peerUnread[id]>0);
   if(peer)desktop.openFriend(peer);
   else desktop.openAgent(friendPending?'friends':'chat');
   return;
  }
  const peer=Object.keys(peerUnread).find(id=>peerUnread[id]>0);
  if(peer){openFriend(peer);return}
  setTab(friendPending?'friends':'chat');setExpanded(true);
 }

 const composer=<div className="composer-area">
  <form className="lite-composer" onSubmit={send}>
   <textarea ref={input} aria-label={`对${agent?.name||'助理'}说`} placeholder={`和${agent?.name||'助理'}说点什么…（可查未读、问新闻、代联络好友）`} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send(e)}}}/>
   <div className="lite-composer-footer">
    <span className="composer-engine-pill"><Sparkles size={12}/>{engineLabel} · 仅本机可见</span>
    {busy?<button className="lite-stop" aria-label="停止" type="button" onClick={()=>act('cancel',{id:agent?.id})}><Square size={14}/><span>停止</span></button>:<button className="lite-send" aria-label="发送" disabled={!text.trim()||sending||!agent?.enabled||!connected}><Send size={15}/></button>}
   </div>
  </form>
 </div>;

 const bubbles=messages.map(m=><div className={`recent-bubble ${m.role}`} key={m.id}>
  {m.role==='error'?<ErrorNotice error={m.text} engine={agent?.engine} onSettings={()=>setTab('settings')}/>:<p>{m.newsDigest?.articles.length?`今日 ${m.newsDigest.topic||'AI'} 新闻 · ${m.newsDigest.articles.length} 条`:m.text}{m.updateVersion&&<button className="update-copy" onClick={()=>copyUpdate(m.updateVersion!)}>复制升级指引</button>}</p>}
  {m.newsDigest?.articles.map(article=><NewsCard key={article.id} article={article} onOpen={()=>setNewsDetail(article)}/>)}
  {m.socialConfirmationId&&state.socialActions?.filter(item=>item.id===m.socialConfirmationId).map(item=><SocialActionConfirmation key={item.id} item={item} name={cloud?.directory.find(p=>p.id===item.action.to)?.profile?.name||cloud?.directory.find(p=>p.id===item.action.to)?.name||'好友'} disabled={sending||busy||!connected} act={act} onOpen={()=>openFriend(item.action.to)}/>)}
 </div>);

 if(visitorMode){
  const item=desktopVisitors(state,clock).find(v=>v.id===visitorMode&&v.hostId===pinnedId);
  return item?<DesktopVisitor key={item.id} visitor={item} onEnd={async reply=>{if(!await act(cloud?.registered?'cloud/visit-action':'visits/action',{id:item.id,actor:agent?.id,action:'end',reply}))throw Error('送客暂未成功，请稍后再试');return true}}/>:<div className="visitor-waiting"/>;
 }
 if(connected&&state.registrationComplete===false)return <Registration engines={state.engines}/>;
 if(connected&&state.cloudOnboarding==='pending'&&agent)return <CloudOnboarding agent={agent} cloud={cloud}/>;
 if(historyMode)return <div className="history-page"><header className="lite-heading"><strong>和{agent?.name}的对话</strong><button aria-label="收起历史" onClick={()=>desktop?desktop.hideHistory():location.assign('/')}><X size={18}/></button></header><div className="history-messages recent-bubbles" ref={messageViewport}>{bubbles}{busy&&<p className="lite-busy">正在处理…</p>}</div>{error&&<ErrorNotice error={error} engine={agent?.engine} onSettings={()=>setTab('settings')}/>}{composer}</div>;

 const overlays=<>
  {toolsOpen&&agent&&<AgentTools agentId={agent.id} tasks={state.scheduledTasks||[]} act={act} error={error} onClose={()=>setToolsOpen(false)}/>}
  {newsDetail&&agent&&<NewsDetail article={newsDetail} cloud={cloud} agentId={agent.id} act={act} error={error} onClose={()=>setNewsDetail(null)}/>}
 </>;

 const panel=<section className="whisper-panel" aria-hidden={!expanded} inert={!expanded}>
  <header className="lite-heading">
   <div>
    <strong>{tab==='settings'?'偏好设置':agent?.name||'知交信使'}</strong>
    <small className="header-presence"><i className={!connected||!agent?.enabled||cloud?.registered&&!cloud.connected?'off':''}/>{tab==='settings'?`客户端 ${state.updates?.currentVersion||'—'}`:status}</small>
   </div>
   <div className="lite-heading-actions">
    {desktop&&!embedded&&<button aria-label="隐藏桌面人物" title="隐藏人物，菜单栏继续收信" onClick={()=>desktop.hideCharacters?.()}><EyeOff size={15}/></button>}
    <button className="agent-tool-trigger" aria-label="Agent 工具" title="工具与定时任务" onClick={()=>setToolsOpen(true)}><Wrench size={16}/></button>
    <button className={tab==='settings'?'active':''} aria-label="设置" title={tab==='settings'?'返回聊天':'设置'} onClick={()=>setTab(tab==='settings'?'chat':'settings')}><Settings size={15}/></button>
    {embedded&&onToggleInspector&&<button className={'icon-toggle'+(inspectorOpen?' active':'')} aria-label={inspectorOpen?'收起资料抽屉':'展开资料抽屉'} title={inspectorOpen?'收起右侧资料':'展开右侧资料'} onClick={onToggleInspector}><PanelRight size={16}/></button>}
    {!embedded&&<button aria-label="收起气泡" onClick={()=>setExpanded(false)}><ChevronDown size={18}/></button>}
   </div>
  </header>

  {!embedded&&tab!=='settings'&&<nav className="companion-tabs" aria-label="助理功能">{(['chat','friends'] as const).map(t=><button key={t} aria-current={tab===t?'page':undefined} onClick={()=>setTab(t)}>{t==='chat'?'Agent':'好友'}{(t==='chat'?Number(unread):friendUnread+friendPending)>0&&<i/>}</button>)}</nav>}

  {error&&<div className="stage-error-wrap"><ErrorNotice error={error} engine={agent?.engine} onSettings={()=>setTab('settings')}/></div>}

  {tab==='chat'?<>
   {!cloud?.registered&&<div className="onboarding-reminder"><span>本机可用 · 连接云端后可添加好友与串门</span><button onClick={()=>setTab('settings')}>填写邀请码 →</button></div>}
   <div className="recent-bubbles agent-messages" ref={messageViewport}>
    {bubbles}
    {!messages.length&&<div className="panel-empty"><strong>嗨，我是 {agent?.name||'你的助理'}</strong><p>可以直接问我今日 AI 新闻、让我汇总好友动态，或替你向好友发起串门和互动。</p></div>}
    {busy&&<p className="lite-busy"><i/>正在认真处理…</p>}
   </div>
   {composer}
   <div className="whisper-footer"><button onClick={()=>desktop?desktop.openHistory(agent?.id):location.assign('/?history=1&agent='+encodeURIComponent(agent?.id||''))}><Clock size={12}/>全部对话</button></div>
  </>:tab==='friends'?<div className="panel-content">{agent&&<CloudPanel cloud={cloud} agent={agent} act={act} disabled={sending||!connected} peerUnread={peerUnread} onChat={openFriend}/>}</div>:
  <div className="lite-settings">
   <div className="settings-grid">
    <section className="settings-card">
     <h3>云端连接</h3>
     {agent&&<CloudPanel cloud={state.cloud} agent={agent} act={act} disabled={sending||!connected} mode="settings"/>}
    </section>

    <section className="settings-card engine-settings">
     <h3>本地 CLI 引擎</h3>
     <label>本地 CLI 工具<select aria-label="本地 CLI 工具" disabled={sending||busy} value={engineDraft} onChange={e=>{setEngineDraft(e.target.value);setModelDraft('');setEngineSaved(false)}}>{[['codex','Codex'],['opencode','OpenCode'],['trae','TRAE'],['antigravity','Antigravity']].map(([id,label])=><option key={id} value={id}>{label}{state.engines?.find(e=>e.id===id)?.installed?'':'（未检测到）'}</option>)}</select></label>
     {engineDraft!=='codex'&&<label>模型标识{engineDraft!=='opencode'?'（选填）':''}<input aria-label="CLI 模型标识" maxLength={150} placeholder={engineDraft!=='opencode'?'留空使用所选 CLI 默认模型':'供应商/模型名称'} value={modelDraft} onChange={e=>{setModelDraft(e.target.value);setEngineSaved(false)}}/></label>}
     <p className="lite-hint">当前：{engineLabel}。沿用本机 CLI 的供应商、代理和登录配置；测试连接会发送一条验证消息。</p>
     <button className="lite-save" disabled={sending||busy||!connected||(engineDraft==='opencode'&&!modelDraft.trim())} onClick={async()=>{if(await act('engine',{id:agent?.id,engine:engineDraft,model:modelDraft,verifyConnection:true}))setEngineSaved(true)}}>{sending?'正在测试…':engineSaved?'已验证并切换':'测试连接并切换'}</button>
    </section>

    <section className="settings-card">
     <h3>主人称呼与公开近况</h3>
     <label>怎么称呼你<input aria-label="我的称呼" value={ownerName} onChange={e=>{setOwnerName(e.target.value);setSaved(false)}}/></label>
     <label>允许分享的近况<textarea aria-label="公开近况" value={profile} onChange={e=>{setProfile(e.target.value);setSaved(false)}} placeholder="只填写你愿意让好友知道的内容"/></label>
     <div className="settings-card-actions">
      <button className="lite-save" disabled={sending} onClick={async()=>{if(await act('profile',{id:agent?.id,ownerName,shareableProfile:profile}))setSaved(true)}}>{saved?<><Check size={13}/>已保存</>:'保存资料'}</button>
      <span className="lite-hint">好友提问先由你确认，拟稿只使用授权资料。</span>
     </div>
    </section>

    <section className="settings-card">
     <h3>版本与助理状态</h3>
     <div className="client-update-settings">
      <span>客户端版本 {state.updates?.currentVersion||'—'}</span>
      <button disabled={sending} onClick={()=>act('updates/check',{})}>检查更新</button>
      {state.updates?.error&&<p className="lite-hint">{state.updates.error}</p>}
      {state.updates?.lastCheckedAt&&!state.updates.error&&<p className="lite-hint">最新发布版本：{state.updates.latestVersion}。有新版时会在聊天中提醒。</p>}
     </div>
     {state.updates?.progress&&<div className="update-recovery" role="status"><strong>升级至 {state.updates.progress.targetVersion} · {state.updates.progress.status==='completed'?'启动验证已通过':state.updates.progress.status==='failed'?'未完成':({waiting:'等待客户端退出',checking:'检查安装条件',installing:'安装代码与依赖',building:'构建客户端',restarting:'重新启动并验证'} as Record<string,string>)[state.updates.progress.phase]||'正在检查'}</strong><p>{state.updates.progress.status==='failed'?'本地数据保留。请让本机开发工具检查 .data/client-update.log，恢复启动后再决定是否重试。':'升级需要主人确认；仅在启动验证通过后显示完成。'}</p>{state.updates.progress.status==='failed'&&<button onClick={()=>void navigator.clipboard.writeText('在 zhijiao-client 目录运行 npm run desktop 恢复启动，保留 .data；检查 .data/client-update.log 后再决定是否运行 npm run desktop:update。')}>复制恢复指引</button>}</div>}
     <div className="settings-card-actions">
      <button className="quiet-control" onClick={()=>act('toggle',{id:agent?.id})}>{agent?.enabled?<Pause size={13}/>:<Play size={13}/>}{agent?.enabled?'让助理休息':'让助理上线'}</button>
      <button className="settings-back" onClick={()=>setTab('chat')}>返回聊天</button>
     </div>
     {desktop&&<details className="desktop-help"><summary>桌面人物与菜单栏怎么用？</summary><p>菜单栏始终保留「打开聊天」「显示桌面人物」。打开工作台会收起桌面人物，关闭后自动恢复；主动隐藏后保持安静，仅菜单栏提示未读。人物自动贴边隐藏后，在屏幕边缘停留 1 秒即可叫回。</p></details>}
    </section>
   </div>
  </div>}
 </section>;

 if(embedded)return <div className="unified-agent-pane">{panel}{overlays}</div>;

 const showAlerts=!expanded&&(edge?.unread||unread||friendUnread>0||friendPending>0||!!incomingVisit);
 const isPeeking=edge?.phase==='peeking';
 const isShown=!edge||edge.phase==='shown';
 const visitSenderName=incomingVisit?cloud?.directory.find(p=>p.id===incomingVisit.from)?.profile?.name||cloud?.directory.find(p=>p.id===incomingVisit.from)?.name||'好友':'';

 return <div className={`desktop-space ${desktop?'native':'web'} ${edge?'edge-stage':''} panel-${panelSide}`}>
  <div className={`companion-anchor ${expanded?'expanded':''}`}>
   {!desktop&&panel}
   <div className={`desktop-character ${characterDrag.dragging?'character-dragging':''}`} style={edge?{'--edge-transition-ms':`${edge.transitionMs??650}ms`} as React.CSSProperties:undefined} data-edge-phase={edge?.phase} data-edge-side={edge?.edge} data-direction={edge?.direction} {...characterDrag.handlers} onPointerEnter={()=>{if(edge?.phase==='shown')desktop?.characterActivity?.()}}>
    {/* Plan A Floating Notice & Quick Command Dock positioned cleanly ABOVE character head */}
    {showAlerts&&<div className="character-alerts" role="region" aria-label="待查收提醒">
     <button className="character-alert message-alert" title="查看新消息" onClick={openNotice}>
      <Mail size={13}/>
      <span>{isPeeking?`未读 ${edge.unread}`:incomingVisit?`${visitSenderName}来敲门 · 请进`:friendUnread>0?`好友消息 ${friendUnread>99?'99+':friendUnread}`:friendPending?'好友申请':`新消息 ${desktopUnread||1}`}</span>
     </button>
    </div>}

    {desktop&&isShown&&!isPeeking&&<div className={`pet-quick-dock ${quickOpen?'open':''}`}>
     {quickOpen?<form className="pet-quick-card" onSubmit={sendQuick}>
      <div className="pet-quick-top">
       <span>{busy?'正在处理…':latest?.text?latest.text.slice(0,26)+(latest.text.length>26?'…':''):`对 ${agent?.name||'助理'} 说点什么`}</span>
       <div>
        <button type="button" title="打开完整工作台" aria-label="打开完整工作台" onClick={()=>{setQuickOpen(false);desktop.openAgent('chat')}}><ArrowUpRight size={13}/></button>
        <button type="button" title="收起" aria-label="收起快捷输入" onClick={()=>setQuickOpen(false)}><X size={13}/></button>
       </div>
      </div>
      <div className="pet-quick-input-row">
       <input aria-label="快捷吩咐助理" placeholder={`对${agent?.name||'助理'}说点什么…`} value={quickText} onFocus={()=>desktop?.characterActivity?.()} onChange={e=>{setQuickText(e.target.value);desktop?.characterActivity?.()}}/>
       <button disabled={!quickText.trim()||sending||!connected} aria-label="快捷发送"><Send size={12}/></button>
      </div>
     </form>:<button type="button" className="pet-quick-trigger" title="快捷对话或展开工作台" onClick={()=>setQuickOpen(true)}>
      <span>对{agent?.name||'助理'}说…</span>
      <ArrowUpRight size={12}/>
     </button>}
    </div>}

    {visitor&&!desktop&&<button className="visitor-badge" onClick={()=>openFriend(visitor.from)}><span>好友来做客</span></button>}
    <div className="drag-handle" title="拖动"><GripHorizontal size={18}/></div>
    <button className="character-button" aria-label={`点击${agent?.name||'助理'}`} onClick={()=>desktop?desktop.openAgent('chat'):setExpanded(!expanded)}>
     <Creature skin={agent?.skin||'taotao'} busy={busy} sleep={!agent?.enabled} attention={latest?.id||visitor?.id||''} action={edge?(['leaving','entering','retreating'].includes(edge.phase)?'walk':edge.phase==='peeking'?'peek':'idle'):undefined}/>
    </button>
    <div className="character-info">
     <strong>{agent?.name||'助理'}</strong>
     <small><i className={!connected||!agent?.enabled||cloud?.registered&&!cloud.connected?'offline':busy?'busy':''}/>{status}</small>
    </div>
   </div>
  </div>
 </div>;
}
