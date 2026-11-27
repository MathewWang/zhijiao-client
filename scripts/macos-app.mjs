import {cpSync,copyFileSync,existsSync,mkdirSync,readFileSync,writeFileSync,renameSync,rmSync,constants} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const APP_NAME='信使';
export function prepareMacApp(root){
 if(process.platform!=='darwin')return createRequire(import.meta.url)('electron');
 const original=createRequire(join(root,'package.json'))('electron'),source=resolve(original,'../../..');
 const cache=join(root,'.data','desktop-app'),bundle=join(cache,APP_NAME+'.app'),icon=join(root,'assets/app-icon.png');
 const stamp=createHash('sha256').update(readFileSync(icon)).update(readFileSync(join(source,'Contents/Info.plist'))).update(APP_NAME+'-v1').digest('hex');
 const marker=join(cache,'identity.sha256'),binary=join(bundle,'Contents/MacOS/Electron');
 if(existsSync(binary)&&existsSync(marker)&&readFileSync(marker,'utf8')===stamp)return binary;
 function run(command,args){const r=spawnSync(command,args,{encoding:'utf8'});if(r.error||r.status!==0)throw Error('准备信使应用失败：'+command+' '+(r.error?.message||r.stderr||''));return r.stdout}
 mkdirSync(cache,{recursive:true});
 const stage=join(cache,'staging-'+process.pid),tempBundle=join(stage,APP_NAME+'.app');mkdirSync(stage,{recursive:true});
 try{
  // Copy the vendor runtime; npm's original bundle stays untouched.
  cpSync(source,tempBundle,{recursive:true,verbatimSymlinks:true,mode:constants.COPYFILE_FICLONE});
  const plist=join(tempBundle,'Contents/Info.plist');
  for(const [key,value] of Object.entries({CFBundleDisplayName:APP_NAME,CFBundleName:APP_NAME,CFBundleIdentifier:'cn.agentmen.messenger',CFBundleIconFile:'messenger.icns'}))run('/usr/libexec/PlistBuddy',['-c',`Set :${key} ${value}`,plist]);
  const iconset=join(stage,'messenger.iconset');mkdirSync(iconset);
  for(const size of [16,32,128,256,512])for(const scale of [1,2])run('/usr/bin/sips',['-z',String(size*scale),String(size*scale),icon,'--out',join(iconset,`icon_${size}x${size}${scale===2?'@2x':''}.png`)]);
  run('/usr/bin/iconutil',['-c','icns',iconset,'-o',join(tempBundle,'Contents/Resources/messenger.icns')]);
  // Re-sign this local copy after changing bundle metadata. No new entitlements.
  run('/usr/bin/codesign',['--force','--deep','--sign','-',tempBundle]);
  if(existsSync(bundle))rmSync(bundle,{recursive:true});renameSync(tempBundle,bundle);writeFileSync(marker,stamp);
  return binary;
 }finally{rmSync(stage,{recursive:true,force:true})}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(prepareMacApp(resolve(dirname(fileURLToPath(import.meta.url)),'..')));
