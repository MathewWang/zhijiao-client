export function isAgentMessage(message:any):boolean;
export function peerActivities(state:any):{id:string;peer:string;stamp:string;eligible:boolean}[];
export function peerUnread(state:any,seen?:Record<string,Record<string,string>>):Record<string,number>;
export function markPeerActivities(state:any,seen:Record<string,Record<string,string>>,peer:string):Record<string,Record<string,string>>;
