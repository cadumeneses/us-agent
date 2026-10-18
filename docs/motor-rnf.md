# Motor de recomendação de RNFs

Versão: `ramos_2019_manhattan_k1_v2`.

## Núcleo do método reimplementado

Fonte: tese local `2019_FelipeRamos_Recomendação de requisitos não funcionais em projetos ágeis baseados em Scrum.pdf`, seções 5.2 e 5.3, tabelas 5.1–5.7 e equações 5.2–5.4.

1. Recuperar perfis de projetos, US classificadas, tarefas e RNFs associados.
2. Pré-filtrar US pelo módulo/operação do alvo e excluir projetos de protótipo.
3. Representar cada candidato em um vetor binário definido pelas características do alvo. O vetor alvo tem somente valores 1.
4. Calcular `similaridade = 1 - distância de Manhattan / número de dimensões`.
5. Selecionar o vizinho com maior similaridade, com k=1.
6. Retornar os RNFs associados ao vizinho. A utilidade é a soma das coocorrências binárias ponderadas pela similaridade; com k=1, cada RNF associado recebe a similaridade desse vizinho.

As dimensões são tags de plataforma, domínio de aplicação, arquitetura, linguagens,
frameworks, APIs, persistência e categorias das tarefas. Como na tabela 5.7, objetivo
é usado no filtro de protótipos, não como dimensão de similaridade. Tags repetidas
não acrescentam peso. Tecnologias adicionais presentes apenas no candidato não
aumentam a distância. As tecnologias de todas as tarefas das classificações mais
recentes de um projeto complementam suas tags manuais; essa união é recalculada
ao executar, sem sobrescrever o cadastro manual.

O motor não usa LLM, templates, embeddings ou os scores de confiança da classificação
para criar RNFs ou modificar a fórmula. As sentenças são recuperadas do histórico,
sem alterar valores ou restrições. Não há fallback para outro algoritmo ou outro
vizinho se o mais próximo não tiver RNFs elegíveis.

## Integração com a pesquisa de classificação

A interface permite escolher uma taxonomia ativa no perfil do projeto e confirma a versão
ao classificar. A versão usada é gravada na execução e em cada classificação. Alterar a
seleção do projeto afeta classificações futuras; classificações existentes mantêm a versão
histórica. A recomendação compara os nomes de módulo/operação e não exige versão da
taxonomia, inclusive quando ela está ausente em classificações antigas.

Estas são políticas explícitas do US-Agent, não conclusões atribuídas à tese:

- Usar somente a classificação mais recente de cada US, por data e identificador. Classificações anteriores permanecem no histórico, mas não contam como novas US.
- Excluir a própria US por identidade, mesmo que possua outras classificações.
- Aceitar classificações com estados `accepted_auto`, `reviewed` e `reclassified`. Revisão pendente, lacunas e necessidade de reescrita bloqueiam o alvo e excluem candidatos.
- Comparar módulo/operação pelo nome exato, mesmo entre versões diferentes. Nomes alterados entre taxonomias não são tratados como equivalentes.
- US multi-label: o usuário escolhe um dos pares já classificados. A lista de classificações não é alterada nem fundida. Um candidato é compatível quando possui esse par; seus RNFs estão associados à US inteira, pois o cadastro atual não os separa por par.
- Campos básicos de perfil (plataforma, domínio de aplicação, objetivo e arquitetura) são necessários. Toda tarefa cadastrada precisa de categoria. Ausência de tarefas é permitida; listas de tecnologias podem estar vazias quando não se aplicam. Campos ausentes não são preenchidos pela IA.
- Empate no maior score: escolher a classificação com menor identificador numérico. Manter k=1 e informar o desempate no resultado. A equivalência dessa política com o código da NFRec depende de obter o código original.
- Comparação exata das tags após trim, com categorias separadas: uma linguagem não corresponde a um framework de mesmo nome. Não aplicar sinônimos, traduções ou aproximação semântica implícitos.

Não foi aplicado limiar adicional de similaridade. Similaridade zero resulta em
utilidade zero e aviso explícito. Similaridade é uma medida de correspondência,
não uma probabilidade de acerto.

