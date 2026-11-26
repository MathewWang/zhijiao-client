// Keep provider failures actionable without putting credentials into the UI or copied reports.
export function safeErrorDetail(value){return String(value||'操作未完成').replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'').replace(/\b(?:sk-|wio_)[a-zA-Z0-9_*.-]+/g,'[已隐藏密钥]').replace(/(Bearer\s+)\S+/gi,'$1[已隐藏]').replace(/((?:api[_-]?key|token|password)\s*[=:]\s*)[^\s,;]+/gi,'$1[已隐藏]').slice(0,2000)}
export function diagnoseError(value,engine='本地 CLI'){
 const raw=String(value||''),detail=safeErrorDetail(raw);let title='操作未完成',action='请重试；若仍失败，可展开详情并将错误信息提供给维护者。',kind='unknown';
 if(/model_not_found|model_not_in_accessible_catalog|model.*not supported|模型.*不可用/i.test(raw)){kind='model';title='当前账号无法使用这个模型';action=`请先在 ${engine} 中选择账号可用的模型，确认能正常对话，再回来重试。知交信使沿用 CLI 配置。`}
 else if(/401|invalid_api_key|unauthori[sz]ed|not logged|登录.*失效/i.test(raw)){kind='auth';title='模型登录或 API 配置需要检查';action=`请先在 ${engine} 中重新登录或检查密钥。使用公司或第三方代理时，还需确认供应商地址与密钥配套。确认 CLI 能对话后再重试。`}
 else if(/ENOENT|command not found|未检测到|找不到.*CLI/i.test(raw)){kind='missing';title='未找到本地 CLI';action=`请安装并登录 ${engine}，在终端确认可以运行，再重新打开知交信使。`}
 else if(/429|rate.limit|quota|额度|余额/i.test(raw)){kind='quota';title='模型额度不足或请求过于频繁';action='请检查模型账号额度，或稍后再试；不会自动重复调用模型。'}
 else if(/timeout|timed out|ETIMEDOUT|ECONN|ENOTFOUND|fetch failed|网络|连接.*失败/i.test(raw)){kind='network';title='暂时无法连接服务';action='请检查网络和现有代理设置，确认 CLI 或云端连接恢复后再试。'}
 else if(/本地代码改动|分支|main 分支|仓库来源/i.test(raw)){kind='checkout';title='需要先处理本地代码';action='请让本机开发工具检查并保存定制代码，再更新。客户端不会覆盖、暂存或清除你的改动。'}
 else if(/版本不一致|不是当前官方|固定提交|邀请版本/i.test(raw)){kind='release';title='升级邀请与官方版本尚未一致';action='请先在设置中检查更新，再重新打开邀请确认版本；不要重复点击安装。'}
 return {kind,title,action,detail};
}
