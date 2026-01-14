import os
from dotenv import load_dotenv
from agent.orchestrator import committee_classify, arbitrate_if_needed
from agent.providers.openai_provider import OpenAIProvider
from agent.storage import append_jsonl

from agent.providers.http_provider import HttpJSONProvider
from agent.providers.gemini_provider import GeminiProvider

TAXONOMY = """\
Registry
- Insert data
- Retrieve data
- Update data
- Remove data
- Modify input behavior

Authentication
- Login with username and password
- Login with OAuth
- Password recovery
- First login
- Validate user permissions
- Update profile
- Create account
- Remove account

Management
- View dashboard
- Export report to PDF
- Export report to XLS
- Notify via app
- Notify by email
"""


def read_user_stories() -> list[str]:
    """
    Lê US em uma linha separadas por ponto e vírgula (;).
    Evita quebrar quando a própria US contém vírgulas.
    """
    raw = input("Digite as US separadas por ponto e vírgula (;): ").strip()
    if not raw:
        return []
    return [s.strip() for s in raw.split(";") if s.strip()]


def main():
    load_dotenv()

    project = input("Nome do projeto (enter para 'n/a'): ").strip() or "n/a"
    user_stories = read_user_stories()
    if not user_stories:
        print("Nenhuma US informada. Encerrando.")
        return

    providers: list[tuple[str, object]] = []

    openai = None
    openai_api_key = os.getenv("OPENAI_API_KEY", "")
    if openai_api_key:
        openai = OpenAIProvider(model=os.getenv("OPENAI_MODEL", None))
        providers.append(("openai", openai))
    else:
        print("Aviso: OPENAI_API_KEY não definido; OpenAI será ignorado.")

    # Gemini via SDK google-genai
    gemini_api_key = os.getenv("GEMINI_API_KEY", "")
    gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    gemini = None
    if gemini_api_key:
        gemini = GeminiProvider(api_key=gemini_api_key, model=gemini_model)
        providers.append(("gemini", gemini))
    else:
        print("Aviso: GEMINI_API_KEY não definido; Gemini será ignorado.")

    # Deepseek via HTTP (formato OpenAI)
    deepseek = HttpJSONProvider(
        base_url=os.getenv("DEEPSEEK_BASE_URL", ""),
        api_key=os.getenv("DEEPSEEK_API_KEY", ""),
        model=os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
        name="deepseek",
    )
    if deepseek.base_url:
        providers.append(("deepseek", deepseek))
    else:
        print("Aviso: DEEPSEEK_BASE_URL não definido; Deepseek será ignorado.")

    if not providers:
        print("Nenhum provedor configurado. Defina GEMINI_API_KEY ou DEEPSEEK_BASE_URL no .env.")
        return

    arbiter_provider = deepseek if deepseek.base_url else providers[0][1]

    for us in user_stories:
        committee = committee_classify(user_story=us, taxonomy=TAXONOMY, providers=providers)
        final = arbitrate_if_needed(committee, taxonomy=TAXONOMY, arbiter_provider=arbiter_provider)
        final["project"] = project
        append_jsonl("runs/results.jsonl", final)
        print(f"[{project}] {us} -> {final['final']}")


if __name__ == "__main__":
    main()
