export const usesWearitNews=t=>t?.kind==='news.digest'&&t.default===true&&/^(ai|人工智能)$/i.test((t.topic??'AI').trim());
export const taskUsesModel=t=>t?.kind==='agent.prompt'||t?.kind==='news.digest'&&!usesWearitNews(t)&&(t.language??'zh-CN')!=='original';
