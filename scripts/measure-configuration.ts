import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseImportJson } from '../apps/api/src/domain/import-formats.js';
import { analyzeConfigurationEffort, configurationEffortCsv, configurationEffortSchema } from '../apps/api/src/evaluation/configuration-effort.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const base='research/configuration-effort-v1';
const sha=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const read=(path:string)=>readFile(resolve(root,path));
const parse=(bytes:Uint8Array)=>parseImportJson(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes).replace(/^\uFEFF/,''));
const json=async(path:string)=>parse(await read(path)) as any;
const names=['input.json','report.json','sessions.csv'] as const;

async function main(){
  const args=process.argv.slice(2);
  let inputPath:string|undefined, outputPath:string|undefined, replayPath:string|undefined;
  for(let i=0;i<args.length;i+=2){
    if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Uso: measure:configuration [--input arquivo.json] [--output diretório-novo] | --replay diretório');
    if(args[i]==='--input'&&!inputPath)inputPath=args[i+1];
    else if(args[i]==='--output'&&!outputPath)outputPath=args[i+1];
    else if(args[i]==='--replay'&&!replayPath)replayPath=args[i+1];
    else throw Error('Argumento desconhecido ou repetido.');
  }
  if(replayPath&&(inputPath||outputPath))throw Error('Replay não aceita input/output.');
  const protocolBytes=await read(`${base}/protocol.md`), materialBytes=await read(`${base}/materials.json`), materials=parse(materialBytes) as any;
  assert.equal(materials.id,'configuration-materials');assert.equal(materials.version,'1');
  const paths=[...new Set(['apps/api/src/evaluation/configuration-effort.ts','apps/api/src/domain/content-snapshot.ts',
    'apps/api/src/domain/import-formats.ts','scripts/measure-configuration.ts','scripts/check-configuration-effort.mjs',
    `${base}/protocol.md`,`${base}/materials.json`,`${base}/rehearsal.json`,...materials.files.map((file:any)=>file.path)])].sort() as string[];
  const sources:Record<string,string>={};
  for(const path of paths){
    assert.ok(!path.startsWith('/')&&!path.includes('\\')&&!path.includes(':')&&!path.split('/').includes('..'),'Invalid source path.');
    sources[path]=sha(await read(path));
  }
  for(const file of materials.files)assert.equal(sources[file.path],file.sha256,'Material bytes differ.');
  const directory=replayPath?resolve(replayPath):null;
  const inputBytes=directory?await readFile(resolve(directory,'input.json')):inputPath?await readFile(resolve(inputPath)):await read(`${base}/rehearsal.json`);
  if(inputBytes.length>5_000_000)throw Error('Observações excedem 5 MB.');
  const input=configurationEffortSchema.parse(parse(inputBytes));
  assert.equal(input.protocol.sha256,sha(protocolBytes),'Protocol bytes do not match observations.');
  assert.deepEqual(input.materials,{id:materials.id,version:materials.version,sha256:sha(materialBytes)},'Material reference differs.');
  const report=analyzeConfigurationEffort(input);
  const artifacts:Record<typeof names[number],Buffer>={'input.json':inputBytes,'report.json':Buffer.from(JSON.stringify(report,null,2)+'\n'),
    'sessions.csv':Buffer.from(configurationEffortCsv(report))};
  if(directory){
    const manifest=await json(resolve(directory,'manifest.json'));
    assert.equal(manifest.schemaVersion,1);assert.equal(manifest.kind,'configuration_effort_instrument');
    assert.equal(manifest.inputKind,input.kind);assert.equal(manifest.empiricalClaim,false);
    assert.deepEqual(manifest.sources,sources,'Source bytes differ.');
    assert.deepEqual(Object.keys(manifest.artifacts).sort(),[...names].sort());
    for(const name of names){const bytes=await readFile(resolve(directory,name));
      assert.equal(sha(bytes),manifest.artifacts[name],'Artifact bytes differ.');assert.ok(bytes.equals(artifacts[name]),'Recomputed observations differ.');}
    assert.equal(manifest.reportSha256,report.sha256);
    console.log(JSON.stringify({replayMatched:true,inputKind:input.kind,reportSha256:report.sha256,empiricalClaim:false}));return;
  }
  const output=resolve(outputPath??resolve(root,'tmp',`configuration-effort-${Date.now()}`));
  await mkdir(dirname(output),{recursive:true});await mkdir(output);
  for(const name of names)await writeFile(resolve(output,name),artifacts[name],{flag:'wx'});
  const manifest={schemaVersion:1,kind:'configuration_effort_instrument',recordedAt:new Date().toISOString(),inputKind:input.kind,empiricalClaim:false,
    sources,artifacts:Object.fromEntries(names.map(name=>[name,sha(artifacts[name])])),reportSha256:report.sha256,
    limitations:['declared_observations_not_automatic_telemetry','artifact_and_software_references_not_independently_verified',
      'no_participant_study_or_recommendation_quality_claim','only_declared_attempts_are_in_the_denominators','third_example_not_included']};
  await writeFile(resolve(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({output,inputKind:input.kind,sessions:report.content.summary.sessions,reportSha256:report.sha256,empiricalClaim:false}));
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
