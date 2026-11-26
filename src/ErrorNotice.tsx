import React from 'react';
import {diagnoseError} from '../shared/diagnostics.mjs';
import './feedback.css';
export function ErrorNotice({error,engine,onSettings}:{error:string;engine?:string;onSettings?:()=>void}){
 const info=diagnoseError(error,engine);return <div className="error-notice" role="alert"><strong>{info.kind==='unknown'&&info.detail.length<=160?info.detail:info.title}</strong><p>{info.action}</p>{onSettings&&['model','auth','missing','network'].includes(info.kind)&&<button onClick={onSettings}>检查连接设置</button>}<details><summary>错误详情</summary><pre>{info.detail}</pre></details></div>;
}
