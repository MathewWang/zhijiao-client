export const RELEASE_URL='https://agentmen.cn/site/client-release.json';
const versionParts=v=>typeof v==='string'&&/^\d+\.\d+\.\d+$/.test(v)?v.split('.').map(Number):null;
export function isNewerVersion(next,current){const a=versionParts(next),b=versionParts(current);if(!a||!b)return false;for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;}
export function validateRelease(value){
 if(!value||!versionParts(value.version)||typeof value.title!=='string'||!value.title.trim()||value.title.length>120||typeof value.notes!=='string'||value.notes.length>2000)throw Error('无效版本公告');
 return {version:value.version,title:value.title.trim(),notes:value.notes.trim()};
}
export function notifyRelease(state,release,currentVersion,addMessage){
 if(!isNewerVersion(release.version,currentVersion))return false;
 let changed=false;
 for(const agent of state.agents){
  if(state.messages.some(m=>m.agentId===agent.id&&m.updateVersion===release.version))continue;
  addMessage(agent.id,'assistant',`知交信使客户端有新版本 ${release.version}：${release.title}\n\n${release.notes}\n\n当前版本 ${currentVersion}。请先结束正在进行的任务，再让本机 Codex 帮你升级。升级会保留角色、好友与聊天记录。`,{updateVersion:release.version});changed=true;
 }
 return changed;
}
export async function fetchRelease(fetcher=fetch){
 const response=await fetcher(RELEASE_URL,{signal:AbortSignal.timeout(10000),redirect:'error',cache:'no-store'});
 if(!response.ok)throw Error('暂时无法获取版本信息');
 let text='';for await(const chunk of response.body){text+=new TextDecoder().decode(chunk);if(text.length>8192)throw Error('版本公告过大');}
 return validateRelease(JSON.parse(text));
}
