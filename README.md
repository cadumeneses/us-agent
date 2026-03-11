# WIS User Story Classifier

Ferramenta para classificar User Stories (US) na taxonomia WIS com foco em **decisao sob incerteza**.
O fluxo combina comite de modelos, arbitragem, rerun para incerteza media e revisao humana no proprio CLI.

## Visao geral
- Classificacao multi-label: uma US pode gerar varios pares `module`/`operation`.
- Politica de incerteza: calcula risco, consenso e divergencia entre modelos.
- Escalonamento humano: quando ha risco alto/consenso baixo, a revisao humana acontece no terminal.
- Evolucao de taxonomia: o revisor pode registrar feedback de taxonomia durante a revisao.
- Taxonomia externa: carregada de arquivo JSON versionavel (nao hardcoded).

## Estrutura
- `run.py`: CLI principal (classificacao e modo somente revisor).
- `agent/orchestrator.py`: comite, metrica de incerteza, rerun e guardrails de escalonamento.
- `agent/human_review.py`: fluxo interativo de revisao humana e captura de feedback.
- `agent/taxonomy.py`: carregamento/validacao da taxonomia e conversao para prompt.
- `agent/providers/`: provedores LLM (`openai`, `gemini`, `deepseek` via HTTP OpenAI-like).
- `agent/schemas.py`: schemas Pydantic de entrada/saida.
- `agent/storage.py`: escrita em JSONL.
- `config/taxonomy.json`: taxonomia WIS versionada.

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

# Taxonomia
TAXONOMY_PATH=config/taxonomy.json

# Politica de incerteza
UNCERTAINTY_MAX_RERUNS=1
UNCERTAINTY_MEDIUM_THRESHOLD=0.33
UNCERTAINTY_HIGH_THRESHOLD=0.66

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

### 3) Modo somente revisor
```bash
py run.py --review-only --reviewer ana
```
Opcional:
```bash
py run.py --review-only --reviewer ana --results-path runs/results.jsonl
```

## Argumentos CLI
- `--project`: nome do projeto.
- `--reviewer`: nome do revisor humano.
- `--stories`: US separadas por `;`.
- `--review-only`: abre fila de revisao para resultados ja classificados.
- `--results-path`: caminho do JSONL a revisar no modo `--review-only`.
- `--reopen-story-ids`: reabre `story_id`(s) ja revisados para `pending_review` (use `,` ou `;`).

## Politica de decisao sob incerteza
1. Comite coleta votos de provedores.
2. Calcula `uncertainty_score`, `band`, `consensus_ratio` e sinais de divergencia.
3. Se banda `medium`, reroda (ate `UNCERTAINTY_MAX_RERUNS`) com instrucao mais conservadora.
4. Arbitra resultado final.
5. Guardrails:
   - `high`: forca `needs_human_review`
   - `medium` + consenso baixo: forca `needs_human_review`

## Revisao humana no CLI
Quando ativada, a tela `HUMAN REVIEW` permite:
- aceitar decisao automatica;
- classificar manualmente na taxonomia atual;
- manter item escalado para fila humana com motivo (`pending_review`, `taxonomy_gap` ou `needs_rewrite`);
- registrar proposta de evolucao da taxonomia.

## Status persistente por item
Cada item em `runs/results.jsonl` passa a ter `review_status`:
- `pending_review`
- `reviewed`
- `accepted_auto`
- `reclassified`
- `taxonomy_gap`
- `needs_rewrite`

No modo `--review-only`, o arquivo `runs/results.jsonl` e atualizado apos cada revisao,
evitando que item ja revisado volte a aparecer como pendente por falta de persistencia.

## Arquivos de saida
- `runs/results.jsonl`: execucoes completas (votos, incerteza, final, revisao humana).
- `runs/review_decisions.jsonl`: decisoes tomadas no modo `--review-only`.
- `runs/taxonomy_feedback.jsonl`: backlog de propostas de evolucao da taxonomia.

## Taxonomia
- Origem: `config/taxonomy.json`.
- Formato esperado:
```json
{
  "version": "1.0.0",
  "modules": {
    "ModuleName": ["Operation A", "Operation B"]
  }
}
```

## Observacoes
- Se nenhum provedor estiver configurado, a execucao encerra com aviso.
- As respostas dos modelos sao validadas por Pydantic.
- Respostas com cercas markdown sao limpas nos providers antes da validacao.
