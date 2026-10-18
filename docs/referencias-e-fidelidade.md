# Referências e fidelidade metodológica

Atualização: 18/10/2026. Este documento acompanha o [plano](plano-evolucao-us-agent.md) e deve ser revisado em cada mudança que afete atributos, representação, filtros, distância, vizinhos ou avaliação.

## 1. Fontes efetivamente disponíveis

| ID | Fonte | Situação nesta análise |
| --- | --- | --- |
| REQ | `C:\Users\cadue\Downloads\US-Agent_Requisitos_e_Lacunas.md`, v1.0, 17/10/2026 | Lido integralmente. Relata áudios e auditoria de outro commit; aceites são propostas do documento. |
| F19 | Felipe Barbosa Araújo Ramos. *Recomendação de Requisitos Não Funcionais em Projetos Ágeis Baseados em Scrum*. Tese, UFCG, 2019. | PDF local consultado, inclusive método e protocolo. É a fonte declarada da implementação RNF atual. |
| E21 | Ednaldo Dilorenzo de Souza Filho. *Uma Abordagem para Recomendação de Casos de Teste em Projetos Ágeis Baseados no Scrum*. Tese, UFCG, 2021. | PDF local consultado, especialmente §§4.4–4.5 e capítulo 5. |
| F25 | Ramos e colaboradores. *A Data-Driven Recommendation System for Enhancing Non-Functional Requirements Elicitation in Scrum-Based Projects*. IEEE Access, 2025. DOI `10.1109/ACCESS.2025.3548631`. | Texto da versão dos autores consultado parcialmente, com foco no método e avaliação. Conferir versão final antes de fixar o contrato científico. [Texto dos autores](https://www.researchgate.net/publication/389646847_A_Data-Driven_Recommendation_System_for_Enhancing_Non-Functional_Requirements_Elicitation_in_Scrum-Based_Projects). |
| E26 | Dilorenzo e colaboradores. *Recommending Test Cases in Agile Software Development with a Taxonomy-Guided KNN Approach*. SAC 2026. DOI candidato `10.1145/3748522.3779891`. | Título e autores confirmados no [programa oficial do SAC](https://www.sigapp.org/sac/sac2026/file2026/SAC26-FinalProgramv1.3.pdf); texto integral não obtido nesta análise. A página ACM retornou 403. O DOI foi localizado em indexação bibliográfica e deve ser conferido na cópia primária. |
| A26 | *ARISE: A framework for automated risk identification in Scrum using memory-based recommendation*. JSS, DOI `10.1016/j.jss.2026.112987`. | Candidato forte ao trabalho de Ademar: [resumo na editora](https://www.sciencedirect.com/science/article/pii/S0164121226002207). Confirmar com a orientação a referência pretendida e consultar texto/material completos. |

Os PDFs locais estão na raiz do repositório, com prefixos `2019_FelipeRamos_` e `2021_EdnaldoFilho_`. Eles estavam fora do controle de versão na inspeção; registrar referências e hashes não significa incorporar os PDFs ao Git.

Hashes SHA-256 dos arquivos consultados:

```text
REQ ebd40a483ed6e64ee2cbcb5b3eeecd77111f5825c1e90fad085d269a5eb85e7b
F19 a1e7092095f5d5f3139e5a2e9e6f5a756fbfe61a5d7bd086852026066cd371d7
E21 f69cd99f2a68b2cc349bcb294f0873439d31c0a93a50272c3d6668740a1eee53
```

## 2. Matriz inicial dos métodos

As regras abaixo para Ednaldo são da **tese E21**, não uma afirmação sobre o conteúdo de E26. Páginas impressas e páginas do arquivo são distinguidas para facilitar a conferência.

| Aspecto | Felipe — F19 | Ednaldo — E21 | Consequência para o US-Agent |
| --- | --- | --- | --- |
| Alvo e saída | RF/US alvo → RNFs associados a RFs vizinhos. §§5.2–5.3. | US alvo → casos de teste recuperados, ranqueados e passíveis de cópia/adaptação. §§4.5.1 e 4.5.4. | Tipo de saída e associação ao artefato precisam ser configuráveis. |
| Atributos | Perfil do projeto, tecnologias e tarefas; módulo/operação na pré-filtragem; objetivo exclui protótipos. §§5.2–5.3, tabela 5.7. | Módulo, operação, plataforma, domínio, critérios de aceitação e RNFs. Tabelas 4.5–4.6, pp.55–56 (PDF 69–70). | Papéis de característica e filtro devem ser independentes. |
| Critérios de aceitação | Não são as dimensões do método RNF atual. | Conjunto de 59 critérios padrão definido a partir de 200 critérios; templates funcionais/não funcionais. §4.4.1, pp.46–48 (PDF 60–62). Só exemplos são apresentados nesse trecho. | Configurar catálogo com IDs; não inventar hierarquia nem afirmar que a lista completa foi recuperada. |
| Representação | Dimensões binárias das características do alvo; extras exclusivos do candidato não penalizam. Tabela 5.7. | Comparação binária com o alvo; CA/RNF multivalorados geram dimensões próprias. §4.5.3. | Reaproveitar mecanismo de representação quando equivalente, mantendo listas de atributos por perfil. |
| Elegibilidade | Filtro módulo/operação e exclusão de protótipos. §5.3.3. | Módulo/operação aparecem como dimensões, permitindo correspondências parciais no exemplo. §4.5.3. | Evitar aplicar o filtro rígido do RNF ao caso de testes sem confirmação científica. |
| Distância e k escolhidos | Manhattan normalizada e k=1. §5.3.3. | Euclidiana e k=3, conforme escolha em §5.6, pp.80–81 (PDF 94–95). | Expor políticas distintas; conferir como a distância Euclidiana é convertida em similaridade. |
| Desempate | Menor ID é uma política atual do US-Agent, não confirmada como regra original. | Heurística favorece US com mais casos de teste quando há empate. §4.5.5, pp.59–60 (PDF 73–74). | Política de empate integra o contrato versionado; eventual empate residual precisa de decisão explícita. |
| Agregação | Coocorrência ponderada pela similaridade; com um vizinho, score igual à similaridade. §§5.3.2–5.3.3. | Soma das similaridades dos vizinhos associados ao item, dividida por K, segundo equação 4.3 e explicação. §4.5.4, p.58 (PDF 72). | Uma agregação fixa para todos os exemplos é insuficiente. Conferir as inconsistências dos exemplos antes de fixar equivalência. |
| Adaptação | Resultado bruto recupera sentença. Adaptação do US-Agent deve preservar origem. | Reuso cria cópia editável, inclusive passos e descrição. §4.5.4, pp.58–59. | Guardar identidade de origem e separar recomendação bruta de cópia adaptada. |
| Avaliação | Leave-2-out por projeto; tese descreve 13 projetos, com 2 no teste e 11 na referência. §6.1.4, pp.79–81. | Validação cruzada 10-fold, precisão/recall e F-measure com β=2; comparação de k, distâncias e uso da heurística. §§5.4–5.6. | Versionar protocolos por método e separar ajuste de configuração da avaliação final. |

A versão dos autores de F25 confirma Manhattan, k=1 e o exemplo com similaridades 1 e 1/3. Também descreve leave-2-out por projeto. Isso apoia a continuidade da direção atual, mas não comprova equivalência do US-Agent com NFRec. [Fonte: artigo de Felipe](https://www.researchgate.net/publication/389646847_A_Data-Driven_Recommendation_System_for_Enhancing_Non-Functional_Requirements_Elicitation_in_Scrum-Based_Projects).

O resumo de A26 descreve recomendação de riscos por perfis de projeto e seleciona Manhattan com k=2. A editora informa material de ciência aberta validado. Localizar esse material e verificar atributos, saída e fórmulas antes de implementar; o resumo não basta para fechar o método. [Fonte: JSS/ARISE](https://www.sciencedirect.com/science/article/pii/S0164121226002207).

## 3. Questões que a leitura já revelou

### Q01 — Distância Euclidiana e similaridade no caso de Ednaldo

E21 compara seis medidas e escolhe Euclidiana com k=3 e heurística. Entretanto, a equação 4.2, p.58, apresenta a forma de Manhattan normalizada; o trecho de p.74 (PDF 88) sobre equivalência de distâncias não resolve de maneira inequívoca a transformação usada no código para o ranking.

**Ação:** conferir E26, implementação original e/ou esclarecimento dos autores. Registrar fórmula, normalização e exemplos numéricos. Distâncias podem produzir a mesma ordem de vizinhos e pesos distintos nos itens; a igualdade da ordem não demonstra igualdade da recomendação final. Enquanto a decisão estiver aberta, não anunciar que Manhattan k=3 reproduz TestRec.

### Q02 — Equação de agregação versus valores ilustrados

E21, equação 4.3, divide a soma ponderada por K. O exemplo de CT03 com similaridades 0,50, 0,87 e 0,75 resulta em aproximadamente 0,71. A releitura de 18/10/2026 confirmou que CT04 também coincide: (0,87+0,75)/3=0,54. Para CT01, descrito no texto como associado apenas a e6, a equação produz 0,75/3=0,25, enquanto o texto informa 0,42. A dúvida fica delimitada a essa divergência e à conciliação das associações com as figuras/código.

**Ação:** reconstruir uma tabela de associações e recalcular cada item; conferir figuras visualmente, artigo e código. Registrar a interpretação escolhida e sua fonte. Dados ilustrativos não devem virar um oráculo de teste contraditório.

Em B16a, a [auditoria numérica e demonstração](testrec-equacoes-demonstracao.md) executa as equações explícitas 4.2/4.3 com regras técnicas identificadas. Os valores CT03/CT04 e a divergência CT01 são verificáveis; não foi reconstruído o grafo completo das figuras nem encerrada Q02. O perfil demonstrativo Manhattan não reproduz automaticamente a escolha Euclidiana de §5.6 ou o artigo E26.

### Q03 — Métrica reportada na tese de Ednaldo

Na p.81 (PDF 95), são reportados precisão de 37,8%, recall de 67,5% e F2 de 80%. Aplicar a equação 5.4 às duas primeiras proporções produz aproximadamente 58,3%, não 80%. Médias por unidade e outras agregações precisam ser examinadas antes de concluir a origem da divergência.

**Ação:** obter resultados por fold/alvo e identificar denominadores, agregação e eventual correção no artigo. Essa é uma questão de consistência a esclarecer, não uma meta de qualidade para copiar nem uma conclusão sobre a implementação original. O relatório do US-Agent deve exportar contagens e permitir recálculo das métricas.

### Q04 — Quais dados estão disponíveis

Os PDFs existem localmente; bases, relações completas e código original ainda não foram confirmados nesta análise. Os catálogos de RNFs/tarefas e os registros `fa`, `f4`, `f5` são materiais de demonstração documentados em [motor-rnf.md](motor-rnf.md). Não representam todos os projetos originais.

**Ação:** criar inventário com origem, versão, licença/autorização, entidades, relações, quantidade, hash e limitações. Tratar datasets de publicações diferentes como versões distintas até comprovar sua correspondência. A pendência da base de um método não impede ensaios de correção nem a implementação da infraestrutura comum.

### Q05 — Atualização das referências

O artigo SAC e o JSS candidatos são mais recentes que as teses locais. Confirmar se são os textos pretendidos pelo professor. O arquivo histórico [reformulacao-us-agent.md](reformulacao-us-agent.md) descreve o recorte anterior somente RNF; o plano atual amplia o escopo futuro e preserva esse documento como histórico.

**Ação:** para cada publicação, registrar data/versão, páginas lidas e correspondência com a tese. Quando uma publicação não detalhar uma decisão, usar a tese como complemento identificado. Não misturar versões em um perfil chamado genericamente “método do autor”.

## 4. Contrato científico por recomendador

Antes de publicar um perfil científico, preencher esta ficha:

| Campo | Conteúdo obrigatório |
| --- | --- |
| Identificação | ID/versão do perfil, referência exata e hash do documento obtido. |
| Entrada/saída | Artefato, atributos, cardinalidades e esquema do item recomendado. |
| Representação | Dimensões, normalização, ausências e valores desconhecidos. |
| Elegibilidade | Filtros, exclusão do alvo, restrições por projeto e mapeamento entre taxonomias. |
| Vizinhança | Distância/similaridade, k, desempates, comportamento com candidatos insuficientes. |
| Itens | Identidade, deduplicação, agregação, ordenação e comportamento sem itens. |
| Dados | Base, associações, permissão, versões, hashes e separação dos alvos. |
| Avaliação | Partições, ajuste de hiperparâmetros, métricas, agregação e tratamento de vazios. |
| Evidência | Fonte e seção por regra; exemplo manual, testes e saída reproduzível. |
| Diferenças | Adaptações do US-Agent, justificativa, efeito esperado e questões em aberto. |

Classificação de fidelidade a usar nos relatórios: **confirmado na fonte**, **adaptação explícita**, **pendente de confirmação** ou **não implementado**. A autoria de uma revisão deve ser registrada quando a revisão acontecer, sem atribuir validação antecipada ao professor ou aos autores.

Toda mudança que afete recomendação deve revisar esta ficha e o teste de referência. Melhorias como embeddings, pesos, geração por LLM ou adaptação automática precisam de outro perfil experimental e comparação sobre os mesmos alvos permitidos.

Na entrega B08, taxonomias independentes e vínculos por ID foram acrescentados à infraestrutura. A árvore de critérios incluída é sintética e não representa uma hierarquia inferida do catálogo de Ednaldo. Os campos científicos do RNF seguem por nomes até um mapeamento explícito; os oito resultados congelados continuam iguais, inclusive quando a simulação recebe dois novos catálogos de contexto. Não houve obtenção de novas fontes nem encerramento de Q01–Q05 nessa entrega.

Em B10, os mesmos conjuntos de demonstração foram importados/publicados por API e comparados com os oito resultados congelados. O importador preserva origem, arquivo, rótulos e associações; não reclassifica a base nem altera elegibilidade/distância do RNF. Isso acrescenta evidência de compatibilidade do fluxo de dados, sem converter as reconstruções em datasets originais ou encerrar as questões metodológicas de Ednaldo.

Em B11, a política RNF foi separada do núcleo KNN e executada com base explicitamente escolhida e evidência persistida. As oito saídas completas e casos adicionais continuaram compatíveis com o legado, que foi preservado. O mapeamento explícito de IDs para nomes não usa rótulos de apresentação como equivalência implícita. O núcleo não carrega filtros RNF por padrão; a política de Ednaldo continua pendente de fonte, sem herdar essas decisões. Novas guardas impedem vetor vazio/NaN e identidades ambíguas no desempate de entradas genéricas.

Em B12a, a interface passou a enviar os atributos e referências publicados ao mesmo executor, sem alterar filtros, distância ou agregação. O teste de interação com o executor real conserva o segundo par da entrada multi-label. Os oito cenários e os sete hashes do legado permanecem preservados. Consulta/replay/download não alteram sugestões originais e não constituem avaliação de relevância. Não houve nova obtenção de artigos nem encerramento das questões científicas de Felipe/Ednaldo.

Em B12b, editores e importação web passaram a produzir os mesmos contratos versionados, mantendo rótulos e associações originais. O formulário permite declarar a correspondência explícita de IDs taxonômicos para nomes científicos; publicar exige validar o mapeamento completo. O hash revisado protege a publicação contra alteração concorrente do rascunho. Essas mudanças não alteram o RNF, não implementam a política de Ednaldo e não substituem revisão das fontes ou avaliação empírica.

Em B12c, a avaliação humana passou a gerar registros separados do resultado bruto. Aceitar/rejeitar não altera a base publicada ou o replay do método. IDs importados não identificam destinos operacionais automaticamente; o vínculo exige escolha e revisão explícitas. O vertical foi verificado em Edge com dados sintéticos e os oito resultados/seus sete arquivos de referência permaneceram preservados. Não houve nova obtenção de artigos, validação da relevância das sugestões ou encerramento das questões metodológicas de Felipe/Ednaldo.

Em B13a, proteção HTTP e dependências foram revisadas sem alterar métodos, filtros, distância, agregação ou taxonomias científicas. As oito saídas RNF e os sete arquivos congelados continuam preservados. O percurso RNF completo passou novamente no navegador com dados sintéticos. Segurança técnica e compatibilidade de dependências não avaliam relevância científica; artigos/dados originais e Q01–Q05 continuam pendentes.

Em B14a, o [piloto técnico de avaliação](avaliacao-rnf.md) separa oito oráculos de compatibilidade de cinco anotações sintéticas para conferir métricas e falhas. Relevância não é inferida do resultado esperado do software, e os RNFs de referência não entram no alvo executado. As guardas locais de IDs/texto duplicado não substituem particionamento científico por projeto ou análise de clones. F2 verifica somente a fórmula/contagens do avaliador; não resolve Q03 nem reproduz o método de Ednaldo. O RNF permaneceu intacto, sem novas fontes obtidas ou alegação de desempenho nos datasets originais.

Em 18/10/2026, B15a reconferiu E21 §§4.4.1/4.5.3–4.5.5 no PDF local, cujo hash permaneceu igual. O [contrato E21](testrec-contrato-dados.md) reproduz quatro vetores de oito dimensões da tabela 4.6 e mantém módulo/operação como características, sem filtro RNF. IDs de critérios/RNFs preservam a tabela 4.5; não foram reconstruídos os catálogos completos nem inventadas associações a testes. O catálogo local é sintético, com escolhas de schema identificadas como US-Agent. Não há similaridade, ranking ou publicação executável TestRec. Tentativas de obter E26 pela ACM não retornaram texto utilizável e não confirmaram código/dados originais; Q01–Q05 permanecem abertas. O replay RNF B14a permaneceu idêntico.

Na continuidade B15b, os [catálogos de testes](catalogos-casos-teste.md) passaram a ter publicação persistida independente, arquivo original e declaração de uso. O schema é uma escolha de engenharia, sem novas conclusões sobre os artigos. Os ensaios usam fixtures sintéticas, sem obter/importar dados originais nem encerrar Q01–Q05. O replay da demonstração B16a e o pacote RNF B14a permaneceram iguais; catálogo publicado ainda não está vinculado a uma execução TestRec persistida.

Na continuidade B15c/B16b, [entrega 017](entregas/017-testes-no-executor-comum.md), o método demonstrativo ganha publicação e catálogo/base/execução no backend comum. A restrição sintética e os parâmetros científicos/adaptações são explícitos; os módulos congelados e pacotes anteriores permanecem íntegros. Não foram obtidos novos artigos ou dados e Q01–Q05 não foram encerradas. A integração técnica não comprova reprodução Euclidiana, qualidade empírica ou generalidade completa pela interface.
