import assert from 'node:assert/strict';
import { readFile,writeFile,copyFile,access } from 'node:fs/promises';
const folder='docs/demo-4min30';
const published=JSON.parse(await readFile(folder+'/publicado-em-producao.json','utf8'));
const captures=JSON.parse(await readFile(folder+'/capturas-verificadas.json','utf8'));
const adaptation=JSON.parse(await readFile(folder+'/dados/adaptacao-rnf.json','utf8'));
assert.equal(captures.productionWrites,0);
assert.deepEqual(captures.liveRunStatus,{targetConfirmed:false,decisionCount:0,copyCount:0});
const base=published.origin;
const links={home:base+'/recommendations',setup:base+'/recommender-setup',risk:base+'/configured-recommendations?definitionId=project-risk-recommender&definitionVersion=2&datasetId=project-risk-recommender-base&datasetVersion=2&project='+encodeURIComponent(published.project),nfr:published.runs['nfr-live'].url};
const steps=[
  {id:1,time:'0:00–0:30',title:'Mostre o que a ferramenta oferece',url:links.home,link:'Abrir Recommenders',image:'01-recommenders',caption:'As três opções principais aparecem na primeira linha. A quarta opção é para recomendadores próprios.',actions:[
    'Abra o link desta etapa. Entre com seu login habitual se aparecer a tela de acesso.',
    'Aponte para Non-functional requirements, Test cases e Project risks, nesta ordem.',
    'Fique nessa tela. Você não precisa clicar em Test cases; este roteiro executará riscos e RNFs.'
  ],expected:'Você vê a tela Recommenders, com as três opções principais e os cartões Project Risk Recommender abaixo.',say:'A ferramenta reutiliza conhecimento de projetos e histórias para recomendar requisitos não funcionais, casos de teste e riscos. Vou mostrar uma comparação de perfis e depois adaptar um requisito.'},
  {id:2,time:'0:30–1:05',title:'Abra a configuração que já está publicada',url:links.setup,link:'Abrir Configuration and datasets',image:'02a-definition-selection',caption:'Escolha o item que contém project-risk-recommender, versão 2 e estado published. Não escolha demo-video nem retired.',actions:[
    'Abra o link desta etapa e clique em Definitions, se essa aba não estiver selecionada.',
    'No campo Definition version, escolha Project Risk Recommender · project-risk-recommender · 2 · published.',
    'Clique em Load definition.',
    'Confira ID = project-risk-recommender, Version = 2, Name = Project Risk Recommender e State: published.'
  ],expected:'A definição abre em modo de consulta. Os campos ficam desabilitados porque a versão já foi publicada.',say:'Esta configuração já está publicada. Ela declara as características usadas para comparar projetos e a saída que será recomendada.'},
  {id:3,time:'1:05–1:40',title:'Mostre o campo que influencia a comparação',image:'03-team-feature',caption:'Team distribution está configurado como Feature e oferece duas opções: co-located e distributed.',actions:[
    'Continue na mesma página. Role até Attributes (5).',
    'Clique no título Team distribution · team_distribution · feature para expandir.',
    'Aponte para Role = Feature e para as opções co-located e distributed.',
    'Role mais abaixo até Calculation settings. Confira Number of neighbors (k) = 1 e Weight for Team distribution = 5. Os outros três pesos são 1.'
  ],expected:'O novo campo faz parte do cálculo. Você está apenas mostrando a configuração; não precisa criar outra versão ou publicar nada.',say:'A distribuição da equipe foi acrescentada como característica de comparação. Seu peso é cinco, e a consulta seleciona um vizinho. Agora vou mudar o valor desse campo na entrada.'},
  {id:4,time:'1:40–2:00',title:'Execute a consulta com equipe distribuída',url:links.risk,link:'Abrir consulta de riscos já preenchida',image:'05-team-and-recommend',caption:'O campo Team distribution e o botão azul Recommend aparecem na parte inferior do formulário.',actions:[
    'Abra o link desta etapa. Ele carrega a versão 2 e o perfil do Information Resources Web Project.',
    'Confira Platforms = Web; Application domains = Information resources; Languages = TypeScript, JavaScript e HTML/CSS, em três valores separados.',
    'No campo Team distribution, selecione distributed.',
    'Em Reference dataset, confira project-risk-recommender-base · 2 · 3 projects.',
    'Clique uma vez no botão azul Recommend e espere a execução terminar. A página abrirá o histórico com seu resultado; role para baixo até Recommendations.'
  ],expected:'A execução termina sem erro e mostra uma recomendação de risco. Não edite as linguagens, o domínio ou a base.'},
  {id:5,time:'2:00–2:20',title:'Mostre por que o resultado veio do P09',image:'06-distributed-p09',caption:'Resultado conferido com distributed: P09, Similarity 93.75% e Distance 1.',actions:[
    'No resultado que acabou de abrir, clique em Compared projects and feature contributions.',
    'Mostre P09, Similarity: 93.75% e Distance: 1.',
    'Mostre a linha Team distribution: Weight 5, Distance contribution 0. O projeto de referência tem a mesma distribuição informada.'
  ],expected:'Vizinho P09. A sugestão começa com “Communication failures between distributed teams may delay integrations.”',say:'Para a equipe distribuída, o vizinho selecionado é P09. A tabela mostra quanto cada característica contribuiu para a distância.'},
  {id:6,time:'2:20–2:50',title:'Mude somente a distribuição da equipe',url:links.risk,link:'Reabrir o mesmo formulário de riscos',image:'07-colocated-p01',caption:'Resultado conferido com co-located: P01, Similarity 100% e Distance 0.',actions:[
    'Abra novamente o link desta etapa para voltar ao formulário.',
    'Altere somente Team distribution para co-located. Confira que definição e base continuam na versão 2.',
    'Clique em Recommend e espere. Role até Recommendations.',
    'Abra Compared projects and feature contributions. Mostre P01, Similarity: 100% e Distance: 0.'
  ],expected:'O vizinho muda de P09 para P01. A sugestão agora começa com “Changes to information visualizations may require user interface rework.”',say:'Mantive a mesma definição, a mesma base e os mesmos dados do perfil. Ao mudar somente a distribuição da equipe, o vizinho mudou de P09 para P01. Estes riscos e distribuições são ilustrativos.'},
  {id:7,time:'2:50–3:05',title:'Abra o RNF e mostre a referência',url:links.nfr,link:'Abrir a execução RNF preparada para você',image:'08-nfr-source',caption:'A entrada é do Projeto Emanuel. A referência selecionada é a história/classificação 86 do P02.',actions:[
    'Abra o link desta etapa. Ele mostra uma execução já preparada; você não precisa preencher uma história nem executar o classificador.',
    'Role até Selected neighbor.',
    'Mostre P02 e Source record: story 86, classification 86. Esta consulta recomenda RNFs para “Como coordenador, quero consolidar notas dos alunos.”'
  ],expected:'Você vê seis sugestões de RNFs. O vizinho selecionado pertence ao P02.',say:'Esta consulta usa uma história do Projeto Emanuel. As sugestões vieram de requisitos já associados a uma história do P02.'},
  {id:8,time:'3:05–3:15',title:'Confirme onde a decisão será registrada',image:'09-confirm-destination',caption:'Mantenha This run’s preserved input e clique em Confirm reviewed destination.',actions:[
    'Continue na mesma execução. Role até Assess suggestions.',
    'No campo Link suggestions to, mantenha This run\'s preserved input.',
    'Clique no botão azul Confirm reviewed destination.',
    'Espere aparecer Confirmed destination. Não selecione Selected US-Agent story.'
  ],expected:'A decisão ficará vinculada à entrada preservada desta execução. A história original não será editada.'},
  {id:9,time:'3:15–3:25',title:'Aceite o RNF certo',image:'09a-accept-access-control',caption:'O cartão correto tem a etiqueta Security / access_control. No print, o botão ainda está claro porque o destino não havia sido confirmado; após o passo 8 ele fica habilitado.',actions:[
    'Role até o cartão com a etiqueta Security / access_control. Ele fica na segunda linha de sugestões no layout desktop mostrado.',
    'Confira a sentença: The system must provide the capability for users see just the information they have permission to access.',
    'No campo Suggestion notes desse cartão, escreva: Suitable for access control over grades; adapt to the coordinator role.',
    'Clique em Accept and link dentro desse mesmo cartão. Não use o botão de outro requisito.'
  ],expected:'O cartão passa a mostrar Accepted and linked to the preserved input e oferece Adapt accepted NFR.'},
  {id:10,time:'3:25–3:50',title:'Escreva e salve a adaptação',image:'10-adaptation-form',caption:'Print da execução de ensaio já concluída. Ela mostra os campos e a Revision 1 que você deve obter na sua execução.',actions:[
    'No cartão Security / access_control que você acabou de aceitar, clique em Adapt accepted NFR.',
    'Apague o conteúdo de Adapted sentence e cole o primeiro texto abaixo.',
    'Em Reason for adaptation, cole o segundo texto abaixo.',
    'Clique em Save NFR adaptation e aguarde Revision 1 aparecer com a nova sentença.'
  ],copy:[{label:'Adapted sentence',text:adaptation.sentence},{label:'Reason for adaptation',text:adaptation.reason}],expected:'Você vê Revision 1, com a nova redação. O requisito original continua preservado no cartão.',say:'Aceito o requisito de controle de acesso e salvo uma versão específica para o papel de coordenador. O original, a decisão e a adaptação permanecem separados.'},
  {id:11,time:'3:50–4:30',title:'Verifique o replay e baixe a evidência',image:'11-replay-and-export',caption:'Verify replay confere o cálculo. Download evidence with assessments, acima dele, inclui também a decisão e a adaptação.',actions:[
    'Continue na mesma execução RNF. Role até o botão Verify replay, no final do resultado, e clique nele.',
    'Espere Replay verified: result, explanation, and projection match the preserved run. Os três indicadores devem mostrar matches.',
    'Suba um pouco até Download evidence with assessments e clique para baixar a execução com o aceite e a adaptação.',
    'Finalize mostrando o endereço https://us-agent-api.vercel.app. Explique que o acesso usa uma conta autorizada.'
  ],expected:'Um arquivo avaliacao-<ID>.json é baixado. Download JSON evidence é outra opção: exporta somente a execução original, sem substituir o download com avaliações.',say:'O replay confere o cálculo usando os dados preservados. A exportação reúne a execução, a decisão e a adaptação. A ferramenta pode ser acessada neste endereço com uma conta autorizada.'}
];
const stamp=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Fortaleza'}).format(new Date(captures.capturedAt));
const intro=[
  'Siga os passos de 1 a 11, na ordem. Mantenha este guia aberto e use os links “Abrir” para trabalhar em outra aba da aplicação. No HTML, todos esses links reutilizam a mesma aba.',
  'Você vai mostrar uma configuração pronta, executar duas consultas de riscos, aceitar e adaptar um RNF e baixar a evidência. As configurações e bases já foram publicadas: não é necessário criar, importar ou publicar novamente.',
  'Este roteiro de 4min30 apresenta a configuração já criada. Ele não filma a criação/importação ao vivo. A diferença está indicada para você não narrar uma consulta como se estivesse criando uma publicação naquele instante.',
  'Faça a primeira leitura sem clicar nos botões de aceitar ou salvar. Reserve essas ações para a apresentação: elas ficam registradas.'
];
const troubleshoot=[
  ['Apareceu a tela de login','Entre com seu usuário e senha habituais e abra novamente o link da etapa.'],
  ['A lista de versões está vazia','Confira o workspace default, aguarde carregar e recarregue.'],
  ['O resultado não é P09/P01','Confira versão 2 da definição e da base, os três valores de linguagens, domínio, plataforma e Team distribution.'],
  ['Accept and link está desabilitado','Conclua o passo 8: Confirm reviewed destination.'],
  ['O RNF já foi aceito/adaptado','Você já realizou esta ação. Para repeti-la, abra o formulário RNF do Projeto Emanuel, selecione a definição/base e gere uma nova execução. O link está abaixo.'],
  ['Replay não verificou','Não diga que passou. Confira a mensagem antes de continuar.']
];
const recovery=base+'/recommendations?recommender=nfr&project=Projeto%20Emanuel&classificationId=269&source=published';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const button=(url,label)=>`<a class="action" href="${escape(url)}" target="usagent-presentation" rel="noopener">${escape(label)} ↗</a>`;
const figure=step=>`<figure><img src="prints/${step.image}.png" alt="Tela do passo ${step.id}: ${escape(step.title)}" onclick="window.open(this.src,'_blank')"><figcaption>${escape(step.caption)}</figcaption></figure>`;
const copied=(step)=>step.copy?`<div class="copy-grid">${step.copy.map(c=>`<div><strong>${escape(c.label)}</strong><pre>${escape(c.text)}</pre></div>`).join('')}</div>`:'';
const html=`<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guia ilustrado — demonstração US-Agent</title><style>
*{box-sizing:border-box}body{margin:0;background:#edf1f6;color:#17253b;font:16px/1.55 system-ui,Segoe UI,sans-serif}main{max-width:1100px;margin:auto;padding:28px 24px}.cover,.step,.closing{background:white;border:1px solid #d7dfea;border-radius:16px;padding:28px 34px;margin:0 0 24px;box-shadow:0 5px 18px #17253b08}h1{font-size:32px;line-height:1.15;margin:10px 0 20px}h2{font-size:25px;line-height:1.25;margin:8px 0 18px}.eyebrow,.time{font-size:13px;font-weight:750;color:#245cc5;letter-spacing:.04em}.action{display:inline-block;background:#245fe5;color:white;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:650;margin:4px 0 14px}.step ol{padding-left:25px}.step li{margin:8px 0}figure{margin:18px 0}img{display:block;width:100%;border:1px solid #d7dfea;border-radius:8px;cursor:zoom-in}figcaption{font-size:13px;color:#52657e;margin-top:7px}.expected{background:#eaf6ee;border-left:4px solid #268648;padding:12px 16px;border-radius:4px}.speech{border-left:4px solid #3768c5;padding:10px 16px;background:#f0f5ff;margin:14px 0}pre{font:14px/1.5 ui-monospace,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f5f9;border:1px solid #d7dfea;border-radius:7px;padding:12px}.note{font-size:13px;color:#52657e}.copy-grid{display:grid;gap:12px}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border:1px solid #d7dfea;padding:9px;text-align:left;vertical-align:top}th{background:#edf2f9}a{color:#245cc5}.index{display:flex;flex-wrap:wrap;gap:8px}.index a{border:1px solid #d7dfea;border-radius:6px;text-decoration:none;padding:4px 9px;font-size:13px}.checked{color:#26713b;font-weight:650}.small{font-size:14px}@page{size:A4;margin:12mm}@media print{body{background:white;font-size:10.2pt;line-height:1.35}main{max-width:none;padding:0}.cover,.step,.closing{border:0;box-shadow:none;border-radius:0;padding:0;margin:0;break-before:page}.cover{break-before:auto}h1{font-size:25pt}h2{font-size:17pt}.time{font-size:9pt}.step li{margin:4px 0}.action{padding:5px 8px;margin:0 0 6px;font-size:9pt}figure{margin:8px 0;break-inside:avoid}img{width:100%;max-height:128mm;object-fit:contain;border-radius:0}figcaption,.note{font-size:8pt}.expected,.speech{padding:6px 9px;margin:8px 0;font-size:9pt}pre{font-size:8.2pt;padding:7px;margin:5px 0}.index{display:none}table{font-size:9pt}td,th{padding:6px}.copy-grid{gap:3px}.small{font-size:9pt}}
</style></head><body><main><section class="cover"><div class="eyebrow">GUIA DE EXECUÇÃO · 4 MINUTOS E 30 SEGUNDOS</div><h1>O que abrir, onde clicar<br>e o que deve aparecer</h1>${intro.map(p=>`<p>${escape(p)}</p>`).join('')}<p class="checked">Conferido em ${escape(stamp)} · horário de Fortaleza</p><p class="note">Os prints são capturas locais da interface efetivamente publicada, carregando dados de produção em modo de leitura. Não são mockups. O login pessoal não foi testado. Nesta captura não foram criadas execuções, decisões ou adaptações em produção.</p><p><strong>O projeto é Information Resources Web Project.</strong> Os riscos e a distribuição das equipes são ilustrativos; os perfis técnicos vêm de P01, P09 e P03. A etapa RNF usa a história 269 do Projeto Emanuel e referências do P02.</p><p class="note">Clique em qualquer print para abrir a imagem em tamanho completo no HTML.</p><nav class="index">${steps.map(s=>`<a href="#step-${s.id}">${s.id}. ${escape(s.title)}</a>`).join('')}</nav></section>${steps.map(s=>`<section class="step" id="step-${s.id}"><div class="time">PASSO ${s.id} · VÍDEO ${s.time}</div><h2>${escape(s.title)}</h2>${s.url?button(s.url,s.link):'<p class="small"><strong>Continue na mesma página da etapa anterior.</strong></p>'}<ol>${s.actions.map(a=>`<li>${escape(a)}</li>`).join('')}</ol>${copied(s)}${figure(s)}<div class="expected"><strong>Deve acontecer:</strong> ${escape(s.expected)}</div>${s.say?`<div class="speech"><strong>Fala sugerida:</strong> “${escape(s.say)}”</div>`:''}</section>`).join('')}<section class="closing"><div class="time">CONSULTA RÁPIDA</div><h2>Se algo não aparecer como no print</h2><table><thead><tr><th>Situação</th><th>O que fazer</th></tr></thead><tbody>${troubleshoot.map(row=>`<tr><td>${escape(row[0])}</td><td>${escape(row[1])}</td></tr>`).join('')}</tbody></table><p>${button(recovery,'Abrir formulário RNF para uma nova execução')}</p><p>Selecione <strong>Non-functional Requirement Recommender</strong>, base <strong>nfr-recommender-base · 1</strong>, confira a história e o par <strong>Registry / Retrieve data</strong> e clique em <strong>Run recommendation</strong>. Use a nova execução somente se precisar repetir a aceitação/adaptação.</p><h2>O que está pronto</h2><p>A execução RNF reservada foi consultada nesta revisão: destino ainda não confirmado, zero decisões e zero adaptações. O print de adaptação e o print de replay usam a execução separada de ensaio, já concluída. Seus próprios cliques nos passos 8 a 10 salvarão uma nova decisão e adaptação na execução reservada.</p><p class="note">Relatório de origem e consultas: capturas-verificadas.json. A conferência visual percorreu a interface publicada em ambiente local com proxy de leitura. A autenticação do preview local foi desativada; as APIs de produção foram consultadas pelo servidor local com a credencial técnica, sem expô-la no navegador. Ações de gravação foram bloqueadas no preview.</p></section></main></body></html>`;
await writeFile(folder+'/GUIA-ILUSTRADO.html',html);
const md=['# Guia correto da demonstração — passo a passo com prints','',...intro.flatMap(p=>[p,'']),`Conferido em ${stamp} (Fortaleza).`,'','Os prints mostram a interface publicada renderizada localmente com dados de produção em modo de leitura. O login pessoal não foi testado. Nenhum dado foi alterado em produção nesta revisão.',''];
for(const step of steps){md.push(`## ${step.id}. ${step.title} — ${step.time}`,'',step.url?`[${step.link}](${step.url})`:'Continue na mesma página da etapa anterior.','',...step.actions.map((action,i)=>`${i+1}. ${action}`),'');if(step.copy)for(const copy of step.copy)md.push(`**${copy.label}:**`,'','```text',copy.text,'```','');md.push(`![Print do passo ${step.id}](prints/${step.image}.png)`,'',step.caption,'',`**Resultado esperado:** ${step.expected}`,'');if(step.say)md.push(`**Fala sugerida:** “${step.say}”`,'');}
md.push('## Se algo não aparecer como no print','','| Situação | O que fazer |','| --- | --- |',...troubleshoot.map(row=>`| ${row[0]} | ${row[1]} |`),'',`[Abrir o formulário RNF para uma nova execução](${recovery})`,'','Selecione Non-functional Requirement Recommender e nfr-recommender-base · 1. Confira a história, o par Registry / Retrieve data e clique em Run recommendation. Isso só é necessário para repetir uma aceitação/adaptação que você já realizou.','',`Verificação: ${captures.screenshots.length} prints; destino da execução reservada não confirmado; zero decisões e zero adaptações. O print da adaptação usa a execução de ensaio já concluída. Seus cliques nos passos 8 a 10 serão salvos na execução reservada.`,'');
await copyFile(folder+'/GUIA.md',folder+'/GUIA-ANTERIOR.md',1).catch(error=>{if(error.code!=='EEXIST')throw error;});
await writeFile(folder+'/GUIA.md',md.join('\n'));
for(const step of steps)await access(folder+'/prints/'+step.image+'.png');
for(const step of steps)if(step.url)assert.equal(new URL(step.url).origin,base);
console.log(JSON.stringify({steps:steps.length,illustratedGuide:true,capturedScreenshots:captures.screenshots.length,liveNfrReady:true}));
