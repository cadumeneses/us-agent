// Read-only inventory: locate existing publications for the complete application guide.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const origin='https://us-agent-api.vercel.app';
assert.ok(process.env.INGEST_API_KEY?.trim().length>=32);
const result={};
for(const [key,path] of [['definitions','recommender-definitions?state=published&limit=100'],['datasets','recommender-datasets?state=published&limit=100'],['catalogs','test-case-catalogs?limit=100'],['taxonomies','recommender-taxonomies?limit=100']]){
 const r=await fetch(origin+'/api/internal/'+path,{headers:{Authorization:'Bearer '+process.env.INGEST_API_KEY.trim(),'X-Organization-Id':'default'},signal:AbortSignal.timeout(45000)});
 assert.equal(r.status,200);result[key]=await r.json();
}
await mkdir('tmp/icse2027-reviewer',{recursive:true});
await writeFile('tmp/icse2027-reviewer/application-inventory.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
