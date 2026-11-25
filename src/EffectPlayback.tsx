import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import './effect-playback.css';
export type PlaybackResult={reason:'ended'|'closed'|'error';error?:string};
const desktop=(window as any).desktop;
function EffectSurface({html,onClose,onError,onReady}:{html:string;onClose:()=>void;onError:(error:string)=>void;onReady:()=>void}){
 const frame=useRef<HTMLIFrameElement>(null);
 useEffect(()=>{const handler=(e:MessageEvent)=>{if(e.source===frame.current?.contentWindow&&e.data?.type==='zhijiao.effect-close')onClose();if(e.source===frame.current?.contentWindow&&e.data?.type==='zhijiao.effect-error')onError(String(e.data.error||'播放失败').slice(0,600))};const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('message',handler);window.addEventListener('keydown',key);return()=>{window.removeEventListener('message',handler);window.removeEventListener('keydown',key)}},[onClose,onError]);
 return <div className="effect-surface" role="dialog" aria-modal="true" aria-label="沉浸式特效"><iframe ref={frame} title="隔离的互动效果" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={html} onLoad={()=>{frame.current?.contentWindow?.postMessage({type:'zhijiao.check-errors'},'*');onReady()}}/><button className="effect-close" aria-label="关闭特效" title="关闭（Esc）" onClick={onClose}><X size={22}/></button></div>
}
export function EffectStage(){
 const [payload,setPayload]=useState<{html:string;duration:number}>();
 useEffect(()=>{document.body.classList.add('effect-stage');desktop?.effectPayload?.().then(setPayload).catch((e:Error)=>desktop.closeEffect?.(e.message));return()=>document.body.classList.remove('effect-stage')},[]);
 return payload?<EffectSurface html={payload.html} onClose={()=>desktop.closeEffect()} onError={error=>desktop.closeEffect(error)} onReady={()=>desktop.effectReady()}/>:null;
}
export function EffectPlayback({html,duration,onDone}:{html:string;duration:number;onDone:(result:PlaybackResult)=>void}){
 const done=useRef(onDone),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),finished=useRef(false);done.current=onDone;
 const finish=(result:PlaybackResult)=>{if(finished.current)return;finished.current=true;clearTimeout(timer.current);done.current(result)};
 useEffect(()=>{if(desktop?.playEffect)void desktop.playEffect({html,duration}).then(finish).catch((e:Error)=>finish({reason:'error',error:e.message}));return()=>{clearTimeout(timer.current);desktop?.cancelEffect?.()}},[html,duration]);
 if(desktop?.playEffect)return null;
 return createPortal(<EffectSurface html={html} onClose={()=>finish({reason:'closed'})} onError={error=>finish({reason:'error',error})} onReady={()=>{clearTimeout(timer.current);timer.current=setTimeout(()=>finish({reason:'ended'}),duration*1000)}}/>,document.body);
}
