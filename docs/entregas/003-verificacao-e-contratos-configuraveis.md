# Entrega 003 — Verificação do plano e contrato RNF configurável

Data: 17/10/2026. Escopo: verificar as entregas anteriores e concluir B07. Referências: [workflow](../workflow-evolucao-us-agent.md), [ADR 001](../decisoes/001-contratos-e-compatibilidade.md) e [contratos executáveis](../recomendadores-configuraveis.md).

## Resultado da verificação anterior ao incremento

| Item | Evidência e conclusão |
| --- | --- |
| B01 — Preservação | Oito cenários congelados passaram; os sete arquivos inventariados em `sourceHashes` mantêm os hashes de bytes do manifesto. Nenhuma referência foi regenerada. |
| B03 — Arquitetura e compatibilidade | Separação entre classificação/recomendação e persistência aditiva mantida. B07 segue os contratos da ADR; publicação e dados genéricos ainda pertencem a incrementos posteriores. |
| B04 — Política web | Testes de quórum, empates, votos inválidos, falhas e métricas passaram. O workflow ainda indicava ativação pendente; o estado documental foi corrigido para refletir B05–B06. |
| B05 — Múltiplos pares | Testes da API, sete interações da interface e check HTTP/PostgreSQL passaram, incluindo preservação de pares e revisão concorrente. |
| B06 — Evidência e métricas | Check com modelos simulados confirmou modelos/prompt/política, snapshots de revisão, bloqueio de alterações da evidência automática e compatibilidade com legado. |
| B02/B19 — Fontes | Permanecem pendentes conforme a matriz: acesso/comparação dos artigos e dados, questões científicas de Ednaldo e confirmação do exemplo sem US. Não foram considerados concluídos. |

Nenhum desvio funcional foi identificado nos fluxos exercitados. Isso não significa conclusão do plano: autenticação/isolamento e alertas de dependências continuam em B13, e os experimentos empíricos e revisões da orientação permanecem pendentes. A verificação usou dados locais de demonstração, sem chamadas a modelos externos.

## Implementação B07

Foram acrescentados contratos e validação estrita de definição, atributos, entrada e base em memória. A configuração JSON declara os 18 atributos do RNF e seus vínculos semânticos. Tipos, cardinalidades, obrigatoriedade e papéis são validados em alvo e base; atributos novos de contexto funcionam por configuração e participam dos snapshots.

O adaptador converte esses valores para o motor RNF v2 existente e preserva sua saída completa. Não altera distância, k, filtros ou desempate. Configurações incompatíveis e parâmetros não implementados são recusados. Categorias por nome continuam compatíveis entre versões, inclusive versões ausentes; taxonomias independentes são B08.

Cada simulação produz cópias imutáveis e hashes versionados de definição, entrada, base, seleção e resultado. O comando `npm.cmd run check:configured-nfr` demonstra a execução pelo novo caminho e compara os oito resultados inteiros com a referência, sem acessar banco.

## Verificações executadas

| Check | Resultado |
| --- | --- |
| API após B07 | 51 testes passaram: 38 existentes e 13 novos de contratos, hashes, validação e compatibilidade do adaptador. |
| Interface | Sete testes passaram durante a auditoria; nenhum arquivo de interface foi alterado neste incremento. |
| Build | Build completo passou na auditoria; a API voltou a compilar após a implementação de B07. |
| Referência legada | `check:nfr-baseline` passou nos oito casos. |
| Novo caminho | `check:configured-nfr` passou nos oito casos, incluindo o par secundário, falta de perfil, empate, ausência de itens e versões de taxonomia distintas. |
| HTTP/PostgreSQL | Checks de classificação/revisão, seleção de taxonomia e recomendação RNF passaram em schemas temporários locais. |
| Integridade | Arquivos científicos/motor inventariados preservados; entradas não são alteradas pela simulação e evidências não aceitam mudanças posteriores. |

Os testes adicionais verificam renomeação de atributos por vínculos, novo contexto sem mudança de ranking, campo obrigatório em toda a base, entradas sem US no contrato genérico, tipos sem coerção, bases ambíguas, configurações incompatíveis e rejeição de dados que sofreriam perdas na serialização JSON. O hash é testado inclusive com chaves numéricas e Unicode.

O Vite encontrou a restrição conhecida de diretórios do sandbox. Os testes da interface e o build completo passaram fora dele após autorização da ferramenta. Não foi feita migration, seed ou alteração no banco de desenvolvimento neste incremento; os checks com banco usaram schemas descartáveis.

## Revisão de escopo e fidelidade

A revisão técnica comparou o novo adaptador com as saídas congeladas e conferiu os contratos e limitações da ADR. A revisão documental confrontou as responsabilidades dos atributos com a matriz metodológica já registrada; não houve obtenção de novas fontes nem validação por professor/autores nesta entrega.

Felipe continua representado pelo recorte RNF v2 declarado, incluindo as adaptações já identificadas do US-Agent. A compatibilidade dos oito casos reconstruídos não substitui avaliação na base original. O método de Ednaldo não foi implementado por aproximação: questões Q01–Q03 continuam registradas e exigem confirmação antes de fechar sua política.

B07 entrega simulação em memória e contratos testados. Publicação persistida, taxonomias independentes, importação, extração das políticas do KNN, execução genérica web e histórico persistido continuam em B08–B12. Os aceites completos de RF01/RF02/RF10 ainda não estão encerrados. Próximo incremento: B08.
