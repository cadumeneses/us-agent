# WIS User Story Classifier

## Planejamento de evolução

O [plano de evolução](docs/plano-evolucao-us-agent.md) organiza a ampliação para recomendadores configuráveis, preservando classificação, incerteza e revisão humana. O [workflow com backlog](docs/workflow-evolucao-us-agent.md) define as implementações e revisões; a [matriz de fidelidade](docs/referencias-e-fidelidade.md) acompanha as referências de Felipe, Ednaldo e o caso sem US. A [primeira entrega](docs/entregas/001-referencia-e-politica.md) preserva a referência RNF; a [segunda entrega](docs/entregas/002-classificacao-multilabel.md) integra múltiplos rótulos, métricas reais e proveniência à classificação e revisão web.

`npm.cmd run check:nfr-baseline` confere os oito cenários congelados do RNF v2 sem banco ou provedores LLM. A ampliação funcional segue o workflow; o funcionamento atual está documentado abaixo.

A [terceira entrega](docs/entregas/003-verificacao-e-contratos-configuraveis.md) reverifica o plano e implementa [definições e atributos configuráveis em memória](docs/recomendadores-configuraveis.md). `npm.cmd run check:configured-nfr` executa a configuração RNF e compara os oito resultados completos com a referência. Publicação e interface de configuração seguem nos próximos incrementos.

A [quarta entrega](docs/entregas/004-taxonomias-e-pendencias.md) acrescenta [taxonomias independentes por API](docs/taxonomias-independentes.md), com versões imutáveis e vínculos por ID/versão/hash. Após o build, `npm.cmd run check:recommender-taxonomies` verifica publicação e compatibilidade em um schema temporário local. A [lista de pendências](docs/pendencias-e-proximos-passos.md) acompanha o que falta para completar a plataforma e os três exemplos científicos.

A [quinta entrega](docs/entregas/005-publicacao-definicoes.md) implementa [publicação de definições](docs/publicacao-definicoes.md) com dependências imutáveis. Após o build, `npm.cmd run check:recommender-definitions` verifica integridade, rollback e concorrência no PostgreSQL local. A importação da base está na entrega seguinte; sua seleção explícita na execução continua em B11.

A [sexta entrega](docs/entregas/006-importacao-bases.md) acrescenta [importação CSV/JSON de bases rotuladas](docs/importacao-bases.md), com arquivo original, prévia, relatório e publicação versionada. Após o build, `npm.cmd run check:recommender-datasets` verifica o fluxo em um schema local descartável. A seleção da base na execução está na entrega seguinte, e a interface segue em B12.

A [sétima entrega](docs/entregas/007-execucao-base-explicita.md) implementa [execuções com base explícita](docs/execucoes-configuraveis.md), política RNF separada, mapeamento de IDs e replay. Após o build, `npm.cmd run check:recommendation-runs` verifica o fluxo completo pelo backend e as oito comparações com o legado.

A [oitava entrega](docs/entregas/008-execucao-configuravel-web.md) acrescenta **Bases publicadas** (`/configured-recommendations`): seleção de versões, formulário por atributos, execução, explicação, histórico e replay.

A [nona entrega](docs/entregas/009-configuracao-importacao-web.md) integra **Configurar e importar bases** (`/recommender-setup`), com editores, publicação revisada por hash e importação CSV/JSON com prévia e exclusões.

A [décima entrega](docs/entregas/010-avaliacoes-e-vertical-rnf.md) acrescenta [avaliações persistidas e destinos explícitos](docs/avaliacoes-configuraveis.md), sem alterar o resultado original. O vertical RNF foi verificado no Edge headless em desktop/mobile. Após o build, `npm.cmd run check:recommendation-runs` verifica também as decisões; `npm.cmd run check:recommender-browser` percorre a interface completa com PostgreSQL local isolado. O [roteiro web](docs/recomendadores-web.md) descreve acesso e limites.

A [entrega 011](docs/entregas/011-perimetro-e-dependencias.md), B13a, acrescenta [proteção central da API](docs/seguranca-acesso.md) e [correções das dependências](docs/dependencias-e-triagem.md). Acesso sem chave fica restrito ao desenvolvimento local direto; em ambiente protegido a interface aguarda o login pessoal de B13b. Não distribuir a chave de integração no navegador. B13 continua com pessoas/sessões/permissões/autoria e isolamento entre organizações. `npm.cmd run check:python-api` verifica as credenciais das integrações e `npm.cmd run check:dependencies` repete a consulta npm.

