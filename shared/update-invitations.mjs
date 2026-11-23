import {randomUUID} from 'node:crypto';
export const validVersion=v=>typeof v==='string'&&/^\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(v);
const terminal=new Set(['completed','failed','declined','cancelled','expired']);
export function expireUpdateInvitations(items,now=Date.now()){for(const i of items)if(!terminal.has(i.status)&&i.expiresAt<=now){i.status=i.status==='accepted'?'failed':'expired';i.detail=i.status==='failed'?'更新中断或超时，请由主人检查客户端。':'';i.endedAt=now}return items}
export function createUpdateInvitation(items,{from,to,key,targetVersion,note=''},areFriends,now=Date.now()){
 expireUpdateInvitations(items,now);if(from===to||!areFriends(from,to))throw Error('只能邀请好友更新客户端');
 if(typeof key!=='string'||!key||key.length>100||!validVersion(targetVersion)||typeof note!=='string'||note.length>500)throw Error('升级邀请格式不正确');
 const old=items.find(i=>i.from===from&&i.key===key);if(old){if(old.to!==to||old.targetVersion!==targetVersion||old.note!==note.trim())throw Error('发送编号已用于其他邀请');return old}
 if(items.some(i=>i.from===from&&i.to===to&&!terminal.has(i.status)))throw Error('已有待处理升级邀请，请等待对方决定');
 if(items.filter(i=>i.from===from&&i.createdAt>now-86400000).length>=10)throw Error('今天的升级邀请已达上限，请稍后再试');
 const item={id:randomUUID(),from,to,key,targetVersion,note:note.trim(),status:'pending',createdAt:now,expiresAt:now+7*86400000};items.push(item);return item;
}
export function actUpdateInvitation(items,{id,actor,action,version,detail=''},now=Date.now()){
 expireUpdateInvitations(items,now);const i=items.find(i=>i.id===id&&[i.from,i.to].includes(actor));if(!i)throw Error('升级邀请不存在');
 if(action==='cancel'){if(actor!==i.from)throw Error('只有邀请方可撤回');if(i.status==='cancelled')return i;if(i.status!=='pending')throw Error('邀请已经处理');i.status='cancelled';i.endedAt=now;return i}
 if(actor!==i.to)throw Error('只能由对方主人决定');
 const status={accept:'accepted',decline:'declined',complete:'completed',fail:'failed'}[action];if(!status)throw Error('无效更新操作');
 if(i.status===status)return i;
 if(['accept','decline'].includes(action)&&i.status!=='pending'||['complete','fail'].includes(action)&&i.status!=='accepted')throw Error('升级邀请状态已变化');
 if(action==='accept'&&items.some(x=>x.to===actor&&x.id!==id&&x.status==='accepted'))throw Error('已有升级正在执行');
 if(action==='complete'&&(!validVersion(version)||version!==i.targetVersion))throw Error('升级结果版本不匹配');
 i.status=status;if(action==='accept'){i.acceptedAt=now;i.expiresAt=now+30*60000}else{i.endedAt=now;if(action==='complete')i.version=version;if(action==='fail')i.detail=typeof detail==='string'?detail.slice(0,300):'更新未完成'}return i;
}
