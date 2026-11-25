import React,{useEffect,useState} from 'react';
import './companion-motion.css';
import characters from '../shared/characters.json';
export type Motion='idle'|'wave'|'walk'|'peek';
export function AnimatedCompanion({skin='taotao',sleep=false,busy=false,attention='',action,motionKey=0,onPhase}:{skin?:string;sleep?:boolean;busy?:boolean;attention?:string;action?:Motion;motionKey?:number;onPhase?:(phase:string)=>void}){
 const preset=characters.find(c=>c.id===skin)||characters[0],sheet=preset.motion.sheet;
 const [frame,setFrame]=useState(4),[failed,setFailed]=useState(false),[greeting,setGreeting]=useState(false);
 useEffect(()=>{setFailed(false);const image=new Image();image.src=sheet;image.onerror=()=>setFailed(true);return()=>{image.onerror=null}},[sheet]);
 useEffect(()=>{if(!attention||action)return;setGreeting(true);const timer=setTimeout(()=>setGreeting(false),1800);return()=>clearTimeout(timer)},[attention,action]);
 const phase=action||(greeting?'wave':'idle');
 useEffect(()=>{onPhase?.(phase)},[phase,onPhase]);
 useEffect(()=>{const start=performance.now(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;const update=()=>{if(document.hidden)return;const t=performance.now()-start;if(phase==='walk')setFrame(reduced?0:Math.floor(t/110)%4);else if(phase==='peek'||phase==='wave'){const frames=[8,9,10,11,10,9];setFrame(reduced?9:frames[Math.floor(t/145)%frames.length])}else{const blink=Math.floor(t%5600/95);setFrame(blink<4?4+blink:4)}};update();const timer=setInterval(update,40);return()=>clearInterval(timer)},[phase,motionKey,sheet]);
 const pose=preset.motion.frames[frame];const imageStyle={width:`${preset.motion.sourceWidth/pose.width*100}%`,height:`${preset.motion.sourceHeight/pose.height*100}%`,left:`${-pose.x/pose.width*100}%`,top:`${-pose.y/pose.height*100}%`};
 return <div className={`anime-motion ${phase} ${busy?'motion-busy':''} ${sleep?'motion-rest':''}`} data-motion={phase} role="img" aria-label={`${preset.name} · ${{idle:'待机',wave:'招手',walk:'走路',peek:'歪头招手'}[phase]}`}>
 {failed?<img className="motion-fallback" src={preset.image} alt={preset.name}/>:<div className="motion-frame"><div className="motion-pose" style={{width:`${pose.width/pose.height*86}%`}}><img src={sheet} alt="" aria-hidden="true" draggable={false} style={imageStyle}/></div></div>}{busy&&<span className="motion-thought">···</span>}</div>;
}