O [contrato da classificação web](docs/classificacao-web.md) descreve a política efetiva e a revisão. Aplique as migrations antes de iniciar a API nova em outro ambiente. `npm.cmd run check:classification-workflow` verifica o fluxo em um schema temporário do PostgreSQL local, com respostas de modelos simuladas.

A [entrega 012](docs/entregas/012-avaliacao-rnf-reproduzivel.md), B14a, acrescenta [avaliação RNF com protocolo, exportação e replay](docs/avaliacao-rnf.md). `npm.cmd run evaluate:rnf` executa 13 cenários sintéticos pelo executor de publicações e exporta resultados por alvo; `npm.cmd run check:rnf-evaluation` verifica o fluxo de arquivos. Compatibilidade e relevância sintética são separadas; a avaliação empírica de Felipe e o segundo exemplo de Ednaldo continuam pendentes. Este incremento segue a [prioridade científica corrigida](docs/revisao-de-escopo.md).

A [entrega 013](docs/entregas/013-contrato-ednaldo-e-aderencia.md), B15a, inicia o [contrato de dados de Ednaldo](docs/testrec-contrato-dados.md), reutilizando atributos/taxonomias e verificando quatro vetores da tabela 4.6 da tese. `npm.cmd run check:testrec-contract` confere essa representação e o catálogo local sintético. O TestRec ainda não calcula recomendações; similaridade/agregação e dados originais continuam pendentes. A [revisão de aderência](docs/aderencia-demandas-professor.md) distingue os pedidos já demonstrados daqueles que ainda exigem outro vertical e avaliação empírica.

A [entrega 014](docs/entregas/014-equacoes-ednaldo.md), B16a, acrescenta uma [demonstração local das equações E21](docs/testrec-equacoes-demonstracao.md): KNN compartilhado, três vizinhos, heurística, ranking, contribuições e catálogo preservado com associações sintéticas separadas. `npm.cmd run check:testrec-equations` verifica os cálculos; `--replay docs/evidencias/b16a/equations-demo.json` confere o pacote. Não é reprodução da configuração Euclidiana ou integração TestRec na API/interface; Q01/Q02 e dados originais continuam pendentes.

A [entrega 015](docs/entregas/015-catalogos-testes-publicados.md), B15b, implementa [catálogos de testes publicados por API](docs/catalogos-casos-teste.md), com JSON original recuperável, declaração de uso, versões imutáveis e retirada. Após compilar a API, `npm.cmd run check:test-case-catalogs` verifica o fluxo em schema PostgreSQL local descartável. Aplique a migration 022 em outros ambientes antes de usar as novas rotas. O vínculo catálogo/base/execução do segundo método e sua interface continuam pendentes.

A [entrega 016](docs/entregas/016-rebase-idioma-e-preservacao.md) integra as alterações remotas de idioma e projetos com os recomendadores configuráveis, preservando os snapshots científicos. O `.gitattributes` conserva os bytes das fontes/artefatos inventariados; mensagens históricas são traduzidas apenas na apresentação. Os fluxos de projetos, configuração, revisão e recomendação foram reverificados após o rebase.

Antes de commitar as adições científicas, `npm.cmd run check:scientific-index` confere os hashes das fontes/artefatos e as regras de finais de linha diretamente no stage, sem alterar o índice ou os arquivos.

## Aplicação web (MVP)

O repositório inclui uma plataforma responsiva com React + TypeScript no frontend, Node.js + Express no backend e PostgreSQL para persistência. Dashboard, histórico e taxonomia da API consultam exclusivamente o banco.

```powershell
npm.cmd install
npm.cmd run db:up
npm.cmd run db:migrate
npm.cmd run db:import
npm.cmd run dev
```

Abra `http://localhost:5173`. A API responde em `http://localhost:3333/api`. Para validar: `npm.cmd run build` e `npm.cmd test`.

### PostgreSQL

- `npm.cmd run db:up`: inicia o PostgreSQL local pelo Docker.
- `npm.cmd run db:migrate`: aplica migrations pendentes de forma idempotente.
- `npm.cmd run db:import`: importa temporariamente `runs/results.jsonl` para as tabelas relacionais.
- `npm.cmd run db:down`: encerra o container sem apagar o volume de dados.

