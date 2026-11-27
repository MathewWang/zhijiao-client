import {ModelCalendar} from './ModelCalendar';
import {messageStatus} from '../shared/message-status.mjs';
import {ErrorNotice} from './ErrorNotice';
import {parseNewsMessage,discussionFor,type NewsArticle} from '../shared/news-messages.mjs';
import {NewsCard,NewsDetail} from './News';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {CalendarDays,Plus,Send,X,Flower2,Sparkles,DoorOpen,WandSparkles,ArrowUpCircle,MessageSquare,Newspaper,Users,Clock,Settings,PanelRight,Search,EyeOff} from 'lucide-react';
import {CompanionAvatar} from './CompanionAvatar';
import {Interactions,type Effect,type Interaction,type PlayTemplate} from './Interactions';
import {CloudPanel,type CloudState} from './CloudPanel';
import {CloudConfirmations} from './CloudConfirmations';
import {ChatTimelineContext} from './RecordFeed';
import {UpdateInvitations} from './UpdateInvitations';
import {LocalPlayCard,type LocalPlayDraft} from './LocalPlayCard';
import {PlayDialog} from './PlayDialog';
import {LiteApp} from './LiteApp';
import {AgentTools,type ScheduledTask} from './AgentTools';
import './tokens.css';
import './style.css';
import './lite.css';
import './companion-theme.css';
import './friend-chat.css';

const desktop=(window as any).desktop;

type AgentInfo={id:string;name:string;ownerName:string;skin:string;enabled:boolean;engine?:string;model?:string;publicBio?:string;shareableProfile?:string};
type OwnerMessage={id:string;agentId:string;role:string;text:string;createdAt:number;newsDigest?:{topic?:string;articles:NewsArticle[]}};
type State={
 peerUnread?:Record<string,number>;
 localPlayDrafts?:LocalPlayDraft[];
 cloud?:CloudState;
 agents:AgentInfo[];
 primaryAgentId?:string;
 messages?:OwnerMessage[];
 busy?:string[];
 scheduledTasks?:ScheduledTask[];
 interactionEffects?:Effect[];
 playTemplates?:PlayTemplate[];
 updates?:{currentVersion:string};
};
type Entry={id:string;time:number;type:'message'|'draft'|'interaction'|'visit'|'update'|'agent'|'agent-outgoing'};
type RailView='messages'|'news'|'contacts'|'calendar';

function formatShortTime(ts?:number){
 if(!ts)return '';
 const d=new Date(ts),now=new Date();
 if(d.toDateString()===now.toDateString())return d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
 const y=new Date(now);y.setDate(now.getDate()-1);
 if(d.toDateString()===y.toDateString())return '昨天';
 return d.toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'});
}

