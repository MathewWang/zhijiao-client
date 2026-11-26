import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseError,safeErrorDetail} from '../shared/diagnostics.mjs';
import {messageStatus} from '../shared/message-status.mjs';
test('provider failures distinguish unavailable models, proxy credentials, install, network and quota',()=>{
 for(const [error,kind] of [['model_not_found: not supported with a ChatGPT account','model'],['401 invalid_api_key','auth'],['spawn codex ENOENT','missing'],['fetch failed ECONNREFUSED','network'],['429 quota exceeded','quota'],['存在本地代码改动','checkout'],['官方仓库与邀请版本不一致','release']])assert.equal(diagnoseError(error,'Codex').kind,kind);
 const info=diagnoseError('model_not_in_accessible_catalog','Codex');assert.match(info.action,/账号可用/);assert.doesNotMatch(info.action,/gpt-/);
});
test('displayed diagnostics redact credentials before offering details',()=>{
 const output=safeErrorDetail('Error invoking remote method \'x\': Error: 401 sk-secret123 wio_secret456 Authorization: Bearer secret789 token=secret000');
 for(const secret of ['sk-secret123','wio_secret456','secret789','secret000'])assert.ok(!output.includes(secret));assert.ok(output.length<=2000);
});
test('statuses preserve sent versus recipient consent and never imply viewing from delivery',()=>{
 assert.equal(messageStatus('direct','queued').label,'等待投递');assert.equal(messageStatus('direct','delivered').label,'已发送');assert.equal(messageStatus('interaction','pending',{incoming:true}).actionable,true);assert.equal(messageStatus('interaction','pending').actionable,false);assert.equal(messageStatus('draft','ready').actionable,true);assert.equal(messageStatus('draft','ready',{sent:true}).actionable,false);assert.equal(messageStatus('interaction','completed').label,'播放结束');assert.equal(messageStatus('update','failed').tone,'failed');
});
