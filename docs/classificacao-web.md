# Classificação web e revisão de múltiplos rótulos

Implementado na [entrega 002](entregas/002-classificacao-multilabel.md), após a referência de compatibilidade e a [política de decisão](decisoes/002-politica-classificacao-web.md).

## Caminho executado

No modo comitê, o motor `web_committee_v2` consulta os provedores configurados, valida cada resposta inteira na taxonomia escolhida e executa `web_committee_multilabel_v1`. A hipótese escolhida conserva todos os seus pares. Empates, falhas e revisão seguem as guardas documentadas; o motor web não executa arbitragem ou rerun.

Após a integração de idioma da [entrega 016](entregas/016-rebase-idioma-e-preservacao.md), novas chamadas usam o prompt `web_wis_multilabel_v3_en`: explicações em inglês e rótulos preservados exatamente como na taxonomia, mantendo todos os pares necessários. O snapshot guarda o prompt realmente enviado; execuções antigas não são reescritas. As interfaces apresentam “Not applicable” para métricas de comitê que não se aplicam às regras locais.

Um voto contendo pares válidos e inválidos é rejeitado por inteiro, contando como falha. Falha de todos os provedores é registrada com saúde dos provedores, motivo e necessidade de intervenção, sem virar automaticamente uma lacuna da taxonomia ou uma solicitação de reescrita da história. Ausência de provedores configurados retorna erro de configuração HTTP 422.

O modo de regras locais permanece separado e não consulta LLM. Registra `web_preview_rules_v1`, sem prompt ou métricas de comitê. A confiança desse modo continua sendo a heurística das regras existentes.

## Dados e proveniência

A migration `016_classification_provenance.sql` acrescenta:

- Modelos solicitado e retornado aos votos. Quando a resposta não informa o modelo efetivo, esse valor permanece ausente; não é inferido do alias solicitado.
- Snapshot imutável por classificação, contendo entrada, prompt realmente enviado, versão e conteúdo da taxonomia com hash, motor, política, resultado automático, métricas e saúde dos provedores.
- Estados antes/depois nas decisões humanas, com notas e autoria já previstas no cadastro do revisor. IDs dos artefatos nos snapshots de revisão são preservados como strings.

Os campos existentes `prompt_version` e `policy_version` passam a ser preenchidos nas classificações e execuções web novas. A persistência usa a decisão registrada na proveniência como origem dos rótulos, confiança e métricas. Revisar modifica a classificação corrente, mantendo o resultado automático original e os estados anterior/posterior na mesma transação.

Para comitê, `consensus_ratio`, `uncertainty_score` e banda recebem os valores efetivamente calculados. Para regras, o contrato de proveniência usa `null` em consenso/incerteza. As colunas numéricas legadas, que não aceitam nulo, recebem zero como marcador de armazenamento e banda nula; a API identifica `metricsSource: 'rules'` e a interface apresenta “Não se aplica”. Clientes devem usar essa identificação para interpretar as métricas.

Registros anteriores conservam seus números. A API os identifica como `metricsSource: 'legacy'`, com proveniência nula quando o snapshot não existe. Não há recálculo retrospectivo nem atribuição da política nova às decisões antigas.

## Contrato de rótulos e revisão

`labels` é a lista autoritativa retornada pela classificação e por `/api/stories`. `module` e `operation` permanecem como projeção do primeiro par para compatibilidade. A busca considera todos os pares, e o dashboard conta cada história uma vez por módulo.

Para aprovar a revisão:

```json
{
  "action": "approve",
  "labels": [
    { "module": "Authentication", "operation": "Login with OAuth" },
    { "module": "Registry", "operation": "Retrieve data" }
  ],
  "notes": "Os dois pares foram conferidos."
}
```

O contrato web suporta de um a oito pares por aprovação. O usuário pode remover/adicionar pares ou usar um conjunto completo sugerido por um provedor. Aprovar sem pares é bloqueado, e a confirmação aguarda o carregamento da taxonomia/contexto. Uma remoção explícita é registrada com os dois estados.

O formato antigo com um único `module`/`operation` continua aceito para classificações com no máximo um par. Em uma classificação multi-label, ele retorna HTTP 422 para impedir perda silenciosa de rótulos. Misturar os formatos ou fornecer uma lista vazia retorna 400; pares que não pertencem à taxonomia retornam 422. Uma classificação já concluída retorna 409. Duas confirmações concorrentes produzem uma única decisão aceita.

O endpoint de contexto retorna rótulos atuais, proveniência automática, votos e histórico de revisões. A interface apresenta os modelos, evidências e a origem das métricas, preservando os fluxos de propostas de evolução da taxonomia.

## Verificação e aplicação

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run check:nfr-baseline
npm.cmd run check:classification-workflow
```

O último comando requer PostgreSQL local. Usa somente respostas de modelos simuladas em loopback e um schema temporário removido ao terminar. O schema é configurado também na conexão para manter isolamento após reconexão do pool. Não consulta provedores externos nem altera a base operacional.

A migration deve preceder a ativação desta API em qualquer outro ambiente. Ela foi aplicada ao banco local nesta entrega; os testes também a aplicam em schemas novos. A execução e persistência do RNF de Felipe continuam verificadas pelos cenários congelados e pelo check HTTP existente. A avaliação científica da classificação e da recomendação permanece no plano, separada destes testes técnicos.