export function FriendChat(){
 const [newsDetail,setNewsDetail]=useState<{article:NewsArticle;roomId?:string;peer?:string;startDiscussion?:boolean}|null>(null);
 const [state,setState]=useState<State>({agents:[]});
 const [connected,setConnected]=useState(false);
 const [peer,setPeer]=useState(new URLSearchParams(location.search).get('friend')||'');
 const [rail,setRail]=useState<RailView>(()=>new URLSearchParams(location.search).get('friend')==='contacts'?'contacts':'messages');
 const [inspectorOpen,setInspectorOpen]=useState(true);
 const [search,setSearch]=useState('');
 const [toolsModal,setToolsModal]=useState(false);
 const [agentExternalTab,setAgentExternalTab]=useState<'chat'|'settings'|null>(null);
 const [drafts,setDrafts]=useState<Record<string,string>>({});
 const [sending,setSending]=useState(false);
 const [error,setError]=useState('');
 const [tools,setTools]=useState(false);
 const [compose,setCompose]=useState<{kind:string;template?:PlayTemplate;peer:string}|null>(null);
 const [desktopStatus,setDesktopStatus]=useState<{agents:{id:string;unread:number}[]}|null>(null);
 const [located,setLocated]=useState('');
 const [newBelow,setNewBelow]=useState(false);
 const stickBottom=useRef(true),openedPeer=useRef(''),viewport=useRef<HTMLDivElement>(null),keys=useRef<Record<string,string>>({});

 useEffect(()=>{void desktop?.getStatus?.().then(setDesktopStatus);return desktop?.onStatus?.(setDesktopStatus)},[]);
 useEffect(()=>{const events=new EventSource('/api/events');events.onmessage=event=>{setState(JSON.parse(event.data));setConnected(true)};events.onerror=()=>setConnected(false);return()=>events.close()},[]);

 function select(id:string){
  setPeer(id);
  setRail(id==='contacts'?'contacts':'messages');
  if(id!=='agent')setAgentExternalTab(null);
  setTools(false);setCompose(null);setNewsDetail(null);setError('');
 }
 function choose(id:string){
  if(desktop?.openFriend)desktop.openFriend(id);
  else select(id);
 }
 useEffect(()=>desktop?.onFriendSelected?.(select),[]);

 const cloud=state.cloud;
 const agent=state.agents.find(a=>a.id===(cloud?.agentId||state.primaryAgentId))||state.agents[0];
 const isAgent=!peer||peer==='agent';
 const isContacts=peer==='contacts'||rail==='contacts';
 const person=cloud?.directory.find(p=>p.id===peer);
 const agentUnread=desktopStatus?.agents.find(a=>a.id===agent?.id)?.unread||0;
 const agentBusy=!!agent&&!!state.busy?.includes(agent.id);
 const pendingRequests=cloud?.requests.filter(r=>r.recipient===cloud.deviceId&&r.status==='pending').length||0;

 const friendsList=useMemo(()=>{
  const list=cloud?.directory.filter(p=>cloud.friends.includes(p.id))||[];
  const q=search.trim().toLowerCase();
  return list
   .filter(p=>!q||(p.profile?.name||p.name).toLowerCase().includes(q))
   .sort((a,b)=>{
    const ua=state.peerUnread?.[a.id]||cloud?.direct?.unread[a.id]||0;
    const ub=state.peerUnread?.[b.id]||cloud?.direct?.unread[b.id]||0;
    if((ub>0)!==(ua>0))return ub-ua;
    return Number(b.online)-Number(a.online);
   });
 },[cloud?.directory,cloud?.friends,cloud?.direct?.unread,state.peerUnread,search]);

 const totalPeerUnread=Object.values(state.peerUnread||cloud?.direct?.unread||{}).reduce((s,n)=>s+n,0);
 const totalMessageUnread=agentUnread+totalPeerUnread;

 const messages=cloud?.direct?.messages.filter(m=>m.peer===peer)||[];
 const unread=cloud?.direct?.unread[peer]||0;
 const latestIncoming=messages.filter(m=>m.incoming&&parseNewsMessage(m.text)?.type!=='comment').sort((a,b)=>(a.sequence||0)-(b.sequence||0)).at(-1)?.id;
 const pendingRooms=messages.flatMap(m=>{
  const d=parseNewsMessage(m.text);
  if(d?.type!=='share')return [];
  const room=discussionFor(messages,peer,d.roomId),count=room?.messages.filter(m=>m.incoming&&m.read===false).length||0;
  return count?[{roomId:d.roomId,article:d.article,count}]:[];
 }).filter((r,i,all)=>all.findIndex(v=>v.roomId===r.roomId)===i);

 const localPlays=(state.localPlayDrafts||[]).filter(d=>d.peer===peer);
 const related=(i:{from:string;to:string})=>(i.from===peer&&i.to===cloud?.deviceId)||(i.to===peer&&i.from===cloud?.deviceId);
 const interactions=cloud?.interactions?.filter(related)||[];
 const visits=cloud?.visits.filter(related)||[];
 const updates=cloud?.updateInvitations?.filter(related)||[];
 const exchanges=cloud?.messages.filter(m=>m.message.sender===peer)||[];
 const agentOutgoing=cloud?.agentOutgoing?.filter(m=>m.peer===peer)||[];

 // Aggregate news feed for the dedicated "今日新闻" rail view
 const newsHubItems=useMemo(()=>{
  const items:{key:string;article:NewsArticle;roomId?:string;peer?:string;peerName?:string;unread:number;discussionCount:number;time:number}[]=[];
  const seen=new Set<string>();
  const directAll=cloud?.direct?.messages||[];
  for(const m of [...directAll].reverse()){
   const d=parseNewsMessage(m.text);
   if(d?.type==='share'&&!seen.has('room:'+m.peer+':'+d.roomId)){
    seen.add('room:'+m.peer+':'+d.roomId);
    const room=discussionFor(directAll,m.peer,d.roomId);
    const unreadCount=room?.messages.filter(x=>x.incoming&&x.read===false).length||0;
    const p=cloud?.directory.find(x=>x.id===m.peer);
    items.push({key:'room:'+d.roomId,article:d.article,roomId:d.roomId,peer:m.peer,peerName:p?.profile?.name||p?.name||'好友',unread:unreadCount,discussionCount:room?.messages.length||0,time:m.createdAt||d.article.publishedAt||0});
   }
  }
  for(const m of [...(state.messages||[])].reverse()){
   if(m.agentId===agent?.id&&m.newsDigest?.articles?.length){
    for(const article of m.newsDigest.articles){
     if(seen.has('art:'+article.id))continue;
     seen.add('art:'+article.id);
     items.push({key:'art:'+article.id,article,unread:0,discussionCount:0,time:m.createdAt||article.publishedAt||0});
    }
   }
  }
  return items.sort((a,b)=>b.unread-a.unread||b.time-a.time);
 },[cloud?.direct?.messages,cloud?.directory,state.messages,agent?.id]);

 const totalNewsUnread=newsHubItems.reduce((s,i)=>s+i.unread,0);

 // Helper to compute last message preview for each friend row
 function peerPreview(id:string){
  const list=cloud?.direct?.messages.filter(m=>m.peer===id&&parseNewsMessage(m.text)?.type!=='comment')||[];
  const lastMsg=list.at(-1);
  const lastDraft=(state.localPlayDrafts||[]).filter(d=>d.peer===id).at(-1);
  const lastInter=cloud?.interactions?.filter(i=>i.from===id||i.to===id).at(-1);
  const lastVisit=cloud?.visits.filter(v=>v.from===id||v.to===id).at(-1);
  const candidates:{time:number;text:string}[]=[];
  if(lastMsg){
   const n=parseNewsMessage(lastMsg.text);
   candidates.push({time:lastMsg.createdAt||0,text:n?.type==='share'?`[新闻] ${n.article.title}`:lastMsg.text});
  }
  if(lastDraft)candidates.push({time:lastDraft.createdAt||0,text:`[玩法] ${lastDraft.title}`});
  if(lastInter)candidates.push({time:lastInter.createdAt||0,text:`[互动] ${lastInter.plan.intent.title||(lastInter.plan.intent.kind==='gift.flowers'?'送花':'烟花')}`});
  if(lastVisit)candidates.push({time:lastVisit.createdAt||0,text:`[串门] ${lastVisit.note}`});
  candidates.sort((a,b)=>b.time-a.time);
  return candidates[0]||null;
 }

 const lastAgentMsg=(state.messages||[]).filter(m=>m.agentId===agent?.id&&m.role!=='user').at(-1);

 const timeline:Entry[]=[
  ...messages.filter(m=>parseNewsMessage(m.text)?.type!=='comment').map(m=>({id:m.id,time:m.createdAt,type:'message' as const})),
  ...localPlays.map(d=>({id:d.id,time:d.createdAt,type:'draft' as const})),
  ...interactions.filter(i=>!localPlays.some(d=>d.id===i.key)).map(i=>({id:i.id,time:i.createdAt||0,type:'interaction' as const})),
  ...visits.map(i=>({id:i.id,time:i.createdAt||0,type:'visit' as const})),
  ...updates.map(i=>({id:i.id,time:i.createdAt||0,type:'update' as const})),
  ...agentOutgoing.map(m=>({id:m.id,time:m.createdAt,type:'agent-outgoing' as const})),
  ...exchanges.map(i=>({id:i.id,time:i.message.createdAt||0,type:'agent' as const}))
 ].sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));

 const signature=JSON.stringify([
  agentOutgoing.map(m=>[m.id,m.status]),
  messages.map(m=>[m.id,m.status]),
  localPlays.map(d=>[d.id,d.status,d.sent,d.previewed]),
  interactions.map(i=>[i.id,i.status]),
  visits.map(i=>[i.id,i.status]),
  updates.map(i=>[i.id,i.status]),
  exchanges.map(i=>[i.id,i.status])
 ]);

 // Recent activity highlights for the right Inspector drawer
 const recentActivities=useMemo(()=>{
  if(isAgent||isContacts||!person)return [];
  const list:{id:string;kind:string;title:string;status:string;tone:string;time:number}[]=[];
  for(const d of localPlays)list.push({id:'draft:'+d.id,kind:'effect',title:d.title,status:messageStatus('draft',d.status||'ready',{sent:d.sent}).label,tone:d.status==='failed'?'failed':!d.sent?'action':'normal',time:d.createdAt||0});
  for(const i of interactions){
   if(localPlays.some(d=>d.id===i.key))continue;
   const inc=i.to===cloud?.deviceId;
   const st=messageStatus('interaction',i.status,{incoming:inc});
   list.push({id:'interaction:'+i.id,kind:'effect',title:i.plan.intent.title||(i.plan.intent.kind==='gift.flowers'?'送花祝福':'烟花效果'),status:st.label,tone:st.tone,time:i.createdAt||0});
  }
  for(const v of visits){
   const inc=v.to===cloud?.deviceId;
   const st=messageStatus('visit',v.status,{incoming:inc});
   list.push({id:'visit:'+v.id,kind:'visit',title:inc?'桌面敲门 · 来访':'我去串门',status:st.label,tone:st.tone,time:v.createdAt||0});
  }
  for(const u of updates){
   const inc=u.to===cloud?.deviceId;
   const st=messageStatus('update',u.status,{incoming:inc});
   list.push({id:'update:'+u.id,kind:'update',title:`升级至 ${u.targetVersion}`,status:st.label,tone:st.tone,time:u.createdAt||0});
  }
  return list.sort((a,b)=>b.time-a.time).slice(0,6);
 },[isAgent,isContacts,person?.id,localPlays,interactions,visits,updates,cloud?.deviceId]);

 useEffect(()=>{document.title=(isAgent?agent?.name||'Agent':isContacts?'好友与发现':person?.profile?.name||person?.name||'好友聊天')+' · 知交信使'},[person?.id,person?.profile?.name,person?.name,isAgent,isContacts,agent?.name]);

 useEffect(()=>{
  const read=()=>{
   if(document.visibilityState!=='visible'||!document.hasFocus())return;
   if(isAgent||isContacts)return;
   if(latestIncoming&&unread){
    if(desktop)desktop.markFriendRead?.(peer,latestIncoming);
    else void fetch('/api/cloud/direct-read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:peer,id:latestIncoming})});
   }
   desktop?.markPeerRead?.(peer);
  };
  read();
  window.addEventListener('focus',read);
  document.addEventListener('visibilitychange',read);
  return()=>{window.removeEventListener('focus',read);document.removeEventListener('visibilitychange',read)};
 },[peer,latestIncoming,unread,signature,isAgent,isContacts]);

 useEffect(()=>{
  const box=viewport.current;
  if(!box||!connected)return;
  if(openedPeer.current!==peer){
   openedPeer.current=peer;
   const first=messages.find(m=>m.incoming&&m.read===false&&parseNewsMessage(m.text)?.type!=='comment');
   if(first)requestAnimationFrame(()=>locate('message:'+first.id));
   else box.scrollTop=box.scrollHeight;
   stickBottom.current=!first;
   setNewBelow(false);
  }else if(stickBottom.current){
   box.scrollTop=box.scrollHeight;
   setNewBelow(false);
  }else setNewBelow(true);
 },[peer,signature]);

 function locate(id:string){
  setLocated(id);
  requestAnimationFrame(()=>{
   const target=document.getElementById('event-'+id);
   target?.scrollIntoView({block:'center',behavior:'smooth'});
  });
 }

 const attention=[
  ...localPlays.filter(d=>!d.sent&&!interactions.some(i=>i.key===d.id)&&['ready','failed'].includes(d.status||'')).map(d=>({id:'draft:'+d.id,label:d.title+' · '+messageStatus('draft',d.status||'ready').label})),
  ...interactions.filter(i=>i.to===cloud?.deviceId&&['pending','ready','failed'].includes(i.status)).map(i=>({id:'interaction:'+i.id,label:'玩法 · '+messageStatus('interaction',i.status,{incoming:true}).label})),
  ...visits.filter(i=>i.to===cloud?.deviceId&&i.status==='pending').map(i=>({id:'visit:'+i.id,label:'串门 · 待你开门'})),
  ...updates.filter(i=>i.to===cloud?.deviceId&&['pending','failed'].includes(i.status)).map(i=>({id:'update:'+i.id,label:'升级 · '+messageStatus('update',i.status,{incoming:true}).label}))
 ];

 async function act(path:string,data:unknown){
  setError('');
  try{
   const response=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
   const result=await response.json();
   if(!response.ok)throw Error(result.error);
   return true;
  }catch(e){setError((e as Error).message);return false}
 }

 async function send(event:React.FormEvent){
  event.preventDefault();
  const text=drafts[peer]?.trim();
  if(!text||!person||sending)return;
  setSending(true);setError('');
  keys.current[peer]||=crypto.randomUUID();
  const target=peer;
  if(await act('cloud/direct',{to:target,text,key:keys.current[target]})){
   stickBottom.current=true;setNewBelow(false);
   if(viewport.current)viewport.current.scrollTop=viewport.current.scrollHeight;
   delete keys.current[target];
   setDrafts(value=>({...value,[target]:''}));
  }
  setSending(false);
 }

 function play(kind:string,template?:PlayTemplate){setTools(false);setError('');setCompose({kind,template,peer})}
 const disabled=!connected||!cloud?.connected||!person;
 const only=(type:'interaction'|'visit'|'update'|'agent',id:string):CloudState=>({
  ...cloud!,
  interactions:type==='interaction'?interactions.filter(i=>i.id===id):[],
  visits:type==='visit'?visits.filter(i=>i.id===id):[],
  updateInvitations:type==='update'?updates.filter(i=>i.id===id):[],
  messages:type==='agent'?exchanges.filter(i=>i.id===id):[]
 });

 const engineName=({codex:'Codex',opencode:'OpenCode',trae:'TRAE',antigravity:'Antigravity'} as Record<string,string>)[agent?.engine||'codex']||'本地 CLI';

 return <ChatTimelineContext.Provider value={true}>
  <div className="friend-chat-window workbench-shell">
   {/* 1. Far-Left Icon Rail */}
   <nav className="workbench-rail" aria-label="主导航">
    <div className="rail-drag-spacer" aria-hidden="true"/>
    <div className="rail-group">
     <button className={rail==='messages'?'active':''} aria-label="消息列表" title="消息" onClick={()=>{setRail('messages');if(peer==='contacts')choose('agent')}}>
      <MessageSquare size={19}/>
      {totalMessageUnread>0&&<i className="rail-dot"/>}
     </button>
     <button className={rail==='news'?'active':''} aria-label="今日见闻" title="今日新闻与讨论" onClick={()=>setRail('news')}>
      <Newspaper size={19}/>
      {totalNewsUnread>0&&<i className="rail-dot"/>}
     </button>
     <button className={'calendar-rail'+(rail==='calendar'?' active':'')} aria-label="模型发布日历" title="模型发布日历" onClick={()=>setRail('calendar')}><CalendarDays size={20}/></button>
     <button className={rail==='contacts'?'active':''} aria-label="好友广场" title="好友与申请" onClick={()=>{setRail('contacts');choose('contacts')}}>
      <Users size={19}/>
      {pendingRequests>0&&<i className="rail-dot"/>}
     </button>
    </div>
    <div className="rail-bottom">
     <button aria-label="定时任务" title="定时任务" onClick={()=>setToolsModal(true)}><Clock size={18}/></button>
     <button aria-label="全局设置" title="设置" onClick={()=>{setRail('messages');setAgentExternalTab('settings');choose('agent')}}><Settings size={18}/></button>
     {desktop&&<button aria-label="隐藏桌面人物并退居菜单栏" title="隐藏桌面人物，菜单栏继续收信" onClick={()=>desktop.hideCharacters?.()}><EyeOff size={17}/></button>}
    </div>
   </nav>

   {/* 2. Middle Navigation / News List Column */}
   <aside className="workbench-list" hidden={rail==='calendar'} aria-label={rail==='calendar'?'模型日历说明':rail==='news'?'今日新闻列表':'会话导航'}>
    {rail!=='calendar'&&<button className="calendar-shortcut" onClick={()=>setRail('calendar')}><CalendarDays size={19}/><span><strong>模型发布日历</strong><small>新模型 · 官方预告 · 发布历史</small></span><b>›</b></button>}
    {rail==='calendar'?<div className="calendar-about"><CalendarDays size={30}/><h2>模型雷达</h2><p>跟进模型动态，区分已经发生的发布与尚未确定的预测。</p><p><strong>已发布</strong><br/>查看正式发布历史。</p><p><strong>已官宣</strong><br/>来源明确公布的预告。</p><p><strong>预测</strong><br/>保留可信度与依据，不把推测当作确定日期。</p><small>数据来自 WearIT，无需调用本机模型。</small></div>:rail==='news'?<>
     <header className="list-header">
      <h1>今日见闻</h1>
      <button className="list-header-action" onClick={()=>setToolsModal(true)} title="配置新闻定时任务"><Clock size={14}/><span>定时</span></button>
     </header>
     <div className="news-hub-list">
      {newsHubItems.length?newsHubItems.map(item=><button key={item.key} className={'news-hub-item'+(item.unread?' has-unread':'')} onClick={()=>setNewsDetail({article:item.article,roomId:item.roomId,peer:item.peer,startDiscussion:item.unread>0})}>
       <div className="news-hub-meta">
        <span>{item.peerName?`好友分享 · ${item.peerName}`:(item.article.source||'WearIT')}</span>
        {item.unread>0?<b className="friend-unread-count">{item.unread}</b>:<time>{formatShortTime(item.time)}</time>}
       </div>
       <strong>{item.article.title}</strong>
       <small>{item.discussionCount?`${item.discussionCount} 条讨论 · 点击查看`:'点击阅读正文或问 Agent'}</small>
      </button>):<div className="list-empty-hint"><Newspaper size={24}/><p>暂无新闻简报</p><small>在左侧定时任务中开启每日 AI 新闻，或立即执行一次。</small></div>}
     </div>
    </>:<>
     <header className="list-header">
      <h1>消息</h1>
      {friendsList.length>2&&<label className="list-search"><Search size={13}/><input aria-label="搜索好友" placeholder="搜索好友" value={search} onChange={e=>setSearch(e.target.value)}/></label>}
     </header>
     <nav className="friend-conversation-list" aria-label="会话列表">
      <button className={'agent-pinned-card'+(isAgent&&!isContacts?' selected':'')} aria-current={isAgent&&!isContacts?'page':undefined} onClick={()=>{setRail('messages');setAgentExternalTab('chat');choose('agent')}}>
       <CompanionAvatar skin={agent?.skin} name={agent?.name||'Agent'}/>
       <span>
        <strong>Agent · {agent?.name||'助理'}</strong>
        <small>{agentBusy?'正在思考处理…':lastAgentMsg?.newsDigest?.articles?.length?`今日 ${lastAgentMsg.newsDigest.topic||'AI'} 新闻 · ${lastAgentMsg.newsDigest.articles.length} 条`:lastAgentMsg?.text||'我的私人助理 · 随时待命'}</small>
       </span>
       {!!agentUnread&&<b className="friend-unread-count">{agentUnread>99?'99+':agentUnread}</b>}
      </button>

      <div className="list-section-label">
       <span>好友</span>
       <small>{friendsList.filter(f=>f.online).length}/{friendsList.length}</small>
      </div>

      {friendsList.map(p=>{
       const count=state.peerUnread?.[p.id]||cloud?.direct?.unread[p.id]||0;
       const preview=peerPreview(p.id);
       return <button key={p.id} className={'friend-row'+(peer===p.id&&!isContacts?' selected':'')} aria-current={peer===p.id&&!isContacts?'page':undefined} onClick={()=>{setRail('messages');choose(p.id)}}>
        <div className="row-avatar-wrap">
         <CompanionAvatar skin={p.profile?.skin} name={p.profile?.name||p.name}/>
         <i className={'row-presence-dot'+(p.online?' online':'')} aria-hidden="true"/>
        </div>
        <span>
         <div className="row-top-line">
          <strong>{p.profile?.name||p.name}</strong>
          {preview?.time?<time>{formatShortTime(preview.time)}</time>:null}
         </div>
         <small className="conversation-presence">{preview?.text||(p.online?'在线 · 点击开聊':'离线 · 可留言')}</small>
        </span>
        {!!count&&<b className="friend-unread-count">{count>99?'99+':count}</b>}
       </button>;
      })}

      {!friendsList.length&&<p className="list-empty-inline">{search?'没有匹配的好友':'连接云端后，好友会显示在这里'}</p>}
     </nav>
     <button className={'friend-agent-link'+(isContacts?' active':'')} onClick={()=>{setRail('contacts');choose('contacts')}}>
      <Users size={14}/>
      <span>添加好友 / 好友申请</span>
      {pendingRequests>0&&<b className="friend-unread-count">{pendingRequests}</b>}
     </button>
    </>}
   </aside>

   {/* 3. Main Conversation / Content Stage */}
   <main className="friend-conversation">
    {rail==='calendar'?<ModelCalendar/>:isContacts?<div className="unified-contacts">
     <header className="friend-chat-heading">
      <div><strong>好友广场与申请</strong><small>管理好友关系、查看在线目录与待审批申请</small></div>
     </header>
     <div className="unified-contacts-body">
      {agent&&<CloudPanel cloud={cloud} agent={agent} act={act} disabled={!connected||sending} onChat={id=>{setRail('messages');choose(id)}}/>}
     </div>
    </div>:isAgent?<LiteApp embedded requestedTab={agentExternalTab} onTabConsumed={()=>setAgentExternalTab(null)} inspectorOpen={inspectorOpen} onToggleInspector={()=>setInspectorOpen(v=>!v)}/>:<>
     <header className="friend-chat-heading">
      <div className="heading-identity">
       <strong>{person?.profile?.name||person?.name||'好友聊天'}</strong>
       <small><i className={person?.online?'online':''}/>{person?.online?'在线':'离线 · 可留言'}</small>
      </div>
      <div className="heading-actions">
       <button className={'icon-toggle'+(inspectorOpen?' active':'')} aria-label={inspectorOpen?'收起资料抽屉':'展开资料抽屉'} title={inspectorOpen?'收起右侧资料':'展开右侧资料'} onClick={()=>setInspectorOpen(v=>!v)}>
        <PanelRight size={17}/>
       </button>
      </div>
     </header>

     {error&&<div className="stage-error-wrap"><ErrorNotice error={error}/></div>}

     {pendingRooms.length>0&&<nav className="news-pending-discussions" aria-label="有新回复的讨论">{pendingRooms.map(r=><button key={r.roomId} onClick={()=>setNewsDetail({article:r.article,roomId:r.roomId,peer,startDiscussion:true})}><strong>{r.count} 条新回复</strong><span>{r.article.title}</span><small>查看讨论 →</small></button>)}</nav>}

     {attention.length>0&&<nav className="conversation-actions" aria-label="待处理事项">{attention.map(item=><button key={item.id} onClick={()=>locate(item.id)}>{item.label} →</button>)}</nav>}

     <div className="friend-chat-messages" ref={viewport} onScroll={()=>{const box=viewport.current;if(box){stickBottom.current=box.scrollHeight-box.scrollTop-box.clientHeight<60;if(stickBottom.current)setNewBelow(false)}}}>
      {timeline.length?timeline.map(entry=><div key={entry.type+entry.id} id={'event-'+entry.type+':'+entry.id} className={'timeline-entry '+(located===entry.type+':'+entry.id?'is-located':'')}>{(()=>{
       if(entry.type==='draft'){const draft=localPlays.find(d=>d.id===entry.id)!;return <LocalPlayCard key={entry.id} draft={draft} remote={interactions.find(i=>i.key===draft.id)} act={act} disabled={disabled}/>}
       if(entry.type==='interaction')return <Interactions key={entry.id} cloud={only('interaction',entry.id)} effects={state.interactionEffects||[]} initialKind="gift.flowers" act={act} disabled={disabled} historyOpen/>;
       if(entry.type==='visit'&&agent)return <CloudPanel key={entry.id} cloud={only('visit',entry.id)} agent={agent} act={act} disabled={disabled} visitsOnly historyOpen onVisit={()=>play('visit')}/>;
       if(entry.type==='update')return <UpdateInvitations key={entry.id} cloud={only('update',entry.id)} currentVersion={state.updates?.currentVersion||'—'} act={act} disabled={disabled} historyOpen onChooseFriends={()=>{}}/>;
       if(entry.type==='agent-outgoing'){const m=agentOutgoing.find(m=>m.id===entry.id)!;return <article className="local-play-card outgoing" key={entry.id}><span className="local-play-label">Agent 代问 · {m.status==='queued'?'等待投递':'已发送'}</span><p>{m.text}</p></article>}
       if(entry.type==='agent'){const m=exchanges.find(i=>i.id===entry.id)!;return <div className="agent-exchange" key={entry.id}>{['waiting_owner','drafting'].includes(m.status)?<CloudConfirmations cloud={only('agent',entry.id)} act={act} disabled={disabled}/>:<article className="local-play-card"><span className="local-play-label">Agent 交流 · {m.status==='failed'?'处理失败':m.status==='done'?'已处理':'已收到'}</span><p>{m.message.text}</p>{m.result&&<small>已回复：{m.result}</small>}{m.error&&<p className="lite-error">{m.error}</p>}</article>}</div>}
       if(entry.type!=='message')return null;
       const m=messages.find(m=>m.id===entry.id)!;
       const news=parseNewsMessage(m.text);
       if(news?.type==='share')return <article key={m.id} className={m.incoming?'incoming':'outgoing'}><NewsCard article={news.article} shared unreadCount={pendingRooms.find(r=>r.roomId===news.roomId)?.count||0} discussionCount={discussionFor(cloud?.direct?.messages||[],peer,news.roomId)?.messages.length||0} onOpen={()=>setNewsDetail({article:news.article,roomId:news.roomId,peer})}/><small>{m.status==='queued'?'等待投递':'已分享 · 详情内讨论'}</small></article>;
       return <article key={m.id} className={m.incoming?'incoming':'outgoing'}><p>{m.text}</p><small>{m.createdAt?new Date(m.createdAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):''}{!m.incoming?(' · '+messageStatus('direct',m.status).label):''}</small></article>;
      })()}</div>):<div className="friend-chat-empty">和 {person?.profile?.name||person?.name||'朋友'} 说点什么吧<small>直聊消息、送花/烟花效果、串门记录和新闻讨论都会留在这里。</small></div>}
     </div>

     {newBelow&&<button className="conversation-jump" onClick={()=>{if(viewport.current)viewport.current.scrollTop=viewport.current.scrollHeight;stickBottom.current=true;setNewBelow(false)}}>回到最新消息 ↓</button>}

     <div className="composer-dock">
      {tools&&<div className="friend-play-tools">
       <div className="play-tools-head">
        <span>更多玩法与收藏</span>
        <button aria-label="收起玩法" className="friend-tools-close" onClick={()=>setTools(false)}><X size={14}/></button>
       </div>
       <div className="play-tools-grid">
        <button onClick={()=>play('update')}><ArrowUpCircle size={18}/><span>邀请更新</span></button>
        {state.playTemplates?.map(p=><button key={p.id} onClick={()=>play('custom.effect',p)}><span className="tpl-icon">{p.icon}</span><span>{p.title}</span></button>)}
       </div>
      </div>}

      <form className="friend-message-composer" onSubmit={send}>
       <textarea aria-label="好友聊天消息" placeholder={`给 ${person?.profile?.name||person?.name||'好友'} 发消息…（Enter 发送，Shift+Enter 换行）`} value={drafts[peer]||''} disabled={!person||sending} maxLength={16000} onChange={e=>{delete keys.current[peer];setDrafts({...drafts,[peer]:e.target.value})}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit()}}}/>
       <div className="composer-bar">
        <div className="composer-quick-plays">
         <button type="button" title="送花" aria-label="送花" disabled={!person} onClick={()=>play('gift.flowers')}><Flower2 size={17}/></button>
         <button type="button" title="烟花" aria-label="烟花" disabled={!person} onClick={()=>play('celebration.fireworks')}><Sparkles size={17}/></button>
         <button type="button" title="串门" aria-label="串门" disabled={!person} onClick={()=>play('visit')}><DoorOpen size={17}/></button>
         <button type="button" title="自定义效果" aria-label="自定义" disabled={!person} onClick={()=>play('custom.effect')}><WandSparkles size={17}/></button>
         <button type="button" className={tools?'active':''} aria-label="展开玩法" aria-expanded={tools} title="更多玩法与邀请更新" disabled={!person} onClick={()=>setTools(!tools)}><Plus size={17}/></button>
        </div>
        <span className="composer-mode-hint">{person?.directProtocol!==1?'对方需升级后才能直接聊天':'直发好友 · 不调模型'}</span>
        <button className="friend-send" disabled={disabled||sending||person?.directProtocol!==1||!drafts[peer]?.trim()}><Send size={14}/>发送</button>
       </div>
      </form>
     </div>
    </>}
   </main>

   {/* 4. Right Slide-Over Inspector Drawer */}
   {rail!=='calendar'&&!isContacts&&inspectorOpen&&<aside className="friend-profile friend-inspector" aria-label="好友公开资料">
    <div className="inspector-header">
     <span>{isAgent?'助理档案':'好友资料'}</span>
     <button aria-label="关闭资料面板" onClick={()=>setInspectorOpen(false)}><X size={14}/></button>
    </div>
    <div className="friend-profile-identity">
     <CompanionAvatar skin={isAgent?agent?.skin:person?.profile?.skin} name={isAgent?agent?.name||'Agent':person?.profile?.name||person?.name||'好友'}/>
     <h2>{isAgent?agent?.name||'Agent':person?.profile?.name||person?.name||'好友'}</h2>
     <span className="friend-profile-status"><i className={(isAgent?connected&&agent?.enabled:person?.online)?'online':''}/>{isAgent?(agentBusy?'正在处理':agent?.enabled?`本地就绪 · ${engineName}`:'休息中'):person?.online?'在线':'离线'}</span>
    </div>
    <section className="inspector-section">
     <h3>{isAgent?'定位与职责':'公开介绍'}</h3>
     <p>{isAgent?(agent?.publicBio?.trim()||'你的私人桌面助理，负责整理消息、每日简报、制作互动效果与代为联络好友。'):(person?.profile?.publicBio?.trim()||'这位好友还没有填写公开介绍。')}</p>
    </section>

    {isAgent?<section className="inspector-section">
     <h3>快捷管理</h3>
     <div className="inspector-quick-list">
      <button onClick={()=>setToolsModal(true)}><Clock size={14}/><span>定时任务（{(state.scheduledTasks||[]).filter(t=>t.agentId===agent?.id&&t.enabled).length} 个运行中）</span></button>
      <button onClick={()=>setAgentExternalTab('settings')}><Settings size={14}/><span>连接云端与模型设置</span></button>
     </div>
    </section>:<section className="inspector-section inspector-activities">
     <h3>近期互动</h3>
     {recentActivities.length?<div className="activity-list">{recentActivities.map(item=><button key={item.id} className="activity-row" onClick={()=>locate(item.id)}>
      <div className={'activity-badge '+item.kind}>{item.kind==='visit'?<DoorOpen size={14}/>:item.kind==='update'?<ArrowUpCircle size={14}/>:<Sparkles size={14}/>}</div>
      <div>
       <strong>{item.title}</strong>
       <small data-tone={item.tone}>{item.status}{item.time?` · ${formatShortTime(item.time)}`:''}</small>
      </div>
     </button>)}</div>:<p className="inspector-empty">暂无互动记录，试试从下方送一束花或去串门吧。</p>}
    </section>}
   </aside>}

   {toolsModal&&agent&&<AgentTools agentId={agent.id} tasks={state.scheduledTasks||[]} act={act} error={error} onClose={()=>setToolsModal(false)}/>}
   {newsDetail&&agent&&<NewsDetail {...newsDetail} cloud={cloud} agentId={agent.id} act={act} error={error} onClose={()=>setNewsDetail(null)} onDiscuss={()=>{setRail('messages');choose('agent')}}/>}
   {!isAgent&&!isContacts&&compose&&<PlayDialog key={compose.peer+compose.kind} kind={compose.kind} template={compose.template} peerName={person?.profile?.name||person?.name||'好友'} disabled={disabled} onClose={()=>setCompose(null)} onSubmit={data=>{const target=compose.peer;return data.kind==='visit'?act('cloud/visit',{to:target,note:data.message,url:data.url,key:crypto.randomUUID()}):data.kind==='update'?act('update-invitations/send',{to:target,note:data.message,key:crypto.randomUUID()}):act('interactions/create-local',{...data,to:target,brief:data.brief||(data.kind==='gift.flowers'?'一束花缓缓展开，搭配柔和花瓣与祝福文字。':'夜空中绽放烟花，出现祝福。')})}}/>}
  </div>
 </ChatTimelineContext.Provider>;
}
