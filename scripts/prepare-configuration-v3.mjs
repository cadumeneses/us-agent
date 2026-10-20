import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {buildConfigurationTaskPack} from '../apps/api/dist/evaluation/configuration-task-materials.js';
import {parseRecommenderDefinition} from '../apps/api/dist/domain/recommender-definition.js';
import {validateConfigurableDefinition,executeConfigurableRecommendation} from '../apps/api/dist/services/configurable-knn.js';
import {snapshotContent} from '../apps/api/dist/domain/content-snapshot.js';
const base='research/configuration-effort-v3',sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async path=>JSON.parse(await readFile(path,'utf8')),serialize=value=>JSON.stringify(value,null,2)+'\n';
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){assert.ok(['--namespace','--output','--replay'].includes(args[i])&&args[i+1]&&!options[args[i]]);options[args[i]]=args[i+1];}
const replay=options['--replay']?resolve(options['--replay']):null;
assert.ok(replay?!options['--namespace']&&!options['--output']:options['--namespace']&&options['--output']);
const previous=replay?await json(resolve(replay,'manifest.json')):null;
const namespace=options['--namespace']??previous.namespace;assert.match(namespace,/^[a-z][a-z0-9_-]{0,23}$/);
const seeds=['config/recommenders/rnf-v2.draft.json','config/recommenders/testrec-equations.draft.json','research/baselines/rnf-v2/reference.json','research/examples/testrec-e21/equations-synthetic.json','research/examples/testrec-e21/synthetic-catalog.json'];
const [rnfDefinition,testDefinition,baseline,equations,catalog]=await Promise.all(seeds.map(json));
const pack=buildConfigurationTaskPack(namespace,{rnfDefinition,testDefinition,baseline,equations,catalog});
const files={...pack.files};
const riskDefinition=parseRecommenderDefinition({...await json('config/recommenders/project-risks.draft.json'),id:`${namespace}-risks`});
validateConfigurableDefinition(riskDefinition,[]);
const stored=await json('docs/evidencias/project-risks-2026-10-19/run-1-baseline.json'),content=stored.snapshot.content;
assert.equal(snapshotContent(content).sha256,stored.snapshot.sha256);
const repeated=executeConfigurableRecommendation(content.request.content,content.definition.content,content.dataset.content);
assert.deepEqual(repeated.result,content.result);
files['participant/risks/dataset.json']=await readFile('config/recommenders/examples/project-risks.synthetic.json','utf8');
files['participant/risks/target.json']=serialize({id:`${namespace}-target`,values:{platforms:['Web'],domains:['Finance'],languages:['TypeScript'],risks:[]},provenance:{source:'Synthetic guided configuration task'}});
files['participant/risks/settings.json']=serialize({definitionId:riskDefinition.id,version:'1',datasetId:`${namespace}-risks-base`,definition:riskDefinition,source:{description:'Synthetic project profiles and risk associations',authorization:{basis:'synthetic',reference:'US-Agent authored demonstration'}}});
const answer=JSON.parse(files['facilitator/answer-key.json']);
answer.version='configuration-task-pack-v3';answer.limits=answer.limits.filter(value=>value!=='third_no_US_example_not_available');
answer.risks={definition:riskDefinition,expectedValidRows:3,result:content.result.content,scope:'offline_technical_oracle_not_human_observation'};
files['facilitator/answer-key.json']=serialize(answer);
for(const task of ['rnf','tests','risks'])files[`participant/${task}.md`]=(await readFile(`${base}/participant-${task}.md`,'utf8')).replaceAll('{{NAMESPACE}}',namespace);
files['facilitator/guide.md']=await readFile(`${base}/facilitator.md`,'utf8');
files['facilitator/checkpoints.csv']='task,criterion,actual_id,actual_sha256,evidence_file,evidence_file_sha256,auditor_status\n';
const protocolBytes=await readFile(`${base}/protocol.md`);
const sources={};
for(const path of [...seeds,'config/recommenders/project-risks.draft.json','config/recommenders/examples/project-risks.synthetic.json',
  'docs/evidencias/project-risks-2026-10-19/run-1-baseline.json',`${base}/protocol.md`,`${base}/facilitator.md`,
  ...['rnf','tests','risks'].map(task=>`${base}/participant-${task}.md`),'scripts/prepare-configuration-v3.mjs',
  'apps/api/src/evaluation/configuration-task-materials.ts','apps/api/src/evaluation/configuration-effort-v3.ts',
  'apps/api/src/services/configured-nfr.ts','apps/api/src/services/testrec-equations.ts','apps/api/src/services/configurable-knn.ts'])sources[path]=sha(await readFile(path));
files['materials.json']=serialize({schemaVersion:3,namespace,version:'configuration-task-pack-v3',status:'proposal_for_review',
  protocolSha256:sha(protocolBytes),participantStudyPerformed:false,methods:['ramos_2019_manhattan_k1_v2','us_agent_e21_equations_demo_v1','configurable_project_knn_v1']});
const manifest={schemaVersion:3,namespace,kind:'three_method_configuration_tasks',protocolSha256:sha(protocolBytes),sources,
  artifacts:Object.fromEntries(Object.entries(files).map(([path,value])=>[path,sha(value)])),empiricalClaim:false};
if(replay){assert.deepEqual(previous,manifest);for(const [path,value]of Object.entries(files))assert.equal(await readFile(resolve(replay,path),'utf8'),value);console.log(JSON.stringify({replayVerified:true,namespace,participantStudyPerformed:false}));}
else{const output=resolve(options['--output']);await mkdir(dirname(output),{recursive:true});await mkdir(output);
  for(const[path,value]of Object.entries({...files,'manifest.json':serialize(manifest)})){const file=resolve(output,path);await mkdir(dirname(file),{recursive:true});await writeFile(file,value,{flag:'wx'});}
  console.log(JSON.stringify({output,namespace,files:Object.keys(files).length,manifestSha256:sha(serialize(manifest)),participantStudyPerformed:false},null,2));}
