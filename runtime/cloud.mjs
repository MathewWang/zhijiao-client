import {mkdirSync,existsSync,readFileSync,writeFileSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {MessengerClient,validateRelayURL} from '../client/core.mjs';
import {normalizeAgent,normalizePublicProfile} from '../shared/agent-profile.mjs';

// Credentials stay on the loopback server. Renderers receive only this public snapshot.
export class DesktopCloud {
 constructor({dir,getAgent,onChange=()=>{},onOwnerEvent,agentRunner,isPaused=()=>false}){
  this.isPaused=isPaused;this.onOwnerEvent=onOwnerEvent;this.dir=dir;this.getAgent=getAgent;this.onChange=onChange;this.agentRunner=agentRunner;
  mkdirSync(dir,{recursive:true,mode:0o700});this.path=join(dir,'config.json');this.lock=join(dir,'client.lock');
  this.state={registered:false,connected:false,directory:[],friends:[],requests:[],visits:[],interactions:[],updateInvitations:[],messages:[]};
  this.abort=new AbortController();this.closed=false;
  if(existsSync(this.path)){
   const c=JSON.parse(readFileSync(this.path,'utf8'));
   if(c.localAgentId){this.config=c;this.state.registered=true;this.state.deviceId=c.id;this.state.agentId=c.localAgentId;}
  }
 }
 snapshot(){return {...this.state,interactions:this.state.interactions.map(i=>{const {artifact,...plan}=i.plan;return {...i,plan}})};}
 publish(patch){if(this.closed)return;Object.assign(this.state,patch);this.onChange();}
 save(){writeFileSync(this.path,JSON.stringify(this.config,null,2),{mode:0o600});}
 async connect({agentId,relay='https://agentmen.cn',deviceName,inviteToken,publishProfile}){
  if(publishProfile!==true)throw Error('请确认公开设备名、助理名字、形象和简介');
  const agent=this.getAgent(agentId);if(!agent)throw Error('请先创建本机助理');
  if(this.client)throw Error('云端已配置，请使用现有身份');
  // Take the same lock as the headless daemon before adopting its identity.
  try{this.fd=openSync(this.lock,'wx',0o600);}catch{throw Error('无头 Client 正在运行，请先停止它再连接桌面版');}
  try{
   const local=normalizeAgent({...agent,publishProfile:true});const url=validateRelayURL(relay);
   if(existsSync(this.path)){
    this.config=JSON.parse(readFileSync(this.path,'utf8'));
    if(this.config.relay!==url)throw Error('现有 Client 属于其他服务器，请保留原配置并使用独立数据目录');
    if(this.config.localAgentId&&this.config.localAgentId!==agentId)throw Error('现有身份已绑定另一位本机助理');
   }else{
    if(typeof inviteToken!=='string'||!inviteToken)throw Error('首次连接需要注册邀请码');
    const r=await fetch(url+'/v1/devices',{method:'POST',headers:{Authorization:`Bearer ${inviteToken}`,'Content-Type':'application/json'},body:JSON.stringify({name:deviceName,publishProfile:true,profile:this.profile(agent)}),signal:AbortSignal.timeout(15000),redirect:'error'});
    const d=await r.json();if(!r.ok)throw Error(d.error||'注册失败');
    this.config={relay:url,...d,agent:local};this.save();
   }
   this.config.localAgentId=agentId;this.config.agent=local;this.save();
   this.client=new MessengerClient({config:this.config,dbPath:join(this.dir,'client.sqlite'),dataDir:this.dir,agentRunner:this.agentRunner,requireOwnerApproval:true});
   this.publish({registered:true,deviceId:this.config.id,agentId});
   await this.client.api('/v1/profile',{profile:this.profile(agent),publishProfile:true});
   this.profileJSON=JSON.stringify(this.profile(agent));
   await this.poll();
  }catch(e){if(!this.client)this.unlock();throw e;}
 }
 profile(agent){return normalizePublicProfile({name:agent.name,publicBio:agent.publicBio||'',skin:agent.skin});}
 unlock(){if(this.fd!==undefined){closeSync(this.fd);this.fd=undefined;unlinkSync(this.lock);}}
 async start(){
  if(!this.config||this.client||this.closed)return;
  try{
   this.fd=openSync(this.lock,'wx',0o600);
   this.client=new MessengerClient({config:this.config,dbPath:join(this.dir,'client.sqlite'),dataDir:this.dir,agentRunner:this.agentRunner,requireOwnerApproval:true});
  }catch(e){this.publish({error:e.code==='EEXIST'?'Client 数据目录被其他进程占用':e.message});return;}
  this.publish(this.rememberSocial());this.refreshMessages();
  await this.poll();
 }
 async poll(){
  if(!this.client||this.polling||this.closed)return;this.polling=true;
  try{
   const agent=this.getAgent(this.config.localAgentId);if(!agent)throw Error('绑定的本机助理不存在');
   this.config.agent=normalizeAgent({...agent,publishProfile:true});
   const card=JSON.stringify(this.profile(agent));
   if(card!==this.profileJSON){await this.client.api('/v1/profile',{profile:JSON.parse(card),publishProfile:true});this.profileJSON=card;this.save();}
   if(this.closed)return;
   const data=await this.client.api('/v1/sync',{online:agent.enabled,interactionProtocol:2,updateProtocol:1,directProtocol:1});
   if(this.closed)return;
   this.publish({...data,...this.rememberSocial(data),connected:true,error:''});
   if(!this.processing&&!this.isPaused()){
    this.processing=this.client.tick(this.abort.signal).catch(e=>this.publish({error:e.message})).finally(()=>{this.processing=null;if(!this.closed)this.refreshMessages();});
   }
   this.refreshMessages();
  }catch(e){this.publish({connected:false,error:e.message});}finally{this.polling=false;}
 }
 rememberSocial(data={}){
  const db=this.client.db;db.exec('CREATE TABLE IF NOT EXISTS social_history(kind TEXT NOT NULL,id TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(kind,id))');const result={};
  const save=db.prepare('INSERT OR REPLACE INTO social_history VALUES(?,?,?)');
  for(const kind of ['visits','interactions','updateInvitations']){for(const item of data[kind]||[])save.run(kind,item.id,JSON.stringify(item));result[kind]=db.prepare('SELECT json FROM social_history WHERE kind=? ORDER BY rowid').all(kind).map(row=>{const item=JSON.parse(row.json);if(item.expiresAt&&item.expiresAt<Date.now()&&['pending','active','accepted','ready','playing','failed'].includes(item.status)){item.status='expired';item.endedAt=item.expiresAt;}return item})}
  return result;
 }
 refreshMessages(){
  if(this.closed||!this.client)return;
  const incoming=this.client.db.prepare('SELECT id,json,status,error,result FROM inbox ORDER BY rowid').all().map(r=>({...r,message:{...JSON.parse(r.json),createdAt:JSON.parse(r.json).created_at||JSON.parse(r.json).createdAt||0},json:undefined}));
  const agentOutgoing=this.client.db.prepare('SELECT key,json,delivered FROM outbox ORDER BY rowid').all().map(r=>{const m=JSON.parse(r.json);return {id:r.key,peer:m.to,text:m.text,kind:m.kind,createdAt:m.createdAt||0,status:r.delivered?'sent':'queued'}}).filter(m=>m.kind==='question');
  this.publish({messages:incoming.filter(r=>r.message.kind!=='direct'),agentOutgoing,direct:this.client.directSnapshot()});
  this.reportOwner();
 }
 reportOwner(){
  if(!this.onOwnerEvent)return;
  this.client.db.exec('CREATE TABLE IF NOT EXISTS desktop_reports(key TEXT PRIMARY KEY)');
  const has=this.client.db.prepare('SELECT 1 FROM desktop_reports WHERE key=?');
  const mark=this.client.db.prepare('INSERT OR IGNORE INTO desktop_reports(key) VALUES(?)');
  for(const row of this.client.db.prepare("SELECT * FROM inbox WHERE status IN ('waiting_owner','done','failed') ORDER BY rowid").all()){
   const key=`${this.config.id}:${row.id}:${row.status}`;if(has.get(key))continue;
   const m=JSON.parse(row.json);if(m.kind==='direct')continue;const peer=this.state.directory.find(d=>d.id===m.sender);const name=peer?.profile?.name||peer?.name||'好友';
   let text;
   if(row.status==='waiting_owner')text=`${name}有个问题需要你确认。我会等你决定如何答复。`;
   else if(row.status==='failed')text=`处理${name}的消息失败：${row.error||'原因未知'}。没有自动重试，请检查后再处理。`;
   else if(m.kind==='reply'){
    text=`${name}那边有回复了。对方表示：${m.text}`;
   }else text=row.owner_confirmed?`已把你确认的答复发给${name}：“${row.result}”`:`此前已回复${name}：“${row.result}”`;
   if(this.onOwnerEvent({key,agentId:this.config.localAgentId,text,messageId:row.id,status:row.status,ownerConfirmed:!!row.owner_confirmed,reportKind:row.status==='waiting_owner'?'confirmation':row.status==='failed'?'failure':m.kind==='reply'?'reply':'receipt'})!==false)mark.run(key);
  }
 }
 async action(path,body){
  if(!this.client)throw Error('请先连接云端');
  const routes={request:'/v1/requests',decision:'/v1/requests/decision',visit:'/v1/visits','visit-action':'/v1/visits/action'};
  if(path==='direct-read'){this.client.markDirectRead(body.to,body.id,body.roomId);this.refreshMessages();return;}
  if(path==='direct'){
   if(!this.state.friends.includes(body.to))throw Error('请先添加好友');
   if(this.state.directory.find(p=>p.id===body.to)?.directProtocol!==1)throw Error('对方客户端需升级后才能接收主人直聊');
   if(typeof body.key!=='string'||!/^[-a-zA-Z0-9]{1,100}$/.test(body.key))throw Error('消息标识无效');
   this.client.queue(body.to,body.text,'direct',null,body.key);this.refreshMessages();
   try{await this.client.flush();}catch(e){this.publish({error:'直聊消息已保存在本机，将在连接恢复后继续投递。'+e.message});}finally{this.refreshMessages();}
  }else if(['owner-reply','owner-decline','draft'].includes(path)){
   const agent=this.getAgent(this.config.localAgentId);if(!agent?.enabled)throw Error('请先让助理上线');
   if(path==='draft'){
    this.config.agent=normalizeAgent({...agent,publishProfile:true});
    const task=this.client.draft(body.id,this.abort.signal);this.refreshMessages();
    try{await task;}finally{this.refreshMessages();}
   }else{
    const row=this.client.db.prepare('SELECT json FROM inbox WHERE id=?').get(body.id);
    const sender=row?JSON.parse(row.json).sender:null;
    const peer=this.state.directory.find(d=>d.id===sender);
    const reply=path==='owner-decline'?'主人暂不提供这项信息。':body.text;
    try{await this.client.ownerReply(body.id,reply);this.onOwnerEvent?.({key:`${this.config.id}:${body.id}:owner-answer`,agentId:this.config.localAgentId,role:'user',reportKind:'owner',text:`请这样回复${peer?.profile?.name||peer?.name||'对方'}：${reply}`});}finally{this.refreshMessages();}}
  }else if(path==='message'){
   const agent=this.getAgent(this.config.localAgentId);if(!agent?.enabled)throw Error('请先让助理上线');
   const key=this.client.queue(body.to,body.text,'question',null,body.key);
   const peer=this.state.directory.find(d=>d.id===body.to);
   if(!body.ownerTurn)this.onOwnerEvent?.({key:`${this.config.id}:outgoing:${key}`,agentId:this.config.localAgentId,role:'user',reportKind:'owner',text:`帮我问${peer?.profile?.name||peer?.name||'对方'}：${body.text}`});
   await this.client.flush();
  }else{
   if(!routes[path])throw Error('未知云端操作');await this.client.api(routes[path],body);
  }
  await this.poll();
 }
 async close(){
  this.closed=true;this.abort.abort();
  try{if(this.client)await this.client.api('/v1/sync',{online:false});}catch{}
  await this.processing;
  if(this.client)this.client.close();this.unlock();
 }
}
