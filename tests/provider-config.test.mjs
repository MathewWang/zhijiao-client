import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {adapters,runAgent,configuredMcpArgs,safeCliError} from '../runtime/adapters.mjs';

test('Codex and TRAE retain provider configuration while overriding execution permissions',()=>{
 for(const id of ['codex','trae']){
  const args=adapters[id].args();assert.ok(!args.includes('--ignore-user-config'));
  for(const override of ['features.hooks=false','features.plugins=false','features.apps=false','features.shell_tool=false','notify=[]','web_search="disabled"','approval_policy="never"'])assert.ok(args.includes(override),id+': '+override);
  assert.ok(args.includes('--ignore-rules'));assert.ok(args.includes('read-only'));
  assert.ok(!args.some(x=>x.startsWith('model_provider=')||x.includes('api.openai.com')));
 }
});

test('configured provider is reused, MCP servers are disabled, and failed isolation never invokes inference',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'zj-provider-')),fake=join(dir,'cli.mjs'),config=join(dir,'provider.json'),receipt=join(dir,'receipt');
 const saved=adapters.codex.command;adapters.codex.command=fake;
 t.after(()=>{adapters.codex.command=saved;rmSync(dir,{recursive:true,force:true})});
 writeFileSync(config,JSON.stringify({base_url:'https://company.invalid/v1',model:'company-model',token:'sk-test-secret-only-fixture'}));
 writeFileSync(fake,`#!${process.execPath}
import fs from 'node:fs';const args=process.argv.slice(2);
if(args[0]==='mcp'){if(fs.existsSync(${JSON.stringify(join(dir,'broken'))})){process.stderr.write('sk-never-expose-this-fixture');process.exit(1)}console.log(JSON.stringify(fs.existsSync(${JSON.stringify(join(dir,'odd-name'))})?[{name:'company.tools'}]:[{name:'company_tools'},{name:'second-server'}]));}
else {let prompt='';for await(const chunk of process.stdin)prompt+=chunk;const local=JSON.parse(fs.readFileSync(${JSON.stringify(config)}));if(args.includes('--ignore-user-config'))local.base_url='https://api.openai.com/v1';fs.writeFileSync(${JSON.stringify(receipt)},JSON.stringify({args,url:local.base_url,model:local.model}));console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'连接成功'}}))}
`,{mode:0o700});
 const text=await runAgent({agent:{id:'agent',engine:'codex',name:'测试'},history:[],message:'测试',dataDir:dir});assert.equal(text,'连接成功');
 const result=JSON.parse(readFileSync(receipt));assert.equal(result.url,'https://company.invalid/v1');assert.equal(result.model,'company-model');assert.ok(result.args.includes('mcp_servers.company_tools.enabled=false'));assert.ok(result.args.includes('mcp_servers.second-server.enabled=false'));assert.ok(!JSON.stringify(result.args).includes('sk-test'));
 rmSync(receipt);writeFileSync(join(dir,'odd-name'),'1');
 await assert.rejects(runAgent({agent:{id:'agent',engine:'codex',name:'测试'},history:[],message:'测试',dataDir:dir}),/无法识别 CLI/);assert.equal(existsSync(receipt),false);rmSync(join(dir,'odd-name'));writeFileSync(join(dir,'broken'),'1');
 await assert.rejects(runAgent({agent:{id:'agent',engine:'codex',name:'测试'},history:[],message:'测试',dataDir:dir}),e=>!e.message.includes('sk-never')&&e.message.includes('尚未调用模型'));
 assert.equal(existsSync(receipt),false);
 const aborted=new AbortController();aborted.abort();await assert.rejects(configuredMcpArgs(fake,{signal:aborted.signal}),/已停止/);
});

test('model errors redact keys and bearer tokens before showing in UI',()=>{
 assert.equal(safeCliError('401 sk-company-secret-key Bearer company-token'),'401 [密钥已隐藏] Bearer [已隐藏]');
});