Em desenvolvimento, a conexão padrão é o PostgreSQL local (`DATABASE_TARGET=local`). Para usar Neon, defina `DATABASE_TARGET=neon` e `DATABASE_URL_NEON` no `.env`; a URL deve conter `sslmode=require`. `DATABASE_URL` continua tendo precedência para compatibilidade com deploys e pode ser configurada diretamente na plataforma. O importador JSONL existe somente para a transição da base histórica; ele não é usado pela API em runtime.

### Vercel

O projeto possui `api/index.ts` como entrada serverless e `vercel.json` para servir a SPA e encaminhar `/api/*` ao Express. No projeto da Vercel:

1. mantenha a raiz do projeto na raiz deste repositório;
2. provisione PostgreSQL gerenciado pelo Marketplace (por exemplo, Neon ou Supabase);
3. configure `DATABASE_URL` com a URL de conexão com pool;
4. aplique `npm run db:migrate` fora do runtime, antes de liberar a versão;
5. não execute migrations durante o build ou a inicialização de uma Function.

O pool é criado uma vez por instância e integrado ao gerenciamento de conexões da Vercel. Nenhuma Function depende do sistema de arquivos persistente.

## Recomendação de requisitos não funcionais

A aba **Recomendadores · RNFs** usa o método descrito por Felipe Ramos (2019):
pré-filtragem por módulo/operação, exclusão de projetos de protótipo, vetores binários
com as características do alvo, similaridade de Manhattan e k=1. Os RNFs são
recuperados da US vizinha, com origem e comparação das características disponíveis
na interface. Não há geração de testes nem plano de qualidade.

Preencha o perfil do projeto e as categorias das tarefas em **Meus projetos**.
O histórico precisa conter outras US aceitas, com perfil completo e RNFs associados.
Em **Recomendadores · RNFs**, escolha a US e o par módulo/operação, execute e avalie
os resultados. **Aceitar e vincular** registra o RNF na US; rejeitar somente registra
a avaliação. Execuções preservam snapshots de entrada, resultados e versão do método.

Classificação multi-label, comitê, incerteza, revisão e evolução da taxonomia são
preservados. As adaptações e os limites da reprodução estão em
[docs/motor-rnf.md](docs/motor-rnf.md). A base original da pesquisa ainda não foi
localizada para download; exemplos dos testes automatizados não são essa base.

Aplique as migrations normalmente com `npm.cmd run db:migrate`. As tabelas antigas
de planos permanecem apenas como arquivo histórico, sem telas ou endpoints ativos.
Após o build, `node scripts/check-nfr-recommendations.mjs` verifica o fluxo HTTP e a
persistência em um schema temporário do PostgreSQL local, sem alterar dados da pesquisa.

## Motor de classificação

Ferramenta para classificar User Stories (US) na taxonomia WIS com foco em **decisao sob incerteza**.
O fluxo combina comite de modelos, arbitragem, rerun para incerteza media e revisao humana no proprio CLI.

## Visao geral
- Classificacao multi-label: uma US pode gerar varios pares `module`/`operation`.
- Politica de incerteza: calcula risco, consenso e divergencia entre modelos.
- Escalonamento humano: quando ha risco alto/consenso baixo, a revisao humana acontece no terminal.
- Evolucao de taxonomia: o revisor pode registrar feedback de taxonomia durante a revisao.
- Taxonomia externa: carregada de arquivo JSON versionavel.

A [entrega 017](docs/entregas/017-testes-no-executor-comum.md), B15c/B16b, liga a demonstração E21 a [definições, importações, bases e execuções nos endpoints comuns](docs/testrec-execucoes-publicadas.md), com catálogo fixado e replay. Requer a migration 023. `npm.cmd run check:testrec-runs` verifica HTTP/PostgreSQL local; `--replay docs/evidencias/b16b/published-runs.json` verifica o pacote offline. Restrita a dados sintéticos e equações Manhattan; Q01/Q02, interface de testes e avaliação empírica permanecem pendentes. Seletores RNF identificam métodos API-only.

## Estrutura
- `apps/api/`: backend Express isolado da interface web.
  - `src/database/`: pool PostgreSQL, migrations e importação histórica.
  - `src/routes/`: endpoints HTTP e validação das requisições.
  - `src/services/`: regras de classificação e agregação de dados.
  - `src/repositories/`: leitura dos resultados e da taxonomia.
  - `src/domain/`: tipos centrais da API.
- `apps/web/`: frontend React isolado da API.
  - `src/pages/`: páginas associadas às rotas da aplicação.
  - `src/components/`: layout e componentes reutilizáveis.
  - `src/services/`: comunicação HTTP com a API.
  - `src/types/`: contratos de dados usados pela interface.
