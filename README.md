# WIS User Story Classifier

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

Em desenvolvimento, a conexão padrão é `postgresql://us_agent:us_agent_local@localhost:5432/us_agent`. Para outro ambiente, copie `.env.example` e configure `DATABASE_URL` no shell ou na plataforma. O importador JSONL existe somente para a transição da base histórica; ele não é usado pela API em runtime.

### Vercel

O projeto possui `api/index.ts` como entrada serverless e `vercel.json` para servir a SPA e encaminhar `/api/*` ao Express. No projeto da Vercel:

1. mantenha a raiz do projeto na raiz deste repositório;
2. provisione PostgreSQL gerenciado pelo Marketplace (por exemplo, Neon ou Supabase);
3. configure `DATABASE_URL` com a URL de conexão com pool;
4. aplique `npm run db:migrate` fora do runtime, antes de liberar a versão;
5. não execute migrations durante o build ou a inicialização de uma Function.

O pool é criado uma vez por instância e integrado ao gerenciamento de conexões da Vercel. Nenhuma Function depende do sistema de arquivos persistente.

## Motor de classificação

Ferramenta para classificar User Stories (US) na taxonomia WIS com foco em **decisao sob incerteza**.
O fluxo combina comite de modelos, arbitragem, rerun para incerteza media e revisao humana no proprio CLI.

## Visao geral
- Classificacao multi-label: uma US pode gerar varios pares `module`/`operation`.
- Politica de incerteza: calcula risco, consenso e divergencia entre modelos.
- Escalonamento humano: quando ha risco alto/consenso baixo, a revisao humana acontece no terminal.
- Evolucao de taxonomia: o revisor pode registrar feedback de taxonomia durante a revisao.
- Taxonomia externa: carregada de arquivo JSON versionavel.

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
# Obrigatória na Vercel e deve ter o mesmo valor na API e no worker
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

A fonte de verdade é formada por `taxonomy_versions`, `taxonomy_modules` e `taxonomy_operations`. A API fornece a versão ativa à WEB e ao worker Python.

## Recomendador de plano de qualidade

O prompt versionado `quality_plan_prompt_v1` fica em `agent/prompts.py` e usa o
schema `QualityPlanOutput` de `agent/schemas.py`. Ele recebe a história, os pares
WIS, confiança, incerteza, evidências e problemas conhecidos.

As recomendações distinguem três bases:

- `explicit_in_story`: informação declarada na história;
- `inferred_from_story`: inferência que precisa ser confirmada;
- `general_quality_practice`: prática geral, não um requisito confirmado.

Os provedores OpenAI, Gemini e HTTP OpenAI-like implementam
`recommend_quality`. O helper `recommend_quality_plan` em
`agent/quality_plan.py` monta o contexto de forma consistente e valida a saída
estruturada antes que ela seja persistida ou apresentada ao usuário.

## Observacoes
- E necessario configurar ao menos um provedor valido (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_BASE_URL` ou `GROQ_BASE_URL`).
- Se nenhum provedor estiver configurado, a execucao encerra com aviso.
- As respostas dos modelos sao validadas por Pydantic.
- Respostas com cercas markdown sao limpas nos providers antes da validacao.
- O status `reviewed` pode aparecer em registros legados/normalizados, mas o fluxo atual tende a persistir `accepted_auto`, `reclassified`, `pending_review`, `taxonomy_gap` ou `needs_rewrite`.
