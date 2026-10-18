# Entrega 015 — Publicação persistida de catálogos de testes

Data: 18/10/2026. Escopo **B15b**, preparação de RF05/RF06/RF14 para o segundo recomendador. Mantém a prioridade A3/A5 relatada no documento fornecido: outro tipo de saída com origem preservada, dentro da evolução KNN planejada.

## Resultado

Os [catálogos de testes](../catalogos-casos-teste.md) agora podem ser publicados e consultados por API, com versão imutável e arquivo original recuperável. O pacote preserva texto, metadados, origem e declaração de uso; referências incluem ID/versão/hash do pacote. Publicações concorrentes idênticas são idempotentes; alterações exigem nova versão. Retirada impede novos usos pelo helper de dependências e mantém a consulta histórica.

O catálogo de artefatos foi mantido separado das taxonomias, das associações histórias–testes e da definição do método. Não foi criada US/classificação operacional nem alterado o motor RNF. O rascunho E21 continua sem publicação executável, e Q01/Q02 não foram encerradas. Catálogos sintéticos não substituem dados originais.

## Evidências

| Verificação | Resultado |
| --- | --- |
| API | 99 testes passaram; três novos cobrem publicação/bytes/BOM, validação e declaração de uso. A verificação do perímetro inclui as novas rotas antes do upload. |
| Build API | TypeScript passou. |
| HTTP/PostgreSQL | `check:test-case-catalogs` passou em schema local descartável: bytes exatos, hashes, duas versões, concorrência, imutabilidade SQL, rollback, retirada com lock, histórico e autorização. |
| Artefatos versionados | Duas versões recuperadas do banco forneceram seus próprios textos à demonstração local, sem alterar as pontuações. Não houve execução TestRec persistida. |
| Pacote | [catalog-integration.json](../evidencias/b15b/catalog-integration.json), hash de conteúdo `e812b63e1a6b19e9dbe783493fbd46ab672258356aac868b9747b910349794ef`. Contém snapshots sintéticos, checks e inventário de fontes; não é um pacote experimental. |
| Migration local | 022 aplicada somente em `127.0.0.1:5432/us_agent/public`. As 42 tabelas de dados anteriores mantiveram contagens e SHA-256; criada uma tabela vazia, com função/trigger e registro em `schema_migrations`. [Inventário antes/depois](../evidencias/b15b/local-migration.json). |
| Regressão integrada RNF | `check:recommendation-runs` passou: oito comparações, base selecionada, versões/hashes, decisões, concorrência, rollback, histórico e replay após retirada. |
| Referências preservadas | Replay B14a manteve `d26d28d5ee2da92f6449fe8fb18ed2bfdfd55192bb3a96fdb0a3e8b58a89a3dd`; replay B16a manteve `76e1f0b0e8ef3febbf4851800825743a0f5f00ec31383fe845f8f9e6a6a07f5e`. Os sete arquivos RNF congelados permaneceram byte a byte iguais. |

Nenhuma dependência nova, alteração de interface, acesso a produção, provedor LLM ou importação de dados dos autores. Não houve novo ensaio de navegador; os testes atuais verificam o backend alterado. A declaração de uso não é uma verificação jurídica da licença nem uma confirmação dos autores.

## Continuidade e aderência

Este incremento fecha a persistência/publicação do catálogo, uma dependência concreta da integração de Ednaldo. B15/B16 e RF14 continuam parciais: faltam uma política com identidade/regras publicáveis, base/associações ligadas ao catálogo selecionado, execução persistida comum e interface. A configuração Euclidiana original ainda precisa ser confirmada; a demonstração Manhattan segue identificada separadamente.

Próximo: conectar catálogo, importação da base e execução do segundo método, com snapshots e replay sem afetar RNF. Em acompanhamento permanecem dados/protocolo empírico de Felipe, terceiro exemplo sem US e revisão da orientação. Sem avaliação empírica ou aprovação do professor presumidas.
