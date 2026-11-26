import test from 'node:test';
import assert from 'node:assert/strict';
import {DesktopCloud} from '../runtime/cloud.mjs';

for(const fails of [false,true])test(`cloud sync completing after shutdown (${fails?'failure':'success'}) does not touch closed databases`,async()=>{
 let finish,closed=false,notifications=0;
 const pending=new Promise((resolve,reject)=>{finish=()=>fails?reject(Error('network stopped')):resolve({});});
 const cloud=Object.assign(Object.create(DesktopCloud.prototype),{
  closed:false,polling:false,abort:new AbortController(),config:{localAgentId:'a'},state:{},
  getAgent:()=>({enabled:true,name:'Test',ownerName:'Owner',engine:'codex'}),profile:()=>({}),profileJSON:'{}',
  onChange:()=>{notifications++;assert.equal(closed,false);},
  rememberSocial:()=>{assert.equal(closed,false);return {};},
  unlock:()=>{},
  client:{api:(_path,body)=>body.online===false?Promise.resolve({}):pending,close:()=>{closed=true;}},
 });
 const polling=cloud.poll();
 await cloud.close();assert.equal(closed,true);
 finish();await polling;
 cloud.publish({connected:true});
 assert.equal(notifications,0);assert.equal(cloud.polling,false);
});
