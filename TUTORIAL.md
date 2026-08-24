# Guia de uso — US-Agent

O US-Agent ajuda times de produto e qualidade a classificar User Stories, organizar o trabalho por sprint, revisar casos que exigem decisão humana e planejar os testes do ciclo.

Este guia é destinado a quem utiliza a aplicação em produção. Acesse o endereço fornecido pela sua organização; se o seu ambiente exigir autenticação, entre com as credenciais corporativas disponibilizadas.

## Visão geral do fluxo

```text
Criar ou selecionar um projeto
        ↓
Adicionar e classificar User Stories
        ↓
Revisar histórias sinalizadas
        ↓
Organizar as histórias em uma sprint
        ↓
Criar e aprovar o plano de qualidade
        ↓
Acompanhar o andamento e o histórico
```

## Conheça as áreas da aplicação

Use o menu lateral para navegar entre as áreas:

| Área | Para que serve |
| --- | --- |
| **Dashboard** | Acompanhar indicadores, classificações recentes e pendências de revisão. |
| **Meus projetos** | Criar projetos, gerenciar backlog e sprints, e detalhar cada User Story. |
| **Classificar histórias** | Incluir novas histórias e obter a classificação sugerida. |
| **Plano de qualidade** | Criar, revisar e aprovar os casos de teste de uma sprint. |
| **Fila de revisão** | Decidir manualmente sobre histórias que precisam de validação. |
| **Taxonomia** | Consultar ou administrar domínios, módulos e operações usados na classificação. |
| **Execuções** | Consultar o histórico de todas as histórias classificadas. |

## 1. Criar um projeto e cadastrar histórias

1. Acesse **Meus projetos**.
2. Clique em **Criar projeto e histórias**.
3. Informe o **nome do projeto**.
4. Defina a sprint inicial. Use `Backlog` se as histórias ainda não fazem parte de uma sprint.
5. Cole ou escreva as User Stories, uma por linha.
6. Clique em **Criar projeto**.

Use histórias claras e orientadas a valor. Por exemplo:

```text
Como cliente, quero entrar com minha conta Google para acessar a plataforma mais rapidamente.
```

Após criar o projeto, selecione uma história para registrar informações complementares:

- tarefas necessárias para concluí-la;
- requisitos funcionais;
- requisitos não funcionais, como desempenho, segurança ou confiabilidade.

## 2. Classificar User Stories

Use a classificação para registrar cada história no projeto, na sprint e na taxonomia adequados.

1. Abra **Classificar histórias**.
2. Informe ou selecione o **Projeto**.
3. Escolha a **Sprint** em que as histórias serão incluídas.
4. Cole as histórias no campo principal, uma por linha ou separadas por ponto e vírgula.
5. Para importar um lote, clique em **Importar TXT/CSV** e selecione o arquivo.
6. Escolha o modo de classificação disponível para o seu ambiente.
7. Clique em **Iniciar classificação**.

Ao concluir, a aplicação mostra para cada história:

- módulo e operação sugeridos;
- percentual de confiança;
- indicação **Revisar**, quando a classificação precisar de validação humana.

As histórias são salvas automaticamente no projeto e na sprint informados.

> Se uma história aparecer como **Revisar**, não a considere concluída: trate-a na Fila de revisão antes de seguir com o planejamento.

## 3. Organizar o backlog e as sprints

Em **Meus projetos**, selecione o projeto desejado. As histórias ficam agrupadas em **Backlog** e em sprints.

### Criar uma sprint

1. Clique em **Nova sprint**.
2. Informe o nome da sprint, como `Sprint 15`.
3. Escolha o status inicial: **Planejamento** ou **Ativa**.
4. Clique em **Criar sprint**.

### Incluir histórias na sprint

1. Abra a sprint criada.
2. Clique em **Conectar histórias**.
3. Selecione as histórias que devem fazer parte do ciclo.
4. Salve a seleção.

Conforme o trabalho evoluir, atualize o status da sprint para **Planejamento**, **Ativa** ou **Concluída**.

## 4. Revisar histórias pendentes

Acesse a **Fila de revisão** para tratar histórias que a aplicação não classificou com segurança ou que indicam uma lacuna na taxonomia.

Para cada história:

1. Selecione-a na lista de pendências.
2. Leia o motivo da revisão e verifique a confiança, o consenso e a incerteza apresentados.
3. Consulte as sugestões e os votos dos classificadores, se disponíveis.
4. Escolha o **Módulo** e a **Operação** adequados ou use uma sugestão apresentada pela aplicação.
5. Registre uma nota quando a decisão precisar de contexto adicional.
6. Clique em **Confirmar classificação**.

### Quando a taxonomia não cobre a história

