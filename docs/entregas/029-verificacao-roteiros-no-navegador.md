# Entrega 029 — revisão do plano e roteiros no navegador

19/10/2026. B18d, continuidade de RF13/RQ05 e A2–A5 conforme o documento de requisitos recebido. Revisão do plano e dos critérios relatados; os áudios originais não foram reanalisados e não há aprovação presumida da orientação.

## Resultado da revisão

A direção permanece alinhada, mas o atendimento é parcial. O resumo do plano estava em B02f e a prioridade de aderência ainda tratava Q02 como inteiramente aberta. Foram atualizados para B02g/B02h/B18b/B18c/B18d: CT01/TC01 já esclarecido, CT05 residual pendente, materiais concretos e percurso automatizado verificado. Os registros históricos continuam preservados.

A pendência técnica independente escolhida foi percorrer os materiais B18c no navegador. O próximo incremento é o vínculo explícito desses materiais ao protocolo/analisador, preservando os pacotes anteriores. Não se acrescentaram algoritmos, regras presumidas de artigos ou reparos aos dados.

## Implementação e evidência

`npm.cmd run check:configuration-tasks-browser` verifica o manifesto dos materiais congelados e percorre os dois exercícios por controles do Edge: taxonomias, definições, catálogo de testes, importação, preenchimento, execução, histórico, replay e download JSON. A aplicação usa API construída e schema PostgreSQL local aleatório; o schema é descartado no encerramento. Acesso ao banco durante a tarefa apenas confere o que a interface produziu. Não houve publicação por atalhos de API ou pré-carga do gabarito.

Revisão da aplicação verificada: `6c1dff6405904ec140ee5a505777ad41668ddb6b`; navegador Edge `155.0.4283.62`, idioma `en`. O novo script e as evidências são adições posteriores a esse commit. Os hashes dos componentes consultados constam no resumo; o manifesto preserva o script e a referência ao lote congelado. A verificação não envolve deploy.

- [Resumo automatizado](../evidencias/b18d/summary.json) e [manifesto](../evidencias/b18d/manifest.json).
- [Exportação RNF](../evidencias/b18d/rnf-run.json): um registro, resultado SHA-256 `37be7574a42807fc71e74e2d24f911d13562c210bfa52ef7c8f704cf8bceeb73`.
- [Exportação de testes](../evidencias/b18d/tests-run.json): quatro registros, resultado SHA-256 `8bf162f6b4a118f9fcd2cab811cfc595f550e0d82151ed5977f023b57acfc04a`.
- Capturas [RNF](../evidencias/b18d/rnf.png) e [testes](../evidencias/b18d/tests.png), inspecionadas visualmente; não constituem avaliação de usabilidade.

As publicações das definições e os resultados completos coincidiram com o gabarito offline. IDs, valores, ordem dos registros, origem declarada da base, hash de arquivo e proveniência de importação foram conferidos. O alvo e sua proveniência também coincidiram. Histórico após recarga, replay e exportação integral passaram nos dois casos, sem exclusões ou exceções JavaScript. Nenhum projeto/classificação operacional, decisão de avaliação ou cópia adaptada foi criado.

A primeira passagem revelou uma comparação incorreta na nova checagem: a proveniência de cada registro importado referencia o hash do arquivo e o ID de origem; ela não deve copiar a proveniência do JSON de entrada. A checagem foi corrigida para conferir ambos os contratos. Não foi necessário modificar a aplicação ou os materiais. O build web precisou sair do sandbox por restrição de leitura do esbuild; o Docker/PostgreSQL local foi iniciado para a execução.

Verificações concluídas: builds API/web; percurso dos dois roteiros no navegador; oito cenários congelados RNF; replays dos 13 cenários RNF B14a, seis cenários de testes B18a, instrumento B18b e materiais B18c; checagem de repetibilidade, não sobrescrita, namespace e recusa de gabarito adulterado mesmo após recalcular seu hash. Não houve alteração no motor ou nas fórmulas. O índice científico inclui os novos artefatos e preserva os pacotes anteriores.

## Limites e próximos critérios

Este é um percurso técnico automatizado, sem participantes, tempos humanos ou resultados empíricos. O RNF usa reconstrução de compatibilidade; testes usam a demonstração sintética Manhattan/K=3, não reprodução Euclidiana de TestRec. As exportações preservam as execuções mesmo após o descarte do schema; reexecuções criam outros UUIDs/hashes completos, conservando os resultados esperados.

Continuam abertos: vínculo versionado de protocolo/material/analisador; decisões metodológicas e coleta de configuração; avaliação científica de classificação/recomendação; fontes/associações/recorte/código/folds e Q01/Q03/CT05 de Ednaldo; complementação de Felipe; terceiro exemplo sem US com fonte confirmada de Ademar; consolidação dos três exemplos e revisão da orientação. Esses critérios não foram substituídos por testes sintéticos.
