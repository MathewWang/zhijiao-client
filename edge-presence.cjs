// Native movement stays inside each display. The final step is clipped inside
// the transparent canvas, avoiding macOS forcibly clamping off-screen windows.
const {clampBounds}=require('./window-placement.cjs');
const IDLE_MS=30000,HOVER_MS=1000,PEEK_MS=5000,WALK_SPEED=.1,RETREAT_MS=310/WALK_SPEED;
function createEdgePresence({screen,onState=()=>{},suppressed=()=>false,isDragging=()=>false,now=Date.now}){
 const records=new Map();let disposed=false;
 const workFor=bounds=>screen.getDisplayMatching(bounds).workArea;
 function emit(r){onState(r.id,{phase:r.phase,edge:r.edge,direction:r.direction,unread:r.unread||0,transitionMs:r.transitionMs??650});}
 function edgeBounds(r){const w=workFor(r.home);r.work=w;r.edge=r.home.x+r.home.width/2<w.x+w.width/2?'left':'right';return clampBounds({...r.home,x:r.edge==='left'?w.x:w.x+w.width-r.home.width},w)}
 function phase(r,value,time=now()){r.phase=value;r.since=time;r.hoverSince=null;emit(r)}
 function register(id,win){const home=win.getBounds();const r={id,win,home,work:workFor(home),phase:'shown',edge:'right',direction:1,since:now(),lastActive:now(),unread:0};records.set(id,r);edgeBounds(r);emit(r);return r}
 function restore(r,time=now()){
  const from=r.win.getBounds();r.home=clampBounds(r.home,workFor(r.home));r.move={from,to:r.home,start:time,delay:(r.phase==='peeking'?110:310)/WALK_SPEED,duration:Math.abs(from.x-r.home.x)/WALK_SPEED};r.direction=r.home.x===from.x?(r.edge==='left'?1:-1):r.home.x>from.x?1:-1;
  r.transitionMs=r.move.delay;phase(r,'entering',time);r.win.showInactive();r.lastActive=time;
 }
 function retreat(r,time=now()){r.retreatMs=(r.phase==='peeking'?200:310)/WALK_SPEED;r.transitionMs=r.retreatMs;r.direction=r.edge==='left'?-1:1;phase(r,'retreating',time)}
 function leave(r,time){const from=r.win.getBounds(),to=edgeBounds(r);r.move={from,to,start:time,duration:Math.abs(to.x-from.x)/WALK_SPEED};r.direction=r.edge==='left'?-1:1;phase(r,'leaving',time)}
 function notice(id,key,count){const r=records.get(id);if(!r)return;const fresh=r.noticeKey!==undefined&&r.noticeKey!==key;r.noticeKey=key;r.unread=count;if(!count){if(r.phase==='peeking')retreat(r);else emit(r);return}if(!fresh||suppressed())return;
  if(r.phase==='peeking'){emit(r);return} // New arrivals do not extend the 5s reminder indefinitely.
  r.win.setBounds(edgeBounds(r));r.transitionMs=650;r.direction=r.edge==='left'?1:-1;phase(r,'peeking');r.win.showInactive();
 }
 function activity(id){const r=records.get(id);if(!r)return;r.lastActive=now();if(['hidden','peeking','retreating','leaving'].includes(r.phase))restore(r);}
 function suspend(){for(const r of records.values()){r.move=null;phase(r,'suppressed');r.win.hide()}}
 function reveal(){for(const r of records.values()){r.home=clampBounds(r.home,workFor(r.home));r.win.setBounds(r.home);r.direction=1;r.lastActive=now();phase(r,'shown');r.win.showInactive()}}
 function drag(id,active){const r=records.get(id);if(!r)return;if(active){r.move=null;phase(r,'dragging')}else{r.home=clampBounds(r.win.getBounds(),workFor(r.win.getBounds()));r.work=workFor(r.home);edgeBounds(r);r.lastActive=now();phase(r,'shown')}}
 function tick(time=now()){
  if(disposed||!records.size||suppressed())return;
  const cursor=screen.getCursorScreenPoint();
  for(const [id,r] of records){if(r.win.isDestroyed()){records.delete(id);continue}if(isDragging(r.win)||r.phase==='suppressed')continue;
   if(r.phase==='leaving'||r.phase==='entering'){
    const m=r.move;if(!m)continue;const elapsed=Math.max(0,time-m.start-(m.delay||0)),t=m.duration?Math.min(1,elapsed/m.duration):(time-m.start>=(m.delay||0)?1:0),e=t;r.win.setPosition(Math.round(m.from.x+(m.to.x-m.from.x)*e),Math.round(m.from.y+(m.to.y-m.from.y)*e));
    if(t===1){r.move=null;if(r.phase==='leaving')retreat(r,time);else{r.lastActive=time;phase(r,'shown',time)}}
   }else if(r.phase==='retreating'&&time-r.since>=(r.retreatMs??RETREAT_MS)){phase(r,'hidden',time);r.win.hide()}
   else if(r.phase==='peeking'&&time-r.since>=PEEK_MS)retreat(r,time);
   else if(r.phase==='shown'&&time-r.lastActive>=IDLE_MS)leave(r,time);
   if(r.phase==='hidden'){
    const w=r.work,display=screen.getDisplayMatching(r.home).bounds||w,x=r.edge==='left'?display.x:display.x+display.width;
    const within=Math.abs(cursor.x-x)<=12&&cursor.y>=r.home.y&&cursor.y<=r.home.y+r.home.height;
    if(!within)r.hoverSince=null;else if(r.hoverSince==null)r.hoverSince=time;else if(time-r.hoverSince>=HOVER_MS)restore(r,time);
   }
  }
 }
 function recover(){for(const r of records.values()){if(r.win.isDestroyed())continue;r.home=clampBounds(r.home,workFor(r.home));edgeBounds(r);r.move=null;if(['hidden','retreating'].includes(r.phase)){phase(r,'hidden');r.win.hide()}else if(!suppressed()){r.win.setBounds(r.home);r.lastActive=now();phase(r,'shown');r.win.showInactive()}}}
 return {register,notice,activity,suspend,reveal,drag,tick,recover,get:id=>{const r=records.get(id);return r?{phase:r.phase,edge:r.edge,direction:r.direction,unread:r.unread}:null},isShown:win=>[...records.values()].some(r=>r.win===win&&!['hidden','suppressed','retreating'].includes(r.phase)),dispose(){disposed=true;records.clear()}};
}
module.exports={createEdgePresence,IDLE_MS,HOVER_MS,PEEK_MS,RETREAT_MS,WALK_SPEED};
