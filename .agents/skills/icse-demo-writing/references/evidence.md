# US-Agent evidence map

Paths below are relative to repository root. Snapshot inspected 2026-10-20; re-read relevant sources before drafting. These are discovery pointers, not permanent proof of current behavior.

| Subject | Local source | Boundary to retain |
| --- | --- | --- |
| Current scope | `README.md`; `docs/academico/artigo-us-agent.md` | Three configurations: NFRs, test-case equation demonstration, project risks. The existing `main.tex` emphasizes an earlier classification/NFR scope. |
| Implemented architecture | `docs/arquitetura-executada.md`; its linked implementation paths | Shared KNN kernel with distinct representation, eligibility, and aggregation policies. Check actual files for implementation claims. |
| User demonstration | `docs/tutorial-three-recommenders.md` | Tutorial instructions are not participant observations. Use one coherent scenario and only supported branches. |
| Technical evidence | `docs/avaliacao-integrada.md`; `docs/evidencias/integrated-demonstration-v1/summary.md`; its manifest/report | 23 preserved conditions: 13 NFR, 6 tests, 4 risks. They share inputs and are not independent samples. Recheck outputs before quoting counts. |
| Methodological fidelity | `docs/referencias-e-fidelidade.md` | Resolve original papers and metadata; TestRec equation demonstration is not a reproduction of the original empirical experiment. |
| Planned human study | `research/configuration-effort-v3/protocol.md`; `docs/estudo-tres-casos-v3.md` | Protocol and instrument preparation do not establish collected data, usability, configuration effort, or relevance. |
| Access and adaptations | `docs/entregas/042-fechamento-tecnico-e-preparacao-empirica.md`; `docs/acesso-organizacoes-e-auditoria.md`; `docs/adaptacao-rnf.md` | Local verification does not establish production deployment or security against privileged operators. |

## Claims requiring particular care

- Technical replay supports repeatability within its recorded dependencies/runtime. It does not show empirical recommendation accuracy, classification quality, or user effort.
- Keep artificial NFR/test relevance annotations identified as synthetic and separate by method. Do not combine them into a platform accuracy score. Risk outputs are not their own ground truth.
- Report blocked, empty, and deliberately failing conditions with explicit denominators; do not remove them to inflate a success percentage.
- A controlled configured-feature example can illustrate a changed neighbor; it does not establish general superiority or a causal effect across projects.
- Confidence scores and review routing do not establish calibrated probabilities or measured benefits of human intervention.
- Distinguish a planned live demo from a currently reachable deployment. Verify the exact deployed version and reviewer access before claiming public availability of new features.
- `main.tex` currently references `references.bib`, which was absent during preparation; the two cite keys therefore remain unverified, not usable metadata.
