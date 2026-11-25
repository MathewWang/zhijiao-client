import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {MessengerClient} from '../client/core.mjs';
test('direct messages never call an Agent, survive ACK failure and remain unread until the matching peer opens them',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'zj-direct-'));let modelCalls=0,acks=0;const message={id:'direct-1',kind:'direct',sender:'friend',text:'你好主人',created_at:100};
 let client=new MessengerClient({config:{relay:'http://127.0.0.1:9999',id:'me',agent:{}},dbPath:join(dir,'client.sqlite'),dataDir:dir,agentRunner:()=>{modelCalls++;throw Error('must not run')},requireOwnerApproval:true});
 t.after(()=>{client.close();rmSync(dir,{recursive:true,force:true})});
 client.api=async path=>{if(path.endsWith('/pull'))return {message};if(path.endsWith('/ack')&&acks++===0)throw Error('network');return {id:'server-id'}};
 await assert.rejects(client.tick(),/network/);await client.tick();assert.equal(modelCalls,0);assert.equal(client.directSnapshot().messages.length,1);assert.deepEqual(client.directSnapshot().unread,{friend:1});
 client.markDirectRead('stranger','direct-1');assert.deepEqual(client.directSnapshot().unread,{friend:1});
 client.markDirectRead('friend','direct-1');assert.deepEqual(client.directSnapshot().unread,{});
 client.queue('friend','主人回复','direct',null,'send-key');await client.flush();assert.equal(client.directSnapshot().messages.find(m=>!m.incoming).status,'delivered');
 client.close();client=new MessengerClient({config:{relay:'http://127.0.0.1:9999',id:'me',agent:{}},dbPath:join(dir,'client.sqlite'),dataDir:dir,requireOwnerApproval:true});assert.equal(client.directSnapshot().messages.length,2);assert.deepEqual(client.directSnapshot().unread,{});
});
