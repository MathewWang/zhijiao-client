const text=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const localized=v=>text(typeof v==='string'?v:v?.['zh-Hans']||v?.en,5000);
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))?v:null;
export function normalizeCalendar(value){
 if(!value||!Array.isArray(value.items)||value.items.length>100||typeof value.stale!=='boolean')throw Error('模型日历响应无效');
 const items=value.items.map(v=>{
  if(!v||!text(v.id,120)||v.id.length>120||!text(v.provider,100)||!text(v.model,200)||!['released','announced','predicted'].includes(v.status))throw Error('模型日历记录无效');
  const sources=(Array.isArray(v.sources)?v.sources:[]).slice(0,20).flatMap(s=>{try{const u=new URL(s.url);return u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<=2000?[{title:text(s.title,300)||u.hostname,url:u.href,date:date(s.date),official:s.official===true}]:[]}catch{return []}});
  return {id:v.id,provider:text(v.provider,100),model:text(v.model,200),status:v.status,confidence:['low','medium','high'].includes(v.confidence)?v.confidence:'low',windowStart:date(v.windowStart),windowEnd:date(v.windowEnd),summary:localized(v.summary),rationale:localized(v.rationale),sources};
 });
 const nextCursor=value.nextCursor==null?null:text(value.nextCursor,200);if(value.nextCursor!=null&&(typeof value.nextCursor!=='string'||value.nextCursor.length>200))throw Error('模型日历分页无效');
 return {items:[...new Map(items.map(i=>[i.id,i])).values()],stale:value.stale,updatedAt:typeof value.updatedAt==='string'&&Number.isFinite(Date.parse(value.updatedAt))?value.updatedAt:null,nextCursor,historyStart:date(value.historyStart)};
}
// Publication status determines the side of today; a forecast's past window is not a release.
export function calendarTimeline(items,today){
 const pending=new Map(),released=new Map();
 for(const item of items){const groups=item.status==='released'?released:pending,day=item.windowStart||null;if(!groups.has(day))groups.set(day,[]);groups.get(day).push(item)}
 const sorted=groups=>[...groups].sort(([a],[b])=>a===null?1:b===null?-1:b.localeCompare(a));
 const group=(phase,day,values)=>({key:phase+':'+(day||'undated'),phase,day,today:false,items:values});
 const result=sorted(pending).map(([day,values])=>group('pending',day,values));
 result.push({key:'today',phase:'released',day:today,today:true,items:released.get(today)||[]});
 released.delete(today);
 return result.concat(sorted(released).map(([day,values])=>group('released',day,values)));
}
export function nearestCalendarItem(items,today){
 return [...items].sort((a,b)=>{const distance=i=>i.windowStart?Math.abs(Date.parse(i.windowStart)-Date.parse(today)):Number.MAX_SAFE_INTEGER;return distance(a)-distance(b)||String(b.windowStart||'').localeCompare(a.windowStart||'')})[0]?.id||null;
}
