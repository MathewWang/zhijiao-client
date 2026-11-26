export function messageStatus(kind,status,{incoming=false,sent=false}={}){
 const maps={direct:{queued:'等待投递',delivered:'已发送',failed:'发送失败'},draft:{generating:'正在制作',ready:'待你预览并发送',failed:'制作失败'},interaction:{pending:incoming?'待你同意':'等待好友同意',accepted:'正在准备',ready:incoming?'可以播放':'对方可以播放',playing:'正在播放',completed:'播放结束',failed:'播放失败',declined:'已拒绝',cancelled:'已撤回',expired:'已过期'},visit:{pending:incoming?'待你开门':'等待好友开门',active:'正在串门',completed:'串门结束',ended:'串门结束',declined:'已拒绝',cancelled:'已撤回',expired:'已过期'},update:{pending:incoming?'待你确认更新':'等待好友确认',accepted:'正在更新',completed:'更新完成',failed:'更新未完成',declined:'暂不同意',cancelled:'已撤回',expired:'已过期'}};
 const label=kind==='draft'&&sent?'已发送给好友':maps[kind]?.[status]||'处理中';const actionable=(kind==='draft'&&!sent&&['ready','failed'].includes(status))||(incoming&&['pending','ready','failed'].includes(status)&&kind!=='direct');
 return {label,tone:status==='failed'?'failed':actionable?'action':'normal',actionable};
}
