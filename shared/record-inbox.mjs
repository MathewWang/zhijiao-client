export function recordStamp(item){const text=JSON.stringify([item.status,item.reply||'',item.detail||'',item.attempt||0]);let hash=2166136261;for(let n=0;n<text.length;n++)hash=Math.imul(hash^text.charCodeAt(n),16777619);return (hash>>>0).toString(36)+':'+text.length}
export function groupRecords(items,seen,filter='all'){
 const tagged=items.map(item=>({...item,unread:item.eligible!==false&&seen[item.id]!==item.stamp}));
 const visible=tagged.filter(i=>filter==='unread'?i.unread:filter==='attention'?i.attention:true);
 return [{id:'attention',title:'待你处理',items:visible.filter(i=>i.attention)},{id:'unread',title:'新动态',items:visible.filter(i=>!i.attention&&i.unread)},{id:'history',title:'历史记录',items:visible.filter(i=>!i.attention&&!i.unread)}].map(g=>({...g,items:g.items.sort((a,b)=>(b.time||0)-(a.time||0))})).filter(g=>g.items.length);
}
