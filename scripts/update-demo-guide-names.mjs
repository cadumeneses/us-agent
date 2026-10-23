import assert from 'node:assert/strict';
import { readFile, writeFile, rename } from 'node:fs/promises';
const folder='docs/demo-4min30';
const old=JSON.parse(await readFile(folder+'/historico-antes-dos-nomes-em-ingles/publicado-em-producao.json','utf8'));
const current=JSON.parse(await readFile(folder+'/publicado-em-producao.json','utf8'));
const plan=JSON.parse(await readFile('tmp/demo-production-preparation/plan.json','utf8'));
let guide=await readFile(folder+'/GUIA.md','utf8');
const translations=[
  ['[DEMO] Roteiro 4m30',current.project],
  ['%5BDEMO%5D%20Roteiro%204m30',encodeURIComponent(current.project)],
  ['demo-video-project-risks','project-risk-recommender'],
  ['demo-video-nfr','nfr-recommender'],
  ['[DEMO] RNFs — referências do P02','Non-functional Requirement Recommender'],
  ['[DEMO] Riscos — projetos cadastrados','Project Risk Recommender'],
  ['demo-video-live-risks','web-project-risk-recommender'],
  ['[DEMO AO VIVO] Riscos','Project Risk Recommender'],
  ['demo-video-live-profile','web-project-profile'],
  ['Demonstração baseada em P01','Profile copied from P01; risk associations are illustrative.'],
  ['Adequado ao controle de acesso às notas; adaptar ao papel de coordenador.','Suitable for access control over grades; adapt to the coordinator role.'],
  ['O sistema deve permitir que o coordenador consulte e consolide somente as notas dos alunos e turmas para os quais possui autorização de acesso.',plan.adaptation.sentence],
  ['Contextualização do RNF de controle de acesso à consulta e consolidação de notas no Projeto Emanuel; cópia separada para demonstração.',plan.adaptation.reason],
  ['Perfis copiados de P01, P09 e P03; riscos sintéticos para demonstração.','Profiles copied from P01, P09 and P03; synthetic risk associations.'],
  ['Demonstração autorizada pelo responsável pelo workspace; associações ilustrativas.','Internal example authorized by the workspace owner; illustrative associations.']
];
for(const [from,to] of translations)guide=guide.replaceAll(from,to);
for(const [name,run] of Object.entries(old.runs))guide=guide.replaceAll(run.id,current.runs[name].id);
guide=guide.replace('## O que ficou pronto','Os nomes ativos foram atualizados para inglês. As publicações anteriores foram retiradas do catálogo ativo; seus registros e execuções continuam preservados no histórico. As instruções e links abaixo já usam os novos nomes.\n\n## O que ficou pronto');
guide=guide.replace('Perfil técnico copiado de P01; nenhuma história criada.','Perfil técnico copiado de P01; projeto renomeado, preservando sua identidade; nenhuma história criada.');
assert.ok(!guide.includes('[DEMO] Roteiro'));
assert.ok(!guide.includes('demo-video-project-risks'));
await writeFile(folder+'/GUIA.md',guide);
// Old reference-definition files remain only in the historical package.
for(const name of ['demo-video-project-risks-v1.definition.json','demo-video-project-risks-v2.definition.json','demo-video-nfr-v1.definition.json']){
  try{await rename(folder+'/dados/'+name,folder+'/historico-antes-dos-nomes-em-ingles/dados/'+name);}catch(error){if(error.code!=='ENOENT')throw error;}
}
console.log(JSON.stringify({guideUpdated:true,project:current.project,runs:Object.keys(current.runs).length}));
