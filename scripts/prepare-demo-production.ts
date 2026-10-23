// Builds and verifies the demonstration locally. This script never contacts production.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { snapshotContent, canonicalJson } from '../apps/api/src/domain/content-snapshot.js';
import { snapshotDefinitionPublication } from '../apps/api/src/domain/definition-publication.js';
import { parseRecommenderDefinition } from '../apps/api/src/domain/recommender-definition.js';
import { buildImportPreview, selectImportRecords } from '../apps/api/src/domain/dataset-import.js';
import { validateConfigurableDefinition, CONFIGURABLE_KNN_ADAPTER, executeConfigurableRecommendation } from '../apps/api/src/services/configurable-knn.js';
import { validateImplementedDefinition } from '../apps/api/src/services/recommender-methods.js';
import { legacyNfrInput } from '../apps/api/src/services/configured-nfr.js';
import { executeMethodRecommendation } from '../apps/api/src/services/method-execution.js';

const directory='docs/demo-4min30/dados';
await mkdir(directory,{recursive:true});
const json=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
const save=async(name:string,value:unknown)=>writeFile(directory+'/'+name,JSON.stringify(value,null,2)+'\n');
const inventory=await json('tmp/demo-production-preparation/projects.json');
const getProfile=(name:string)=>structuredClone(inventory.profiles.find((x:any)=>x.project===name).profile);
const risk1=parseRecommenderDefinition(await json('config/recommenders/project-risks.draft.json'));
risk1.id='project-risk-recommender';risk1.version='1';risk1.name='Project Risk Recommender';risk1.method.parameters.k=1;
const risk2=structuredClone(risk1);risk2.version='2';
risk2.attributes.push({id:'team_distribution',name:'Team distribution',valueType:{type:'enum',values:['co-located','distributed']},scope:'project',cardinality:'single',required:true,role:'feature',representation:'presence'});
risk2.method.parameters.weights={platforms:1,domains:1,languages:1,team_distribution:5};
const risks:Record<string,string[]>={
  P01:['Changes to information visualizations may require user interface rework.'],
  P09:['Communication failures between distributed teams may delay integrations.'],
  P03:['Integration incompatibilities may delay delivery.']
};
const records1=['P01','P09','P03'].map(project=>{const p=getProfile(project);return{id:project,values:{platforms:p.platforms,domains:p.applicationDomains,languages:p.technologies.languages,risks:risks[project]}};});
const records2=records1.map(row=>({...structuredClone(row),values:{...structuredClone(row.values),team_distribution:row.id==='P01'?'co-located':'distributed'}}));
const profile=getProfile('P01');
const target1={id:'information-resources-web-profile',values:{platforms:profile.platforms,domains:profile.applicationDomains,languages:profile.technologies.languages,risks:[]},provenance:{source:'Profile copied from P01. Risk associations and team distribution are illustrative.'}};
const distributed={...structuredClone(target1),values:{...structuredClone(target1.values),team_distribution:'distributed'}};
const colocated={...structuredClone(distributed),values:{...structuredClone(distributed.values),team_distribution:'co-located'}};
const rnf=parseRecommenderDefinition(await json('config/recommenders/rnf-v2.draft.json'));
rnf.id='nfr-recommender';rnf.version='1';rnf.name='Non-functional Requirement Recommender';
rnf.attributes=rnf.attributes.map(attribute=>({...attribute,name:attribute.id.split('_').map(word=>word[0].toUpperCase()+word.slice(1)).join(' ')}));
const nfrContexts=await Promise.all(['91','86'].map(id=>json('tmp/demo-production-preparation/nfr-'+id+'.json')));
const rnfRecords=nfrContexts.map(context=>legacyNfrInput(rnf,context.target,context.target.storyId,'Copy of classification '+context.target.classificationId+' from P02; operational content preserved.'));
const context=await json('tmp/demo-production-preparation/nfr-269.json');
const rnfTarget=legacyNfrInput(rnf,context.target,context.target.storyId,'Source: Projeto Emanuel; classification 269; preserved recommendation input.');
rnfTarget.values.nfrs=[];
const riskSource={description:'Technical profiles copied from registered projects P01, P09 and P03. Associated risks and team_distribution values are synthetic examples, not observed project risks.',authorization:{basis:'synthetic',reference:'Internal example preparation authorized by the workspace user on 2026-10-22. Synthetic associations are explicitly declared.'}};
const rnfSource={description:'Profiles, labels and existing non-functional requirements copied from P02 classifications 91 and 86.',authorization:{basis:'permission',reference:'Internal reuse authorized by the workspace user on 2026-10-22; original operational records remain unchanged.'}};
const offlineId='00000000-0000-4000-8000-000000000001';
function verify(definition:any,records:any[],source:any,targets:any[]){
  const configurable=definition.method.id==='configurable_project_knn_v1';
  const adapterVersion=configurable?(validateConfigurableDefinition(definition,[]),CONFIGURABLE_KNN_ADAPTER):validateImplementedDefinition(definition,[]).adapterVersion;
  const publication=snapshotDefinitionPublication({schemaVersion:1,definition:{...definition,state:'published'},taxonomies:[],implementation:{methodId:definition.method.id,adapterVersion}});
  const reference={id:definition.id,version:definition.version,format:publication.format,sha256:publication.sha256};
  const spec={schemaVersion:1,id:definition.id+'-base',version:definition.version,definition:reference,format:'json',source,mapping:{recordId:['id'],attributes:Object.fromEntries(definition.attributes.map((a:any)=>[a.id,{path:['values',a.id],encoding:'value'}]))}};
  const preview=buildImportPreview(spec,Buffer.from(JSON.stringify(records)), 'dataset.json',publication.content);
  assert.equal(preview.report.fatal.length,0);assert.equal(preview.report.invalid,0);assert.equal(preview.report.duplicate,0);assert.equal(preview.report.valid,records.length);
  const dataset={schemaVersion:1,importerVersion:preview.importerVersion,id:spec.id,version:spec.version,definition:reference,source,import:{id:offlineId,previewSha256:snapshotContent(preview).sha256,fileSha256:preview.file.sha256},mapping:spec.mapping,selection:{excludedOrdinals:[],includedOrdinals:preview.report.rows.map(r=>r.ordinal)},records:selectImportRecords(preview,[]).records};
  const ds=snapshotContent(dataset);
  const results=targets.map(input=>{
    const request={id:offlineId,definition:reference,dataset:{id:dataset.id,version:dataset.version,format:ds.format,sha256:ds.sha256},input,...(configurable?{}:{selection:{labelIndex:0}})};
    const execute=()=>configurable?executeConfigurableRecommendation(request,publication.content,dataset):executeMethodRecommendation(request,publication.content,dataset);
    const run=execute();assert.equal(run.result.content.status,'completed');assert.equal(snapshotContent(run).sha256,snapshotContent(execute()).sha256);
    return run.result.content;
  });
  return {validRows:preview.report.valid,results};
}
const v1=verify(risk1,records1,riskSource,[target1]);
const v2=verify(risk2,records2,riskSource,[distributed,colocated]);
assert.equal(v1.results[0].neighbors[0].recordId,'P01');
assert.equal(v2.results[0].neighbors[0].recordId,'P09');
assert.equal(v2.results[1].neighbors[0].recordId,'P01');
assert.deepEqual(Object.keys(distributed.values).filter(key=>canonicalJson(distributed.values[key])!==canonicalJson(colocated.values[key])),['team_distribution']);
const nfr=verify(rnf,rnfRecords,rnfSource,[rnfTarget]);
assert.ok(nfr.results[0].items.some((item:any)=>item.attribute==='access_control'));
const plan={schemaVersion:1,origin:'https://us-agent-api.vercel.app',organizationId:'default',demoProject:'Information Resources Web Project',renameProjectFrom:'[DEMO] Roteiro 4m30',stateFilename:'english-publication-state.json',sourceProject:'P01',profile,
  definitions:[{definition:risk1,records:records1,source:riskSource,filename:'riscos-v1-base.json'},{definition:risk2,records:records2,source:riskSource,filename:'riscos-v2-base.json'},{definition:rnf,records:rnfRecords,source:rnfSource,filename:'rnf-base-p02.json'}],
  inputs:{baseline:target1,distributed,colocated,nfr:rnfTarget},
  adaptation:{sentence:'The system must allow coordinators to view and consolidate grades only for students and classes they are authorized to access.',reason:'Adapt the access-control requirement to the coordinator role and the grade-consolidation workflow in Projeto Emanuel; preserve the original requirement as a separate artifact.'},
  limitations:['Riscos e distribuição da equipe são sintéticos; perfis técnicos vêm dos projetos cadastrados.','A adaptação ficará associada à entrada preservada, sem editar a história 269.','UUIDs e hashes offline não são publicações em produção.']};
