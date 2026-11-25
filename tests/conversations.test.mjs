import test from 'node:test';
import assert from 'node:assert/strict';
import {isAgentMessage,peerActivities,peerUnread,markPeerActivities} from '../shared/conversations.mjs';
import {summarizeInbox} from '../desktop-inbox.cjs';
test('friend events have one destination, stable read receipts and remain actionable after read',()=>{
 const state={agents:[{id:'agent',name:'A'}],messages:[],localPlayDrafts:[{id:'local',peer:'b',status:'ready'}],cloud:{agentId:'agent',deviceId:'a',direct:{unread:{b:1}},messages:[],visits:[{id:'v',from:'b',to:'a',status:'pending'}],interactions:[{id:'effect',key:'local',from:'a',to:'b',status:'pending'}],updateInvitations:[]}};
 assert.equal(peerActivities(state).filter(i=>i.id==='draft:local').length,0);assert.deepEqual(peerUnread(state),{b:2});const seen=markPeerActivities(state,{},'b');assert.deepEqual(peerUnread(state,seen),{b:1});assert.equal(state.cloud.visits[0].status,'pending');state.cloud.interactions[0].status='completed';assert.deepEqual(peerUnread(state,seen),{b:2});assert.deepEqual(peerUnread(state,markPeerActivities(state,seen,'other')),{b:2});state.peerUnread=peerUnread(state,seen);const badge=summarizeInbox(state);assert.equal(badge.total,2);assert.equal(badge.messages,0);assert.equal(badge.plays,1);
});
test('owner conversations retain public release notices and owner turns, exclude legacy social receipts',()=>{
 assert.equal(isAgentMessage({role:'assistant',updateVersion:'1.0.0'}),true);assert.equal(isAgentMessage({role:'user',cloudReportKind:'owner'}),true);
 for(const metadata of [{interactionId:'i'},{updateInvitationId:'u'},{cloudReportKind:'reply'},{cloudReportKind:'confirmation'},{channel:'friend-event'}])assert.equal(isAgentMessage({role:'assistant',...metadata}),false);
});

test('completed effects may be replayed locally without accepting or sending another receipt',async()=>{
 const {InteractionRuntime}=await import('../runtime/interaction-runtime.mjs');const {createInteraction,actInteraction}=await import('../shared/interactions.mjs');const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const dir=mkdtempSync(join(tmpdir(),'replay-')),items=[];let calls=0;
 const i=createInteraction(items,{from:'a',to:'b',key:'effect',plan:{protocol:'zhijiao.interaction',version:2,intent:{kind:'gift.flowers',message:'hi',brief:'flowers'},presentation:{durationSeconds:20},artifact:{html:'<div>flowers</div>'}}},()=>true);
 const cloud={config:{id:'b'},state:{interactions:items},client:{api:async(p,b)=>{calls++;return actInteraction(items,{...b,actor:'b'})}},poll:async()=>{}};const r=new InteractionRuntime({dbPath:join(dir,'effects.sqlite'),cloud,getAgent:()=>({id:'owner'}),dataDir:dir});
 try{assert.throws(()=>r.artifact(i.id,{},true));await r.action({id:i.id,action:'accept'});await r.action({id:i.id,action:'complete'});const before=calls;assert.match(r.artifact(i.id,{},true),/flowers/);assert.equal(i.status,'completed');assert.equal(calls,before);cloud.config.id='stranger';assert.throws(()=>r.artifact(i.id,{},true))}finally{await r.close();rmSync(dir,{recursive:true,force:true})}
});

test('social cards persist when the relay trims its response, while render snapshots exclude artifact source',async()=>{
 const {DesktopCloud}=await import('../runtime/cloud.mjs');const {DatabaseSync}=await import('node:sqlite');const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const dir=mkdtempSync(join(tmpdir(),'social-archive-')),cloud=new DesktopCloud({dir,getAgent:()=>null});const db=new DatabaseSync(':memory:');cloud.client={db};
 try{const event={id:'i',from:'a',to:'b',status:'completed',plan:{version:2,intent:{message:'hi'},artifact:{html:'private effect source'}}};const first=cloud.rememberSocial({interactions:[event]});assert.equal(first.interactions.length,1);cloud.state.interactions=first.interactions;assert.equal(cloud.snapshot().interactions[0].plan.artifact,undefined);assert.equal(cloud.state.interactions[0].plan.artifact.html,'private effect source');assert.equal(cloud.rememberSocial({interactions:[]}).interactions[0].id,'i')}finally{db.close();rmSync(dir,{recursive:true,force:true})}
});
