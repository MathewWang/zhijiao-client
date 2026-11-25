import React from 'react';
export type SocialActionRequest={id:string;agentId:string;status:string;draftId?:string;action:{type:string;to:string;text:string;kind?:string;title?:string;brief?:string}};
export function SocialActionConfirmation({item,name,disabled,act,onOpen}:{item:SocialActionRequest;name:string;disabled:boolean;act:(path:string,data:unknown)=>Promise<boolean>;onOpen:()=>void}){
 const title=item.action.title||({'gift.flowers':'送花','celebration.fireworks':'烟花'} as Record<string,string>)[item.action.kind||'']||'自定义效果';
 return <div className="social-action-confirmation" role="group" aria-label="确认特效制作"><strong>给{name} · {title}</strong><p>{item.action.text}</p>{item.action.brief&&<small>{item.action.brief}</small>}{item.status==='pending'?<><small>制作会调用本机 Agent，可能消耗模型额度。不会自动发送给好友。</small><div><button disabled={disabled} onClick={()=>act('social-actions/confirm',{id:item.id,confirmCost:true})}>同意制作</button><button disabled={disabled} onClick={()=>act('social-actions/decline',{id:item.id})}>暂不制作</button></div></>:item.status==='started'?<><small>已开始制作，进度与预览在对应好友聊天中。</small><button onClick={onOpen}>查看好友聊天</button></>:<small>已取消，未开始制作。</small>}</div>;
}
