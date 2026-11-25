// Presentation only: an opaque sandboxed iframe gets no filesystem or Node access.
function createEffectPlayer({BrowserWindow,screen,preferences,url}){
 let current=null;
 function finish(result={reason:'closed'}){const session=current;if(!session)return;current=null;clearTimeout(session.timer);session.parent?.removeListener('closed',session.onSourceClosed);if(!session.win.isDestroyed())session.win.destroy();session.resolve(result)}
 return {
  play(sender,payload){
   if(current)throw Error('已有特效正在播放，请先关闭');
   if(!payload||typeof payload.html!=='string'||Buffer.byteLength(payload.html)>8*1024*1024||!Number.isFinite(payload.duration)||payload.duration<5||payload.duration>60)throw Error('特效播放参数无效');
   const source=BrowserWindow.fromWebContents(sender);if(!source||source.isDestroyed())throw Error('聊天窗口已关闭');
   const b=source.getBounds(),display=screen.getDisplayNearestPoint({x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)});
   const win=new BrowserWindow({...display.bounds,frame:false,type:process.platform==='darwin'?'panel':undefined,enableLargerThanScreen:true,transparent:true,backgroundColor:'#00000000',hasShadow:false,resizable:false,movable:false,minimizable:false,maximizable:false,fullscreenable:false,skipTaskbar:true,show:false,title:'知交信使 · 沉浸式播放',webPreferences:preferences});
   return new Promise(resolve=>{current={win,parent:source,source:sender,resolve,html:payload.html,duration:payload.duration};current.timer=setTimeout(()=>finish({reason:'error',error:'特效窗口加载超时，请重新查看'}),15000);
    win.setAlwaysOnTop(true,'screen-saver');win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.once('ready-to-show',()=>{if(current?.win===win){win.show();win.focus()}});
    win.on('closed',()=>{if(current?.win===win)finish({reason:'closed'})});win.webContents.on('render-process-gone',()=>{if(current?.win===win)finish({reason:'error',error:'特效播放进程已退出'})});
    current.onSourceClosed=()=>{if(current?.win===win)finish({reason:'closed'})};source.once('closed',current.onSourceClosed);win.loadURL(url+'/?effect-stage=1').catch(()=>{if(current?.win===win)finish({reason:'error',error:'特效窗口加载失败'})});
   });
  },
  payload(sender){if(current?.win.webContents!==sender)throw Error('此窗口无权读取特效');return {html:current.html,duration:current.duration}},
  ready(sender){if(current?.win.webContents!==sender||current.started)return;current.started=true;clearTimeout(current.timer);current.timer=setTimeout(()=>finish({reason:'ended'}),current.duration*1000)},
  close(sender,error){if(current?.win.webContents!==sender)return;finish(error?{reason:'error',error:String(error).slice(0,600)}:{reason:'closed'})},
  cancel(sender){if(current?.source===sender)finish({reason:'closed'})},
  dispose(){finish({reason:'closed'})}
 };
}
module.exports={createEffectPlayer};
