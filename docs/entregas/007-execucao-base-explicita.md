# Entrega 007 — Execução com base explícita e política RNF separada

Data: 17/10/2026. Escopo: B11 concluído no backend. Contrato: [execuções configuráveis](../execucoes-configuraveis.md). Continuidade: [pendências](../pendencias-e-proximos-passos.md).

## Resultado

A execução agora recebe a definição publicada e uma versão de base explicitamente escolhida, ambas com hash. Valida disponibilidade, compatibilidade, entrada e dependências na mesma transação que grava a evidência. A consulta não completa candidatos com outras bases ou com o histórico operacional.

O núcleo KNN foi separado das escolhas de representação, elegibilidade, distância/similaridade, desempate e agregação. A política RNF extraída mantém o recorte declarado de Felipe e o arquivo legado permanece preservado para comparação. Somente a política RNF implementada é publicável/executável; o núcleo genérico não constitui uma implementação do método de Ednaldo.

Também foi implementado o mapeamento explícito de nós taxonômicos para nomes científicos legados, com cobertura completa e nomes distintos por campo. O adaptador passou a v3; publicações v2 sem esse mapeamento continuam aceitas. IDs originais e projeção usada no cálculo são preservados separadamente.

Cada execução tem pacote imutável, snapshots, versões de software, resultado e explicação de candidatos/distâncias/exclusões. Consulta e replay continuam possíveis após retirada de dependências; novos usos são bloqueados. Repetições com o mesmo UUID e conteúdo são idempotentes; outro conteúdo com o mesmo UUID é recusado.

## Evidências

| Verificação | Resultado |
| --- | --- |
| Referência anterior | 69 testes passaram antes da implementação; check de bases importadas passou novamente. |
| API | 75 testes passaram, com seis novos de separação do núcleo/política, paridade, execução publicada e mapeamento. |
| Interface/build | Sete testes da interface e build completo passaram; a API foi recompilada após os ajustes finais. Não houve alteração de interface. |
| Política extraída | Oito snapshots inteiros passaram com entrada/base idênticas, inclusive ordem invertida; casos adicionais cobriram similaridade zero, RNFs duplicados/fora do recorte, índices inválidos e IDs grandes. |
| HTTP/PostgreSQL | `check:recommendation-runs` passou: oito bases importadas/publicadas, execução persistida, consulta, replay e troca explícita de bases com vizinhos diferentes. |
| Integridade/concorrência | UUID idempotente, duas execuções concorrentes, tentativa de alterar/excluir evidência, falha forçada de INSERT e corrida de retirada de taxonomia passaram. |
| Mapeamento | Publicação rejeitou mapeamento ausente/incompleto; um nó com nome de apresentação diferente projetou para `Web`, preservando IDs na entrada e resultado RNF. |
| Regressão | Checks de definições, taxonomias, importação de bases, classificação/revisão, seleção WIS e RNF passaram com a migration nova. |
| Preservação | Os arquivos inventariados do legado permanecem conferíveis pelo manifesto; o check de execução não criou classificações operacionais. |
| Migration local | A migration 020 foi aplicada somente em `127.0.0.1`. Contagens e SHA-256 das 38 tabelas anteriores permaneceram iguais; foi acrescentada a tabela de execuções. |

As rejeições também cobrem base de outra definição, hashes/versões incorretos, tipos inválidos, parâmetros não declarados, dependências retiradas e implementação não suportada. ID numérico/textual ambíguo para o desempate é recusado; vetor vazio fica bloqueado sem produzir NaN. Nenhuma dessas guardas altera os oito resultados válidos de referência.

Build/testes web exigiram execução fora do sandbox pela restrição conhecida do Vite. Os checks com banco usaram schemas descartáveis; a migration local foi verificada separadamente. Não foram acessados produção ou provedores externos.

## Revisão científica e limites

Distância, k, filtros e recuperação de RNFs permanecem os do recorte de Felipe já documentado, inclusive as adaptações identificadas do US-Agent. A evidência é de compatibilidade técnica sobre reconstruções e não de reprodução empírica do artigo ou de desempenho na base original.

O núcleo não impõe ao caso de Ednaldo os filtros RNF. Distância Euclidiana/similaridade, agregação e métricas continuam pendentes nas fontes; não foram preenchidas por aproximação. Não houve nova obtenção de artigos nem aprovação metodológica da orientação nesta entrega.

B11 conclui execução persistida, seleção da base e explicação no backend. Ainda faltam o fluxo web configurável e decisões genéricas integradas (B12), controle por pessoa/organização e triagem de dependências (B13), piloto e os demais exemplos/avaliações. Próximo incremento: B12.