## RNFs, identidade e decisões

Recorte da tabela 5.1/apêndice D:

| Tipo | Atributos |
| --- | --- |
| Performance | response_time, capacity, transit_delay, efficiency_compliance |
| Reliability | availability, integrity, fault_tolerance, recoverability |
| Security | confidentiality, access_control, authentication |

RNFs legados fora desse recorte continuam no cadastro, mas não são recomendados
por este motor. O campo legado `metric` guarda o atributo; a interface o apresenta
como **Atributo**. Espaços nos nomes de atributos são normalizados para `_`.

Um RNF tem identidade por tipo + atributo + sentença, após normalização limitada
de espaços externos e do atributo. O SHA-256 dessa tripla identifica os itens nas
decisões; sentenças diferentes não são fundidas por semelhança. Duplicatas no mesmo
vizinho contam uma única coocorrência.

Aceitar vincula a sentença recuperada à classificação da US. Rejeitar registra a
decisão sem criar um vínculo. Repetir a mesma decisão é idempotente; uma decisão
contraditória exige nova execução. Decisões de execuções anteriores não impedem
avaliações futuras. Antes de aceitar, o backend verifica se a classificação ainda
é a mais recente, aceita e com o mesmo par consultado. A versão da taxonomia
permanece no snapshot para rastreabilidade, sem bloquear o vínculo.

## Persistência e endpoints

`nfr_recommendation_runs` armazena método, snapshots completos de alvo/histórico,
índice do par, resultado e data. `nfr_recommendation_decisions` armazena a avaliação
por item. A criação usa transação com snapshot consistente; aceitação e associação
são atômicas e serializadas com as edições manuais dos detalhes da US.

- `GET /api/classifications/:id/nfr-context`
- `GET /api/classifications/:id/nfr-runs` (50 execuções mais recentes)
- `POST /api/classifications/:id/nfr-runs`, corpo `{ "labelIndex": 0 }`
- `POST /api/nfr-runs/:id/decisions`, corpo `{ "itemKey": "...", "decision": "accepted" }` ou `rejected`

Estados: `blocked`, `no_candidates`, `no_items` e `completed`. Resultados vazios e
bloqueios são persistidos com seus motivos. Não existe endpoint para cadastrar um
novo recomendador nesta etapa.

## Validação e limites

Os testes reproduzem as nove dimensões da tabela 5.7 e o caso de distância seis
(similaridade 1/3), além de filtros, k=1, duplicação, empate, multi-label, dados
faltantes e namespaces das tags. O teste de integração verifica migrations,
execução HTTP, snapshots, associação, idempotência e bloqueio após mudança de
classificação, usando um schema temporário no PostgreSQL local.

```powershell
npm.cmd run build
npm.cmd test
node scripts/check-nfr-recommendations.mjs
```

Essa validação não reproduz os experimentos científicos da tese. O código original
da NFRec e a base completa ainda não foram obtidos. A base de testes é reconstruída
e isolada: não é instalada como histórico real. A interface oferece as 131 categorias
de tarefas publicadas no apêndice A para o par módulo/operação da história, mas ainda
permite texto livre; grafias diferentes continuam sendo dimensões diferentes.
Sem histórico compatível com RNFs associados, a execução retorna ausência de
recomendações com explicação.

## Material publicado aproveitado

A seção 6.1.3 e a tabela 6.1 descrevem uma base de 13 projetos, 383 RFs/US,
693 RNFs e 1.127 tarefas. A tese publica somente o resumo agregado dessa base;
não fornece as linhas completas nem um projeto integral pronto para importação.

- O apêndice A contém 131 categorias de tarefas para 18 pares de módulo/operação.
  Elas foram extraídas para `apps/web/src/data/ramos-task-catalog.json`, conferidas
  contra os totais da tabela 4.3 e oferecidas como sugestões na edição de tarefas.
