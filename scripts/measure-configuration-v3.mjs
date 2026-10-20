import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {analyzeConfigurationEffortV3,configurationEffortV3Schema} from '../apps/api/dist/evaluation/configuration-effort-v3.js';
import {snapshotContent} from '../apps/api/dist/domain/content-snapshot.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),serialize=value=>JSON.stringify(value,null,2)+'\n';
const options={},taskDirs=[];const args=process.argv.slice(2);
for(let i=0;i<args.length;i+=2){const[key,value]=args.slice(i,i+2);assert.ok(value&&!value.startsWith('--'));if(key==='--tasks')taskDirs.push(resolve(value));else{assert.ok(['--input','--output','--artifacts','--replay'].includes(key)&&!options[key]);options[key]=value;}}
const replay=options['--replay']?resolve(options['--replay']):null;
assert.ok(replay?!options['--input']&&!options['--output']&&!options['--artifacts']&&!taskDirs.length:options['--input']&&options['--output']);
function safe(path){assert.ok(typeof path==='string'&&/^[a-zA-Z0-9_./-]+$/.test(path)&&!path.startsWith('/')&&!path.split('/').some(part=>part==='..'||!part));return path;}
const inputBytes=await readFile(replay?resolve(replay,'input.json'):resolve(options['--input']));assert.ok(inputBytes.length<=5000000);
const input=configurationEffortV3Schema.parse(JSON.parse(inputBytes.toString('utf8')));
const protocol=await readFile('research/configuration-effort-v3/protocol.md');assert.equal(input.protocolSha256,sha(protocol));
const report=analyzeConfigurationEffortV3(input),files={'input.json':inputBytes,'protocol.md':protocol};
if(replay)for(const session of input.sessions)taskDirs.push(resolve(replay,'tasks',session.materials.namespace));
const batches=new Map();
for(const directory of taskDirs){const bytes=await readFile(resolve(directory,'manifest.json')),manifest=JSON.parse(bytes.toString('utf8'));
  assert.equal(manifest.schemaVersion,3);assert.match(manifest.namespace,/^[a-z][a-z0-9_-]{0,23}$/);assert.ok(!batches.has(manifest.namespace));
  assert.equal(manifest.protocolSha256,input.protocolSha256);batches.set(manifest.namespace,sha(bytes));files[`tasks/${manifest.namespace}/manifest.json`]=bytes;
  for(const[path,hash]of Object.entries(manifest.artifacts)){const data=await readFile(resolve(directory,safe(path)));assert.equal(sha(data),hash);files[`tasks/${manifest.namespace}/${path}`]=data;}
}
const artifactRoot=replay?resolve(replay,'observed-artifacts'):options['--artifacts']?resolve(options['--artifacts']):null;
for(const session of input.sessions){assert.equal(batches.get(session.materials.namespace),session.materials.sha256,'Task material hash differs.');
  const checks=session.events.filter(event=>event.type==='checkpoint');
  for(const checkpoint of checks){assert.ok(artifactRoot,'Observed checkpoints require --artifacts directory.');const path=safe(checkpoint.artifact.file),bytes=await readFile(resolve(artifactRoot,path));
    assert.ok(bytes.length<=10000000);assert.equal(sha(bytes),checkpoint.artifact.sha256,'Evidence bytes differ.');
    const evidence=JSON.parse(bytes.toString('utf8'));
    if(checkpoint.criterion==='replay'){
      const run=checks.find(event=>event.criterion==='run');assert.ok(run&&evidence.verified===true&&evidence.originalSha256===run.reference.sha256);
      assert.ok(evidence.resultMatches===true&&evidence.explanationMatches===true&&evidence.projectionMatches===true);
      assert.equal(snapshotContent(evidence).sha256,checkpoint.reference.sha256);
    }else{
      const envelope=evidence.snapshot??evidence;assert.equal(envelope.format,'us-agent-json-v1');
      assert.equal(snapshotContent(envelope.content).sha256,envelope.sha256);assert.equal(envelope.sha256,checkpoint.reference.sha256);
      const identity=evidence.id??envelope.content.id??envelope.content.definition?.id??envelope.content.catalog?.content?.id;assert.equal(identity,checkpoint.reference.id);
      if(checkpoint.criterion==='run'||checkpoint.criterion==='export')assert.equal(evidence.snapshot.content.result.content.method,session.method);
    }
    files[`observed-artifacts/${path}`]=bytes;
  }
  const byCriterion=new Map(checks.map(checkpoint=>[checkpoint.criterion,checkpoint]));
  const runCheck=byCriterion.get('run');
  if(runCheck){
    const run=JSON.parse(files[`observed-artifacts/${safe(runCheck.artifact.file)}`].toString('utf8'));
    const request=run.snapshot.content.request.content;
    for(const key of ['definition','dataset','catalog']){
      const selected=byCriterion.get(key);
      if(selected)assert.ok(request[key]?.id===selected.reference.id&&request[key]?.sha256===selected.reference.sha256,'Run uses a different publication than the observed checkpoint.');
    }
    const taxonomy=byCriterion.get('taxonomy');
    if(taxonomy)assert.ok(run.snapshot.content.definition.content.taxonomies.some(dependency=>dependency.snapshot.content.id===taxonomy.reference.id&&dependency.snapshot.sha256===taxonomy.reference.sha256),'Run taxonomy differs.');
    const exported=byCriterion.get('export');
    if(exported)assert.deepEqual(exported.reference,runCheck.reference,'Export must preserve the observed run.');
  }
}
assert.equal(batches.size,new Set(input.sessions.map(session=>session.materials.namespace)).size,'Unused task material.');
files['report.json']=Buffer.from(serialize(report));
files['sessions.csv']=Buffer.from('session_id,participant_code,method,outcome,elapsed_ms,active_ms,errors,help\n'+report.content.results.map(row=>[row.sessionId,row.participantCode,row.method,row.outcome,row.elapsedMs,row.activeMs,row.errors,row.help].join(',')).join('\n')+'\n');
files['summary.md']=Buffer.from(`# Three-method configuration effort\n\nKind: ${input.kind}. Sessions: ${report.content.results.length}. Human authenticity and methodological approval are not certified by this tool.\n\n${report.content.results.length?'Read denominators and provenance in report.json.':'No participant observations. Times, completion and empirical quality are not measured.'}\n`);
const manifest={schemaVersion:3,protocolSha256:input.protocolSha256,artifacts:Object.fromEntries(Object.entries(files).map(([path,data])=>[path,sha(data)])),
  sources:Object.fromEntries(await Promise.all(['scripts/measure-configuration-v3.mjs','apps/api/src/evaluation/configuration-effort-v3.ts','apps/api/src/domain/content-snapshot.ts'].map(async path=>[path,sha(await readFile(path))])))};
if(replay){assert.deepEqual(JSON.parse(await readFile(resolve(replay,'manifest.json'),'utf8')),manifest);for(const[path,data]of Object.entries(files))assert.equal(sha(await readFile(resolve(replay,path))),sha(data));console.log(JSON.stringify({replayVerified:true,sessions:input.sessions.length}));}
else{const output=resolve(options['--output']);await mkdir(dirname(output),{recursive:true});await mkdir(output);for(const[path,data]of Object.entries({...files,'manifest.json':Buffer.from(serialize(manifest))})){await mkdir(dirname(resolve(output,path)),{recursive:true});await writeFile(resolve(output,path),data,{flag:'wx'});}console.log(JSON.stringify({output,sessions:input.sessions.length,empiricalClaim:false},null,2));}
