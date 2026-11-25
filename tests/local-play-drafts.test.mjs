import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {InteractionRuntime} from '../runtime/interaction-runtime.mjs';
test('completed local effects retain recipient across restart, hide source in cards and isolate owner',()=>{
 const dir=mkdtempSync(join(tmpdir(),'local-play-'));let owner='owner-a';let runtime;
 const open=()=>new InteractionRuntime({dbPath:join(dir,'effects.sqlite'),cloud:{},getAgent:()=>({id:owner}),dataDir:dir});
 try{runtime=open();const plan={protocol:'zhijiao.interaction',version:2,intent:{kind:'gift.flowers',message:'送你一束花',brief:'花瓣'},presentation:{durationSeconds:20},artifact:{html:'<div>Flowers</div>'}};
 const id=runtime.saveDraft('friend-a',plan);assert.equal(runtime.drafts()[0].peer,'friend-a');assert.equal(runtime.drafts()[0].sent,false);assert.equal(runtime.drafts()[0].plan,undefined);assert.equal(runtime.drafts()[0].previewed,false);runtime.markDraft(id,'previewed');runtime.db.close();runtime=open();assert.equal(runtime.drafts()[0].previewed,true);assert.equal(runtime.localDraft(id).plan.artifact.html,plan.artifact.html);assert.equal(runtime.localDraft(id).peer,'friend-a');owner='owner-b';assert.deepEqual(runtime.drafts(),[]);assert.throws(()=>runtime.localDraft(id));owner='owner-a';runtime.markDraft(id,'sent');assert.equal(runtime.drafts()[0].sent,true);assert.throws(()=>runtime.markDraft(id,'owner'));
 }finally{runtime?.db.close();rmSync(dir,{recursive:true,force:true})}
});

test('making and failed drafts persist; restart never silently generates again',()=>{
 const dir=mkdtempSync(join(tmpdir(),'play-job-'));let r;const open=()=>new InteractionRuntime({dbPath:join(dir,'effects.sqlite'),cloud:{},getAgent:()=>({id:'owner'}),dataDir:dir});
 try{r=open();const id=r.beginDraft('friend',{kind:'gift.flowers',message:'hello',brief:'flowers'});assert.equal(r.drafts()[0].status,'generating');r.db.close();r=open();assert.equal(r.drafts()[0].status,'failed');const request=r.restartDraft(id);assert.equal(request.kind,'gift.flowers');assert.equal(r.drafts()[0].status,'generating');assert.throws(()=>r.restartDraft(id));r.finishDraft(id,null,'mock failure');assert.equal(r.drafts()[0].error,'mock failure');assert.equal(r.drafts()[0].peer,'friend');}finally{r?.db.close();rmSync(dir,{recursive:true,force:true})}
});
