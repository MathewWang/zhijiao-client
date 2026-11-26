import {createHash} from 'node:crypto';
export const NEWS_FEEDS=[{url:'https://openai.com/news/rss.xml',source:'OpenAI',hosts:['openai.com']},{url:'https://blog.google/innovation-and-ai/technology/ai/rss/',source:'Google AI',hosts:['blog.google']}];
const decode=s=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'");
const plain=s=>decode(s).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export function parseFeed(xml,feed,now=Date.now()){
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('不支持的新闻源格式');const articles=[];for(const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)){const block=match[1],tag=name=>block.match(new RegExp('<'+name+'\\b[^>]*>([\\s\\S]*?)<\\/'+name+'>','i'))?.[1]||'';try{const title=plain(tag('title')).slice(0,200),url=new URL(decode(tag('link')).trim()),publishedAt=Date.parse(tag('pubDate'));if(!title||url.protocol!=='https:'||!feed.hosts.includes(url.hostname)||!Number.isFinite(publishedAt)||publishedAt>now+3600000||publishedAt<now-7*86400000)continue;articles.push({id:createHash('sha256').update(url.href).digest('hex').slice(0,24),title,url:url.href,summary:plain(tag('description')).slice(0,1200),source:feed.source,publishedAt});}catch{}}return articles;
}
export async function fetchNews({count=3,fetcher=fetch,signal,now=Date.now()}={}){
 const result=await Promise.allSettled(NEWS_FEEDS.map(async feed=>{const res=await fetcher(feed.url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000),redirect:'error',cache:'no-store'});if(!res.ok)throw Error('新闻源暂不可用');let text='';const decoder=new TextDecoder();for await(const chunk of res.body){text+=decoder.decode(chunk,{stream:true});if(text.length>1500000)throw Error('新闻源过大')}text+=decoder.decode();return parseFeed(text,feed,now)}));
 const articles=[...new Map(result.flatMap(r=>r.status==='fulfilled'?r.value:[]).map(a=>[a.url,a])).values()].sort((a,b)=>b.publishedAt-a.publishedAt).slice(0,Math.min(10,Math.max(1,count)));
 if(!articles.length)throw Error('暂未取得近7天可核验的 AI 新闻，请稍后重试');return articles;
}
