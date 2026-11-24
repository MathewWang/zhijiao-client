import test from 'node:test';import assert from 'node:assert/strict';
import {parseEvent,adapters} from '../runtime/adapters.mjs';
test('only final user-facing text is emitted, not reasoning/tool output',()=>{
 assert.equal(parseEvent('codex',{type:'item.completed',item:{type:'agent_message',text:'hello'}}),'hello');
 assert.equal(parseEvent('codex',{type:'item.completed',item:{type:'reasoning',text:'private'}}),'');
 assert.equal(parseEvent('opencode',{type:'text',part:{text:'hi'}}),'hi');
 assert.equal(parseEvent('opencode',{type:'tool_use',part:{text:'private'}}),'');
});
test('engine allowlist, no shell command interpolation, OpenCode tools denied',()=>{
 assert.equal(adapters.opencode.env.OPENCODE_PERMISSION,'{"*":"deny"}');
 assert.ok(adapters.codex.args().includes('read-only'));assert.equal(adapters.bash,undefined);
 assert.deepEqual(adapters.opencode.args('a; echo bad').slice(-2),['--model','a; echo bad']);
});

test('TRAE uses structured final replies and read-only ephemeral calls',()=>{assert.equal(parseEvent('trae',{type:'item.completed',item:{type:'agent_message',text:'hello'}}),'hello');assert.equal(parseEvent('trae',{type:'item.completed',item:{type:'reasoning',text:'private'}}),'');assert.ok(adapters.trae.args().includes('read-only'));assert.ok(!adapters.trae.args().includes('--ignore-user-config'));});

test('Antigravity accepts only a successful terminal result and denies tools per session',()=>{
 const args=adapters.antigravity.args('model; echo bad');
 const settings=JSON.parse(args[args.indexOf('--settings')+1]);
 assert.equal(settings.toolPermission,'strict');
 assert.equal(settings.useG1Credits,false);
 for(const action of ['read_file','write_file','command','read_url','execute_url','mcp'])assert.ok(settings.permissions.deny.includes(`${action}(*)`));
 assert.ok(args.includes('--disable-slash-commands'));
 assert.deepEqual(args.slice(-2),['--model','model; echo bad']);
 assert.equal(parseEvent('antigravity',{event:'step_update',step_update:{step_type:'agent_response',text_delta:'partial'}}),'');
 assert.equal(parseEvent('antigravity',{event:'result',result:{status:'ERROR',response:'partial'}}),'');
 assert.equal(parseEvent('antigravity',{event:'result',result:{status:'SUCCESS',response:'最终回复'}}),'最终回复');
});
