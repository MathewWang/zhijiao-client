export type NewsArticle={id:string;title:string;url:string;summary:string;source:string;publishedAt:number};
export const DISCUSSION_TTL:number;
export function normalizeArticle(value:unknown):NewsArticle;
export function encodeNewsMessage(value:unknown):string;
export function parseNewsMessage(text:string):null|{version:1;type:'share'|'comment';roomId:string;article:NewsArticle;expiresAt:number;text?:string};
export function discussionFor(messages:any[],peer:string,roomId:string,now?:number):null|{roomId:string;article:NewsArticle;expiresAt:number;expired:boolean;messages:{id:string;text:string;incoming:boolean;createdAt:number;status:string}[]};
