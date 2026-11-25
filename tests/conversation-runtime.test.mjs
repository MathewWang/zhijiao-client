import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
test('real loopback routes create one durable task, require consent and preview, and send to its bound peer',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'conversation-runtime-')),dataDir=join(dir,'data'),cloudDir=join(dataDir,'cloud-client'),bin=join(dir,'bin');for(const path of [dataDir,cloudDir,bin])mkdirSync(path,{recursive:true});
 const marker=join(dir,'calls');
 writeFileSync(join(bin,'codex'),`#!${process.execPath}\nimport {appendFileSync} from 'node:fs';if(process.argv.includes('--version'))console.log('mock');else if(process.argv[2]==='mcp')console.log('[]');else{appendFileSync(${JSON.stringify(marker)},'call\\n');setTimeout(()=>console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'<div>mock flowers</div>'}})),150)}\n`,{mode:0o755});
 const agent={id:'local',name:'Local',ownerName:'Owner',ownerId:'owner',skin:'taotao',engine:'codex',enabled:true,publishProfile:true};const db=new DatabaseSync(join(dataDir,'companion.sqlite'));db.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,json TEXT NOT NULL)');db.prepare('INSERT INTO state VALUES(1,?)').run(JSON.stringify({agents:[agent],messages:[],links:[],reports:[],visits:[],registrationComplete:true,primaryAgentId:'local'}));db.close();
 const items=[],directory=[{id:'me',name:'Me',online:true,profile:{name:'Local',skin:'taotao'}},{id:'friend',name:'Friend',online:true,interactionProtocol:2,profile:{name:'Friend',skin:'xiaobai'}}];let transmissions=0;
 const relay=createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;const b=JSON.parse(body||'{}');res.setHeader('Content-Type','application/json');if(req.url==='/v1/sync')return res.end(JSON.stringify({directory,friends:['friend'],requests:[],visits:[],interactions:items,updateInvitations:[]}));if(req.url==='/v1/inbox/pull')return res.end('[]');if(req.url==='/v1/interactions'){transmissions++;let item=items.find(i=>i.key===b.key);if(!item){item={id:'remote',from:'me',...b,status:'pending',attempt:0,createdAt:Date.now(),expiresAt:Date.now()+100000};items.push(item)}return res.end(JSON.stringify(item))}res.end('{"ok":true}')});await new Promise(r=>relay.listen(0,'127.0.0.1',r));
 writeFileSync(join(cloudDir,'config.json'),JSON.stringify({relay:`http://127.0.0.1:${relay.address().port}`,id:'me',token:'mock',localAgentId:'local',agent}));const free=createServer();await new Promise(r=>free.listen(0,'127.0.0.1',r));const port=free.address().port;await new Promise(r=>free.close(r));
 const child=spawn(process.execPath,['runtime/index.mjs'],{env:{...process.env,PATH:bin,PORT:String(port),COMPANION_DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);const base=`http://127.0.0.1:${port}`,snapshot=async()=> (await fetch(base+'/api/state')).json(),post=async(path,data)=>{const r=await fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:r.status,body:await r.json()}};
 try{
  let ready=false;for(let n=0;n<100;n++){try{if((await snapshot()).cloud.connected){ready=true;break}}catch{}await delay(30)}assert.ok(ready,logs);
  const body={kind:'gift.flowers',to:'friend',message:'Hi friend',brief:'Flowers'};assert.equal((await post('interactions/create-local',body)).status,400);assert.equal((await post('interactions/create-local',{...body,to:'stranger',confirmCost:true})).status,400);
  const made=await post('interactions/create-local',{...body,confirmCost:true});assert.equal(made.status,202,JSON.stringify(made));const id=made.body.id;assert.equal((await snapshot()).localPlayDrafts[0].status,'generating');assert.equal(items.length,0);
  let completed;for(let n=0;n<100;n++){completed=(await snapshot()).localPlayDrafts[0];if(completed.status!=='generating')break;await delay(30)}assert.equal(completed.status,'ready',JSON.stringify(completed));assert.equal(completed.peer,'friend');assert.equal(readFileSync(marker,'utf8'),'call\n');assert.equal((await post('interactions/draft-send',{id})).status,400);
  const preview=await post('interactions/preview',{draftId:id,to:'stranger'});assert.equal(preview.status,200);assert.match(preview.body.html,/mock flowers/);assert.equal((await post('interactions/draft-send',{id,to:'stranger'})).status,200);assert.equal(items[0].to,'friend');assert.equal(items[0].key,id);assert.equal((await post('interactions/draft-send',{id})).status,200);assert.equal(transmissions,1);assert.equal((await snapshot()).localPlayDrafts[0].sent,true);assert.equal((await snapshot()).messages.some(m=>m.interactionId),false);
  assert.equal((await post('conversations/read',{peer:'friend'})).status,200);assert.equal((await snapshot()).peerUnread.friend||0,0);
 }finally{const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;relay.closeAllConnections();await new Promise(r=>relay.close(r));rmSync(dir,{recursive:true,force:true})}
});
