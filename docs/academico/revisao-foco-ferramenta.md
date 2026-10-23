# Revisão do artigo com foco na ferramenta

20/10/2026. Solicitação: analisar o produto de ponta a ponta, mostrar seus pontos fortes e tornar a narrativa e as figuras mais envolventes. O recorte de plataforma configurável e rastreável e a indefinição do nome foram preservados.

## O que mudou na narrativa

O artigo passa a acompanhar o trabalho de quem usa a aplicação: preparar contexto, obter classificações revisáveis, escolher um recomendador, examinar sugestões e preservar decisões/adaptações. Configuração e evidência aparecem como capacidades que permitem essas ações. A descrição técnica e as ressalvas empíricas ficam concentradas onde delimitam as alegações.

Título descritivo de trabalho: “From Project Knowledge to Reusable Software Artifacts: A Configurable Recommendation Workspace”. Não fixa o nome da ferramenta, que continua concentrado na macro `\toolname`.

Os benefícios são apresentados por mecanismos observáveis: reaproveitamento dos dados preparados da história; escolha explícita da base; origem e contribuições visíveis; atributo categórico configurado que participa do cálculo; cópias adaptadas com histórico; replay dos snapshots. Não foram criadas alegações de aumento de precisão, redução de tempo, superioridade ou validação com pessoas.

## Análise de ponta a ponta

Inspeção estática da interface, dos serviços relevantes, dos contratos e da evidência preservada; esta revisão não executou o produto com banco/provedores nem verificou o deployment.

| Etapa/capacidade | Implementação inspecionada | Valor mostrado e limite |
| --- | --- | --- |
| Navegação do produto | `apps/web/src/App.tsx`, `components/AppLayout.tsx` | Projetos, classificação, revisão, recomendadores, taxonomias, dashboard e acesso pertencem ao mesmo workspace. |
| Projeto, histórias e tarefas | `pages/ProjectDetailsPage.tsx`, `components/ResearchProfile.tsx` | Preparação anterior à classificação; identidade e dados preparados são preservados. |
| Classificação | `pages/ClassifyPage.tsx`, `apps/api/src/services/ai-classifier.ts`, `classification-policy.ts` | Pares módulo/operação validados na taxonomia, votos e razões de revisão; confiança não é probabilidade calibrada. |
| Revisão e feedback | `pages/ReviewPage.tsx`, `apps/api/src/routes/api.ts`, `services/classification-store.ts` | Correção/confirmação e propostas de lacunas/extensão; não implica evolução autônoma da taxonomia. |
| Três recomendações | `pages/RecommendersPage.tsx`, `components/ProjectRiskRecommendations.tsx` | Contexto muda por método; riscos não exigem história. RNFs oferecem base publicada ou histórico explicitamente. |
| Configuração/importação | `pages/RecommenderSetupPage.tsx`, `components/RecommenderEditors.tsx`, `DatasetImporter.tsx`; contratos de definição já inspecionados | Atributos, taxonomias e catálogos publicados, mapeamento e prévia. Novos métodos arbitrários não surgem apenas de configuração. |
| Resultado explicado | `components/ConfiguredRunDetails.tsx`, `ProjectRecommendationDetails.tsx` | Origens, vizinhos, dimensões/contribuições e exclusões conforme método; similaridade não estima ocorrência do risco. |
| Decisão e adaptação | `components/ConfiguredRunReview.tsx`, `NfrAdaptation.tsx`, `TestCaseAssessment.tsx` | Decisões/cópias separadas; riscos não têm aceitação/adaptação operacional. |
| Histórico/replay/exportação | `ConfiguredRunDetails.tsx`; `apps/api/src/services/configurable-runs.ts`, inspecionado na redação inicial | Snapshots e comparações com implementação compatível; não garante reprodução em runtime arbitrário. |
| Taxonomias | `pages/TaxonomyPage.tsx` | Publicações independentes para atributos; catálogo de classificação permanece uma área própria, sem alegar unificação total. |
| Papéis/autoria/auditoria | `pages/AccessPage.tsx`, `apps/api/src/app.ts`, `security/organization-access.ts` | Papéis por organização e registros de atores; inspeção não é auditoria de segurança ou confirmação de produção. |
| Dashboard | `pages/DashboardPage.tsx` | Visão operacional de volume/confiança/pendências; não é avaliação empírica de precisão. |

## Figuras e reprodução

