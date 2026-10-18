# Entrega 002 — Classificação multi-label integrada

Data: 17/10/2026. Escopo: B05 e B06 concluídos. O funcionamento e os contratos estão descritos em [classificação web](../classificacao-web.md).

## Resultado

A política de classificação testada na entrega 001 agora é executada pelo caminho web. Todos os pares escolhidos chegam à resposta HTTP, à persistência, à consulta de histórias, aos detalhes do projeto e à revisão. O revisor mantém, remove ou acrescenta pares explicitamente, com validação da taxonomia e registro dos estados anterior/posterior.

Consenso e incerteza deixam de codificar apenas o estado de revisão. Cada classificação nova registra motor, política, prompt, taxonomia congelada com hash, decisão automática e modelos solicitado/retornado. A evidência automática não pode ser sobrescrita por uma revisão. Os registros legados são identificados e não têm seus números reescritos. Regras locais não apresentam valores de comitê como se tivessem sido calculados.

Falhas totais dos provedores permanecem auditáveis e distintas de lacunas taxonômicas. Um voto parcialmente inválido conta como falha integral, protegendo a interpretação do consenso. O cliente antigo que envia apenas um par não consegue apagar silenciosamente uma classificação multi-label.

## Evidências de qualidade

| Verificação | Resultado |
| --- | --- |
| API | 38 testes passaram, incluindo paridade de métricas com sete referências Python, votos inválidos, falhas, múltiplos rótulos e busca pelos pares secundários. |
| Interface | Sete testes de interação passaram: confirmação completa, remoção explícita, restauração de conjunto, adição sem duplicata, erro com possibilidade de repetição, métricas de regras e espera do contexto. |
| Build | API e web compilaram. |
| Referência RNF | Oito cenários congelados passaram, sem alteração do motor. |
| HTTP e PostgreSQL | `check-classification-workflow.mjs` passou com modelos simulados: métricas, modelos, snapshots, rejeição sem alterações parciais, proteção da evidência, dados legados e duas revisões concorrentes com apenas uma aprovada. |
| Compatibilidade HTTP | Checks existentes de seleção de taxonomia e recomendação RNF passaram. |
| Migration local | Somente a migration 016 estava pendente e foi aplicada. Contagens e hashes do conteúdo anterior em sete tabelas foram conferidos antes/depois e permaneceram iguais. |

O primeiro teste HTTP detectou perda do `search_path` após reconexão do pool durante a verificação isolada. O script passou a definir o schema também nas opções da conexão, mantendo o isolamento ao reconectar. A repetição com a versão final passou. Isso não exigiu alteração da conexão de produção.

A verificação de dependências do npm sinalizou 15 ocorrências em pacotes já presentes no lockfile anterior, incluindo alertas altos/críticos. As versões desses 15 pacotes não foram alteradas nesta entrega; `jsdom` foi acrescentado apenas para testes e não aparece nessa relação. As ocorrências ainda exigem triagem e atualização controlada, registradas em B13; o teste funcional não constitui auditoria de segurança. Não foi executada atualização global com alterações incompatíveis.

## Limites e continuidade

Os testes técnicos usam modelos simulados e não medem a qualidade das previsões de LLM em dados reais. A revisão do professor e os experimentos científicos continuam pendentes. Os métodos de recomendação de Felipe e Ednaldo não foram alterados por esta política de classificação do US-Agent; a referência RNF continua protegida.

A próxima implementação é B07: contratos e validação de definições/atributos, executando uma configuração RNF com adaptador do método atual. A comparação das versões dos artigos e obtenção dos dados originais continua em B02.
