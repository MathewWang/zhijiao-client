const {clampBounds}=require('./window-placement.cjs');
// macOS can finish restoring displays after unlock-screen has already fired.
function installDesktopRecovery({powerMonitor,screen,windows,isQuitting,log=()=>{},timers=globalThis}){
 let pending=[];const listeners=[];
 function restore(reason){
  if(isQuitting())return;
  for(const win of windows()){
   if(win.isDestroyed())continue;
   try{
    const bounds=win.getBounds(),work=screen.getDisplayMatching(bounds).workArea;
    const next=clampBounds(bounds,work);
    if(Object.keys(next).some(key=>next[key]!==bounds[key]))win.setBounds(next);
    win.setAlwaysOnTop(true);if(win.isMinimized())win.restore();win.showInactive();
   }catch(e){log('window-restore-failed',e.message)}
  }
  log('windows-restored',reason);
 }
 function schedule(reason){
  for(const timer of pending)timers.clearTimeout(timer);
  pending=[timers.setTimeout(()=>restore(reason),250),timers.setTimeout(()=>restore(reason),1800)];
 }
 for(const event of ['resume','unlock-screen','user-did-become-active']){
  const handler=()=>schedule(event);powerMonitor.on(event,handler);listeners.push([powerMonitor,event,handler]);
 }
 for(const event of ['display-added','display-removed','display-metrics-changed']){
  const handler=()=>schedule(event);screen.on(event,handler);listeners.push([screen,event,handler]);
 }
 return ()=>{for(const timer of pending)timers.clearTimeout(timer);for(const [emitter,event,handler] of listeners)emitter.removeListener(event,handler)};
}
module.exports={installDesktopRecovery};
