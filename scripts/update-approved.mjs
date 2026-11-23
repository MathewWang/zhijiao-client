import {runUpdateFile} from '../runtime/client-updater.mjs';
const [file,pid]=process.argv.slice(2);if(!file||!/^\d+$/.test(pid))throw Error('需要本机主人确认的升级任务');await runUpdateFile(file,Number(pid));