- O apêndice D contém 46 sentenças de RNF, distribuídas nos três tipos e onze
  atributos. Foram extraídas para `apps/web/src/data/ramos-nfr-catalog.json` como
  exemplos opcionais para preenchimento manual. Seus limites e tecnologias devem
  ser adaptados ao projeto antes do vínculo; o motor não as recomenda sem uma
  associação prévia no histórico.
- Os scripts `scripts/extract-ramos-task-catalog.py` e
  `scripts/extract-ramos-nfr-catalog.py` reproduzem a extração a partir do PDF da
  tese. O PDF não é necessário em tempo de execução.
- `scripts/seed-ramos-example.mjs` carrega **somente no banco local** três
  projetos explicitamente identificados como demonstração: o alvo `fa` e os
  perfis históricos `f4` e `f5` das tabelas 5.3–5.7. Cada projeto contém só a
  história ilustrada; os textos das histórias foram reconstruídos, e `t6`/`t7`
  permanecem identificadores do exemplo porque a tese não os liga a descrições
  específicas. Não são os projetos completos da base experimental.

```powershell
npm.cmd run db:migrate
npm.cmd run db:seed:ramos
npm.cmd run db:check:ramos
```

A carga é idempotente e não sobrescreve perfis ou classificações existentes.
O verificador lê os três registros e confirma `f4` com similaridade 1, `f5`
com 1/3 e seus RNFs associados.

## Auditoria de fidelidade à tese

**Conclusão: a recomendação não está exatamente igual à NFRec de Felipe Ramos.**
O núcleo descrito nas seções 5.3.1–5.3.3 coincide: filtro pelo par módulo/operação,
exclusão de protótipos, vetor binário construído com características do alvo,
similaridade `1 - distância de Manhattan / n`, `k=1` e recuperação dos RNFs
associados ao vizinho. A tabela 5.7 foi reproduzida em teste (nove dimensões,
similaridade de 1/3 para `f5`). Os três tipos e onze atributos aceitos pelo motor
correspondem ao modelo apresentado na tabela 5.1 e no apêndice D.

As diferenças com efeito potencial no resultado são:

| Ponto | Tese de Felipe | US-Agent atual |
| --- | --- | --- |
| Tarefas no vetor | Tarefas estruturadas do requisito, exemplificadas como `t6` e `t7` na tabela 5.7; o apêndice A publica a taxonomia de categorias. | Compara o texto de `category` em cada tarefa. O catálogo do apêndice A agora é sugerido na interface, mas texto livre ainda é aceito e não há identificador estável de categoria. |
| Histórico | RF alvo de um projeto corrente comparado com RFs da base histórica de projetos passados (seção 5.3.3). | Todas as histórias classificadas disponíveis podem entrar, inclusive outras do projeto corrente. Não há importação da base histórica original. |
| Tags | Repositório central de tags predefinidas, com novas tags auditadas por especialista (seção 5.2.1). | Há sugestões e entrada livre, sem catálogo central auditado; grafias divergentes deixam de coincidir no vetor. |
| Elegibilidade | A pré-filtragem explicitada na seção 5.3.3 usa módulo/operação e descarta protótipos. | Também exige classificação aceita/revisada, campos básicos preenchidos e categoria em todas as tarefas. Essas regras podem retirar candidatos que a tese consideraria. A versão da taxonomia não é um filtro. |
| Identidade de RNF | RNFs estruturados por tipo, atributo e sentença, com associações à US; o apêndice D traz um catálogo inicial de sentenças. | A identidade é calculada por hash dessa tripla normalizada. As 46 sentenças do apêndice D estão disponíveis para edição manual, mas as associações dos 13 projetos não foram publicadas; só RNFs vinculados no banco local são recuperados. |

O desempate pelo menor identificador, a escolha manual de um par em classificações
multi-label e a seleção da classificação mais recente são decisões de integração
do US-Agent. A tese não permite verificar se elas equivalem ao comportamento da
implementação original. O apêndice A lista tarefas, mas não fornece o mapeamento
dos identificadores `t6`/`t7` do exemplo para descrições específicas. Sem o código, a base histórica
e um conjunto de entradas/saídas da NFRec, não é possível atestar equivalência exata
nem reproduzir as métricas experimentais.
