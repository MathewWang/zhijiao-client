import {spawnSync,spawn} from 'node:child_process';
import {readFileSync,writeFileSync,renameSync,existsSync,mkdirSync,openSync,closeSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {isNewerVersion} from './updates.mjs';
export const OFFICIAL_REPOSITORY='https://github.com/MathewWang/zhijiao-client.git';
export function commandRunner(root){return (command,args)=>{const r=spawnSync(command,args,{cwd:root,env:{...process.env,PATH:'/opt/homebrew/bin:/usr/local/bin:'+process.env.PATH},encoding:'utf8',timeout:command==='npm'?20*60000:90000,maxBuffer:4*1024*1024});if(r.error||r.status!==0)throw Object.assign(Error(`${command} 步骤未完成，请检查本机更新日志。`),{localDetail:String(r.error?.message||r.stderr||r.stdout||'').slice(-12000)});return (r.stdout||'').trim()}}
export function inspectCheckout(root,run=commandRunner(root)){
 if(run('git',['rev-parse','--show-toplevel'])!==resolve(root))throw Error('客户端需要位于独立 Git 仓库，暂不支持此安装方式自动更新');
 if(run('git',['status','--porcelain']))throw Error('存在本地代码改动，请先保存并处理；不会覆盖或自动暂存');
 if(run('git',['branch','--show-current'])!=='main')throw Error('自动更新只支持 main 分支');
 if(!['git@github.com:MathewWang/zhijiao-client.git',OFFICIAL_REPOSITORY,'https://github.com/MathewWang/zhijiao-client'].includes(run('git',['remote','get-url','origin'])))throw Error('仓库来源不是官方客户端，请手动检查');
 const nodeVersion=run('node',['-p','process.versions.node']);if(Number(nodeVersion.split('.')[0])<24)throw Error('需要 Node.js 24 或更新版本');
 return run('git',['rev-parse','HEAD']);
}
export function pinOfficialUpdate(root,targetVersion,currentVersion,run=commandRunner(root)){
 if(!isNewerVersion(targetVersion,currentVersion))throw Error('当前客户端已是此版本或更新，无需升级');
 const previousCommit=inspectCheckout(root,run);
 run('git',['fetch','--no-tags',OFFICIAL_REPOSITORY,'main']);const commit=run('git',['rev-parse','FETCH_HEAD']);
 if(!/^[a-f0-9]{40}$/.test(commit)||JSON.parse(run('git',['show',commit+':package.json'])).version!==targetVersion)throw Error('官方仓库与邀请版本不一致，请刷新版本后重新邀请');
 run('git',['merge-base','--is-ancestor',previousCommit,commit]);
 return {commit,previousCommit};
}
export function saveUpdateJob(file,job){const temp=file+'.tmp';mkdirSync(resolve(file,'..'),{recursive:true,mode:0o700});writeFileSync(temp,JSON.stringify(job,null,2),{mode:0o600});renameSync(temp,file)}
export function validateUpdateJob(job){if(job?.approved!==true||job.status!=='approved'||!/^[-a-zA-Z0-9]+$/.test(job.id)||!/^\d+\.\d+\.\d+$/.test(job.targetVersion)||!['commit','previousCommit'].every(k=>/^[a-f0-9]{40}$/.test(job[k])))throw Error('没有有效的主人升级授权');return job}
export async function applyApprovedUpdate(job,{run=commandRunner(job.root),waitForExit=async()=>{},start=()=>{},onPhase=()=>{}}={}){
 validateUpdateJob(job);onPhase('waiting');await waitForExit();onPhase('checking');
 if(inspectCheckout(job.root,run)!==job.previousCommit)throw Error('等待更新期间代码已变化，请重新确认');
 if(JSON.parse(run('git',['show',job.commit+':package.json'])).version!==job.targetVersion)throw Error('固定提交的版本不匹配');
 run('git',['merge-base','--is-ancestor',job.previousCommit,job.commit]);
 onPhase('installing');run('git',['merge','--ff-only','--no-edit',job.commit]);
 run('npm',['ci','--include=dev']);
 if(!existsSync(join(job.root,'node_modules/electron/path.txt')))run('node',[join(job.root,'node_modules/electron/install.js')]);
 onPhase('building');run('npm',['run','build']);
 onPhase('restarting');await start();return {status:'completed',version:job.targetVersion};
}
export async function deliverUpdateReceipt(job,fetcher=fetch){
 const config=JSON.parse(readFileSync(job.configPath,'utf8'));const relay=new URL(config.relay);
 if(relay.origin!=='https://agentmen.cn'||relay.pathname!=='/'||relay.search||relay.hash||relay.username||relay.password)throw Error('升级回执只发送到官方知交信使服务');
 const r=await fetcher(relay.origin+'/v1/update-invitations/action',{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify({id:job.id,action:job.status==='completed'?'complete':'fail',...(job.status==='completed'?{version:job.targetVersion}:{detail:'本机更新未完成，请由主人检查更新日志并手动重试。'})}),redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('更新回执尚未送达');
}
export async function flushUpdateReceipts(dir){if(!existsSync(dir))return;for(const name of readdirSync(dir).filter(n=>n.endsWith('.json'))){const file=join(dir,name);try{const job=JSON.parse(readFileSync(file,'utf8'));if(['approved','running'].includes(job.status)&&Date.now()-job.createdAt>120000){let alive=false;if(job.pid)try{process.kill(job.pid,0);alive=true}catch{}if(!alive){job.status='failed';job.updatedAt=Date.now();job.pendingReceipt=true;job.error='升级进程中断，没有自动重试';saveUpdateJob(file,job)}}if(job.pendingReceipt&&['completed','failed'].includes(job.status)){await deliverUpdateReceipt(job);job.pendingReceipt=false;saveUpdateJob(file,job)}}catch{}}}
export async function waitForProcesses(pids,{alive=pid=>{try{process.kill(pid,0);return true}catch(e){if(e.code==='ESRCH')return false;throw e}},sleep=ms=>new Promise(r=>setTimeout(r,ms)),attempts=120}={}){for(let n=0;n<attempts;n++){if(!pids.filter(Boolean).some(alive))return;await sleep(500)}throw Error('客户端没有退出，已停止更新')}
export async function runUpdateFile(file,parentPid){
 const job=validateUpdateJob(JSON.parse(readFileSync(file,'utf8')));saveUpdateJob(file,{...job,status:'running',pid:process.pid});const log=join(job.root,'.data','client-update.log'),baseRun=commandRunner(job.root);
 const run=(command,args)=>{writeFileSync(log,`${new Date().toISOString()} ${command} ${args.join(' ')}\n`,{flag:'a',mode:0o600});try{return baseRun(command,args)}catch(e){writeFileSync(log,(e.localDetail||e.message)+'\n',{flag:'a',mode:0o600});throw e}};

 try{
  const result=await applyApprovedUpdate(job,{run,onPhase:phase=>{job.phase=phase;job.updatedAt=Date.now();saveUpdateJob(file,{...job,status:'running',pid:process.pid})},waitForExit:()=>waitForProcesses([parentPid,job.runtimePid]),start:async()=>{const electron=run('node',[join(job.root,'scripts/macos-app.mjs')]);if(!electron||!existsSync(electron))throw Error('信使应用准备失败，请手动启动');const fd=openSync(log,'a',0o600),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const child=spawn(electron,[job.root],{cwd:job.root,env,detached:true,stdio:['ignore',fd,fd]});await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject)});child.unref();closeSync(fd);
   for(let n=0;n<60;n++){try{const r=await fetch('http://127.0.0.1:4317/api/state',{signal:AbortSignal.timeout(1000)});const s=await r.json();if(s.updates?.currentVersion===job.targetVersion)return}catch{}await new Promise(r=>setTimeout(r,500))}throw Error('新版客户端启动后未通过健康检查')}});
  Object.assign(job,result,{phase:'completed',updatedAt:Date.now(),pendingReceipt:true});
 }catch(e){Object.assign(job,{status:'failed',updatedAt:Date.now(),pendingReceipt:true,error:e.message});writeFileSync(log,`${new Date().toISOString()} ${e.message}\n`,{flag:'a',mode:0o600});
  // No reset/clean/stash or automatic replay; the owner can recover from the local log.
 }finally{saveUpdateJob(file,job);try{await deliverUpdateReceipt(job);job.pendingReceipt=false;saveUpdateJob(file,job)}catch{}}
}

// Only expose bounded, credential-free progress; never return paths, commands or config.
export function readUpdateProgress(dir){
 if(!existsSync(dir))return null;
 const jobs=[];for(const name of readdirSync(dir).filter(n=>/^[-a-zA-Z0-9]+\.json$/.test(n)).slice(-100)){try{const job=JSON.parse(readFileSync(join(dir,name),'utf8'));if(job.id!==name.slice(0,-5)||!['approved','running','failed','completed'].includes(job.status)||!/^\d+\.\d+\.\d+$/.test(job.targetVersion))continue;jobs.push({id:job.id,targetVersion:job.targetVersion,status:job.status,phase:['waiting','checking','installing','building','restarting','completed'].includes(job.phase)?job.phase:'checking',updatedAt:Number(job.updatedAt||job.createdAt)||0})}catch{}}
 return jobs.sort((a,b)=>b.updatedAt-a.updatedAt)[0]||null;
}
