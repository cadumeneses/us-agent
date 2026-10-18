# ADR 002 — Política executável de classificação web

Data: 17/10/2026. Estado: B04 implementado e testado; integração com API, persistência e interface concluída em B05–B06 na [entrega 002](../entregas/002-classificacao-multilabel.md).

Implementação: `apps/api/src/services/classification-policy.ts`. Identificação: `web_committee_multilabel_v1`. Este é um contrato do US-Agent; não é uma regra atribuída aos trabalhos de recomendação de Felipe ou Ednaldo.

## Agregação e validade

Um voto válido contém um conjunto completo de pares módulo/operação. O contrato exige validação integral contra a taxonomia selecionada antes da agregação. Um par inválido deve invalidar a resposta do provedor e entrar na contagem de falhas; não descartar apenas o par inválido e tratar o restante como voto íntegro.

O módulo normaliza espaços externos, remove duplicatas e ordena os pares de forma determinística. Não altera a entrada. A falta de cobertura é representada somente pelo par completo `n/a`/`n/a`, isolado de pares classificados. Confiança deve ser finita e pertencer a [0,1]; provedores têm identificações únicas.

Cada conjunto completo é uma hipótese. Consenso é a frequência da hipótese mais votada dividida pelo número de respostas válidas. Preservar todos os pares dessa hipótese; não formar uma união de pares que nenhum provedor propôs em conjunto. A confiança final é a média da confiança dos votos válidos multiplicada pelo consenso, arredondada a quatro casas; não representa probabilidade calibrada de correção.

Sem maioria estrita, a hipótese de maior frequência e menor chave canônica é apenas uma sugestão provisória para revisão. A ordem dos provedores não decide o desempate. Sem respostas válidas, o retorno usa o marcador `n/a` e motivo explícito de falha, com confiança/consenso zero; isso não é evidência de lacuna da taxonomia.

## Quórum e revisão

Aceitação automática exige simultaneamente:

- Pelo menos duas respostas válidas, que sejam maioria estrita dos provedores participantes, incluindo os que falharam.
- Uma hipótese com maioria estrita entre os votos válidos.
- Menos de duas falhas de provedores.
- Ausência de pedido de revisão, `n/a` ou sinal de lacuna nos votos válidos.
- Confiança média dos votos válidos de pelo menos 0,50. Esse piso é uma guarda de engenharia desta versão, ainda sem calibração empírica; impede aprovar unanimidade de respostas de baixa confiança, pois o score composto pode permanecer baixo nesse caso.
- Ausência de risco alto e de risco médio com consenso menor que 0,67.

Uma única resposta, mesmo quando é a única configurada, exige revisão. Duas respostas concordantes e uma falha podem ser aceitas; uma resposta e uma falha não atingem quórum. Três respostas concordantes e duas falhas exigem revisão pela regra de falhas múltiplas. Esse comportamento conservador é uma decisão explícita desta política.

Retornar todos os motivos aplicáveis em `reviewReasons`, além da saúde dos provedores. O pedido de revisão não transforma artificialmente o score em 1 nem o consenso em 0.

## Incerteza e relação com Python

O cálculo usa as hipóteses completas para consenso/entropia, Jaccard médio dos conjuntos de pares para sobreposição, e a composição presente em `_assess_uncertainty` de `agent/orchestrator.py`:

```text
score = 0,25 × risco de confiança
      + 0,20 × entropia normalizada
      + 0,25 × risco de desacordo
      + 0,15 × penalidade de n/a e lacuna
      + 0,15 × sinal de revisão
```

A penalidade de lacuna é `min(1, 0,70 × proporção de n/a + 0,30 × proporção de sinais de lacuna)`. Os sinais textuais conservam a regra atual do Python: `taxonomy_gap`, `taxonomia` ou `lacuna`. O desacordo é leve se sua taxa for menor que 0,34 e o Jaccard médio for pelo menos 0,50; nesse caso, o risco é a taxa multiplicada por 0,55. Caso contrário, o risco é a própria taxa. Os limites de banda são 0,33 e 0,66, aplicados antes do arredondamento.

Sete referências em `research/baselines/classification-policy/python-metrics.json` foram calculadas pelo Python existente, com hash da fonte, política `uncertainty_v2` e limites registrados. Os testes comparam cada componente da incerteza e o consenso. Isso confirma paridade das métricas nesses casos; não prova paridade universal nem inclui arbitragem, rerun ou decisões finais do Python. A política web acrescenta quórum e guardas próprios, e recebe um identificador diferente.

O teste inicial de desacordo leve revelou um valor esperado calculado incorretamente: a entropia para proporções 2/3 e 1/3 é aproximadamente 0,9183. A referência foi corrigida após conferência pelo Python; o score esperado é 0,2545. Esse registro evita perpetuar uma expectativa numérica incorreta.

## Integração realizada

B05 carrega a lista completa em classificação, resposta HTTP, armazenamento e revisão. `module`/`operation` legados permanecem como projeção do primeiro par; a lista é a representação autoritativa. Aprovar/reclassificar valida e guarda a lista na mesma transação, mantendo os estados anterior/posterior.

B06 registra política, motor/modelos, prompt, saúde dos provedores, motivos e métricas efetivas. A decisão automática é preservada em snapshot imutável. Registros antigos conservam suas métricas e são identificados como legados. A política está integrada ao caminho web; a migration 016 precede sua ativação em outros ambientes. [Contrato e verificação](../classificacao-web.md).