- `figures/recommender-workflow.svg`: jornada colorida com três alternativas, editável; PDF vetorial integrado como figura de duas colunas. Cores e rótulos têm papéis consistentes.
- `figures/configured-feature.svg`: comparação de `team_distribution`, gerada diretamente de `report.json → content.configuredFeature`. Mesmas definição/base, entradas distributed/co-located, vizinhos reference-b/reference-a, similaridades 88,2%/100,0% e distâncias 2/0.
- `figures/tool-risk-interface.png`: cópia byte a byte de `docs/evidencias/project-risks-2026-10-19/project-risks-desktop.png`. A seleção visual da área de resultado é feita por clipping no LaTeX, sem recriar nem alterar a interface. É captura histórica local com dados sintéticos.
- `scripts/build-paper-figures.py`: gera SVG e HTML usando apenas a biblioteca padrão Python.
- `scripts/render-paper-figures.ps1`: renderiza HTML com Edge headless em PDFs e PNGs. Os SVGs continuam sendo as fontes editáveis; alterar o script e regenerar evita divergência entre fonte e preview.

Comandos, na raiz:

```powershell
.venv/Scripts/python.exe scripts/build-paper-figures.py
powershell -NoProfile -File scripts/render-paper-figures.ps1
```

As duas figuras esquemáticas foram renderizadas e seus PNGs inspecionados. Cada PDF tem uma página com tamanho próprio e texto vetorial. Isso verifica os assets, não a paginação do artigo. A captura foi inspecionada na resolução preservada; o tamanho final no artigo requer revisão do PDF compilado.

## Tratamento das referências fornecidas

O anexo contém 62 entradas e 40 chaves únicas, com duplicações e variantes incompatíveis. Não foi importado integralmente para `references.bib`.

| Referência | Tratamento |
| --- | --- |
| Taxonomia WIS/2020 | Incorporada sob `dilorenzo2020wis`, com metadados enviados pelo autor; texto primário dos autores disponível em ResearchGate foi aberto. Não duplicar as chaves taxonomy/2019 para o mesmo DOI. |
| TestRec/SAC 2026 | Incorporada sob `dilorenzo2026testrec`, conforme metadados fornecidos agora pelo autor. O programa oficial SAC confirma título/autores; a leitura metodológica preservada no repositório delimita a demonstração local. Acesso novo ao texto integral continua indisponível nesta revisão. |
| QUS/AQUSA | Incorporado `lucassen2016quality`, com página primária Springer consultada. Não duplicar o artigo sob improving nem adicionar a demo separada sem necessidade para o argumento. |
| Classificação LLM/SBES 2025 | Incorporada a entrada fornecida `desouza2025automating`, usada apenas para seu tema declarado. Há variantes autorais no anexo; a conferência final no registro da SBC continua pendente. O bloqueio de acesso não foi interpretado como confirmação. |
| NFRec e ARISE | Preservadas as duas entradas já incluídas, com o registro das fontes da redação anterior. |
| Entradas 2018 de Perkusich, placeholders anônimos, classificadores/surveys e demais candidatos | Não usados. Há títulos/autores/anos conflitantes e chaves provisórias; exigir fonte específica antes de citar. As referências restantes podem servir a outro recorte, mas não precisam ocupar o artigo curto. |

Fontes consultadas: [taxonomia WIS — manuscrito dos autores](https://www.researchgate.net/publication/341840605_Enabling_the_Reuse_of_Software_Development_Assets_Through_a_Taxonomy_for_User_Stories), [QUS/AQUSA — Springer](https://link.springer.com/article/10.1007/s00766-016-0250-x), [programa oficial SAC 2026](https://www.sigapp.org/sac/sac2026/file2026/SAC26-FinalProgramv1.3.pdf). Os metadados fornecidos pelo autor são identificados como tal; não se afirma verificação primária integral de todas as entradas.

## Validação e pendências

Passaram os checks locais de chaves/environments, labels/citações, assets incluídos e contagens da tabela contra `report.json`. As seis chaves BibTeX são únicas. Os vizinhos e percentuais da figura comparativa coincidem com `configuredFeature`. A captura copiada preserva o SHA-256 `d4e854ca6fdc910de7799006f033c373b604038f6df6033d28c693470f75e43d`, igual ao original. Cada PDF de figura tem uma página; os PNGs foram examinados visualmente. O nome provisório, vídeo e URLs de acesso continuam pendentes. Não foi instalado TeX: compilar IEEEtran/BibTeX, medir quatro páginas e revisar colocação/legibilidade de todas as figuras continuam necessários antes da submissão.
