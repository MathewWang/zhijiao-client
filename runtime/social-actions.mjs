// A model proposes data only. The host owns credentials, authorization and side effects.
export const SOCIAL_ACTIONS={
 'conversation.read':{description:'只读检索本机所有好友或指定好友的聊天历史，to 为好友 id 或 all，query 可选关键词，limit 1-100，before 使用上次 nextBefore 分页'},
 'message.direct':{description:'给主人直接留言，不调用对方 Agent',limit:8000},
 'message.ask':{description:'向好友 Agent 提问，需要对方主人确认答复',limit:8000},
 'visit.invite':{description:'邀请自己的形象去好友桌面串门，等待对方同意',limit:1000},
 'update.invite':{description:'邀请好友更新到官网最新版，等待对方主人同意',limit:500},
 'effect.create':{description:'准备送花、烟花或自定义效果，先让本机主人确认制作额度，预览后由主人发送',limit:500}
};
const clean=(v,max,required=false)=>{if(typeof v!=='string'||v.length>max||required&&!v.trim())throw Error('动作内容无效，未执行');return v.trim()};
export function normalizeSocialAction(value,contacts){
 if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.type!=='string'||!Object.hasOwn(SOCIAL_ACTIONS,value.type))throw Error('不支持这个动作，未执行');
 if(value.type==='conversation.read'){
  if(Object.keys(value).some(k=>!['type','to','query','limit','before'].includes(k)))throw Error('聊天检索参数无效');
  const to=value.to??'all',query=value.query??'',limit=value.limit??40,before=value.before;
  if(typeof to!=='string'||to!=='all'&&!contacts.some(c=>c.id===to))throw Error('只能检索现有好友的聊天');
  if(typeof query!=='string'||query.length>200||!Number.isInteger(limit)||limit<1||limit>100||before!==undefined&&(typeof before!=='string'||before.length>200))throw Error('聊天检索参数无效');
  return {type:value.type,to,query,limit,...(before?{before}:{})};
 }
 const allowed=['type','to','text',...(value.type==='effect.create'?['kind','title','brief']:value.type==='visit.invite'?['url']:[])];if(Object.keys(value).some(key=>!allowed.includes(key)))throw Error('动作包含未授权参数，未执行');
 if(typeof value.to!=='string'||!contacts.some(c=>c.id===value.to))throw Error('请先确认对方已成为好友');
 const action={type:value.type,to:value.to,text:clean(value.text??'',SOCIAL_ACTIONS[value.type].limit,value.type!=='update.invite')};
 if(action.type==='visit.invite'){action.url=clean(value.url??'',2000);if(action.url){const u=new URL(action.url);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('串门链接只支持普通 HTTP/HTTPS 地址')}}
 if(action.type==='effect.create'){
  if(value.kind!==undefined&&(typeof value.kind!=='string'||value.kind.length>80))throw Error('玩法类型无效');
  action.kind=['gift.flowers','celebration.fireworks'].includes(value.kind)?value.kind:'custom.effect';
  action.title=clean(value.title??'',40,action.kind==='custom.effect');action.brief=clean(value.brief??'',2000,action.kind==='custom.effect');
 }
 return action;
}
export function createSocialExecutor({cloud,fetchRelease,prepareEffect}){return async(raw,{key,source='主人'}={})=>{
 if(source!=='主人')throw Error('只有主人可以发起社交动作');
 if(!cloud.client||!cloud.state.registered)throw Error('请先连接云端');
 const contacts=cloud.state.directory.filter(d=>cloud.state.friends.includes(d.id)),action=normalizeSocialAction(raw,contacts),peer=contacts.find(p=>p.id===action.to),name=peer?.profile?.name||peer?.name||'好友';
 if(action.type==='conversation.read')throw Error('请通过只读聊天检索通道查询');
 if(!/^[-a-zA-Z0-9]{1,100}$/.test(key||''))throw Error('动作标识无效');
 if(action.type==='message.direct'){if(peer.directProtocol!==1)throw Error('对方需升级客户端后才能收到直接留言');await cloud.action('direct',{to:action.to,text:action.text,key});const pending=cloud.state.direct?.messages?.find(m=>m.id===key)?.status==='queued';return {text:pending?`给${name}的留言已保存在本机，连接恢复后继续投递。`:`已把留言发给${name}，不会调用对方 Agent。`}}
 if(action.type==='message.ask'){await cloud.action('message',{to:action.to,text:action.text,key,ownerTurn:true});return {text:`已向${name}的 Agent 发出提问；答复会显示在你们的聊天窗口。`}}
 if(action.type==='update.invite'){if(peer.updateProtocol!==1)throw Error('对方客户端需先手动升级，才能接收升级邀请');const release=await fetchRelease();const item=await cloud.client.api('/v1/update-invitations',{to:action.to,key,targetVersion:release.version,note:action.text||'一起更新到新版吧！'});await cloud.poll();return {id:item.id,text:`已邀请${name}更新到 ${release.version}，仍需对方主人点击同意。`}}
 if(action.type==='visit.invite'){await cloud.action('visit',{to:action.to,note:action.text,url:action.url,key});return {text:`已向${name}敲门，等待对方同意；来访状态会显示在你们的聊天窗口。`}}
 if((peer.interactionProtocol||0)<2)throw Error('对方需升级客户端后才能接收特效');return prepareEffect(action,{key,name});
}}
