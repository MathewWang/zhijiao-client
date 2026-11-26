import test from 'node:test';import assert from 'node:assert/strict';
import {usesWearitNews,taskUsesModel} from '../shared/news-provider.mjs';import {fetchWearitNews} from '../runtime/news.mjs';
test('only default AI task switches to WearIT, without model calls or changing other topic tasks',()=>{
 const task={kind:'news.digest',default:true,topic:'AI',language:'zh-CN',time:'11:00'};
 assert.equal(usesWearitNews(task),true);assert.equal(taskUsesModel(task),false);assert.equal(usesWearitNews({...task,topic:'机器人'}),false);assert.equal(taskUsesModel({...task,topic:'机器人'}),true);assert.equal(usesWearitNews({...task,default:false}),false);assert.equal(taskUsesModel({...task,default:false,language:'original'}),false);assert.equal(taskUsesModel({kind:'agent.prompt'}),true);
});
test('desktop requests today news through authenticated relay only and rejects stale dates',async()=>{
 const now=Date.parse('2026-11-26T04:00:00Z'),article={id:'wearit:one',title:'今日新闻',summary:'摘要',source:'WearIT',url:'https://example.com/news',publishedAt:now-1000};
 const client={api:async path=>{assert.ok(path.startsWith('/v1/news/daily?'));const params=new URL('https://relay.example'+path).searchParams;assert.equal(params.get('timezone'),'Asia/Shanghai');assert.equal(params.get('language'),'zh-CN');return {source:'WearIT',day:'2026-11-26',timezone:'Asia/Shanghai',articles:[article]}}};
 assert.deepEqual(await fetchWearitNews({client,now}),[article]);
 await assert.rejects(fetchWearitNews({now}),/先连接云端/);
 await assert.rejects(fetchWearitNews({client:{api:async()=>({source:'WearIT',day:'2026-11-25',timezone:'Asia/Shanghai',articles:[article]})},now}),/响应无效/);
 await assert.rejects(fetchWearitNews({client:{api:async()=>{throw Error('接口不存在')}},now}),/尚未部署/);
 assert.deepEqual(await fetchWearitNews({client:{api:async()=>({source:'WearIT',day:'2026-11-26',timezone:'Asia/Shanghai',articles:[]})},now}),[]);
});
