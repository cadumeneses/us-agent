"""Extract Appendix D of Ramos (2019) into optional RNF examples.

Usage: python scripts/extract-ramos-nfr-catalog.py thesis.pdf
Requires pypdf. The application reads the checked-in JSON, not the PDF.
"""

import json
import sys
from pathlib import Path

from pypdf import PdfReader


ATTRIBUTES = {
    "Performance": ("response time", "capacity", "transit delay", "efficiency compliance"),
    "Reliability": ("availability", "integrity", "fault tolerance", "recoverability"),
    "Security": ("confidentiality", "access control", "authentication"),
}
PREFIXES = sorted(
    ((f"{kind} {attribute}", kind, attribute.replace(" ", "_"))
     for kind, attributes in ATTRIBUTES.items() for attribute in attributes),
    key=lambda item: len(item[0]), reverse=True,
)


def extract(pdf_path: Path):
    reader = PdfReader(pdf_path)
    lines = "\n".join(reader.pages[index].extract_text() or "" for index in (155, 156, 157)).splitlines()
    rows = []
    current = None
    for raw in lines:
        line = raw.strip()
        match = next((entry for entry in PREFIXES if line == entry[0] or line.startswith(entry[0] + " ")), None)
        if match:
            if current:
                current["sentence"] = " ".join(current["sentence"].split())
                rows.append(current)
            prefix, kind, attribute = match
            current = {"type": kind, "attribute": attribute, "sentence": line[len(prefix):].strip()}
        elif current and line and not line.isdigit() and line != "Tipo Atributo Sentença":
            current["sentence"] += " " + line
    if current:
        current["sentence"] = " ".join(current["sentence"].split())
        rows.append(current)
    if not rows or any(not row["sentence"] for row in rows):
        raise ValueError("Failed to extract the RNF sentences")
    return rows


if __name__ == "__main__":
    output = Path("apps/web/src/data/ramos-nfr-catalog.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    rows = extract(Path(sys.argv[1]))
    output.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(rows)} RNF examples from Appendix D to {output}")
