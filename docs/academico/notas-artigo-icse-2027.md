# Primeira versão LaTeX — ICSE 2027

Registro histórico da primeira redação. Para o texto e as figuras atuais, consultar [a revisão com foco na ferramenta](revisao-foco-ferramenta.md); ela substitui as decisões visuais e atualiza o estado das referências descritos abaixo.

20/10/2026. O autor confirmou o recorte de plataforma configurável e rastreável, com RNFs, demonstração de equações de testes e riscos. O texto está em inglês. O nome está em aberto: a macro `\toolname` concentra o marcador `ToolName`; o título descritivo não fixa uma marca.

## Decisões de redação

O argumento acompanha configuração/publicação, execução e inspeção/replay. O exemplo principal de riscos mostra uma característica que participa do cálculo sem exigir user story. RNFs e testes delimitam como o fluxo comum preserva políticas distintas. Classificação aparece como preparação, sem alegação de benefício medido por IA.

Os sete autores, sua ordem, afiliações e e-mails foram fornecidos pelo usuário e convertidos de ACM para IEEEtran. A figura TikZ editável está em `figures/recommender-workflow.tex`; não é captura da interface. A tabela agrega “sem candidatos” e “sem itens” em Empty, sem eliminar condições. O arquivo anterior foi preservado em `tmp/main-before-icse-writing.tex`.

## Mapa de alegações

| Alegação | Fonte consultada e localizador | Natureza/limite |
| --- | --- | --- |
| Atributos, papéis e representações | `apps/api/src/domain/recommender-definition.ts`: `attributeDefinitionSchema`, `recommenderDefinitionSchema` | Código; não há codificação genérica de texto/número como característica. |
| Núcleo e políticas distintos | `apps/api/src/services/knn.ts`: `KnnPolicy`, `rankNeighbors` | Código; elegibilidade/representação/medida/desempate vêm da política; agregação externa. |
| Publicação | `apps/api/src/services/recommender-definitions.ts`: `record`, `saveDefinitionDraft`; `docs/arquitetura-executada.md` | Código e contrato documentado; não é auditoria de implantação. |
| Integridade e replay de riscos | `apps/api/src/services/configurable-runs.ts`: `record`, `createConfigurableRun`, `replayConfigurableRun` | Código; compara result/explanation/projection e confere versões. |
| Stack | `apps/web/package.json`; `apps/api/package.json`; import de pool em `configurable-runs.ts` | Código/dependências, sem inferir versão em produção. |
| Distribuição da equipe muda o vizinho | `docs/tutorial-three-recommenders.md`, “Project risks and a new calculation attribute”; pacote técnico preservado | Exemplo sintético; comparação entre entradas na mesma v2, peso 5 e k=1. |
| 23 condições, 8/8 compatibilidade, quatro riscos | `docs/evidencias/integrated-demonstration-v1/summary.md`, `report.json`, `scenarios.csv` | Resultados preservados, sem alegar nova coleta ou independência. |
| Avaliação e adaptação separadas | `docs/adaptacao-rnf.md`; tutorial e arquitetura | Documentação do release, sem nova verificação de navegador. |
| Estudo planejado | `research/configuration-effort-v3/protocol.md`: Proposed design, Checkpoints, Analysis | Proposta aguardando revisão; sem coleta inferida. |

## Fontes bibliográficas

- `ramos2025nfr`: [manuscrito dos autores](https://www.researchgate.net/publication/389646847_A_Data-Driven_Recommendation_System_for_Enhancing_Non-Functional_Requirements_Elicitation_in_Scrum-Based_Projects), cabeçalho, abstract e apresentação de NFRec. Os nomes seguem a lista impressa: a interface do ResearchGate associa ao quarto perfil um nome divergente. Volume/paginação constam do registro do artigo. Conferir versão IEEE final antes da submissão; metadados editoriais provisórios impressos no PDF não foram copiados.
- `sousa2026arise`: primeira página e abstract do PDF primário local `1-s2.0-S0164121226002207-main.pdf`, com título, oito autores, DOI, volume 241, ano 2026 e número 112987. Resultados de ARISE não foram atribuídos à ferramenta.
- TestRec/SAC: leitura histórica em `docs/revisao-artigo-ednaldo-e26.md`; o DOI não retornou texto nesta sessão e o PDF histórico não foi localizado na árvore pesquisada. Não foi criada referência com base apenas em índices/memória. Incorporar a fonte original continua pendente.

## Pendências

1. Nome definitivo; substituir macro e revisar título/abstract conforme necessário.
2. Vídeo real no fim do abstract e URLs públicas de ferramenta/instruções, com versão e acesso conferidos. Os marcadores visíveis identificam uma versão de trabalho.
3. Ampliar posicionamento com fontes originais sobre TestRec e ferramentas comparáveis de configuração/rastreabilidade. A redação atual não estabelece prioridade científica ou revisão exaustiva.
4. Compilar IEEEtran, BibTeX e TikZ, examinar o PDF e conferir as quatro páginas totais. Nenhum motor TeX foi localizado no PATH; paginação e legibilidade visual continuam pendentes.
5. Revisão dos autores sobre contribuição, terminologia e limites. Avaliações empíricas continuam futuras.

Não se afirma implantação atual verificada, redução de esforço medida, probabilidade calibrada, reprodução integral dos métodos originais ou coleta humana a partir de fixtures.

## Verificações desta redação

Passaram as verificações locais de chaves/environments, correspondência de citações com as duas entradas BibTeX, labels/referências, existência do arquivo da figura e sete entradas de autores. Os valores da tabela foram reconciliados diretamente com as 23 linhas de `report.json`, incluindo os estados vazios e as duas falhas esperadas. A comparação de distribuição da equipe coincide com `configuredFeature` do mesmo relatório. `git diff --check` não apontou problemas nos arquivos rastreados. Esses checks são limitados à fonte e aos dados; não substituem compilação, BibTeX ou revisão visual.