- `database/migrations/`: schema SQL versionado.
- `compose.yaml`: PostgreSQL para desenvolvimento local.
- `api/index.ts`: entrada serverless da API na Vercel.
- `run.py`: worker CLI de classificação com persistência via API.
- `run_committee.py`: CLI alternativa sem arbitro, com decisao por maioria simples.
- `agent/orchestrator.py`: comite, metrica de incerteza, rerun e guardrails de escalonamento.
- `agent/human_review.py`: fluxo interativo de revisao humana e captura de feedback.
- `agent/api_client.py`: acesso seguro do worker Python à API SQL.
- `agent/taxonomy.py`: conversão e validação da taxonomia recebida da API.
- `agent/providers/`: provedores LLM (`openai`, `gemini`, `deepseek` e `groq` via HTTP OpenAI-like).
- `agent/schemas.py`: schemas Pydantic de entrada/saida.
- `export_results_csv.py`: exporta as classificações SQL da API para CSV.

## Setup
```bash
python -m venv .venv
pip install -r requirements.txt
```

Exemplo de `.env` (configure ao menos um provedor):
```bash
# OpenAI
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-pro

# Gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash

# Deepseek (API OpenAI-like)
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1/chat/completions
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-chat

# Groq (API OpenAI-like)
GROQ_BASE_URL=https://api.groq.com/openai/v1/chat/completions
GROQ_API_KEY=...
GROQ_MODEL=llama-3.1-8b-instant

# API SQL usada pelo worker Python
US_AGENT_API_URL=http://localhost:3333/api
# Obrigatória fora do desenvolvimento local; mesmo valor na API e no worker
INGEST_API_KEY=troque-por-um-segredo-forte

# Politica de incerteza
UNCERTAINTY_MAX_RERUNS=1
UNCERTAINTY_MEDIUM_THRESHOLD=0.33
UNCERTAINTY_HIGH_THRESHOLD=0.66
PROVIDER_TIMEOUT_SECONDS=60

# Human-in-the-loop
HUMAN_REVIEW_ENABLED=true
HUMAN_REVIEW_ONLY_ON_ESCALATION=true
```

## Como executar

### 1) Classificacao interativa
```bash
py run.py
```
Pergunta projeto, revisor e US separadas por `;`.

### 2) Classificacao nao interativa
```bash
py run.py --project P01 --reviewer ana --stories "US1;US2;US3"
```

### 3) Classificacao em lote sem espera por revisao
```bash
py run.py --project P01 --stories "US1;US2;US3" --classify-only
```
Nesse modo, o CLI nao abre `HUMAN REVIEW`. Qualquer item que seria escalado para revisao humana e finalizado automaticamente como `not covered` (`module='n/a'`, `operation='n/a'`).

Tambem e possivel carregar o lote de um arquivo texto:
```powershell
py run.py --project P01 --classify-only --stories-file .\lote.txt
```
O arquivo pode conter US separadas por `;` ou uma por linha.

Tambem e possivel executar varios projetos em uma unica run, carregando automaticamente os arquivos em `projects/`:
```powershell
py run.py --project-ids P01-P10 --projects-dir .\projects --classify-only
```
Cada projeto deve existir como `.\projects\P01.txt`, `.\projects\P02.txt`, etc. Todos os itens do lote compartilham o mesmo `run_id`.

Atalho em PowerShell para esse lote:
```powershell
.\run_projects_p01_p10.ps1
```
Por padrao ele roda com `--classify-only` e depois gera `runs/results.csv`. Use `-InteractiveReview` para permitir revisao humana durante a execucao ou `-CommitteeOnly` para usar `run_committee.py`.

### 4) Revisão humana

A revisão persistente é feita em `http://localhost:5173/review`. O antigo `--review-only` apenas informa essa mudança e não manipula arquivos locais.

A fila exibe o contexto que levou ao fallback: decisão e motivo final, sugestões estruturadas, votos dos classificadores, evidências, problemas e perguntas. A taxonomia segue a hierarquia **domínio (área, como Mobile ou IoT) → módulo → operação**. Ao marcar uma lacuna, o revisor pode registrar uma proposta de novo domínio, módulo ou operação; sugestões da IA podem ser incorporadas explicitamente na própria fila. As propostas ficam em `taxonomy_feedback` com status `pending_taxonomy_board`.

