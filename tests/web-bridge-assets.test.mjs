import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('lightweight web connector uses desktop CLI adapter contract and no Electron or npm runtime dependencies',()=>{
 assert.equal(readFileSync(new URL('../bridge/adapters.mjs',import.meta.url),'utf8'),readFileSync(new URL('../runtime/adapters.mjs',import.meta.url),'utf8'));
 const source=readFileSync(new URL('../bridge/bridge.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/from ['"](?:electron|react|express)['"]/);assert.match(source,/detached:true/);assert.match(source,/status='running'/);
});
