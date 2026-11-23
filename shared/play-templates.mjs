import {randomUUID} from 'node:crypto';
export function initPlayTemplates(db){db.exec('CREATE TABLE IF NOT EXISTS play_templates(owner TEXT NOT NULL,id TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(owner,id))')}
export function normalizePlayTemplate(value){
 const read=(key,max,required=true)=>{const s=value?.[key];if(typeof s!=='string'||s.length>max||(required&&!s.trim()))throw Error('请检查玩法名称、图标和描述');return s.trim()};
 return {title:read('title',40),icon:read('icon',8,false)||'✨',brief:read('brief',2000),message:read('message',500)};
}
export function listPlayTemplates(db,owner){return db.prepare('SELECT json FROM play_templates WHERE owner=? ORDER BY rowid').all(owner).map(r=>JSON.parse(r.json))}
export function savePlayTemplate(db,owner,body){
 const value=normalizePlayTemplate(body);let id=body.id;
 if(id){if(typeof id!=='string'||!db.prepare('SELECT 1 FROM play_templates WHERE owner=? AND id=?').get(owner,id))throw Error('玩法不存在或不属于你')}
 else {if(listPlayTemplates(db,owner).length>=30)throw Error('最多保存 30 个玩法，请先移除不用的玩法');id=randomUUID()}
 const item={id,...value};db.prepare('INSERT OR REPLACE INTO play_templates VALUES(?,?,?)').run(owner,id,JSON.stringify(item));return item;
}
export function deletePlayTemplate(db,owner,id){if(typeof id!=='string'||!db.prepare('DELETE FROM play_templates WHERE owner=? AND id=?').run(owner,id).changes)throw Error('玩法不存在或不属于你');return {ok:true}}
