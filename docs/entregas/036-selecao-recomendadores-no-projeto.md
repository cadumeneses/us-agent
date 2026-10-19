# 036 — Seleção de recomendadores no fluxo do projeto

19/10/2026. Refinamento do segundo exemplo por solicitação do usuário. RF01, RF09 manual, RF10–RF11 e RF14 no recorte implementado.

O menu passa a ter **Recommenders**, reunindo **Non-functional requirements** e **Test cases**. Conforme solicitado pelo usuário, todos os textos acrescentados à interface ficam em inglês, incluindo mensagens, acessibilidade, origem e resultados; datas/números seguem `en-US`. A pessoa escolhe o recomendador e reutiliza projeto/história classificados; o detalhe do projeto oferece acesso com contexto preservado. Perfil, tarefas e classificação continuam usando o cadastro existente.

O caminho de casos de teste carrega configuração publicada, contexto da história e bases compatíveis; preenche identidade, classificação e campos de perfil compatíveis, conserva proveniência e solicita os demais valores explicitamente. Não converte nomes em IDs de taxonomia ou presume equivalência de taxonomias. Pares múltiplos e múltiplas bases/configurações exigem escolha; catálogo exato da base tem disponibilidade verificada. Se faltar base/configuração, mostra acesso para preparação, sem publicar exemplos automaticamente.

Resultados destacam os casos recuperados, com detalhes técnicos, avaliação/adaptação e replay acessíveis por expansão. Permanecem o executor, dados e política demonstrativa E21; não houve alteração de algoritmo, migration, provisionamento ou deploy. O caminho RNF usa o histórico operacional existente; execuções RNF com bases publicadas permanecem na área de bases. Esta mudança não declara RF02/RF07 genéricos ou o terceiro caso sem US concluídos.

Verificação: build web e os 65 testes web preexistentes; nenhum teste automatizado novo ou arquivo de teste alterado. Integridade científica conferida no índice com 198 hashes preservados e whitespace conferido. Não foi realizado novo percurso no navegador contra banco de produção. A conferência adicional de bytes do worktree detectou CRLF em `research-inputs.ts`; normalizar somente para comparação coincide com o índice, cujo hash científico permanece correto. Esse arquivo não foi alterado nesta entrega.

O [roteiro de uso](../recomendadores-web.md) descreve o fluxo atual. Próxima frente do plano: terceiro exemplo sem US e configurabilidade efetiva dos atributos de cálculo, preservando a distinção entre demonstração funcional e reprodução científica.
