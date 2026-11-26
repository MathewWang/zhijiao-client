const text=(v,max=12000)=>typeof v==='string'?v.trim().slice(0,max):'';
const link=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<=2000?u.href:''}catch{return ''}};
function column(v){if(typeof v==='string')return {title:'',text:text(v),items:[]};return {title:text(v?.title,200),text:text(v?.text),items:Array.isArray(v?.items)?v.items.map(i=>text(i,2000)).filter(Boolean).slice(0,30):[]}}
function block(v){
 if(!v||typeof v!=='object')return null;
 if(['paragraph','heading','quote'].includes(v.type)&&text(v.text))return {type:v.type,text:text(v.text),attribution:text(v.attribution,300)};
 if(['keyPoints','list'].includes(v.type)&&Array.isArray(v.items))return {type:'keyPoints',items:v.items.map(i=>text(i,2000)).filter(Boolean).slice(0,30)};
 if(v.type==='stat'&&Array.isArray(v.items))return {type:'stat',items:v.items.slice(0,30).filter(i=>i&&typeof i==='object').map(i=>({label:text(i.label,300),value:text(i.value,500),note:text(i.note,2000)}))};
 if(v.type==='comparison')return {type:'comparison',left:column(v.left),right:column(v.right)};
 if(v.type==='image'&&link(v.url))return {type:'image',url:link(v.url),alt:text(v.alt,300),caption:text(v.caption,2000),credit:text(v.credit,300)};
 return text(v.text)?{type:'paragraph',text:text(v.text),attribution:''}:null;
}
export function normalizeNewsContent(v){
 if(!v||typeof v.id!=='string'||!/^wearit:[a-zA-Z0-9_-]{1,93}$/.test(v.id)||!text(v.title,200)||!link(v.url)||!Array.isArray(v.blocks)||v.blocks.length>200)throw Error('无效新闻正文');
 const result={id:v.id,title:text(v.title,200),summary:text(v.summary,1600),source:'WearIT',url:link(v.url),publishedAt:Number.isFinite(v.publishedAt)?v.publishedAt:0,language:['zh-CN','en','original'].includes(v.language)?v.language:'zh-CN',contentLanguage:text(v.contentLanguage,30),readMinutes:Number.isFinite(v.readMinutes)&&v.readMinutes>0?Math.min(120,v.readMinutes):null,blocks:v.blocks.map(block).filter(Boolean),sources:(Array.isArray(v.sources)?v.sources:[]).slice(0,20).filter(s=>s&&link(s.url)).map(s=>({url:link(s.url),title:text(s.title,300),publisher:text(s.publisher,200)}))};
 if(JSON.stringify(result).length>150000)throw Error('新闻正文过长');return result;
}
