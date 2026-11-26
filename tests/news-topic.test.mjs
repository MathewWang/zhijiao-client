import test from 'node:test';import assert from 'node:assert/strict';
import {fetchNews} from '../runtime/news.mjs';import {ScheduledTasks,validateTask} from '../runtime/scheduled-tasks.mjs';
test('custom news topic changes the bounded RSS query and never falls back to AI articles',async()=>{
 const now=Date.now();let requests=[];
 const articles=await fetchNews({topic:'机器人 & 游戏',language:'zh-CN',now,fetcher:async url=>{
  requests.push(url);const u=new URL(url);assert.equal(u.origin,'https://www.bing.com');assert.equal(u.searchParams.get('q'),'机器人 & 游戏');assert.equal(u.searchParams.get('mkt'),'zh-CN');
  return new Response(`<rss><item><title>机器人新闻</title><link>http://www.bing.com/news/apiclick.aspx?url=https%3A%2F%2Fexample.com</link><description>摘要</description><pubDate>${new Date(now-1000).toUTCString()}</pubDate></item></rss>`);
 }});assert.equal(requests.length,1);assert.equal(articles[0].title,'机器人新闻');assert.ok(articles[0].url.startsWith('https://www.bing.com/'));
 await assert.rejects(fetchNews({topic:'游戏',fetcher:async()=>new Response('<rss/>')}),/符合主题/);
 await assert.rejects(fetchNews({topic:'',fetcher:()=>{throw Error('should not fetch')}}),/主题/);
});
test('task topic migrates, persists across edits, and supports multiple separate news tasks',()=>{
 const task={id:'old',agentId:'a',default:true,kind:'news.digest',enabled:true,time:'11:00',timezone:'Asia/Shanghai',count:3,language:'zh-CN'};
 const state={scheduledTasks:[task]};let writes=0;const options={state,persist:()=>writes++,getAgents:()=>[{id:'a'}]};
 const s=new ScheduledTasks(options);s.seed();assert.equal(task.topic,'AI');assert.equal(writes,1);
 s.save('a',{...task,topic:'  机器人  '});assert.equal(task.topic,'机器人');
 s.save('a',{...task,id:undefined,topic:'游戏'});new ScheduledTasks(options).seed();assert.equal(state.scheduledTasks.length,2);assert.equal(task.topic,'机器人');assert.equal(state.scheduledTasks[1].topic,'游戏');
 for(const topic of ['',42,'x'.repeat(101)])assert.throws(()=>validateTask({...task,topic}),/主题/);
});
