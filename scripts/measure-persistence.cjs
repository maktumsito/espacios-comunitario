const {spawnSync}=require('node:child_process');
const {mkdirSync,writeFileSync}=require('node:fs');
const {resolve}=require('node:path');
const phase=process.argv[2]||'after';
if(!['before','after'].includes(phase))throw new Error('Expected before or after');
if(phase==='before') {
  const root=resolve('work/baseline-source');mkdirSync(root,{recursive:true});
  for(const [command,args] of [['git',['archive','--format=tar','--output=work/baseline-source.tar','e4bcbeefd6d4f3da4973ec29469de8a029bfb806']],['tar',['-xf','work/baseline-source.tar','-C',root]]]) {
    const result=spawnSync(command,args,{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
  }
  writeFileSync(resolve(root,'src/firebase/config.ts'),`import {initializeApp} from 'firebase/app';
import {getFirestore,connectFirestoreEmulator} from 'firebase/firestore';
const app=initializeApp({projectId:'demo-espacios',apiKey:'local-only'},'baseline-measurement');
const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8087);
export const getDb=()=>db;
export const getFirebaseApp=()=>app;
export const getFirebaseAuth=():any=>undefined;
export const auth:any=undefined;
export const testFirestoreConnection=async()=>true;
`);
}
const result=spawnSync(process.execPath,[resolve('node_modules/vitest/vitest.mjs'),'run','--config','vitest.measure.config.ts'],{stdio:'inherit',env:{...process.env,FIRESTORE_EMULATOR_HOST:'127.0.0.1:8087',BENCH_PHASE:phase}});
process.exitCode=result.status??1;
