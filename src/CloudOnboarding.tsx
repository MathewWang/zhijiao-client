import {ErrorNotice} from './ErrorNotice';
import React,{useState} from 'react';
import {CloudPanel,type CloudState} from './CloudPanel';
import {Creature} from './Creature';
import './registration.css';
type Agent={id:string;name:string;ownerName:string;skin:string};
export function CloudOnboarding({agent,cloud}:{agent:Agent;cloud?:CloudState}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function post(path:string,body:unknown){const r=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||'操作未完成，请重试');}
 async function finish(action:'skip'|'connected'){await post('onboarding/cloud',{action});const desktop=(window as any).desktop;if(desktop)await desktop.finishRegistration();else location.assign('/');}
 async function act(path:string,body:unknown){setBusy(true);setError('');try{if(path!=='onboarding/cloud')await post(path,body);await finish('connected');return true}catch(e){setError((e as Error).message);return false}finally{setBusy(false)}}
 return <div className="registration-page"><header><a href="/">✳ 知交信使</a><span className="registration-local">最后一步 · 连接云端</span></header><main className="registration-content cloud-onboarding"><aside className="registration-portrait"><Creature skin={agent.skin}/><h2>{agent.name}</h2><p>助理已创建，本机模型已连接。</p></aside><section className="registration-fields"><span className="registration-eyebrow">CONNECT WITH FRIENDS</span><h1>用邀请码，和朋友见面。</h1><p className="registration-desc">连接云端后，可以添加好友、直接聊天和互相串门。本地模型仍在你的电脑上运行。</p><CloudPanel cloud={cloud} agent={agent} act={act} disabled={busy} mode="settings"/>{cloud?.registered&&<button className="registration-primary" disabled={busy} onClick={()=>void act('onboarding/cloud',{action:'connected'})}>连接已保存，进入桌面</button>}{error&&<ErrorNotice error={error}/>}<div className="registration-actions"><button disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await finish(cloud?.registered?'connected':'skip')}catch(e){setError((e as Error).message);setBusy(false)}}}>{cloud?.registered?'进入桌面':'暂时跳过，先在本机使用'}</button></div><p className="registration-desc">没有邀请码也可以跳过。以后从菜单栏打开聊天 → Agent →「设置」，填写邀请码即可连接云端。</p></section></main></div>;
}
