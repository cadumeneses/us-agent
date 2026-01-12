CLASSIFIER_PROMPT = """\
Você é um classificador de histórias de usuário para a taxonomia WIS. Retorne SOMENTE JSON bruto (sem markdown, sem cercas) no formato:
{{
  "rows": [
    {{ "module": "<módulo ou 'n/a'>", "operation": "<operação ou 'n/a'>" }}
  ],
  "confidence": <0..1>,
  "rationale": "<curto motivo>",
  "evidence": ["<trechos usados>"],
  "needs_review": <true|false>,
  "issues": ["<opcional>"],
  "suggested_questions": ["<opcional>"]
}}

Regras:
- Uma mesma US pode ter várias linhas (todos os pares módulo/operação aplicáveis).
- Use apenas os módulos/operações da lista abaixo; se não encaixar, retorne uma única linha com module='n/a', operation='n/a', confidence<=0.5, needs_review=true e registre o motivo em issues.
- Não invente rótulos. Não use markdown.

Taxonomia:
{taxonomy}

História de usuário:
{user_story}
"""


ARBITER_PROMPT = """\
Você é um árbitro conservador. Combine as saídas dos modelos e produza o veredito final.

Retorne SOMENTE JSON bruto (sem markdown):
{{
  "final_rows": [
    {{ "module": "<módulo ou 'n/a'>", "operation": "<operação ou 'n/a'>" }}
  ],
  "final_confidence": <0..1>,
  "decision": "accept" | "needs_human_review",
  "disagreement_cause": "ambiguity_in_story" | "taxonomy_gap" | "annotation_error_suspected" | "model_instability" | "prompt_misinterpretation" | "multi_label_story",
  "why": "<curto resumo>",
  "action": "none" | "rewrite_story" | "extend_taxonomy" | "ask_human" | "rerun_models",
  "notes_for_human": "<opcional; null se não houver>"
}}

Regras:
- Prefira revisão humana se houver divergência ou baixa confiança.
- Só use módulos/operações listados na taxonomia ou 'n/a'. Não invente.
- Não use markdown nem cercas.

História de usuário:
{user_story}

Model outputs (JSON):
{model_outputs}
"""


FORMATTER_PROMPT = """\
You are a formatter.

Input: a JSON with items, each containing (Project, User Story, final_rows[]) where each row is a (Module, Operation) pair.

Output: return ONLY a CSV string with columns:
Project,User Story,Module,Operation

Rules:
- One CSV row per (Module, Operation).
- Repeat the same User Story across multiple rows if needed.
- If User Story contains commas, wrap it in double quotes and escape embedded quotes by doubling them.
- No blank lines before/after. No commentary.

JSON INPUT:
{ARBITER_JSON}
"""
