const {createEdgePresence}=require('./edge-presence.cjs');
const {createEffectPlayer}=require('./effect-window.cjs');
const {app,BrowserWindow,ipcMain,screen,Tray,Menu,nativeImage,shell,session,powerMonitor}=require('electron');
const {spawn}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
const {installDesktopRecovery}=require('./desktop-recovery.cjs');
const logDir=path.join(__dirname,'.data');fs.mkdirSync(logDir,{recursive:true});
function lifecycleLog(event,detail=''){try{fs.appendFileSync(path.join(logDir,'desktop-lifecycle.log'),`${new Date().toISOString()} ${event} ${detail}\n`,{mode:0o600})}catch{}}
let disposeRecovery;
const {conversation,summarizeInbox,markConversationRead,recoveryWindows}=require('./desktop-inbox.cjs');
const uiFile=path.join(logDir,'desktop-ui.json');
let ui={hidden:false,seen:{}};try{const value=JSON.parse(fs.readFileSync(uiFile,'utf8'));ui={hidden:value.hidden===true,seen:value.seen&&typeof value.seen==='object'?value.seen:{}}}catch{}
let desktopState={agents:[],messages:[]},inbox=summarizeInbox(desktopState),traySignature='';
const saveUI=()=>{try{const temp=uiFile+'.tmp';fs.writeFileSync(temp,JSON.stringify(ui),{mode:0o600});fs.renameSync(temp,uiFile)}catch(e){lifecycleLog('ui-save-failed',e.message)}};
function publishInbox(){const value={...inbox,hidden:ui.hidden};for(const win of [...pets.values(),...histories.values(),...(friendWindow?[friendWindow]:[])])if(!win.isDestroyed())win.webContents.send('desktop-status',value)}
function refreshTray(){
 publishInbox();if(!tray)return;
 const signature=JSON.stringify([ui.hidden,inbox]);if(signature===traySignature)return;traySignature=signature;
 const image=nativeImage.createFromPath(path.join(__dirname,'assets/tray',inbox.total?'unread.png':'idle.png')).resize({width:22,height:22});
 tray.setImage(image);tray.setTitle(inbox.total?String(Math.min(inbox.total,99))+(inbox.total>99?'+':''):'');
 tray.setToolTip(`知交信使 · ${inbox.messages+(inbox.peerMessages||inbox.direct)} 条消息 · ${inbox.plays} 个玩法 · ${inbox.updates} 个升级邀请`);
 const items=[{label:'知交信使 · 后台运行中',enabled:false},{label:ui.hidden?'显示桌面人物':'隐藏桌面人物',click:()=>ui.hidden?showAll():hideAll()},{type:'separator'}];
 items.push({label:'打开好友',click:()=>openDesktop(undefined,'friends')});
 if(!inbox.total)items.push({label:'暂时没有新消息或待查收玩法',enabled:false});
 for(const a of inbox.agents){if(a.peerMessages)items.push({label:`查看好友消息（${a.peerMessages}）`,click:()=>openFriend(Object.keys(desktopState.peerUnread||{}).find(id=>desktopState.peerUnread[id]>0))});else if(a.direct)items.push({label:`查看好友直聊（${a.direct}）`,click:()=>openFriend(Object.keys(desktopState.cloud?.direct?.unread||{}).find(id=>desktopState.cloud.direct.unread[id]>0))});if(a.messages)items.push({label:`查看${a.name}的消息（${a.messages}）`,click:()=>openDesktop(a.id,'chat')});if(a.interactions)items.push({label:`查收${a.name}的玩法（${a.interactions}）`,click:()=>openFriend(desktopState.cloud?.interactions?.find(i=>i.to===desktopState.cloud.deviceId&&['pending','failed','ready'].includes(i.status))?.from)});if(a.visits)items.push({label:`查看${a.name}的敲门（${a.visits}）`,click:()=>openFriend(desktopState.cloud?.visits?.find(i=>i.to===desktopState.cloud.deviceId&&i.status==='pending')?.from)});if(a.updates)items.push({label:`查看${a.name}的升级邀请（${a.updates}）`,click:()=>openFriend(desktopState.cloud?.updateInvitations?.find(i=>i.to===desktopState.cloud.deviceId&&i.status==='pending')?.from)});if(a.requests)items.push({label:`查看${a.name}的好友申请（${a.requests}）`,click:()=>openDesktop(a.id,'friends')});}
 items.push({type:'separator'},{label:'打开聊天',click:()=>openDesktop()},{label:'查看历史聊天',click:()=>openFriend('agent')},{type:'separator'},{label:'退出知交信使',click:()=>app.quit()});
 tray.setContextMenu(Menu.buildFromTemplate(items));
}
function updateInbox(state){desktopState=state;let changed=false;for(const a of state.agents||[])if(ui.seen[a.id]===undefined){ui.seen[a.id]=conversation(state,a.id).at(-1)?.id||'';changed=true}if(changed)saveUI();inbox=summarizeInbox(state,ui.seen);refreshTray();updateEdgeNotices(state)}
function hideAll(){edgePresence.suspend();ui.hidden=true;saveUI();for(const pet of pets.values())pet.webContents.send('desktop-open','collapse');for(const win of [...pets.values(),...histories.values(),...Array.from(visitors.values(),v=>v.win),...(friendWindow?[friendWindow]:[])])win.hide();refreshTray()}
function openDesktop(id,view='chat'){
 if(['inbox','interactions','visits','updates'].includes(view)){const c=desktopState.cloud;const items=view==='visits'?c?.visits:view==='updates'?c?.updateInvitations:c?.interactions;const item=items?.find(i=>i.to===c.deviceId&&['pending','ready','failed'].includes(i.status));if(item&&c?.friends?.includes(item.from)){openFriend(item.from);return}}
 openFriend(view==='friends'?'contacts':'agent');
}

