export function recordStamp(item:{status:string;reply?:string;detail?:string;attempt?:number}):string;
export function groupRecords<T extends {id:string;stamp:string;attention?:boolean;eligible?:boolean;time?:number}>(items:T[],seen:Record<string,string>,filter?:string):{id:string;title:string;items:(T&{unread:boolean})[]}[];
