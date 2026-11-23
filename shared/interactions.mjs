import {randomUUID,createHash} from 'node:crypto';
export const INTERACTION_PROTOCOL=2;
const text=(v,max,required=true)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw Error('互动内容格式不正确');return v.trim();};
export function normalizePlan(p){
 if(!p||p.protocol!=='zhijiao.interaction'||![1,2].includes(p.version))throw Error('不支持的互动协议');
 const kind=text(p.intent?.kind,80);if(!/^[a-z][a-z0-9.-]+$/.test(kind))throw Error('无效玩法');
 const durationSeconds=p.presentation?.durationSeconds??20;if(!Number.isInteger(durationSeconds)||durationSeconds<5||durationSeconds>60)throw Error('展示时长需为 5–60 秒');
 let artifact;
 if(p.version===2){const html=p.artifact?.html;if(typeof html!=='string'||!html.trim()||Buffer.byteLength(html)>60000||!/<(?:html|body|div|canvas|svg|style|section|main|p|article)\b/i.test(html))throw Error('展示文件为空或超过 60KB');const sha256=createHash('sha256').update(html).digest('hex');if(p.artifact.sha256&&p.artifact.sha256!==sha256)throw Error('展示文件校验失败');artifact={html,sha256};}
 return {protocol:'zhijiao.interaction',version:p.version,...(artifact?{artifact}:{}),intent:{kind,...(p.intent?.title!==undefined?{title:text(p.intent.title,40)}:{}),message:text(p.intent?.message,500),brief:text(p.intent?.brief,2000)},presentation:{renderer:'web',durationSeconds,sound:false,dismissible:true}};
}
const terminal=new Set(['completed','declined','cancelled','expired']);
export function expireInteractions(items,now=Date.now()){
 for(const i of items)if(!terminal.has(i.status)&&i.expiresAt<=now){i.status='expired';i.endedAt=now;}
 return items;
}
export function createInteraction(items,{from,to,key,plan},areFriends,now=Date.now()){
 expireInteractions(items,now);if(from===to||!areFriends(from,to))throw Error('只能向好友发送互动');
 key=text(key,100);plan=normalizePlan(plan);const old=items.find(i=>i.from===from&&i.key===key);
 if(old){if(old.to!==to||JSON.stringify(old.plan)!==JSON.stringify(plan))throw Error('发送编号已用于其他内容');return old;}
 if(items.filter(i=>i.from===from&&!terminal.has(i.status)).length>=10)throw Error('待处理互动较多，请稍后再发');
 const item={id:randomUUID(),from,to,key,plan,status:'pending',attempt:0,createdAt:now,expiresAt:now+86400000};items.push(item);return item;
}
export function actInteraction(items,{id,actor,action,attempt,reply=''},now=Date.now()){
 expireInteractions(items,now);const i=items.find(i=>i.id===id);if(!i||![i.from,i.to].includes(actor))throw Error('互动不存在');
 if(action==='cancel'){if(actor!==i.from)throw Error('只有发送方可撤回');if(i.status==='cancelled')return i;if(terminal.has(i.status)||i.status==='playing')throw Error('互动已无法撤回');i.status='cancelled';i.endedAt=now;return i;}
 if(actor!==i.to)throw Error('只有接收方可处理');
 if(action==='accept'){
  if(i.status==='accepted'||i.plan.version===2&&i.status==='playing')return i;
  if(i.plan.version===2&&i.status==='failed')throw Error('运行失败，请使用修复操作');
  if(!['pending','failed'].includes(i.status))throw Error('当前状态无法开始创作');
  if(i.plan.version===2&&items.some(x=>x.id!==i.id&&x.to===actor&&x.status==='playing'))throw Error('已有互动正在展示');
  i.attempt++;i.status=i.plan.version===2?'playing':'accepted';if(i.plan.version===2){i.startedAt=now;} i.acceptedAt=now;i.expiresAt=now+(i.plan.version===2?(i.plan.presentation.durationSeconds+30)*1000:10*60000);delete i.failure;return i;
 }
 if(action==='repair'){if(i.plan.version!==2||i.status!=='failed')throw Error('仅可修复运行失败的效果');if(i.attempt>=2)throw Error('本次互动已尝试修复，请让发送方重新制作');i.attempt++;i.status='accepted';i.expiresAt=now+10*60000;return i;}
 if(action==='decline'){if(i.status==='declined')return i;if(i.status!=='pending')throw Error('只可拒绝待接收的互动');i.status='declined';i.endedAt=now;return i;}
 if(attempt!==i.attempt)throw Error('创作批次已变化');
 const target={ready:'ready',play:'playing',complete:'completed',fail:'failed'}[action];if(!target)throw Error('无效互动操作');
 if(i.status===target)return i;
 const allowed={ready:['accepted'],play:['ready'],complete:['playing'],fail:['accepted','ready','playing']};
 if(!allowed[action].includes(i.status))throw Error('互动状态已变化');
 if(action==='play'&&items.some(x=>x.id!==i.id&&x.to===actor&&x.status==='playing'))throw Error('已有互动正在展示');
 i.status=target;if(action==='play'){i.startedAt=now;i.expiresAt=now+(i.plan.presentation.durationSeconds+30)*1000;}
 if(action==='complete'){i.reply=text(reply,500,false);i.endedAt=now;}
 return i;
}
