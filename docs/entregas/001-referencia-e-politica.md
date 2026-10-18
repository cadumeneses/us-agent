# Entrega 001 — Referência RNF e política de classificação

Data: 17/10/2026. Escopo: B01, B03 e B04 do workflow. B02 continua em análise das fontes; B05–B06 são a próxima implementação.

## Resultado concreto

- Referência congelada em `research/baselines/rnf-v2`: oito cenários com entradas/saídas completas, manifesto, SHA-256 e inventário de 21 arquivos com alterações preexistentes. O manifesto registra o commit e a árvore modificada, preservando a distinção entre código versionado e trabalho local.
- Comando `npm.cmd run check:nfr-baseline`: valida integridade e resultados do motor atual, testa inversão da base e preservação das entradas. Executa sem banco, modelos externos ou alteração do arquivo de referência.
- [ADR 001](../decisoes/001-contratos-e-compatibilidade.md): contratos mínimos, publicação imutável, migração aditiva, compatibilidade e estratégia de retorno.
- [ADR 002](../decisoes/002-politica-classificacao-web.md): política `web_committee_multilabel_v1` como módulo puro, com testes de conjuntos completos, empate, quórum, falhas e incerteza.
- Sete referências calculadas pelo Python existente, preservadas em `research/baselines/classification-policy/python-metrics.json`, para verificar paridade dos componentes de incerteza e consenso sem exigir Python na suíte Node.

Os cenários RNF são demonstração reconstruída e dados sintéticos identificados; não representam o dataset de Felipe. A política de classificação é uma decisão do US-Agent, separada dos métodos de recomendação. As diferenças entre Felipe e Ednaldo continuam registradas na [matriz de fidelidade](../referencias-e-fidelidade.md).

## Revisão e limites

A revisão técnica desta etapa conferiu determinismo, ausência de mutação, detecção de referência corrompida, casos numéricos do RNF e componentes da incerteza. As métricas Python foram obtidas por chamada direta a `_assess_uncertainty`, usando somente votos locais; não houve chamada a provedores. A implementação Python foi preservada.

Foi acrescentada uma guarda de baixa confiança: unanimidade com confiança média abaixo de 0,50 exige revisão, mesmo que a composição da incerteza produza banda baixa. O teste cobre esse caso e o ADR registra que o piso é uma decisão de engenharia ainda sem calibração empírica.

Uma expectativa numérica incorreta do teste de entropia foi detectada e corrigida após recálculo e comparação com o Python. A distinção entre paridade de métricas e paridade de decisão está explícita no ADR 002: arbitragem, rerun e guardas finais não são anunciados como equivalentes.

A política nova ainda não está ligada ao fluxo web. B05–B06 precisam integrar a lista autoritativa de rótulos, persistência, métricas/proveniência e revisão na mesma entrega de comportamento, antes da ativação. A correção da perda de rótulos no fluxo atual permanece pendente; esta entrega prepara seu contrato verificável.

Não houve revisão do professor nem experimento de qualidade da recomendação nesta etapa. A aprovação dos testes comprova os cenários cobertos, não fidelidade completa aos sistemas originais.

## Verificação

| Verificação | Resultado |
| --- | --- |
| Referência RNF | Oito cenários passaram; nove dimensões, vizinhos, itens, estados e desempate preservados. |
| Suíte API | 32 testes passaram, incluindo os 18 anteriores; sete cenários conferem os componentes calculados pelo Python. |
| Suíte web | Comando concluiu com sucesso, sem arquivos de teste encontrados. Não há alegação de cobertura de interação. |
| Build | API e web compilaram com sucesso; API recompilada após a última alteração da política. |
| Integridade documental e fontes | Links locais e JSON válidos; hashes das sete fontes originais do manifesto conferidos e preservados. |
| Banco e interface | Fluxos não alterados nesta etapa; checks HTTP/persistência e interação ficam para B05–B06. |

Os comandos completos inicialmente encontraram a restrição de diretórios do sandbox no Vite e concluíram após repetição fora dele. Nenhuma falha de ambiente foi tratada como aprovação de teste.

## Próximo incremento

Integrar B05–B06 de ponta a ponta, com o novo contrato multi-label, política efetiva e métricas/proveniência persistidas. Executar os checks de classificação e RNF em schema local isolado, além dos testes de regras e do build. Conservar a referência RNF congelada como condição de compatibilidade.
