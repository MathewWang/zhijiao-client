type Task={kind?:string;default?:boolean;topic?:string;language?:string};
export function usesWearitNews(task?:Task):boolean;
export function taskUsesModel(task?:Task):boolean;