Se nenhuma classificação existente for adequada:

1. Clique em **Marcar lacuna**.
2. Se necessário, selecione **Sugerir evolução da taxonomia**.
3. Informe se a proposta é um novo domínio, módulo, operação ou um pedido de esclarecimento da história.
4. Explique a justificativa da proposta.
5. Salve a decisão.

A história ficará registrada como lacuna e a proposta seguirá o processo de governança da taxonomia da sua organização.

## 5. Consultar e manter a taxonomia

A taxonomia organiza as classificações nesta estrutura:

```text
Domínio → Módulo → Operação
```

Exemplo: um domínio como `Mobile` pode conter o módulo `Autenticação`, que possui operações como `Login com OAuth`.

Na área **Taxonomia**, você pode consultar as versões disponíveis e entender quais classificações estão em uso. Se seu perfil tiver permissão de governança, também poderá:

- criar uma nova versão;
- adicionar domínios;
- adicionar módulos e operações;
- incluir a descrição de quando uma operação deve ser utilizada.

Altere a taxonomia somente quando houver uma necessidade real e validada. Essas alterações impactam as opções oferecidas nas próximas classificações e revisões.

## 6. Criar o plano de qualidade da sprint

O plano de qualidade reúne o escopo de teste das User Stories de uma sprint.

Para iniciar pelo projeto:

1. Em **Meus projetos**, abra a sprint desejada.
2. Confirme que as User Stories do ciclo já estão conectadas à sprint.
3. Clique em **Planejar qualidade**.

Também é possível iniciar em **Plano de qualidade**, clicando em **Nova sprint** e selecionando as histórias que entrarão no escopo.

### Completar o plano

No plano, revise e ajuste:

- **perguntas de refinamento**, quando faltarem detalhes para testar;
- **critérios de aceitação**, que definem o comportamento esperado;
- **casos de teste**, que descrevem como verificar cada critério.

Para cada caso de teste, informe:

1. cenário ou objetivo;
2. pré-condições;
3. dados de teste;
4. passos de execução;
5. resultado esperado;
6. tipo do teste: positivo, negativo, limite ou segurança;
7. prioridade, forma de execução e critério de aceitação relacionado.

Use o **Mapa de qualidade da sprint** para localizar rapidamente critérios sem cobertura, casos incompletos, hipóteses pendentes e candidatos à automação.

Clique em **Salvar rascunho** enquanto estiver trabalhando. Quando o plano estiver completo, clique em **Aprovar plano**.

Um plano somente pode ser aprovado quando:

- houver pelo menos um caso de teste;
- todos os casos tiverem passos e resultado esperado;
- todo critério de aceitação estiver ligado a pelo menos um caso de teste.

## 7. Acompanhar o trabalho

Use o **Dashboard** para acompanhar o panorama do trabalho:

- total de histórias classificadas;
- confiança média das classificações;
- quantidade de histórias aguardando revisão;
- classificações aceitas automaticamente;
- distribuição das histórias por módulo.

Use **Execuções** quando precisar consultar o histórico completo de histórias, classificações, confiança e status.

## Boas práticas de uso

- Escreva histórias objetivas, com ator, necessidade e benefício. Isso melhora a qualidade da classificação e do plano de testes.
- Revise diariamente a Fila de revisão para não levar pendências para a sprint.
- Só mova uma história para uma sprint depois de confirmar que ela está corretamente classificada ou que sua lacuna foi registrada.
- Mantenha os critérios de aceitação específicos e verificáveis.
- Antes de aprovar um plano, confira a cobertura de todos os critérios e a completude de cada caso de teste.
- Registre notas de revisão em decisões relevantes, para manter a rastreabilidade do time.

## Dúvidas frequentes

| Dúvida | Resposta |
| --- | --- |
| Uma história foi marcada para revisão. O que faço? | Abra a **Fila de revisão**, escolha ou confirme módulo e operação, registre uma nota se necessário e confirme a classificação. |
| Não encontrei uma operação adequada. | Marque a história como lacuna e registre uma proposta de evolução da taxonomia, se aplicável. |
| Posso alterar uma sprint depois de criada? | Sim. Você pode conectar histórias e atualizar o status da sprint conforme o andamento do ciclo. |
| Por que não consigo aprovar o plano? | Verifique se todos os critérios têm casos vinculados e se cada caso possui passos e resultado esperado. |
| Onde vejo tudo o que já foi classificado? | Acesse **Execuções** para o histórico completo ou o **Dashboard** para uma visão resumida. |

Em caso de erro de acesso, indisponibilidade ou comportamento inesperado, registre o ocorrido e entre em contato com o suporte responsável pela aplicação, informando o projeto, a sprint e a User Story envolvidos.
