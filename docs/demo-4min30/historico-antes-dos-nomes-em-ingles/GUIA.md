# Demonstração de 4min30 — guia com a preparação publicada

Preparação publicada em **22/10/2026**, na organização **default**, em <https://us-agent-api.vercel.app>. Use seu login habitual. Os links exigem uma sessão autenticada.

**Comece pelos links abaixo. As definições e bases já estão publicadas; você não precisa cadastrá-las novamente.** O roteiro principal apresenta essas publicações prontas. A seção final explica como demonstrar também a criação e importação ao vivo, se isso for indispensável.

## O que ficou pronto

| Recurso | Nome / identificação | Conteúdo |
| --- | --- | --- |
| Projeto separado | `[DEMO] Roteiro 4m30` | Perfil técnico copiado de P01; nenhuma história criada. |
| Riscos, versão inicial | `demo-video-project-risks`, versão `1` | Plataformas, domínios e linguagens; k=1; pesos 1. |
| Riscos, versão estendida | `demo-video-project-risks`, versão `2` | Mesmas características, mais `team_distribution`, peso 5; k=1. |
| Bases de riscos | `demo-video-project-risks-base`, versões `1` e `2` | Três perfis: P01, P09 e P03. Cada versão pertence à sua definição exata. |
| RNFs | `demo-video-nfr`, versão `1` | Método RNF existente, sem alterar seus parâmetros. |
| Base RNF | `demo-video-nfr-base`, versão `1` | Duas referências reais do P02: classificações 91 e 86, com seus RNFs existentes. |
| Entrada RNF | Projeto Emanuel, classificação `269` | “Como coordenador, quero consolidar notas dos alunos.” |
| Ensaio RNF | Execução separada | Aceite, cópia adaptada e replay já conferidos. |
| RNF para apresentar | Outra execução | Sem destino confirmado, sem decisões e sem adaptações: pronta para você executar esses passos. |

Os perfis técnicos dos riscos vêm dos projetos existentes. **Os riscos associados e os valores de distribuição da equipe foram criados para ilustrar a demonstração.** Não são observações sobre as equipes desses projetos. A aplicação identifica a base como sintética.

Os perfis originais dos 14 projetos e a lista de histórias/classificações foram conferidos antes e depois e permaneceram iguais. A adaptação de ensaio foi vinculada somente à entrada preservada; a história 269 não recebeu alteração.

A opção **Test cases** existe na interface, mas este roteiro executa riscos e RNFs. Não foi publicado catálogo de testes nesta preparação. Na abertura, apresente a opção sem tentar executar um exemplo de testes.

## Abra estas abas antes de começar

