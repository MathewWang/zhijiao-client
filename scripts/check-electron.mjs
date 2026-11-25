// Isolated native smoke check. Quit the real client first; all data stays in a temp directory.
import {createServer} from 'node:http';
import {mkdtempSync,copyFileSync,cpSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {_electron} from '@playwright/test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const temp=mkdtempSync(join(tmpdir(),'zhijiao-electron-smoke-'));
const state={registrationComplete:true,primaryAgentId:'smoke',agents:[{id:'smoke',name:'兼容性测试',ownerName:'测试',ownerId:'test',skin:'taotao',enabled:true}],messages:[{id:'owner-smoke',agentId:'smoke',role:'assistant',text:'Agent 测试消息'}],links:[],visits:[],busy:[],cloud:{registered:true,connected:true,agentId:'smoke',deviceId:'me',directory:[{id:'friend',name:'好友测试',online:true,directProtocol:1,interactionProtocol:2,profile:{name:'好友测试',skin:'xiaobai'}}],friends:['friend'],requests:[],visits:[],messages:[],interactions:[],updateInvitations:[],direct:{messages:[{id:'incoming-test',peer:'friend',incoming:true,text:'直聊测试',createdAt:1,status:'delivered',read:false}],unread:{friend:1}}}};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const streams=new Set(),directSends=[];const notify=()=>{for(const stream of streams)stream.write('data: '+JSON.stringify(state)+'\n\n')};
const server=createServer((req,res)=>{
 if(req.method==='POST'&&['/api/cloud/direct','/api/cloud/direct-read'].includes(req.url)){let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{const data=JSON.parse(body);if(req.url==='/api/cloud/direct'){directSends.push(data);state.cloud.direct.messages.push({id:data.key,peer:data.to,incoming:false,text:data.text,createdAt:2,status:'delivered',read:true})}else{state.cloud.direct.unread={};state.cloud.direct.messages[0].read=true}res.setHeader('Content-Type','application/json');res.end('{"ok":true}');notify()});return;}

 if(req.url.startsWith('/api/state')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(state));return;}
 if(req.url.startsWith('/api/events')){res.writeHead(200,{'Content-Type':'text/event-stream'});res.write('data: '+JSON.stringify(state)+'\n\n');streams.add(res);req.on('close',()=>streams.delete(res));return;}
 try{const name=new URL(req.url,'http://localhost').pathname;const file=join(root,'dist',name==='/'?'index.html':name);res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(readFileSync(file))}catch{res.writeHead(404);res.end()}
});
let app;
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4317,'127.0.0.1',resolve)});
 for(const file of ['electron.cjs','preload.cjs','desktop-inbox.cjs','desktop-recovery.cjs','window-placement.cjs'])copyFileSync(join(root,file),join(temp,file));
 cpSync(join(root,'assets'),join(temp,'assets'),{recursive:true});cpSync(join(root,'shared'),join(temp,'shared'),{recursive:true});
 writeFileSync(join(temp,'main.cjs'),`const {app}=require('electron');app.setPath('userData',${JSON.stringify(join(temp,'user-data'))});require('./electron.cjs');`);
 app=await _electron.launch({executablePath:require('electron'),args:[join(temp,'main.cjs')],env:{...process.env,ELECTRON_RUN_AS_NODE:''}});
 const page=await app.firstWindow();await page.waitForFunction(()=>typeof window.desktop?.getStatus==='function');
 assert.equal((await page.evaluate(()=>window.desktop.getStatus())).agents[0].id,'smoke');
 assert.equal(await page.locator('.companion-tabs button').count(),2);assert.equal(await page.locator('.companion-tabs button').first().textContent(),'Agent');assert.equal(await page.locator('.recent-bubble .companion-avatar').count(),0);assert.equal(await page.getByRole('button',{name:'展开玩法'}).count(),0);
 const next=app.waitForEvent('window');await page.evaluate(()=>window.desktop.openFriend('friend'));const friendPage=await next;await friendPage.getByRole('textbox',{name:'好友聊天消息'}).waitFor();
 await friendPage.getByRole('textbox',{name:'好友聊天消息'}).fill('主人直接发送');await friendPage.getByRole('button',{name:'发送',exact:true}).click();await friendPage.getByText('主人直接发送',{exact:true}).first().waitFor();assert.equal(state.cloud.direct.unread.friend,undefined);assert.equal(directSends.length,1);assert.equal(directSends[0].to,'friend');
 await friendPage.getByRole('button',{name:'展开玩法'}).click();await friendPage.getByRole('button',{name:'送花',exact:true}).waitFor();await friendPage.screenshot({path:join(tmpdir(),'zhijiao-friend-chat-native.png')});
 await app.evaluate(({BrowserWindow})=>{const wins=BrowserWindow.getAllWindows();wins.find(w=>w.webContents.getURL().includes('?friend='))?.hide();wins.find(w=>!w.webContents.getURL().includes('?friend='))?.focus()});
 const versions=await app.evaluate(({app,BrowserWindow})=>({electron:process.versions.electron,node:process.versions.node,dock:app.dock.isVisible(),prefs:BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences()}));
 assert.equal(versions.electron,JSON.parse(readFileSync(join(root,'package.json'),'utf8')).devDependencies.electron);assert.equal(versions.dock,false);assert.equal(versions.prefs.contextIsolation,true);assert.equal(versions.prefs.nodeIntegration,false);assert.equal(versions.prefs.sandbox,true);
 const frameResult=await page.evaluate(()=>new Promise(resolve=>{
  const frame=document.createElement('iframe');frame.sandbox='allow-scripts';const listener=e=>{if(e.source===frame.contentWindow&&e.data?.smoke){window.removeEventListener('message',listener);resolve(e.data)}};window.addEventListener('message',listener);
  frame.srcdoc=`<script>parent.postMessage({smoke:true,node:typeof require,popup:window.open('https://example.com')===null},'*')<\/script>`;document.body.append(frame);
 }));
 assert.equal(frameResult.node,'undefined');assert.equal(frameResult.popup,true);assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length),2);
 const blocked=await page.evaluate(()=>fetch('https://example.com').then(()=>false,()=>true));assert.equal(blocked,true);
 await page.evaluate(()=>window.desktop.hideCharacters());await page.waitForTimeout(100);assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('?friend=')).isVisible()),false);
 await app.evaluate(({app})=>app.emit('second-instance'));assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('?friend=')).isVisible()),true);
 console.log(JSON.stringify({ok:true,electron:versions.electron,node:versions.node,checks:['friend direct-send and play entry','Agent tabs/no avatars/no plus','preload IPC','sandbox/contextIsolation','no Dock','iframe playback','no Node in iframe','popup denied','external requests blocked','hide/show recovery']}));
}catch(error){if(error.code==='EADDRINUSE')throw Error('请先退出真实客户端，4317 端口正在使用；不会替换现有服务。');throw error}
finally{if(app)await app.close();for(const stream of streams)stream.end();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(temp,{recursive:true,force:true})}