for(const row of plan.definitions){await save(row.filename,row.records);await save(row.definition.id+'-v'+row.definition.version+'.definition.json',row.definition);}
for(const [name,input] of Object.entries(plan.inputs))await save('entrada-'+name+'.json',input);
await save('adaptacao-rnf.json',plan.adaptation);
await writeFile('tmp/demo-production-preparation/plan.json',JSON.stringify(plan,null,2)+'\n');
await writeFile('docs/demo-4min30/validacao-local.json',JSON.stringify({checkedAt:new Date().toISOString(),offlineOnly:true,productionWrites:false,imports:{risk1:v1.validRows,risk2:v2.validRows,nfr:nfr.validRows},riskBaseline:v1.results[0],controlledRiskPair:v2.results,nfr:nfr.results[0],sameDefinitionAndDatasetWithinPair:true,onlyChangedAttribute:'team_distribution',repeatabilityVerified:true},null,2)+'\n');
console.log(JSON.stringify({ready:true,imports:[v1.validRows,v2.validRows,nfr.validRows],riskNeighbors:v2.results.map((r:any)=>r.neighbors.map((n:any)=>({recordId:n.recordId,distance:n.distance,similarity:n.similarity}))),nfrItems:nfr.results[0].items.length,nfrNeighbor:nfr.results[0].neighbor?.classificationId}));
