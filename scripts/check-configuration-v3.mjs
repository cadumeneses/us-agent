import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {analyzeConfigurationEffortV3,effortMethods} from '../apps/api/dist/evaluation/configuration-effort-v3.js';
import {snapshotContent} from '../apps/api/dist/domain/content-snapshot.js';
import {executeConfigurableRecommendation} from '../apps/api/dist/services/configurable-knn.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),serialize=value=>JSON.stringify(value,null,2)+'\n';
const empty=JSON.parse(await readFile('research/configuration-effort-v3/observations.empty.json','utf8'));
const blank=analyzeConfigurationEffortV3(empty);assert.equal(blank.content.results.length,0);
assert.ok(blank.content.summary.every(row=>row.medianActiveMsCompleted===null&&row.completionRatioStarted===null));
const incomplete={...structuredClone(empty),kind:'synthetic_rehearsal',sessions:[],plannedAttempts:[]};
for(const[order,method]of effortMethods.entries()){
  const attempt={participantCode:'synthetic',method,attempt:1,order:order+1};
  incomplete.plannedAttempts.push({...attempt,status:'recorded',reason:'Authored software verification only.'});
  incomplete.sessions.push({...attempt,id:'synthetic-'+order,materials:{namespace:'synthetic-'+order,sha256:'0'.repeat(64)},
    environment:{softwareRevision:'0'.repeat(40),softwareSnapshotSha256:'0'.repeat(64),interfaceLanguage:'en',experience:'not_recorded',organizationId:'synthetic'},
    capture:'authored_fixture',events:[{type:'start',atMs:0},{type:'finish',atMs:100,outcome:'incomplete'}]});
}
assert.equal(analyzeConfigurationEffortV3(incomplete).content.results.length,3);
const invalid=structuredClone(incomplete);invalid.sessions[0].events[1].outcome='completed';assert.throws(()=>analyzeConfigurationEffortV3(invalid),/checkpoint/);
const observed=structuredClone(incomplete);observed.kind='observed_sessions';assert.throws(()=>analyzeConfigurationEffortV3(observed),/review/);
const namespace='check'+randomUUID().replaceAll('-','').slice(0,12),root=resolve('tmp','configuration-v3-'+namespace);
await mkdir(root,{recursive:true});
function run(script,args,success=true){const result=spawnSync(process.execPath,[script,...args],{encoding:'utf8',windowsHide:true});assert.equal(result.status===0,success,result.stderr||result.stdout);return result;}
run('scripts/prepare-configuration-v3.mjs',['--namespace',namespace,'--output',resolve(root,'tasks')]);
run('scripts/prepare-configuration-v3.mjs',['--replay',resolve(root,'tasks')]);
const materialBytes=await readFile(resolve(root,'tasks','manifest.json'));
const runEvidence=JSON.parse(await readFile('docs/evidencias/project-risks-2026-10-19/run-1-baseline.json','utf8'));
const content=runEvidence.snapshot.content,repeated=executeConfigurableRecommendation(content.request.content,content.definition.content,content.dataset.content);
const replay={id:runEvidence.id,originalSha256:runEvidence.snapshot.sha256,resultMatches:repeated.result.sha256===content.result.sha256,
  explanationMatches:repeated.explanation.sha256===content.explanation.sha256,projectionMatches:repeated.projection.sha256===content.projection.sha256};
replay.verified=replay.resultMatches&&replay.explanationMatches&&replay.projectionMatches;
const artifacts={definition:{state:'published',definition:content.definition.content.definition,snapshot:content.definition},
  dataset:{state:'published',snapshot:content.dataset},run:runEvidence,replay,export:runEvidence};
await mkdir(resolve(root,'artifacts'));
const session={...incomplete.sessions[2],id:'synthetic-risk-check',materials:{namespace,sha256:sha(materialBytes)},events:[{type:'start',atMs:0}]};
for(const[index,[criterion,evidence]]of Object.entries(artifacts).entries()){
  const bytes=serialize(evidence),file=criterion+'.json';await writeFile(resolve(root,'artifacts',file),bytes);
  const snapshot=criterion==='replay'?snapshotContent(evidence):evidence.snapshot;
  session.events.push({type:'checkpoint',atMs:(index+1)*100,criterion,reference:{id:criterion==='definition'?content.request.content.definition.id:criterion==='dataset'?content.request.content.dataset.id:runEvidence.id,sha256:snapshot.sha256},artifact:{file,sha256:sha(bytes)}});
}
session.events.push({type:'finish',atMs:700,outcome:'completed'});
const input={...structuredClone(empty),kind:'synthetic_rehearsal',plannedAttempts:[{participantCode:session.participantCode,method:session.method,attempt:session.attempt,order:session.order,status:'recorded',reason:'Authored software check, not human observations.'}],sessions:[session]};
await writeFile(resolve(root,'input.json'),serialize(input));
run('scripts/measure-configuration-v3.mjs',['--input',resolve(root,'input.json'),'--tasks',resolve(root,'tasks'),'--artifacts',resolve(root,'artifacts'),'--output',resolve(root,'report')]);
run('scripts/measure-configuration-v3.mjs',['--replay',resolve(root,'report')]);
await writeFile(resolve(root,'artifacts','run.json'),'{}');
run('scripts/measure-configuration-v3.mjs',['--input',resolve(root,'input.json'),'--tasks',resolve(root,'tasks'),'--artifacts',resolve(root,'artifacts'),'--output',resolve(root,'tampered')],false);
console.log(JSON.stringify({passed:true,threeMethodsAccepted:true,emptyObservationsNotInvented:true,missingCheckpointsRejected:true,
  unreviewedCollectionRejected:true,taskReplayVerified:true,artifactReplayVerified:true,tamperingRejected:true,participantStudyPerformed:false,output:root},null,2));
