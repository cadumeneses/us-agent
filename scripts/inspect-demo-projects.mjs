import { mkdir, writeFile } from 'node:fs/promises';
const origin='https://us-agent-api.vercel.app';
const headers={Authorization:`Bearer ${process.env.INGEST_API_KEY?.trim()}`,'X-Organization-Id':'default'};
async function get(path){const r=await fetch(origin+path,{headers,redirect:'error',signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error(`${path}: ${r.status}`);return r.json();}
const projects=await get('/api/projects');
const stories=await get('/api/stories?limit=10000');
const profiles=[];
for(const project of projects)profiles.push({project,profile:await get('/api/project-research-profile?project='+encodeURIComponent(project))});
await mkdir('tmp/demo-production-preparation',{recursive:true});
await writeFile('tmp/demo-production-preparation/projects.json',JSON.stringify({checkedAt:new Date().toISOString(),projects,stories,profiles},null,2));
console.log(JSON.stringify({projects:profiles.map(({project,profile})=>({project,profile,stories:stories.filter(s=>s.project===project).length,ready:stories.filter(s=>s.project===project&&['accepted_auto','reviewed','reclassified'].includes(s.status)).map(s=>({id:s.id,labels:s.labels}))}))},null,2));
