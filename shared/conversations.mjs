// One owner-facing destination for every event. Rendering and notifications share this contract.
export function isAgentMessage(message){return !message.channel&&!message.interactionId&&!message.updateInvitationId&&!(message.cloudMessageId&&message.role!=='user')&&(!message.cloudReportKind||message.cloudReportKind==='owner')&&['user','assistant','system','error'].includes(message.role)}
const stamp=value=>JSON.stringify(value);
export function peerActivities(state){
 const cloud=state.cloud;if(!cloud)return [];const self=cloud.deviceId,items=[];
 const add=(id,peer,value,eligible)=>{if(peer&&peer!==self)items.push({id,peer,stamp:stamp(value),eligible})};
 const drafts=state.localPlayDrafts||[],matched=new Set();
 for(const i of cloud.interactions||[]){const incoming=i.to===self,peer=incoming?i.from:i.to,draft=drafts.find(d=>d.id===i.key&&d.peer===peer);if(draft)matched.add(draft.id);add('interaction:'+i.id,peer,[i.status,i.attempt,i.reply],incoming||!['pending','cancelled'].includes(i.status))}
 for(const d of drafts)if(!matched.has(d.id))add('draft:'+d.id,d.peer,[d.status,d.sent,d.error],['ready','failed'].includes(d.status)&&!d.sent);
 for(const v of cloud.visits||[])add('visit:'+v.id,v.to===self?v.from:v.to,[v.status,v.reply],v.to===self||!['pending','cancelled'].includes(v.status));
 for(const v of cloud.updateInvitations||[])add('update:'+v.id,v.to===self?v.from:v.to,[v.status,v.detail],v.to===self||!['pending','cancelled'].includes(v.status));
 for(const m of cloud.messages||[])if(m.message.kind!=='direct')add('agent:'+m.id,m.message.sender,[m.status,m.result,m.error],true);
 return items;
}
export function peerUnread(state,seen={}){const counts={...state.cloud?.direct?.unread};for(const item of peerActivities(state))if(item.eligible&&seen[item.peer]?.[item.id]!==item.stamp)counts[item.peer]=(counts[item.peer]||0)+1;return counts}
export function markPeerActivities(state,seen,peer){const next={...(seen[peer]||{})};for(const item of peerActivities(state))if(item.peer===peer)next[item.id]=item.stamp;return {...seen,[peer]:next}}