## Argumentos CLI
- `--project`: nome do projeto.
- `--project-ids`: IDs de projeto para execucao em lote, separados por `,` ou `;` e com suporte a intervalo (`P01-P10`).
- `--projects-dir`: diretorio com os arquivos `<project_id>.txt` usados por `--project-ids`.
- `--reviewer`: nome do revisor humano.
- `--stories`: US separadas por `;`.
- `--stories-file`: arquivo texto com US separadas por `;` ou uma por linha.
- `--classify-only`: classifica o lote sem bloquear por revisao humana; itens escalados sao gravados como `not covered`.
- `--review-only`: compatibilidade temporária; direciona o usuário à fila da WEB.

## Politica de decisao sob incerteza
1. Comite coleta votos de provedores.
2. Calcula `uncertainty_score`, `band`, `consensus_ratio` e sinais de divergencia com:
   - entropia de Shannon normalizada das hipoteses;
   - nivel de desacordo (`none`, `light`, `strong`) em vez de desacordo binario;
   - overlap medio de rotulos entre votos (`label_overlap`);
   - penalidade especifica para `n/a` e sinais de lacuna taxonomica.
   - composicao do score:
     - `0.25 * confidence_risk`
     - `0.20 * entropy_risk`
     - `0.25 * disagreement_risk`
     - `0.15 * na_gap_penalty`
     - `0.15 * review_risk`
3. Se banda `medium`, reroda (ate `UNCERTAINTY_MAX_RERUNS`) com instrucao mais conservadora.
4. Arbitra resultado final.
5. Guardrails:
   - `high`: forca `needs_human_review`
   - `medium` + consenso baixo (`consensus_ratio < 0.67`): forca `needs_human_review`
   - falha de provedores (`failed >= 2` ou sem sucesso efetivo): forca `needs_human_review`

## Arbitragem
- O arbitro e escolhido automaticamente:
  - se `DEEPSEEK_BASE_URL` estiver configurado, Deepseek e usado como arbitro;
  - caso contrario, o primeiro provedor ativo da lista e usado.

## CLI sem arbitro
- Use `run_committee.py` quando quiser que todos os modelos apenas classifiquem, sem prompt de arbitro.
- O resultado final e escolhido pela maioria simples do comite, mantendo a mesma politica de incerteza e rerun.

Exemplo:
```powershell
py run_committee.py --project P01 --stories-file .\lote.txt --classify-only
```

## Revisao humana no CLI
Quando ativada, a tela `HUMAN REVIEW` permite:
- aceitar decisao automatica;
- classificar manualmente na taxonomia atual;
- manter item escalado para fila humana com motivo (`pending_review`, `taxonomy_gap` ou `needs_rewrite`);
- registrar proposta de evolucao da taxonomia.

## Status persistente por item
Cada classificação no PostgreSQL possui `review_status`:
- `pending_review`
- `reviewed`
- `accepted_auto`
- `reclassified`
- `taxonomy_gap`
- `needs_rewrite`

Campos de rastreabilidade gravados por item:
- `story_id`
- `run_id`
- `taxonomy_version`
- `prompt_version`
- `policy_version`

As decisões humanas são gravadas em `review_decisions`, e alterações de rótulo atualizam `classification_labels` na mesma transação.

## Saída e exportação

Execuções, votos, tentativas, classificações, revisões e feedback de taxonomia são persistidos nas tabelas PostgreSQL. `runs/results.csv` é apenas uma exportação opcional gerada pela API; não é fonte de dados da aplicação.

Exportacao manual:
```powershell
.\.venv\Scripts\python.exe .\export_results_csv.py --output .\runs\results.csv
```

## Taxonomia

A fonte de verdade é formada por `taxonomy_versions`, `taxonomy_domains`, `taxonomy_modules` e `taxonomy_operations`. Um domínio representa uma nova área de negócio ou plataforma; módulos ficam dentro de um domínio, e operações dentro de um módulo. A API fornece a versão ativa à WEB e ao worker Python.

## Observacoes
- E necessario configurar ao menos um provedor valido (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_BASE_URL` ou `GROQ_BASE_URL`).
- Se nenhum provedor estiver configurado, a execucao encerra com aviso.
- As respostas dos modelos sao validadas por Pydantic.
- Respostas com cercas markdown sao limpas nos providers antes da validacao.
- O status `reviewed` pode aparecer em registros legados/normalizados, mas o fluxo atual tende a persistir `accepted_auto`, `reclassified`, `pending_review`, `taxonomy_gap` ou `needs_rewrite`.