const {expandedBounds,characterCenter,conversationPlacement,visitorBounds}=require('./window-placement.cjs');
let friendWindow=null,friendPeer='';
let service,tray,setup,visitorTimer,pickVisitors,visitorsBusy=false,quitting=false;
const visitors=new Map();
const characterDrags=new Map();
const pets=new Map(),histories=new Map(),placements=new Map();
const url='http://127.0.0.1:4317';
const preferences={preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false};
const edgePresence=createEdgePresence({screen,suppressed:()=>ui.hidden||!!friendWindow?.isVisible()||quitting,isDragging:win=>characterDrags.has(win),onState:(id,value)=>{const pet=pets.get(id);if(pet&&!pet.isDestroyed())pet.webContents.send('edge-presence',value)}});
function updateEdgeNotices(state){for(const a of inbox.agents){const c=state.cloud?.agentId===a.id?state.cloud:null;const key=JSON.stringify([conversation(state,a.id).at(-1)?.id,c?.direct?.messages?.filter(m=>m.incoming&&!m.read).map(m=>m.id),state.peerUnread,c?.requests?.filter(r=>r.recipient===c.deviceId&&r.status==='pending').map(r=>r.id),c?.visits?.filter(v=>v.to===c.deviceId&&v.status==='pending').map(v=>v.id),c?.interactions?.filter(i=>i.to===c.deviceId&&['pending','ready','failed'].includes(i.status)).map(i=>[i.id,i.status])]);edgePresence.notice(a.id,key,a.unread+(a.peerMessages||a.direct)+a.requests+a.plays+a.updates)}}
let edgeTimer;
const effectPlayer=createEffectPlayer({BrowserWindow,screen,preferences,url});
async function ready(){for(let i=0;i<80;i++){try{const r=await fetch(url+'/api/state');if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,250))}throw Error('本地服务启动超时')}
function openHistory(id){
 if(setup){setup.show();return}
 if(!pets.has(id))id=pets.keys().next().value;
 if(!id)return;
 let history=histories.get(id);
 if(!history){
  history=new BrowserWindow({width:520,height:700,minWidth:360,minHeight:480,show:false,title:'知交信使 · 历史聊天',transparent:true,backgroundColor:'#00000000',webPreferences:preferences});
  histories.set(id,history);history.loadURL(url+'/?history=1&agent='+encodeURIComponent(id));
  history.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  history.on('close',e=>{if(!quitting){e.preventDefault();history.hide()}});
 }
 history.show();history.focus();
}
function openFriend(peer){
 if(typeof peer!=='string'||!['agent','contacts'].includes(peer)&&!desktopState.cloud?.friends?.includes(peer))return;
 for(const pet of pets.values())if(!pet.isDestroyed()){pet.webContents.send('desktop-open','collapse');pet.hide();}
 edgePresence.suspend();
 friendPeer=peer;
 if(!friendWindow||friendWindow.isDestroyed()){
  const pet=pets.values().next().value;let area=screen.getPrimaryDisplay().workArea;
  const bounds=pet?.getBounds(),center=bounds?characterCenter(bounds,placements.get(pet)||'left'):{x:area.x+area.width,y:area.y+area.height/2};
  if(bounds)area=screen.getDisplayNearestPoint(center).workArea;
  const width=Math.min(780,area.width),height=Math.min(720,area.height);
  friendWindow=new BrowserWindow({width,height,minWidth:560,minHeight:480,x:Math.max(area.x,Math.min(center.x-width-90,area.x+area.width-width)),y:Math.max(area.y,Math.min(Math.round(center.y-height/2),area.y+area.height-height)),title:'知交信使 · 聊天',backgroundColor:'#24211e',show:false,webPreferences:preferences});
  const win=friendWindow;win.loadURL(url+'/?friend='+encodeURIComponent(peer));
  win.once('ready-to-show',()=>{if(!win.isDestroyed()){win.show();win.focus()}});
  win.on('show',()=>{for(const pet of pets.values())if(!pet.isDestroyed())pet.hide()});
  win.on('close',event=>{if(!quitting){event.preventDefault();win.hide();showAll()}});
  win.on('closed',()=>{if(friendWindow===win)friendWindow=null});
 }else{friendWindow.show();friendWindow.focus();friendWindow.webContents.send('friend-selected',peer)}
}
function createPets(agents){
 const work=screen.getPrimaryDisplay().workArea;
 agents.forEach((a,index)=>{
  if(pets.has(a.id))return;
  // Each companion owns its canvas and conversation; transparent regions pass through.
  const gap=Math.min(640,Math.max(250,(work.width-260)/Math.max(1,agents.length-1)));
  const canvas={x:Math.max(work.x,work.x+work.width-320-index*gap),y:Math.max(work.y,work.y+work.height-365),width:Math.min(300,work.width),height:Math.min(360,work.height)};
  const pet=new BrowserWindow({...canvas,title:a.name+' · 知交信使',transparent:true,backgroundColor:'#00000000',frame:false,hasShadow:false,resizable:false,alwaysOnTop:true,skipTaskbar:true,show:!ui.hidden,webPreferences:preferences});
  pets.set(a.id,pet);edgePresence.register(a.id,pet);pet.webContents.on('did-finish-load',()=>pet.webContents.send('edge-presence',edgePresence.get(a.id)));placements.set(pet,'left');pet.loadURL(url+'/?agent='+encodeURIComponent(a.id)+'&panel=left');
  let placementTimer;
  pet.on('move',()=>{clearTimeout(placementTimer);if(characterDrags.has(pet)||edgePresence.get(a.id)?.phase!=='shown')return;placementTimer=setTimeout(()=>{
   if(pet.isDestroyed())return;
   const previous=placements.get(pet)||'left';const bounds=pet.getBounds();
   const work=screen.getDisplayNearestPoint(characterCenter(bounds,previous)).workArea;
   const next=conversationPlacement(bounds,previous,work);
   placements.set(pet,next.side);
   if(next.side!==previous){pet.setBounds(next.bounds);pet.webContents.send('panel-placement',next.side);}
  },160);});
  pet.on('closed',()=>{characterDrags.delete(pet);clearTimeout(placementTimer);placements.delete(pet)});
  pet.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  pet.on('closed',()=>pets.delete(a.id));
 });
}
async function syncVisitors(){
 if(visitorsBusy||quitting||!pickVisitors)return;visitorsBusy=true;
 try{
  for(const [id,entry] of visitors)if(entry.expiresAt<=Date.now()){entry.win.destroy();visitors.delete(id)}
  const response=await fetch(url+'/api/state',{signal:AbortSignal.timeout(5000)});if(!response.ok)return;
  const state=await response.json();if(quitting)return;updateInbox(state);
  const wanted=pickVisitors(state);const ids=new Set(wanted.map(v=>v.id));
  for(const [id,entry] of visitors)if(!ids.has(id)){entry.win.destroy();visitors.delete(id)}
  for(const visitor of wanted){
   if(visitors.has(visitor.id))continue;const host=pets.get(visitor.hostId);if(!host||host.isDestroyed())continue;
   const side=placements.get(host)||'left';const bounds=host.getBounds();const work=screen.getDisplayNearestPoint(characterCenter(bounds,side)).workArea;
   const win=new BrowserWindow({...visitorBounds(bounds,side,work),title:visitor.name+' · 来做客',transparent:true,backgroundColor:'#00000000',frame:false,hasShadow:false,resizable:false,alwaysOnTop:true,skipTaskbar:true,show:false,webPreferences:preferences});
   visitors.set(visitor.id,{win,expiresAt:visitor.expiresAt});
   win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
   win.loadURL(url+'/?agent='+encodeURIComponent(visitor.hostId)+'&visit='+encodeURIComponent(visitor.id));
   win.once('ready-to-show',()=>{if(!win.isDestroyed()&&!ui.hidden)win.showInactive()});
   win.on('close',e=>{if(!quitting){e.preventDefault();win.hide()}});
   win.on('closed',()=>visitors.delete(visitor.id));
   host.webContents.send('visitor-arrived',visitor.id);
  }
 }catch(e){console.error('同步桌面访客失败：'+e.message)}finally{visitorsBusy=false;}
}
function showAll(){ui.hidden=false;saveUI();if(setup)setup.show();else{if(!friendWindow?.isVisible())edgePresence.reveal();for(const {win} of visitors.values())win.showInactive()}refreshTray()}
app.on('web-contents-created',(_event,contents)=>{contents.on('render-process-gone',(_event,details)=>{lifecycleLog('renderer-gone',details.reason);if(!quitting&&details.reason!=='clean-exit'&&!contents.isDestroyed())contents.reload()});contents.on('will-frame-navigate',event=>event.preventDefault());contents.setWindowOpenHandler(()=>({action:'deny'}));});
if(!app.requestSingleInstanceLock()){app.quit();}else{
app.on('second-instance',showAll);
app.whenReady().then(async()=>{
 if(quitting)return;
 edgeTimer=setInterval(()=>edgePresence.tick(),16);edgeTimer.unref?.();
 // macOS accessory apps keep their Tray entry and windows without a Dock icon.
 if(process.platform==='darwin')app.setActivationPolicy('accessory');
 // Generated opaque-origin frames must not send network traffic outside the local UI.
 session.defaultSession.webRequest.onBeforeRequest({urls:['*://*/*']},(details,callback)=>{let allowed=false;try{const target=new URL(details.url);allowed=['127.0.0.1','localhost'].includes(target.hostname)&&target.port==='4317';}catch{}callback({cancel:!allowed});});
 session.defaultSession.on('will-download',event=>event.preventDefault());
 try{await fetch(url+'/api/state')}catch{const runtimeLog=fs.openSync(path.join(logDir,'runtime.log'),'a',0o600);service=spawn(process.execPath,[path.join(__dirname,'runtime/index.mjs')],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1',PATH:'/opt/homebrew/bin:/usr/local/bin:'+process.env.PATH},stdio:['ignore',runtimeLog,runtimeLog]});fs.closeSync(runtimeLog);service.on('exit',(code,signal)=>lifecycleLog('runtime-exit',JSON.stringify({code,signal})));}
 await ready();lifecycleLog('desktop-started',String(process.pid));
 ({desktopVisitors:pickVisitors}=await import('./shared/desktop-visitors.mjs'));
 const state=await (await fetch(url+'/api/state')).json();updateInbox(state);
 if(state.registrationComplete===false||state.cloudOnboarding==='pending'){
  setup=new BrowserWindow({width:1000,height:820,minWidth:760,minHeight:650,title:'知交信使 · 注册助理',backgroundColor:'#151719',webPreferences:preferences});
  setup.loadURL(url+'/?register=1');setup.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  setup.on('closed',()=>{setup=null;if(!pets.size)app.quit()});
 }else createPets(state.agents);
 ipcMain.handle('open-visit-link',async(_event,value)=>{if(typeof value!=='string'||value.length>2000)throw Error('Invalid link');const target=new URL(value);if(target.protocol!=='https:'||target.username||target.password)throw Error('Only HTTPS links are supported');await shell.openExternal(target.href)});
 ipcMain.handle('finish-registration',async()=>{const current=await (await fetch(url+'/api/state')).json();if(!current.registrationComplete||current.cloudOnboarding==='pending')throw Error('请先连接云端或选择暂时跳过');createPets(current.agents);setup?.close()});
 ipcMain.handle('approve-client-update',async(e,{id,confirm}={})=>{
  const win=BrowserWindow.fromWebContents(e.sender);if(confirm!==true||!win?.isVisible()||!win.isFocused()||![...pets.values(),friendWindow].includes(win)||typeof id!=='string'||!/^[-a-zA-Z0-9]+$/.test(id))throw Error('请由主人在桌面确认升级');
  if(!service||service.killed)throw Error('本机服务由其他进程启动，请先停止单独的 npm start，再重开桌面客户端后升级');
  const response=await fetch(url+'/api/update-invitations/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,confirm:true})});const result=await response.json();if(!response.ok)throw Error(result.error);
  if(result.file!==path.join(__dirname,'.data','update-jobs',id+'.json'))throw Error('升级任务路径无效');
  const fd=fs.openSync(path.join(logDir,'client-update.log'),'a',0o600);
  try{const env={...process.env,PATH:'/opt/homebrew/bin:/usr/local/bin:'+process.env.PATH};delete env.ELECTRON_RUN_AS_NODE;const updater=spawn('node',[path.join(__dirname,'scripts/update-approved.mjs'),result.file,String(process.pid)],{cwd:__dirname,env,detached:true,stdio:['ignore',fd,fd]});await new Promise((resolve,reject)=>{updater.once('spawn',resolve);updater.once('error',reject)});updater.unref();setTimeout(()=>app.quit(),300);return {started:true};}
  catch(error){await fetch(url+'/api/update-invitations/launch-failed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});throw Error('更新器未启动，客户端保持运行，请手动检查日志');}finally{fs.closeSync(fd)}
 });
 ipcMain.handle('effect-play',(event,payload)=>{if(![...pets.values(),...histories.values(),friendWindow].some(w=>w&&!w.isDestroyed()&&w.webContents===event.sender))throw Error('请从聊天窗口播放特效');return effectPlayer.play(event.sender,payload)});
 ipcMain.on('effect-cancel',event=>effectPlayer.cancel(event.sender));
 ipcMain.handle('effect-payload',event=>effectPlayer.payload(event.sender));
 ipcMain.on('effect-ready',event=>effectPlayer.ready(event.sender));
 ipcMain.on('effect-close',(event,error)=>effectPlayer.close(event.sender,error));
 ipcMain.on('open-friend',(_event,peer)=>openFriend(peer));
 ipcMain.on('peer-read',async(event,peer)=>{if(!friendWindow||event.sender!==friendWindow.webContents||!friendWindow.isVisible()||!friendWindow.isFocused()||peer!==friendPeer)return;try{await fetch(url+'/api/conversations/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({peer})})}catch(error){lifecycleLog('peer-read-failed',error.message)}});
 ipcMain.on('friend-read',async(event,{peer,id}={})=>{if(!friendWindow||event.sender!==friendWindow.webContents||!friendWindow.isVisible()||!friendWindow.isFocused()||peer!==friendPeer)return;try{await fetch(url+'/api/cloud/direct-read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:peer,id})})}catch(error){lifecycleLog('friend-read-failed',error.message)}});
 ipcMain.on('open-agent',(_event,view)=>openDesktop(undefined,['chat','friends','inbox','updates','interactions','visits'].includes(view)?view:'chat'));
 ipcMain.handle('desktop-status',()=>({...inbox,hidden:ui.hidden}));
 ipcMain.on('desktop-hide',e=>{if([...pets.values(),...histories.values(),friendWindow].includes(BrowserWindow.fromWebContents(e.sender)))hideAll()});
 ipcMain.on('desktop-read',(e,{agentId,lastId}={})=>{
  const win=BrowserWindow.fromWebContents(e.sender);if(!win||!win.isVisible()||!win.isFocused()||!(pets.get(agentId)===win||histories.get(agentId)===win||win===friendWindow&&friendPeer==='agent'))return;
  if(markConversationRead(desktopState,ui.seen,agentId,lastId)){saveUI();inbox=summarizeInbox(desktopState,ui.seen);refreshTray()}
 });
 ipcMain.handle('panel-placement',e=>placements.get(BrowserWindow.fromWebContents(e.sender))||'left');
 ipcMain.on('open-updates',(_e,id)=>openDesktop(id,'updates'));
 ipcMain.on('open-history',(_e,id)=>openHistory(id));
 ipcMain.on('hide-history',e=>BrowserWindow.fromWebContents(e.sender)?.hide());
 ipcMain.handle('edge-presence',event=>edgePresence.get([...pets].find(([,w])=>w.webContents===event.sender)?.[0]));
 ipcMain.on('character-activity',event=>edgePresence.activity([...pets].find(([,w])=>w.webContents===event.sender)?.[0]));
 ipcMain.on('character-drag',(event,phase)=>{
  const win=BrowserWindow.fromWebContents(event.sender);if(![...pets.values()].includes(win)||win.isDestroyed())return;
  if(phase==='end'){if(characterDrags.delete(win)){edgePresence.drag([...pets].find(([,w])=>w===win)?.[0],false);win.emit('move');}return}
  if(!win.isVisible())return;
  const point=screen.getCursorScreenPoint();
  if(phase==='begin'){const bounds=win.getBounds();characterDrags.set(win,{point,x:bounds.x,y:bounds.y});edgePresence.drag([...pets].find(([,w])=>w===win)?.[0],true);win.setIgnoreMouseEvents(false);}
  else if(phase==='move'){const start=characterDrags.get(win);if(start)win.setPosition(Math.round(start.x+point.x-start.point.x),Math.round(start.y+point.y-start.point.y));}
 });
 ipcMain.on('pointer-through',(e,value)=>{const win=BrowserWindow.fromWebContents(e.sender);if([...pets.values(),...Array.from(visitors.values(),v=>v.win)].includes(win))win.setIgnoreMouseEvents(value===true,{forward:true})});
 visitorTimer=setInterval(()=>void syncVisitors(),1000);void syncVisitors();
 tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'assets/tray/idle.png')).resize({width:22,height:22}));refreshTray();
 app.on('activate',()=>{if(!ui.hidden)showAll()});
 for(const event of ['resume','unlock-screen','user-did-become-active'])powerMonitor?.on?.(event,()=>edgePresence.recover());
 for(const event of ['display-added','display-removed','display-metrics-changed'])screen.on?.(event,()=>edgePresence.recover());
 disposeRecovery=installDesktopRecovery({powerMonitor,screen,windows:()=>recoveryWindows({hidden:ui.hidden,setup,pets:[...pets.values()].filter(win=>edgePresence.isShown(win)),visitors:Array.from(visitors.values(),v=>v.win),histories:[...histories.values(),...(friendWindow?[friendWindow]:[])]}),isQuitting:()=>quitting,log:lifecycleLog});
}).catch(e=>{console.error(e);app.quit()});
app.on('window-all-closed',()=>{});
app.on('before-quit',()=>{lifecycleLog('before-quit');quitting=true;clearInterval(edgeTimer);edgePresence.dispose();effectPlayer.dispose();disposeRecovery?.();clearInterval(visitorTimer);service?.kill()});

}
