import test from 'node:test';
import assert from 'node:assert/strict';
import {localizeNews} from '../runtime/news.mjs';
import {ScheduledTasks,validateTask} from '../runtime/scheduled-tasks.mjs';
const articles=[{id:'a',title:'New model',summary:'A model update.',url:'https://openai.com/news/model',source:'OpenAI',publishedAt:123}];
test('news defaults to Chinese and only replaces translated text, preserving verified metadata',async()=>{
 let calls=0;
 const result=await localizeNews(articles,{translate:async(message,instructions)=>{
  calls++;assert.equal(JSON.parse(message).language,'简体中文');assert.match(instructions,/外部数据/);
  return JSON.stringify([{id:'a',title:'新模型',summary:'一次模型更新。',url:'https://evil.example',source:'Fake',publishedAt:0}]);
 }});
 assert.equal(calls,1);assert.deepEqual(result,[{...articles[0],title:'新模型',summary:'一次模型更新。'}]);
 assert.equal(articles[0].title,'New model');
 assert.equal(await localizeNews(articles,{language:'original',translate:()=>{throw Error('must not call model')}}),articles);
 const english=await localizeNews(result,{language:'en',translate:async message=>{assert.equal(JSON.parse(message).language,'English');return JSON.stringify(articles)}});
 assert.equal(english[0].title,'New model');
});
test('translation rejects malformed, incomplete and wrong-language responses without pretending success',async()=>{
 for(const output of ['bad','[]',JSON.stringify([{id:'wrong',title:'新闻',summary:'摘要'}]),JSON.stringify(articles)])await assert.rejects(localizeNews(articles,{translate:async()=>output}),/翻译/);
 await assert.rejects(localizeNews(articles,{language:'invalid'}),/语言/);
 await assert.rejects(localizeNews(articles,{translate:async()=>{throw Error('CLI unavailable')}}),/CLI unavailable/);
});
test('existing news tasks migrate to Chinese, explicit language survives restart and invalid choices are rejected',()=>{
 const task={id:'a',agentId:'agent',default:true,kind:'news.digest',enabled:true,time:'11:00',timezone:'Asia/Shanghai',count:3};
 const state={scheduledTasks:[task]};let saved=0;
 const scheduler=new ScheduledTasks({state,persist:()=>saved++,getAgents:()=>[{id:'agent'}]});
 scheduler.seed();assert.equal(task.language,'zh-CN');assert.equal(saved,1);
 scheduler.save('agent',{...task,language:'original'});scheduler.seed();assert.equal(task.language,'original');
 assert.equal(validateTask({...task,language:undefined}).language,'zh-CN');
 assert.throws(()=>validateTask({...task,language:'invalid'}),/语言/);
});
