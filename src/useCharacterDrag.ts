import {useEffect,useRef,useState} from 'react';
import type {PointerEvent,MouseEvent} from 'react';
const desktop=(window as any).desktop;
export function useCharacterDrag(){
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),active=useRef(false),suppress=useRef(false),pointer=useRef<number|null>(null);
 const [dragging,setDragging]=useState(false);
 function stop(){if(timer.current)clearTimeout(timer.current);timer.current=null;if(active.current)desktop?.endCharacterDrag?.();active.current=false;pointer.current=null;setDragging(false)}
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);if(active.current)desktop?.endCharacterDrag?.()},[]);
 return {dragging,handlers:{
  onPointerDown(e:PointerEvent<HTMLDivElement>){if(!desktop?.beginCharacterDrag||e.button!==0||!(e.target as Element).closest('.character-button,.character-info,.drag-handle'))return;stop();suppress.current=false;pointer.current=e.pointerId;const target=e.currentTarget,id=e.pointerId;timer.current=setTimeout(()=>{timer.current=null;target.setPointerCapture(id);active.current=true;suppress.current=true;setDragging(true);desktop.beginCharacterDrag()},220)},
  onPointerMove(e:PointerEvent<HTMLDivElement>){if(pointer.current===e.pointerId&&active.current)desktop?.moveCharacterDrag?.()},
  onPointerUp(e:PointerEvent<HTMLDivElement>){if(pointer.current!==e.pointerId)return;stop();if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)},
  onPointerLeave(){if(!active.current)stop()},onPointerCancel(){stop()},onLostPointerCapture(){stop()},
  onClickCapture(e:MouseEvent<HTMLDivElement>){if(suppress.current&&e.detail!==0){e.preventDefault();e.stopPropagation();suppress.current=false}},
  onDragStart(e:React.DragEvent<HTMLDivElement>){e.preventDefault()}
 }};
}
