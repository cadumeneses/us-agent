# Preparação da escrita para ICSE 2027 Demonstrations

Pesquisa e inspeção local: 20/10/2026. O objetivo desta entrega é preparar skills próprias e o ponto de partida editorial para `main.tex`. O manuscrito existente foi preservado.

## Skills pesquisadas

Seleção por aderência à tarefa e inspeção das fontes dos autores; não é um ranking de popularidade nem um levantamento exaustivo.

| Skill/fonte | Utilidade | Decisão para este projeto |
| --- | --- | --- |
| [claude-latex-paper-skill](https://github.com/witold-andelie/claude-latex-paper-skill/blob/main/SKILL.md) | Escrita LaTeX com mapa de evidências, citações verificadas e revisão do PDF. | Aproveitar os princípios; adaptar o fluxo de relatório/tese ao artigo curto de demonstração. |
| [Scientific Writing, K-Dense](https://github.com/K-Dense-AI/scientific-agent-skills/blob/main/skills/scientific-writing/SKILL.md) | Procedência das alegações e consistência entre métodos, resultados e conclusões. | Adotar precisão e rastreabilidade com notas proporcionais ao artigo. |
| [Venue Templates, K-Dense](https://github.com/K-Dense-AI/scientific-agent-skills/blob/main/skills/venue-templates/SKILL.md) | Seleção de template e requisitos do destino. | Usar a chamada específica de 2027 como autoridade; evitar presumir acmart por associação do evento à ACM. |
| [Scientific Visualization, K-Dense](https://github.com/K-Dense-AI/scientific-agent-skills/blob/main/skills/scientific-visualization/SKILL.md) | Figuras reproduzíveis, acessíveis e fiéis aos dados. | Aplicar a gráficos; usar diagramas vetoriais e capturas reais para arquitetura e interface. |
| [AlterLab Scientific Writing, NVlabs/Skill2Env](https://github.com/NVlabs/Skill2Env/blob/main/SkillHub/skills/alterlab-scientific-writing/SKILL.md) | Escrita científica com referências de figuras/tabelas. | A organização IMRAD e diretrizes biomédicas não são pressupostos deste tool paper. |

As três skills locais foram escritas para o US-Agent; nenhuma coleção externa foi instalada nem seus scripts executados. Os links registram versões consultadas na branch principal, sujeitas a mudança. O antigo endereço K-Dense `claude-scientific-skills` atualmente redireciona para `scientific-agent-skills`.

## Skills próprias e uso

Destino de descoberta no projeto: `.agents/skills/`.

- [icse-demo-writing](../../.agents/skills/icse-demo-writing/SKILL.md): escrita, evidências, citações, revisão editorial e preparação do PDF.
- [icse-demo-figures](../../.agents/skills/icse-demo-figures/SKILL.md): diagramas editáveis, capturas reais e gráficos com procedência.
- [icse-demo-tables](../../.agents/skills/icse-demo-tables/SKILL.md): tabelas compactas com booktabs, interpretação e denominadores explícitos.

Exemplo de pedido: `Use $icse-demo-writing para revisar a introdução de main.tex com base nas evidências atuais do repositório.` Para uma figura ou tabela, invocar a skill correspondente. Elas também permitem seleção automática quando descobertas pelo ambiente.

As fontes normativas e os limites científicos estão nas referências da skill de escrita. As outras duas incluem snippets LaTeX de integração; seus exemplos não são figuras finais nem resultados medidos.

Validação concluída: as três skills passaram pelo `quick_validate.py` de `skill-creator`; os cinco links locais internos foram resolvidos; os oito arquivos instalados coincidem por SHA-256 com os arquivos preparados. PyYAML foi instalado apenas em `tmp/icse-skill-validator` para executar o validador, sem alterar as dependências do projeto. Os snippets ainda precisam ser integrados a um documento com assets reais e compilados. A descoberta automática das novas skills pela interface pode exigir uma nova sessão; os caminhos explícitos permitem sua leitura direta.

## Diagnóstico de main.tex

| Item observado | Consequência para a escrita |
| --- | --- |
| IEEEtran 10pt/conference e autores identificados | A base coincide com o formato indicado pela chamada consultada. |
| Ênfase em classificação e RNFs | Reconciliar com o escopo atual de recomendadores configuráveis, testes e riscos antes de mudar título/contribuição. O artigo não precisa narrar toda a aplicação. |
| Figura em caixa como placeholder | Desenhar um fluxo apoiado na implementação; não apresentá-la como figura pronta. |
| Autores/afiliação/email incompletos e vídeo ausente | Completar com dados reais antes da submissão. |
| `\bibliography{references}` sem `references.bib` | Verificar as duas citações e obter metadados nas fontes originais. Não inferir autoria/ano a partir das chaves. |
| “more traceable and controllable ... than ad-hoc prompting” no abstract | Exige comparação sustentada ou reformulação como mecanismo concreto, sem superioridade presumida. |
| Avaliação descrita em termos futuros e uso preliminar genérico | Substituir por evidência identificada, mantendo distinta a avaliação técnica e a coleta humana ainda não realizada. |
| Endereço público mencionado | Conferir acesso e versão efetivamente implantada; o checkout não comprova o deployment. |

Nenhum `pdflatex`, `latexmk` ou `tectonic` foi encontrado no PATH durante a preparação. Portanto não houve compilação, contagem de páginas ou inspeção visual do PDF. Essa limitação não determina se há uma distribuição TeX instalada fora do PATH.

## Recorte inicial proposto

Título de trabalho, ainda sujeito ao recorte dos autores: **US-Agent: Configurable and Traceable Recommenders for Software Engineering**.

Argumento inicial: a ferramenta explicita definições, taxonomias e bases versionadas, preservando políticas específicas e evidências das execuções. RNFs, a demonstração de equações para testes e riscos sem user stories ilustram variações desse mecanismo. Essa formulação é uma proposta editorial baseada em `docs/academico/artigo-us-agent.md`, não uma reivindicação de novidade já demonstrada frente à literatura.

Sequência sugerida: problema e público; mecanismo e implementação; um cenário de demonstração; verificação técnica e limites; posicionamento e disponibilidade. Integrar trabalho relacionado onde ele esclarece decisões. Ajustar seções ao argumento e ao espaço, sem estrutura obrigatória.

Planejamento visual: um diagrama do fluxo publicação–execução–evidência; uma captura focal da decisão do usuário, se legível e necessária; uma tabela pequena que distinga os três exemplos e a natureza de suas evidências. A seleção final depende do texto e do PDF.

Próximos dados necessários ao artigo: metadados dos autores, referências originais verificadas, versão pública acessível com instruções e vídeo real. As 23 condições preservadas não constituem 23 participantes/projetos independentes e não demonstram relevância empírica ou redução de esforço.

Fontes editoriais: [chamada oficial ICSE 2027](https://conf.researchr.org/track/icse-2027/icse-2027-demonstrations), [IEEEtran](https://ctan.org/pkg/ieeetran), [booktabs](https://ctan.org/pkg/booktabs) e [Wikipedia: Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing). A página da Wikipedia orienta a revisão de clareza e de generalidades; não é detector de autoria nem justifica ocultar uso de IA.
