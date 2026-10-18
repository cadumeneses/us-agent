# Entrega 010 — Avaliações persistidas e vertical RNF verificado

Data: 17/10/2026. Escopo: B12c e fechamento técnico de B12 no recorte RNF. Contratos: [avaliações configuráveis](../avaliacoes-configuraveis.md) e [ADR 004](../decisoes/004-destinos-e-avaliacoes.md).

## Resultado

Cada sugestão pode ser aceita ou rejeitada com observação. Antes, a pessoa confirma explicitamente o destino: entrada preservada ou história operacional escolhida, revisada e justificada. IDs importados nunca selecionam automaticamente uma história local. Destino e decisões são imutáveis; mudar destino ou reavaliar exige outra execução.

Aceitar cria um vínculo rastreável sem duplicar o RNF; rejeitar não cria vínculo. Para histórias, o backend confere classificação atual, estado, par módulo/operação e hash do contexto revisado. Alterações posteriores impedem nova aceitação até outra execução/revisão. A falha de gravação final desfaz os efeitos intermediários.

O histórico exibe decisão, observação, destino, autoria técnica, data e hashes. A evidência completa pode ser baixada sem modificar o resultado original. Replay continua verificando o resultado bruto. A aceitação não retroalimenta a base publicada.

Também foram declarados idioma, título, codificação e viewport no HTML inicial. O viewport ausente impedia tratar a largura do celular corretamente na verificação real.

## Evidências

| Verificação | Resultado |
| --- | --- |
| API | 77 testes passaram, incluindo os contratos de avaliação e isolamento das identidades. |
| Web | 45 testes passaram, incluindo seis novos de destino explícito, aceitação/rejeição, observações, falha de rede, conflitos e duplo envio. |
| Build | API e web compilaram. |
| HTTP/PostgreSQL | `check:recommendation-runs` passou com o novo módulo de revisão: confirmações concorrentes, UUID idempotente, imutabilidade, IDs importados/locais coincidentes, destinos alterados e falha forçada no INSERT final. |
| Deduplicação operacional | Duas execuções aceitaram concorrentemente o mesmo item para a mesma classificação: um RNF operacional, com efeitos `created`/`already_present`. |
| Regressão RNF | Oito resultados congelados permaneceram iguais; sete hashes de arquivos legados preservados. O check do fluxo RNF anterior passou. |
| Classificação/revisão | `check:classification-workflow` passou novamente. |
| Migration local | Migration 021 aplicada somente em `127.0.0.1`; contagens e SHA-256 das 39 tabelas anteriores permaneceram iguais. Três tabelas novas, sem reescrever dados anteriores. |
| Navegador real | Edge headless percorreu taxonomia → definição com contexto adicional → importação/prévia/publicação → formulário → execução → destino operacional explícito → aceitar/rejeitar → recarregar histórico → replay. |
| Desktop/mobile | Viewports reais de 1440 e 390 px, sem transbordamento horizontal no recorte capturado e sem controles de formulário visíveis sem rótulo. Capturas inspecionadas visualmente. |

Evidência preservada: [resumo do navegador](../evidencias/b12c/summary.json), [desktop](../evidencias/b12c/desktop.png) e [mobile](../evidencias/b12c/mobile.png). As capturas são de um schema sintético descartado após o teste; os IDs nelas não identificam execuções publicadas no banco da aplicação.

O PostgreSQL/Docker estavam parados no início da verificação; foram iniciados localmente com autorização da ferramenta. Testes/build Vite e Edge headless usaram a execução autorizada fora do sandbox. Todos os ensaios funcionais usaram schemas locais descartáveis. Não houve acesso a produção nem a provedores de IA.

## Limites e próximo trabalho

B12 está tecnicamente verificado para o RNF implementado, sem equivaler à aprovação do professor, a um estudo de usabilidade ou a uma auditoria completa de acessibilidade. O ensaio de navegador foi automatizado e as capturas foram inspecionadas; não houve avaliação com leitores de tela ou participantes.

Autoria continua técnica; autenticação por pessoa, permissões, isolamento e triagem das dependências são o próximo incremento, **B13**, antes de bases restritas. Adaptação de sentenças não foi implementada. Piloto/protocolo, artigos/dados originais e os métodos de Ednaldo e do terceiro exemplo permanecem pendentes. A [matriz de fidelidade](../referencias-e-fidelidade.md) continua distinguindo compatibilidade sintética e avaliação empírica.
