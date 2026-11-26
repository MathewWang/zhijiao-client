import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {MessengerClient} from '../client/core.mjs';import {encodeNewsMessage,discussionFor,DISCUSSION_TTL} from '../shared/news-messages.mjs';
test('opening friend chat preserves discussion unread; room reads are bounded, peer-scoped and durable',t=>{
 const dir=mkdtempSync(join(tmpdir(),'news-unread-')),config={relay:'http://127.0.0.1:9999',id:'me',agent:{}};let client=new MessengerClient({config,dbPath:join(dir,'db.sqlite'),dataDir:dir});t.after(()=>{client.close();rmSync(dir,{recursive:true,force:true})});
 const now=Date.now(),article={id:'a',title:'News',summary:'Summary',url:'https://openai.com/news/test',source:'OpenAI',publishedAt:now};
 const add=(id,text,peer='friend')=>client.db.prepare('INSERT INTO inbox(id,json,status) VALUES(?,?,?)').run(id,JSON.stringify({kind:'direct',sender:peer,text,created_at:now}),'done');
 const share=roomId=>encodeNewsMessage({type:'share',roomId,article,expiresAt:now+DISCUSSION_TTL}),comment=roomId=>encodeNewsMessage({type:'comment',roomId,article,expiresAt:now+DISCUSSION_TTL,text:'New reply'});
 add('share-a',share('a'));add('reply-a1',comment('a'));add('share-b',share('b'));add('reply-b',comment('b'));add('text','Ordinary message');add('reply-a2',comment('a'));add('other',comment('a'),'other');
 client.markDirectRead('friend','reply-a2');assert.deepEqual(client.directSnapshot().unread,{friend:3,other:1});
 client.markDirectRead('other','reply-a2','a');client.markDirectRead('friend','reply-a1','b');client.markDirectRead('friend','text','a');assert.equal(client.directSnapshot().unread.friend,3);
 client.markDirectRead('friend','reply-a1','a');assert.equal(client.directSnapshot().unread.friend,2);assert.equal(client.directSnapshot().messages.find(m=>m.id==='reply-a2').read,false);
 add('reply-a3',comment('a'));client.markDirectRead('friend','reply-a2','a');assert.equal(client.directSnapshot().messages.find(m=>m.id==='reply-a3').read,false);
 client.close();client=new MessengerClient({config,dbPath:join(dir,'db.sqlite'),dataDir:dir});assert.equal(client.directSnapshot().unread.friend,2);
 const room=discussionFor(client.directSnapshot().messages,'friend','b');assert.equal(room.messages[0].read,false);
 client.markDirectRead('friend','reply-b','b');assert.equal(client.directSnapshot().unread.friend,1);client.markDirectRead('friend','reply-a3','a');assert.equal(client.directSnapshot().unread.friend,undefined);assert.equal(client.directSnapshot().unread.other,1);
});
