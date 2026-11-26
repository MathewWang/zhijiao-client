import React from 'react';
import type {NewsContent} from '../shared/news-content.mjs';
export function NewsBody({content,onOpen}:{content:NewsContent;onOpen:(url:string)=>void}){
 const language=({'zh-Hans':'简体中文','zh-CN':'简体中文',en:'English',ja:'日本語',ko:'한국어'} as Record<string,string>)[content.contentLanguage];
 return <article className="news-full-body" aria-label="WearIT 新闻正文">
  <p className="news-muted">WearIT 正文{content.readMinutes?` · 约 ${Math.ceil(content.readMinutes)} 分钟`:''}{language?` · ${language}`:''}</p>
  {content.blocks.map((block,index)=>{
   if(block.type==='heading')return <h3 key={index}>{block.text}</h3>;
   if(block.type==='paragraph')return <p key={index}>{block.text}</p>;
   if(block.type==='quote')return <blockquote key={index}><p>{block.text}</p>{block.attribution&&<cite>{block.attribution}</cite>}</blockquote>;
   if(block.type==='keyPoints')return <section className="news-key-points" key={index}><h3>关键要点</h3><ul>{block.items.map((item,i)=><li key={i}>{item}</li>)}</ul></section>;
   if(block.type==='stat')return <section className="news-stats" aria-label="新闻数据" key={index}>{block.items.map((item,i)=><div key={i}><small>{item.label}</small><strong>{item.value}</strong>{item.note&&<p>{item.note}</p>}</div>)}</section>;
   if(block.type==='comparison')return <section className="news-comparison" key={index}>{[block.left,block.right].map((side,i)=><div key={i}>{side.title&&<h3>{side.title}</h3>}{side.text&&<p>{side.text}</p>}{side.items.length>0&&<ul>{side.items.map((item,j)=><li key={j}>{item}</li>)}</ul>}</div>)}</section>;
   if(block.type==='image')return <figure className="news-illustration" key={index}><button type="button" onClick={()=>onOpen(block.url)}>查看配图{block.alt?' · '+block.alt:''} ↗</button>{(block.caption||block.credit)&&<figcaption>{block.caption}{block.credit&&<small>{block.credit}</small>}</figcaption>}</figure>;
   return null;
  })}
  {content.blocks.length===0&&<p>WearIT 暂未提供正文内容，可查看下方来源。</p>}
  {content.sources.length>0&&<section className="news-source-list"><h3>新闻来源</h3>{content.sources.map((source,index)=><button type="button" key={index} onClick={()=>onOpen(source.url)}><strong>{source.title||source.url}</strong><small>{source.publisher||new URL(source.url).hostname} ↗</small></button>)}</section>}
 </article>;
}
