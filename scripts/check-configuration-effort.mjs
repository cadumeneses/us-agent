import assert from 'node:assert/strict';
import { createHash,randomUUID } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const directory=resolve('tmp',`configuration-effort-check-${randomUUID()}`);await mkdir(directory,{recursive:true});
const first=resolve(directory,'first'),second=resolve(directory,'second');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
function cli(args,expected=0){const result=spawnSync(process.execPath,['--import','tsx','scripts/measure-configuration.ts',...args],
  {cwd:resolve('.'),encoding:'utf8',windowsHide:true,maxBuffer:1_000_000});if(result.error)throw result.error;
  assert.equal(result.status,expected,result.stderr||result.stdout);return expected?result.stderr:result.stdout;}
cli(['--output',first]);cli(['--output',second]);assert.equal(JSON.parse(cli(['--replay',first])).replayMatched,true);
for(const name of ['input.json','report.json','sessions.csv'])assert.ok((await readFile(resolve(first,name))).equals(await readFile(resolve(second,name))));
assert.match(cli(['--output',first],1),/EEXIST|exist/i);
const cleanManifest=await readFile(resolve(second,'manifest.json')),cleanReport=await readFile(resolve(second,'report.json'));
const changed=await json(resolve(second,'report.json'));changed.content.empiricalClaim=true;
const bytes=Buffer.from(JSON.stringify(changed));await writeFile(resolve(second,'report.json'),bytes);
assert.match(cli(['--replay',second],1),/Artifact bytes differ/);
const manifest=await json(resolve(second,'manifest.json'));manifest.artifacts['report.json']=sha(bytes);
await writeFile(resolve(second,'manifest.json'),JSON.stringify(manifest));assert.match(cli(['--replay',second],1),/Recomputed observations differ/);
await writeFile(resolve(second,'manifest.json'),cleanManifest);await writeFile(resolve(second,'report.json'),cleanReport);
const csvPath=resolve(second,'sessions.csv'),csv=await readFile(csvPath);csv[100]^=1;await writeFile(csvPath,csv);
assert.match(cli(['--replay',second],1),/Artifact bytes differ/);
const observations=await json(resolve(first,'input.json'));observations.protocol.sha256='0'.repeat(64);
const invalid=resolve(directory,'invalid.json');await writeFile(invalid,JSON.stringify(observations));
assert.match(cli(['--input',invalid,'--output',resolve(directory,'invalid-output')],1),/Protocol bytes/);
const duplicate=resolve(directory,'duplicate.json');await writeFile(duplicate,'{"id":"a","id":"b"}');
assert.match(cli(['--input',duplicate],1),/duplicada/i);
assert.match(cli(['--replay',first,'--input',invalid],1),/Replay/);
console.log(JSON.stringify({passed:true,checks:['exact_replay','repeatability','no_overwrite','report_corruption','updated_checksum_cannot_create_empirical_claim',
 'csv_corruption','protocol_mismatch','duplicate_JSON_keys','invalid_argument_combination'],directory}));
