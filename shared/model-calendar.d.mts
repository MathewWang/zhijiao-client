export type CalendarItem={id:string;provider:string;model:string;status:'released'|'announced'|'predicted';confidence:'low'|'medium'|'high';windowStart:string|null;windowEnd:string|null;summary:string;rationale:string;sources:{title:string;url:string;date:string|null;official:boolean}[]};
export type CalendarData={items:CalendarItem[];stale:boolean;updatedAt:string|null;nextCursor:string|null;historyStart:string|null};
export function normalizeCalendar(value:unknown):CalendarData;
export function calendarTimeline(items:CalendarItem[],today:string):{key:string;phase:'pending'|'released';day:string|null;today:boolean;items:CalendarItem[]}[];
export function nearestCalendarItem(items:CalendarItem[],today:string):string|null;
