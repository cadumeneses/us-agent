"""Extract Appendix A of Ramos (2019) into the app's task catalog.

Usage: python scripts/extract-ramos-task-catalog.py thesis.pdf
Requires pypdf. The output is checked in so the application does not need the PDF.
"""

import json
import sys
from collections import Counter
from pathlib import Path

from pypdf import PdfReader


OPERATIONS = {
    ("Autenticação", "Fazer login com usuário e senha"): ("Authentication", "Login with username and password", 13),
    ("Autenticação", "Fazer login com OAuth"): ("Authentication", "Login with OAuth", 3),
    ("Autenticação", "Recuperar senha"): ("Authentication", "Password recovery", 6),
    ("Autenticação", "Acessar pela primeira vez o sistema"): ("Authentication", "First login", 8),
    ("Autenticação", "Validar Permissão do Usuário"): ("Authentication", "Validate user permissions", 5),
    ("Autenticação", "Atualizar perfil"): ("Authentication", "Update profile", 7),
    ("Autenticação", "Criar conta"): ("Authentication", "Create account", 8),
    ("Autenticação", "Remover conta"): ("Authentication", "Remove account", 2),
    ("Cadastro", "Recuperação de Dados"): ("Registry", "Retrieve data", 14),
    ("Cadastro", "Atualizar dados"): ("Registry", "Update data", 8),
    ("Cadastro", "Inserir dados"): ("Registry", "Insert data", 9),
    ("Cadastro", "Modificar inserção de dados"): ("Registry", "Modify input behavior", 9),
    ("Cadastro", "Remover dados"): ("Registry", "Remove data", 6),
    ("Gerencial", "Visualizar painel"): ("Management", "View dashboard", 4),
    ("Gerencial", "Exportar relatório em PDF"): ("Management", "Export report to PDF", 9),
    ("Gerencial", "Exportar relatório em XLS"): ("Management", "Export report to XLS", 6),
    ("Gerencial", "Notificar via E-mail"): ("Management", "Notify by email", 7),
    ("Gerencial", "Notificar via aplicação"): ("Management", "Notify via app", 7),
}


def extract(pdf_path: Path):
    reader = PdfReader(pdf_path)
    lines = "\n".join(reader.pages[index].extract_text() or "" for index in (139, 140, 141)).splitlines()
    prefixes = sorted(OPERATIONS, key=lambda pair: len(" ".join(pair)), reverse=True)
    rows = []
    pending = None
    for raw in lines:
        line = raw.strip()
        match = next((pair for pair in prefixes if line.casefold().startswith(" ".join(pair).casefold() + " ")
                      or line.casefold() == " ".join(pair).casefold()), None)
        if match:
            module, operation, _ = OPERATIONS[match]
            title = line[len(" ".join(match)):].strip()
            if title:
                rows.append({"module": module, "operation": operation, "sourceModule": match[0], "sourceOperation": match[1], "title": title})
                pending = None
            else:
                pending = (module, operation, match[0], match[1])
        elif pending and line and not line.isdigit():
            rows.append({"module": pending[0], "operation": pending[1], "sourceModule": pending[2], "sourceOperation": pending[3], "title": line})
            pending = None
    counts = Counter((row["module"], row["operation"]) for row in rows)
    for module, operation, expected in OPERATIONS.values():
        actual = counts[(module, operation)]
        if actual != expected:
            raise ValueError(f"{module}/{operation}: expected {expected} tasks, found {actual}")
    if len(rows) != 131:
        raise ValueError(f"Expected 131 tasks, found {len(rows)}")
    return rows


if __name__ == "__main__":
    source = Path(sys.argv[1])
    output = Path("apps/web/src/data/ramos-task-catalog.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(extract(source), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote 131 task categories from Appendix A to {output}")
