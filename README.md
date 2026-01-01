# WIS User Story Classifier

Pipeline para classificar histórias de usuário (US) segundo a taxonomia de Web Information Systems (WIS), com suporte a múltiplos pares (módulo, operação) por US. Usa provedores LLM (Gemini via `google-genai` e/ou Deepseek via API compatível OpenAI) em comitê e arbitragem.

## Estrutura
- `run.py`: CLI que lê US separadas por `;`, aciona provedores e grava resultados em `runs/results.jsonl`.
- `agent/prompts.py`: prompts para classificador, árbitro e formatter.
- `agent/orchestrator.py`: orquestra comitê, agrega votos e arbitra.
- `agent/providers/`: integrações de provedores (Gemini via SDK, HTTP genérico para Deepseek).
- `agent/schemas.py`: modelos Pydantic para entradas/saídas.
- `agent/storage.py`: utilitário para gravar JSONL.

## Preparar ambiente
```bash
python -m venv .venv
pip install -r requirements.txt
```

Crie um `.env` com pelo menos um provedor:
```
# Gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-1.5-pro

# Deepseek (API estilo OpenAI)
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1/chat/completions
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-chat
```

## Taxonomia
Definida em `run.py` (seção `TAXONOMY`): módulos Registry, Authentication, Management e respectivas operações. 

## Executar
```bash
py run.py
```
Entradas:
- Nome do projeto.
- US separadas por ponto e vírgula `;` em uma única linha.

Saídas:
- Console: decisão final por US.
- Arquivo: `runs/results.jsonl` (uma linha por execução).

## Dataset
- Link para dataset: [SAC](https://docs.google.com/spreadsheets/d/17XTasK9oAhMusTyC7fqeG3SxbGurDOwmANK4eW1uqSI/edit?gid=905958695#gid=905958695)

## Notas
- Se nenhum provedor estiver configurado no `.env`, a execução encerra com aviso.
- Respostas de LLM são validadas via Pydantic; cercas de código são removidas nos providers.
