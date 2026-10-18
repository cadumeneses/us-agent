# Entrega 006 — Importação de bases rotuladas

Data: 17/10/2026. Escopo: B10 concluído no backend. O contrato e as rotas estão em [importação de bases](../importacao-bases.md); a continuidade está na [lista de pendências](../pendencias-e-proximos-passos.md).

## Resultado

Foram implementadas importação CSV/JSON com mapeamento explícito, prévia por registro/campo, preservação dos bytes originais e publicação versionada. O importador distingue papéis de atributos conforme a definição publicada e conserva rótulos e itens associados sem reclassificar a base ou inserir linhas nas tabelas operacionais.

CSV preserva aspas, delimitadores e quebras de linha válidas, incluindo células com JSON explícito para atributos múltiplos/registros. JSON rejeita chaves duplicadas antes que apaguem valores. Erros e duplicatas permanecem visíveis. Publicação parcial exige ordinais excluídos explicitamente e revalida a unicidade da seleção; não escolhe uma duplicata nem descarta inválidos silenciosamente.

Cada base fixa a referência exata da definição, origem/autorização declarada, prévia/hash, arquivo/hash, mapeamento, seleção e registros. Conteúdo publicado e evidência de importação são imutáveis. Novos dados exigem outra versão. A retirada preserva consulta, arquivo e hashes.

## Evidências

| Verificação | Resultado |
| --- | --- |
| Referência anterior | Os 60 testes anteriores e o check configurável RNF passaram antes do incremento. |
| API | 69 testes passaram: nove novos cobrem parsing, mapeamento, duplicatas, seleção e comparação após importação. |
| Interface/build | Sete testes da interface e build completo API/web passaram. Não houve alteração de interface. |
| CSV/JSON | Verificados aspas escapadas, vírgula/ponto e vírgula/tabulação, CRLF em células, vazios, contagem de colunas, Unicode/BOM, texto curto e chaves JSON duplicadas. |
| HTTP/PostgreSQL | `check:recommender-datasets` passou com prévia, download byte a byte, hashes, exclusões explícitas, publicação concorrente/idempotente, novas versões, retirada e controle interno de acesso. |
| Transações | Falha forçada no INSERT final não publicou dataset parcial e preservou a prévia original. Dependência retirada entre prévia e publicação foi recusada. |
| Compatibilidade RNF | Os oito conjuntos de candidatos foram importados e publicados por API separadamente; cada resultado em simulação permaneceu inteiro igual ao snapshot esperado. |
| Regressão | Checks de definições, taxonomias independentes, classificação/revisão, seleção WIS e RNF passaram com a migration nova nos schemas isolados. |
| Preservação | Os sete hashes de origem do manifesto continuaram iguais. No check de importação, a contagem de classificações operacionais permaneceu igual. |
| Migration local | A migration 019 foi aplicada somente em `127.0.0.1`. Contagens e SHA-256 do conteúdo das 36 tabelas anteriores permaneceram iguais; foram acrescentadas duas tabelas. |

Também foram verificados upload acima de 5 MB, registros além do limite explícito, UTF-8 inválido, mapeamento obrigatório ausente, nó taxonômico desconhecido e tentativa de publicar com hash de prévia diferente. Uma definição/taxonomia retirada bloqueia novas prévias/publicações aplicáveis, sem prejudicar leitura histórica.

Build e testes web foram executados fora do sandbox pela restrição conhecida do Vite. Não houve acesso a produção ou chamadas a modelos. Os checks com banco usaram schemas descartáveis; a migration no banco local foi verificada separadamente por contagens/hashes.

## Revisão de fidelidade e limites

O método RNF de Felipe, filtros e fórmulas não foram alterados. O importador verifica estrutura e identidade sem eliminar perfis apenas por serem inelegíveis no método. Essa decisão continua no motor. Os dados dos testes são reconstruídos/sintéticos e a autorização registrada não significa acesso comprovado aos datasets originais.

O método de Ednaldo continua dependendo das decisões documentadas sobre distância, agregação e avaliação; a importação não o implementa por aproximação. Não foram obtidas novas fontes nem realizada validação com professor/autores nesta entrega.

Faltam a seleção explícita da base numa execução persistida, extração das políticas KNN e mapeamentos compatíveis do legado (B11), o fluxo de configuração/importação pela interface (B12), controle por pessoa/organização (B13) e avaliação empírica. Próximo incremento: B11.