| Aba | Link | Para que serve |
| --- | --- | --- |
| 1 | [Escolher recomendador](https://us-agent-api.vercel.app/recommendations) | Abertura: mostrar as três opções principais. |
| 2 | [Configuration and datasets](https://us-agent-api.vercel.app/recommender-setup) | Mostrar definições, atributos e publicações. |
| 3 | [Nova consulta de riscos v2, preenchida pelo projeto DEMO](https://us-agent-api.vercel.app/configured-recommendations?definitionId=demo-video-project-risks&definitionVersion=2&datasetId=demo-video-project-risks-base&datasetVersion=2&project=%5BDEMO%5D%20Roteiro%204m30) | Executar a comparação de equipe. |
| 4 | [Resultado com equipe distributed](https://us-agent-api.vercel.app/configured-recommendations?runId=dd267f21-fa5e-4fa5-96a7-7eb5d37fd1ea) | Resultado conferido: P09. |
| 5 | [Resultado com equipe co-located](https://us-agent-api.vercel.app/configured-recommendations?runId=a777c267-12d4-4170-8d04-1620f8d1abf2) | Resultado conferido: P01. |
| 6 | [RNF pronto para aceitar e adaptar durante a apresentação](https://us-agent-api.vercel.app/configured-recommendations?runId=3a17e01a-9214-4b9b-b23f-48c7755ade5d) | Realizar a etapa humana. |
| 7 | [Ensaio RNF com adaptação já salva](https://us-agent-api.vercel.app/configured-recommendations?runId=970922af-9750-4163-ba6c-6fe137f7bdd7) | Conferir o resultado esperado antes ou mostrar como alternativa. |

Para observar também o fluxo do projeto: [RNF do Projeto Emanuel, história 269](https://us-agent-api.vercel.app/recommendations?recommender=nfr&project=Projeto%20Emanuel&classificationId=269&source=published). Selecione a configuração `[DEMO] RNFs — referências do P02` e sua base. Esse formulário reaproveita a história existente; você não precisa classificá-la novamente.

## Antes da apresentação — faça uma conferência de 10 minutos

1. Entre com sua conta. Em **Access and audit**, confira que está na organização `default`. A inspeção encontrou cinco vínculos de administrador ativos, mas use a função exibida para sua sessão atual.
2. Abra as abas da tabela. Aguarde terminar o carregamento. Elas devem abrir a aplicação, sem mensagens de erro.
3. Na aba 2, em **Definitions**, escolha a versão `2` de `demo-video-project-risks` e clique **Load definition**. Abra o atributo **Team distribution** e confira suas duas opções e peso 5.
4. Na aba 3, confira o perfil e a base conforme a tabela abaixo. O perfil v2 foi salvo com `distributed` na preparação. Se você já o alterou em um ensaio, selecione `distributed` novamente.
5. Nas abas 4 e 5, abra **Compared projects and feature contributions** e confira P09/P01. Depois deixe recolhido para abrir durante a fala.
6. Use a aba 7 para estudar a adaptação concluída. **Não aceite nem adapte itens na aba 6 durante o ensaio**, para mantê-la pronta para o vídeo. Se fizer isso, crie uma nova execução pelo formulário do Projeto Emanuel; decisões anteriores ficam no histórico.
7. Deixe o texto de adaptação e a justificativa desta página copiados em um editor de texto. Os campos da aplicação não importam automaticamente o arquivo de entrada JSON.

### Valores exatos do perfil de riscos

| Campo | Valor |
| --- | --- |
| Projeto | `[DEMO] Roteiro 4m30` |
| Definição | `demo-video-project-risks` · `2` |
| Base | `demo-video-project-risks-base` · `2` |
| Platforms | `Web` |
| Application domains | `Information resources` |
| Languages | `TypeScript`, `JavaScript`, `HTML/CSS` — três valores separados |
| Team distribution, primeira consulta | `distributed` |
| Team distribution, segunda consulta | `co-located` |

Não traduza esses valores dentro dos campos: categorias são comparadas exatamente. Se preencher um formulário manual, use **Add Platforms**, **Add Application domains** e **Add Languages** para acrescentar cada item; não cole uma lista JSON em um único campo.

## 0:00–0:30 — problema e três recomendadores

**Tela:** aba 1, **Recommenders**.

**Faça:** aponte para **Non-functional requirements**, **Test cases** e **Project risks**. Se aparecer também **My KNN recommenders**, explique que é a área para configurações próprias. Nesta abertura, não escolha uma história nem tente executar testes.

**Fale:**

> “A ferramenta permite reutilizar conhecimento já associado a projetos e histórias. Aqui temos recomendações de requisitos não funcionais, casos de teste e riscos. Vou mostrar como configurar a comparação, entender a origem de uma sugestão e registrar uma adaptação.”

## 0:30–1:40 — definição, importação e base publicada

**Tela:** aba 2, **Definitions**.

1. Em **Definition version**, escolha `demo-video-project-risks` versão `1`; clique **Load definition**.
2. Mostre **Platforms**, **Application domains** e **Languages**. São as características de comparação. **Risks** é a saída associada aos registros de referência.
3. Mostre **Number of neighbors (k)** = `1` e os pesos = `1`.
4. Abra **Review complete configuration** brevemente, se quiser mostrar que a configuração é explícita. Não é preciso ler o JSON.
5. Mostre **Published definition**, com ID, versão e SHA-256. Essa versão já foi publicada pela preparação.
6. Para mostrar a origem da base, use o resultado [baseline v1](https://us-agent-api.vercel.app/configured-recommendations?runId=691b8a07-3369-451a-9210-d56c7e618815), abra **Recorded profile, configuration, and calculation** e mostre a identificação da base e sua descrição.
7. Mostre por alguns segundos o arquivo [riscos-v1-base.json](dados/riscos-v1-base.json): contém P01, P09 e P03 com características e riscos associados. Volte à aplicação.

**Fale:**

> “A definição determina quais características comparar. A base publicada reúne cópias dos perfis P01, P09 e P03. Para este exemplo, associei riscos ilustrativos a esses perfis. A configuração e a base têm versões preservadas.”

**O que foi verificado:** importação de três registros válidos, sem erros e sem exclusões; execução inicial com P01 como vizinho.

Este percurso mostra a configuração e a importação **já concluídas**. Para filmar as ações de criar, importar e publicar, siga a variação ao vivo no fim do guia; não apresente a consulta de uma publicação como se estivesse criando-a naquele instante.

## 1:40–2:50 — team_distribution e troca de vizinho

1. Na configuração, carregue a versão `2` e expanda **Team distribution**.
2. Mostre: papel **Feature**, **One value**, **Enumeration**, opções `co-located`/`distributed`, peso `5`; k continua `1`.
3. Abra a aba 3. Confira os valores do perfil e escolha `distributed`. Clique **Recommend**.
4. No resultado, abra **Source projects** e **Compared projects and feature contributions**: o vizinho esperado é **P09**, distância **1**, similaridade **93,75%**.
5. Reabra o link da aba 3 para voltar ao formulário preenchido. Mude **somente Team distribution** para `co-located`; mantenha definição e base na versão `2`. Clique **Recommend**.
6. O vizinho esperado é **P01**, distância **0**, similaridade **100%**.
7. Se preferir evitar navegação durante a fala, as abas 4 e 5 preservam as duas execuções verificadas. Mostre os resultados e diga que são execuções já registradas.

**Fale:**

> “Adicionei a distribuição da equipe como característica de comparação. Nessas duas consultas, mantive a definição, a base, os pesos e o restante do perfil. Alterei somente o valor desse campo: a equipe distribuída selecionou P09; a equipe no mesmo local selecionou P01.”

**Conferência:** os percentuais deste pacote são **93,75% e 100%**. Os números 88,2% de materiais anteriores pertencem a outra base sintética. Similaridade não é probabilidade de ocorrência do risco.

## 2:50–3:50 — origem do RNF, aceite e adaptação

**Tela:** aba 6, execução RNF pronta para apresentar.

1. Mostre a entrada: **Projeto Emanuel**, “Como coordenador, quero consolidar notas dos alunos.”
2. Em **Selected neighbor**, mostre **P02**, história/classificação **86**. A consulta preservada retornou seis sugestões. Se necessário, **Candidates and exclusion reasons** identifica os dois registros da base.
3. Vá a **Assess suggestions**. Em **Link suggestions to**, mantenha **This run's preserved input**. Clique **Confirm reviewed destination**.
4. Procure o item **Security / access_control**, cuja sentença original é:

   > The system must provide the capability for users see just the information they have permission to access.

5. Nas notas desse item, escreva `Adequado ao controle de acesso às notas; adaptar ao papel de coordenador.` Clique **Accept and link** **nesse item**.
6. Expanda **Adapt accepted NFR**. Preencha os textos abaixo e clique **Save NFR adaptation**.
7. Mostre **Revision 1** e a nova sentença. O original continua acima.

**Adapted sentence — copiar:**

```text
O sistema deve permitir que o coordenador consulte e consolide somente as notas dos alunos e turmas para os quais possui autorização de acesso.
```

**Reason for adaptation — copiar:**

```text
Contextualização do RNF de controle de acesso à consulta e consolidação de notas no Projeto Emanuel; cópia separada para demonstração.
```

**Fale:**

> “Esta sugestão veio de uma referência do P02. Aceito o requisito de controle de acesso e salvo uma redação específica para o coordenador. O original, a decisão e a adaptação ficam separados e rastreáveis.”

O destino escolhido é a **entrada preservada**. Não diga que o texto adaptado foi aplicado automaticamente à história ou à base. Se usar a aba 7 como alternativa, explique que está mostrando a adaptação do ensaio já registrada.

## 3:50–4:30 — replay, exportação e acesso

1. Na execução RNF, clique **Verify replay**.
2. Aguarde **Replay verified: result, explanation, and projection match the preserved run.** Confira os três indicadores `matches`.
3. Clique **Download evidence with assessments** para baixar também as decisões e a adaptação. **Download JSON evidence** exporta a execução original; ele não substitui o primeiro download.
4. Termine mostrando <https://us-agent-api.vercel.app> e a necessidade do login autorizado. Use apenas links de materiais que estejam realmente acessíveis ao público escolhido. Não apresente este guia local como uma página pública.

**Fale:**

> “O replay confere o resultado a partir dos dados preservados. A exportação inclui as evidências da execução e, nesta opção, também a decisão e a adaptação. O acesso à ferramenta ocorre neste endereço com uma conta autorizada.”

As cinco execuções preparadas tiveram o replay verificado em produção. O replay não avalia a pertinência das sugestões nem a qualidade de uma adaptação humana.

## Se quiser criar e importar ao vivo

Esta é uma alternativa ao trecho de apresentação das publicações prontas. **Prepare os campos antes e use cortes entre as etapas para caber em 4min30.** Não altere as publicações usadas nas abas verificadas.

1. Em **Configuration and datasets → Definitions**, clique **New project-risk recommender**.
2. Use ID `demo-video-live-risks`, versão `1`, nome `[DEMO AO VIVO] Riscos`. Confira antes que esse ID ainda não foi usado. Se já existir, escolha outro ID novo e anote-o.
3. Mantenha os quatro atributos do template; ajuste k para `1`. Clique **Save definition draft**, confira o resumo e clique **Publish reviewed definition**.
4. Em **Import dataset**, selecione essa definição e clique **Load dataset schema**. Use:

   | Campo | Valor |
   | --- | --- |
   | Dataset ID | `demo-video-live-risks-base` |
   | Dataset version | `1` |
   | File format | `JSON` |
   | Reference data source | `Import CSV or JSON` |
   | Source description | `Perfis copiados de P01, P09 e P03; riscos sintéticos para demonstração.` |
   | Use declaration | `Synthetic demonstration` |
   | Authorization reference | `Demonstração autorizada pelo responsável pelo workspace; associações ilustrativas.` |
   | CSV or JSON file | [riscos-v1-base.json](dados/riscos-v1-base.json) |

5. Clique **Use US-Agent record mapping**, depois **Generate import preview**. Confira **3 records · 3 valid · 0 invalid · 0 with duplicate identities**, sem erros fatais e sem exclusões. Só então clique **Publish reviewed dataset**.
6. Para acrescentar o campo, carregue a definição ao vivo versão `1`, clique **Create a new definition version** e informe versão `2`.
7. Clique **Add comparison feature**. No atributo adicionado, preencha:

   | Campo | Valor |
   | --- | --- |
   | Attribute ID | `team_distribution` |
   | Attribute name | `Team distribution` |
   | Scope | `Project` |
   | Cardinality | `One value` |
   | Required value | `Required` |
   | Role | `Feature` |
   | Representation | `Binary presence` — definida automaticamente pelo papel |
   | Type | `Enumeration` |
   | Options (one per line) | `co-located` na primeira linha; `distributed` na segunda, sem linha vazia final |
   | Weight for Team distribution | `5` |
   | Number of neighbors (k) | `1` |

8. Salve, revise e publique a versão `2`. Importe [riscos-v2-base.json](dados/riscos-v2-base.json) com Dataset ID `demo-video-live-risks-base`, versão `2`, escolhendo a definição ao vivo versão `2`. Repita o mapeamento e a conferência dos três registros.
9. Execute as duas consultas com essa **mesma versão 2 e sua base**, usando os valores da tabela do perfil. Pela tela **Runs and history**, você pode preencher um perfil manual com identificador `demo-video-live-profile`, origem `Demonstração baseada em P01` e os valores separados. Use `distributed` e depois `co-located`.

Criar outra versão da definição exige publicar uma base correspondente. A base publicada da definição original `demo-video-project-risks` não é compatível automaticamente com o novo ID `demo-video-live-risks`.

## Arquivos e recuperação

- [Dados de riscos v1](dados/riscos-v1-base.json), [dados de riscos v2](dados/riscos-v2-base.json) e [base RNF do P02](dados/rnf-base-p02.json): **arquivos para importar na área de bases**.
- [Entrada distributed](dados/entrada-distributed.json), [entrada co-located](dados/entrada-colocated.json) e [entrada RNF](dados/entrada-nfr.json): referências para preencher consultas; **não importar como base**. O formulário não possui botão para importar a consulta inteira.
- Arquivos `*.definition.json`: espelhos da configuração para consulta; **não são bases**.
- [Textos da adaptação](dados/adaptacao-rnf.json).
- [Publicações e IDs reais de produção](publicado-em-producao.json).
- [Validação local dos dados](validacao-local.json).
- [Ensaio RNF exportado com adaptação](evidencias/rnf-com-adaptacao.json).

| Se ocorrer… | Faça… |
| --- | --- |
| Lista vazia de configurações | Confira organização `default`, login e versão publicada; recarregue a página. |
| Base não aparece | Escolha a definição e a versão exatas. Bases pertencem ao ID/versão/hash publicados. |
| Vizinho diferente | Confira as três linguagens, domínio, plataforma, peso 5, k=1 e base v2. Reabra as abas 4/5 para mostrar as execuções verificadas. |
| Não aparece **Adapt accepted NFR** | Confirme o destino e aceite o RNF de controle de acesso na execução RNF, não em uma execução de riscos. |
| O item já está aceito/adaptado | É uma decisão preservada. Gere uma nova execução no formulário do Projeto Emanuel para repetir a ação. |
| Pedido para preencher o objetivo | Não altere um projeto original para contornar isso. Use o Projeto Emanuel na consulta RNF preparada; seu objetivo já é `product`. |
| Replay não verifica | Não apresente como sucesso. Confira o erro e use a execução de ensaio verificada, indicando que ela foi preparada anteriormente. |

## Alcance da verificação

Foram consultadas as APIs autenticadas e os arquivos JavaScript efetivamente publicados, conferidos os controles usados pelo roteiro, publicados os dados pelas APIs existentes e reexecutados os cinco replays em produção. O aceite e a adaptação do ensaio foram salvos e recuperados com sucesso. A navegação visual com sua sessão pessoal não foi executada; faça a conferência das abas antes de apresentar. Nenhuma coleta com participantes ou avaliação empírica é inferida desta preparação.
