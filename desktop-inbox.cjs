// Desktop read cursors are independent of task acceptance and model execution.
function conversation(state,id){return (state.messages||[]).filter(m=>m.agentId===id&&!m.channel&&['assistant','error'].includes(m.role))}
function summarizeInbox(state,seen={}){
 const agents=(state.agents||[]).map(agent=>{
  const messages=conversation(state,agent.id),cursor=messages.findIndex(m=>m.id===seen[agent.id]);
  const unread=seen[agent.id]===undefined?0:messages.slice(cursor+1).length;
  const cloud=state.cloud?.agentId===agent.id?state.cloud:null,self=cloud?.deviceId||agent.id;
  const confirmations=(cloud?.messages||[]).filter(m=>['waiting_owner','drafting'].includes(m.status)).length;
  const interactions=(cloud?.interactions||[]).filter(i=>i.to===self&&['pending','failed','ready'].includes(i.status)).length;
  const visits=(cloud?.visits||state.visits||[]).filter(v=>v.to===self&&v.status==='pending').length;
  const requests=(cloud?.requests||[]).filter(r=>r.recipient===self&&r.status==='pending').length;
  return {id:agent.id,name:agent.name,unread,confirmations,messages:Math.max(unread,confirmations),interactions,visits,plays:interactions+visits,requests};
 });
 const sum=key=>agents.reduce((n,a)=>n+a[key],0);
 return {agents,messages:sum('messages'),plays:sum('plays'),requests:sum('requests'),total:sum('messages')+sum('plays')+sum('requests')};
}
function markConversationRead(state,seen,id,lastId){
 const messages=conversation(state,id),next=messages.findIndex(m=>m.id===lastId),previous=messages.findIndex(m=>m.id===seen[id]);
 if(next<0||next<previous)return false;
 if(seen[id]===lastId)return false;seen[id]=lastId;return true;
}
// Filtering recovery windows prevents unlock/display recovery from undoing deliberate hiding.
function recoveryWindows({hidden,setup,pets,visitors,histories}){return setup?[setup]:[...(hidden?[]:[...pets,...visitors]),...histories.filter(win=>win.isVisible())]}
module.exports={conversation,summarizeInbox,markConversationRead,recoveryWindows};
