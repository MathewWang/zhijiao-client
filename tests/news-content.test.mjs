import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeNewsContent} from '../shared/news-content.mjs';import {fetchWearitDetail} from '../runtime/news.mjs';import {encodeNewsMessage,parseNewsMessage} from '../shared/news-messages.mjs';
const base={id:'wearit:test',title:'新闻',summary:'摘要',url:'https://example.com/news',source:'WearIT',publishedAt:1,language:'en',blocks:[{type:'paragraph',text:'Full story'},{type:'heading',text:'Background'},{type:'stat',items:[{label:'Count',value:'3',note:'Reported'}]},{type:'image',url:'https://example.com/photo.jpg',caption:'Editorial photo'}]};
test('structured detail keeps readable blocks, rejects executable links, drops unknown fields and bounds input',()=>{
 const result=normalizeNewsContent({...base,ownerId:'private',blocks:[...base.blocks,{type:'image',url:'javascript:alert(1)'},{type:'unknown',text:'Readable fallback'}]});assert.equal(result.blocks.length,5);assert.equal(result.blocks.at(-1).text,'Readable fallback');assert.equal(result.ownerId,undefined);assert.equal(result.language,'en');
 assert.throws(()=>normalizeNewsContent({...base,url:'javascript:alert(1)'}));assert.throws(()=>normalizeNewsContent({...base,blocks:Array(201).fill(base.blocks[0])}));
 const message=parseNewsMessage(encodeNewsMessage({type:'share',roomId:'room',article:base,expiresAt:Date.now()+10000}));assert.equal(message.article.language,'en');assert.equal(message.article.blocks,undefined);
});
test('client detail uses its authenticated relay adapter and checks article identity',async()=>{
 const article=await fetchWearitDetail({client:{api:async path=>{assert.equal(path,'/v1/news/detail?articleId=wearit%3Atest&language=en');return {article:base}}},articleId:base.id,language:'en'});assert.equal(article.blocks[0].text,'Full story');
 await assert.rejects(fetchWearitDetail({client:{api:async()=>({article:base})},articleId:'wearit:other',language:'en'}),/不匹配/);
 await assert.rejects(fetchWearitDetail({articleId:base.id}),/连接云端/);
});
