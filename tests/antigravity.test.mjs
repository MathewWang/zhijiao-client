import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {adapters,runAgent} from '../runtime/adapters.mjs';

test('Antigravity transports prompts over stdin, ignores tool/thought updates, handles final line and errors',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'zj-agy-'));const fake=join(dir,'fake-agy');
 const old=adapters.antigravity.command;adapters.antigravity.command=fake;
 t.after(()=>{adapters.antigravity.command=old;rmSync(dir,{recursive:true,force:true})});
 writeFileSync(fake,`#!/usr/bin/env node
import fs from 'node:fs';
let input='';for await(const c of process.stdin)input+=c;
const message=JSON.parse(input);fs.writeFileSync('received.json',JSON.stringify({args:process.argv.slice(2),message}));
console.log(JSON.stringify({event:'step_update',step_update:{step_type:'tool',text_delta:'secret'}}));
const fail=message.message.content.includes('FAIL_TEST');
process.stdout.write(JSON.stringify({event:'result',result:{status:fail?'ERROR':'SUCCESS',response:fail?'partial':'测试成功',error:fail?'模型不可用':undefined}}));
`,{mode:0o700});
 const agent={id:'probe',engine:'antigravity',name:'测试',persona:'简洁'};let shown='';
 const result=await runAgent({agent,history:[],message:'你好; $(echo bad)',dataDir:dir,onText:x=>shown+=x});
 assert.equal(result,'测试成功');assert.equal(shown,'测试成功');
 const received=JSON.parse(readFileSync(join(dir,'workspaces/probe/received.json'),'utf8'));
 assert.equal(received.message.event,'user');assert.ok(received.message.message.content.includes('你好; $(echo bad)'));
 assert.ok(!received.args.some(x=>x.includes('你好')));
 await assert.rejects(runAgent({agent,history:[],message:'FAIL_TEST',dataDir:dir}),/模型不可用/);
});
