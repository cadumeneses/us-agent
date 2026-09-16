# Motor de recomendação de RNFs

Versão: `ramos_2019_manhattan_k1_v1`.

## Método reproduzido

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

Estas são políticas explícitas do US-Agent, não conclusões atribuídas à tese:

- Usar somente a classificação mais recente de cada US, por data e identificador. Classificações anteriores permanecem no histórico, mas não contam como novas US.
- Excluir a própria US por identidade, mesmo que possua outras classificações.
- Aceitar classificações com estados `accepted_auto`, `reviewed` e `reclassified`. Revisão pendente, lacunas e necessidade de reescrita bloqueiam o alvo e excluem candidatos.
- Exigir a mesma versão de taxonomia. Não inferir equivalências entre versões ou nomes alterados; a ausência de histórico compatível é informada.
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
é a mais recente, aceita, da mesma versão e com o mesmo par consultado.

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
e isolada: não é instalada como histórico real. Categorias de tarefas ainda são
textuais; a normalização por um catálogo científico depende da obtenção desse
artefato. Sem histórico compatível com RNFs associados, a execução retorna ausência
de recomendações com explicação.
