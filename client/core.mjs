import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {runAgent} from '../runtime/adapters.mjs';
export function validateRelayURL(value){
 const u=new URL(value);
 if(u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Relay 地址只能包含协议、主机和端口');
 if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(u.hostname)))throw Error('公网 Relay 必须使用 HTTPS');
 return u.origin;
}
export class MessengerClient {
 constructor({config,dbPath,dataDir,agentRunner=runAgent,recoverProcessing=true,requireOwnerApproval=false}){
  this.requireOwnerApproval=requireOwnerApproval;this.config=config;this.url=validateRelayURL(config.relay);this.dataDir=dataDir;this.agentRunner=agentRunner;
  this.db=new DatabaseSync(dbPath);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS inbox(id TEXT PRIMARY KEY, json TEXT NOT NULL, status TEXT NOT NULL, result TEXT, error TEXT);
   CREATE TABLE IF NOT EXISTS outbox(key TEXT PRIMARY KEY, json TEXT NOT NULL, delivered INTEGER NOT NULL DEFAULT 0);`);
  if(!this.db.prepare('PRAGMA table_info(inbox)').all().some(c=>c.name==='owner_confirmed'))this.db.exec('ALTER TABLE inbox ADD COLUMN owner_confirmed INTEGER NOT NULL DEFAULT 0');
  if(!this.db.prepare('PRAGMA table_info(outbox)').all().some(c=>c.name==='server_id'))this.db.exec('ALTER TABLE outbox ADD COLUMN server_id TEXT');
  if(!this.db.prepare('PRAGMA table_info(inbox)').all().some(c=>c.name==='direct_read_at'))this.db.exec('ALTER TABLE inbox ADD COLUMN direct_read_at INTEGER');
  // A crash during inference is ambiguous; never silently repeat a potentially billable call.
  if(recoverProcessing)this.db.prepare("UPDATE inbox SET status='waiting_owner',error='建议生成中断，请重新确认' WHERE status='drafting'").run();
  if(recoverProcessing)this.db.prepare("UPDATE inbox SET status='failed',error='Client 在模型执行期间退出，结果未知；请人工检查后重试' WHERE status='processing'").run();
 }
 async api(path,body,token=this.config.token){
  const response=await fetch(this.url+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000),redirect:'error'});
  const data=await response.json();if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);return data;
 }
 queue(to,text,kind='question',replyTo=null,key=randomUUID()){
  if(typeof text!=='string'||!text.trim()||text.length>16000)throw Error('消息需为 1–16000 字符');
  if(!['question','reply','direct'].includes(kind))throw Error('无效消息类型');
  const prior=this.db.prepare('SELECT json FROM outbox WHERE key=?').get(key);if(prior){const old=JSON.parse(prior.json);if(old.to!==to||old.text!==text||old.kind!==kind||(old.replyTo||null)!==replyTo)throw Error('消息标识已用于其他内容');return key;}
  const b={to,text,kind,replyTo,key,createdAt:Date.now()};this.db.prepare('INSERT OR IGNORE INTO outbox(key,json) VALUES(?,?)').run(key,JSON.stringify(b));return key;
 }
 async flush(){
  for(const row of this.db.prepare('SELECT * FROM outbox WHERE delivered=0 ORDER BY rowid').all()){
   const sent=await this.api('/v1/messages',JSON.parse(row.json));this.db.prepare('UPDATE outbox SET delivered=1,server_id=? WHERE key=?').run(sent?.id||null,row.key);
  }
 }
 async tick(signal){
  await this.flush();
  await this.deliverReady();
  const {message:m}=await this.api('/v1/inbox/pull',{directProtocol:1});if(!m)return false;
  this.db.prepare("INSERT OR IGNORE INTO inbox(id,json,status) VALUES(?,?,'received')").run(m.id,JSON.stringify(m));
  let local=this.db.prepare('SELECT * FROM inbox WHERE id=?').get(m.id);
  if(m.kind==='direct'){this.db.prepare("UPDATE inbox SET status='done' WHERE id=?").run(m.id);await this.api('/v1/inbox/ack',{id:m.id});return true;}
  if(this.requireOwnerApproval&&m.kind==='question'&&local.status==='received'){
   this.db.prepare("UPDATE inbox SET status='waiting_owner' WHERE id=?").run(m.id);
   await this.api('/v1/inbox/ack',{id:m.id});return true;
  }
  if(['waiting_owner','drafting'].includes(local.status)){await this.api('/v1/inbox/ack',{id:m.id});return true;}
  if(local.status==='failed') {await this.api('/v1/inbox/ack',{id:m.id});return true;}
  if(local.status==='received'){
   if(m.kind==='reply')this.db.prepare("UPDATE inbox SET status='done' WHERE id=?").run(m.id);
   else {
    this.db.prepare("UPDATE inbox SET status='processing' WHERE id=?").run(m.id);
    try{
     const result=await this.agentRunner({agent:{...this.config.agent,id:this.config.id},history:[],message:m.text,source:`好友设备 ${m.sender}`,dataDir:this.dataDir,signal,instructions:'这是好友的一次请求，仅回复本次问题。不得发起新的联系；仅可使用主人明确允许分享的资料，不得读取或披露本机其他信息。'});
     if(typeof result!=='string'||!result.trim()||result.length>16000)throw Error('模型回复为空或超过 16000 字符，请人工处理');
     this.db.prepare("UPDATE inbox SET status='ready',result=? WHERE id=?").run(result,m.id);
    }catch(e){this.db.prepare("UPDATE inbox SET status='failed',error=? WHERE id=?").run(e.message,m.id);await this.api('/v1/inbox/ack',{id:m.id});return true;}
   }
  }
  local=this.db.prepare('SELECT * FROM inbox WHERE id=?').get(m.id);
  if(local.status==='ready'){
   this.queue(m.sender,local.result,'reply',m.id,`reply:${m.id}`);await this.flush();
   this.db.prepare("UPDATE inbox SET status='done' WHERE id=?").run(m.id);
  }
  await this.api('/v1/inbox/ack',{id:m.id});return true;
 }
 async deliverReady(){
  for(const row of this.db.prepare("SELECT * FROM inbox WHERE status='ready' ORDER BY rowid").all()){
   const m=JSON.parse(row.json);this.queue(m.sender,row.result,'reply',m.id,`reply:${m.id}`);await this.flush();
   this.db.prepare("UPDATE inbox SET status='done',error=NULL WHERE id=?").run(row.id);
  }
 }
 async draft(id,signal){
  const row=this.db.prepare("SELECT * FROM inbox WHERE id=? AND status='waiting_owner'").get(id);if(!row)throw Error('这条消息不在待确认状态');
  if(!this.config.agent.shareableProfile?.trim())throw Error('请先填写允许分享的近况，或直接输入本次答复');
  this.db.prepare("UPDATE inbox SET status='drafting',error=NULL WHERE id=?").run(id);
  try{
   const m=JSON.parse(row.json);const result=await this.agentRunner({agent:{...this.config.agent,id:this.config.id},history:[],message:m.text,source:`好友设备 ${m.sender}`,dataDir:this.dataDir,signal,instructions:'仅根据主人明确允许分享的资料拟一段答复，交给主人审核；资料不足就说明不足，不猜测，不读取文件，不主动联系他人。此步骤不会发送答复。'});
   if(typeof result!=='string'||!result.trim()||result.length>16000)throw Error('建议回复为空或过长');
   this.db.prepare("UPDATE inbox SET status='waiting_owner',result=?,error=NULL WHERE id=?").run(result,id);
  }catch(e){this.db.prepare("UPDATE inbox SET status='waiting_owner',error=? WHERE id=?").run(e.message,id);throw e;}
 }
 async ownerReply(id,text){
  if(typeof text!=='string'||!text.trim()||text.length>16000)throw Error('请填写本次答复（最多 16000 字）');text=text.trim();
  const row=this.db.prepare('SELECT * FROM inbox WHERE id=?').get(id);
  if(!row||JSON.parse(row.json).kind!=='question')throw Error('未找到待确认的好友问题');
  if(['ready','done'].includes(row.status)&&row.result===text){await this.deliverReady();return;}
  if(row.status!=='waiting_owner')throw Error('这条消息已处理或正在处理，请勿重复发送');
  this.db.prepare("UPDATE inbox SET status='ready',result=?,error=NULL,owner_confirmed=1 WHERE id=?").run(text,id);
  await this.deliverReady();
 }
 async retry(id,signal){
  if(this.requireOwnerApproval)throw Error('桌面好友问题请在待确认卡片中处理');
  const row=this.db.prepare("SELECT * FROM inbox WHERE id=? AND status='failed'").get(id);if(!row)throw Error('未找到失败消息');
  const m=JSON.parse(row.json);
  this.db.prepare("UPDATE inbox SET status='processing',error=NULL WHERE id=?").run(id);
  try {
   const result=await this.agentRunner({agent:{...this.config.agent,id:this.config.id},history:[],message:m.text,source:`好友设备 ${m.sender}`,dataDir:this.dataDir,signal});
   if(typeof result!=='string'||!result.trim()||result.length>16000)throw Error('模型回复为空或超过 16000 字符，请人工处理');
   this.db.prepare("UPDATE inbox SET status='ready',result=? WHERE id=?").run(result,id);
   this.queue(m.sender,result,'reply',id,`reply:${id}`);await this.flush();this.db.prepare("UPDATE inbox SET status='done' WHERE id=?").run(id);
  }catch(e){this.db.prepare("UPDATE inbox SET status='failed',error=? WHERE id=? AND status='processing'").run(e.message,id);throw e;}
 }
 directSnapshot(){
  const incoming=this.db.prepare("SELECT rowid AS sequence,id,json,direct_read_at FROM inbox WHERE json_extract(json,'$.kind')='direct' ORDER BY rowid DESC").all().map(r=>{const m=JSON.parse(r.json);return {sequence:r.sequence,id:r.id,peer:m.sender,text:m.text,incoming:true,createdAt:m.created_at||0,read:!!r.direct_read_at,status:'delivered'}});
  const outgoing=this.db.prepare("SELECT key,json,delivered,server_id FROM outbox WHERE json_extract(json,'$.kind')='direct' ORDER BY rowid DESC").all().map(r=>{const m=JSON.parse(r.json);return {id:r.key,peer:m.to,text:m.text,incoming:false,createdAt:m.createdAt||0,read:true,status:r.delivered?'delivered':'queued'}});
  const unread=this.db.prepare("SELECT json_extract(json,'$.sender') AS peer,count(*) AS count FROM inbox WHERE json_extract(json,'$.kind')='direct' AND direct_read_at IS NULL GROUP BY peer").all();
  return {messages:[...incoming,...outgoing].sort((a,b)=>a.createdAt-b.createdAt),unread:Object.fromEntries(unread.map(r=>[r.peer,r.count]))};
 }
 markDirectRead(peer,id){
  const target=this.db.prepare("SELECT rowid FROM inbox WHERE id=? AND json_extract(json,'$.kind')='direct' AND json_extract(json,'$.sender')=?").get(id,peer);if(!target)return;
  this.db.prepare("UPDATE inbox SET direct_read_at=COALESCE(direct_read_at,?) WHERE rowid<=? AND json_extract(json,'$.kind')='direct' AND json_extract(json,'$.sender')=?").run(Date.now(),target.rowid,peer);
 }
 close(){this.db.close();}
}
