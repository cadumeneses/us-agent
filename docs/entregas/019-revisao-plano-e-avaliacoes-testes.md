# Entrega 019 — Revisão do plano e avaliações de testes

Data: 18/10/2026. Pedido: revisar aderência ao plano e continuar o desenvolvimento com qualidade. Recorte implementado: B17b/RF11, avaliações e cópias humanas rastreáveis.

## Resultado da revisão

A direção permanece alinhada aos pedidos relatados: RNF configurável, outro conjunto de atributos/taxonomias/saídas no mesmo núcleo KNN e evidências preservadas. O atendimento global continua parcial. E3 tem agora o percurso técnico demonstrativo; confirmação científica, dados e avaliação empírica continuam abertos. O exemplo de Ademar sem US ainda não existe como execução.

Foi encontrada uma divergência documental: o plano principal ainda apresentava como próxima frente a integração de catálogo/base/execução, concluída em B15c/B16b e ampliada pela interface B17a. O cabeçalho, estado corrente e workflow foram atualizados, preservando o diagnóstico histórico. Não houve evidência de desvio do desenvolvimento para novos algoritmos, geração por LLM ou infraestrutura de contas/organizações.

O destino da avaliação foi refinado para a entrada preservada da execução. Isso atende ao vínculo rastreável de RF11 sem inferir IDs operacionais a partir da base importada. A [ADR 006](../decisoes/006-avaliacoes-e-copias-testes.md) documenta essa escolha de engenharia, a autoria técnica e os campos editáveis. Não é uma decisão atribuída ao professor nem parte presumida do método de Ednaldo.

## Desenvolvimento

B17b acrescenta confirmação do destino, aceitar/rejeitar com observações e cópias versionadas de testes aceitos. Título/Gherkin podem ser adaptados com motivo; origem, metadados, item original, execução, catálogo, decisão, destino e revisão anterior permanecem preservados. Decisões e versões são imutáveis; requisições repetidas são idempotentes e concorrência não sobrescreve uma revisão.

O fluxo tem API própria e [interface/histórico/exportação](../avaliacoes-testes.md), sem usar vínculos RNF. A migration 024 cria três tabelas e triggers, preservando os dados anteriores. As políticas e os módulos de cálculo congelados não foram alterados.

## Verificações

| Verificação | Resultado |
| --- | --- |
| API | 109 testes passaram, incluindo origem/destino, cópias, integridade e perímetro das novas rotas. |
| Interface | 61 testes passaram, incluindo aceitar/rejeitar, duas revisões, repetição de UUID e rascunhos após falha/conflito. |
| Builds | API e web compilaram. Vite executado fora do sandbox pela restrição de acesso já identificada. |
| HTTP/PostgreSQL | Destino explícito, decisões imutáveis, cópias somente de aceitos, revisões concorrentes, referências, histórico paginado, rollback e retirada passaram. [Pacote](../evidencias/b17b/assessment-integration.json). |
| Replay da avaliação | Reconstruiu destino, duas decisões e duas cópias; SHA-256 `2414c80f8c382fa96f1d4ecc8a4c5220a49bc4a0ecc1193fa85bedc91261beb3`. |
| Navegador | Edge percorreu configuração → importação → execução → destino → aceitar/rejeitar → duas revisões → exportação → histórico/replay após retirada. [Resumo](../evidencias/b17b/browser-summary.json). |
| Visual | Desktop/mobile inspecionados, sem transbordamento horizontal ou controles visíveis sem rótulo nos pontos verificados. [Desktop](../evidencias/b17b/desktop-assessment.png), [mobile](../evidencias/b17b/mobile-assessment.png). |
| Regressão RNF | Check HTTP preservou oito saídas, destinos, decisões, deduplicação, rollback e replay. Baseline de oito cenários passou. |
| Pacotes científicos | B14a, B16a e B16b mantiveram seus hashes. A fonte E21 local continuou verificada; CT01 permanece 0,42 reportado versus 0,25 calculado, sem ajuste do oráculo. |
| Stage | `check:scientific-index` conferiu 58 fontes e três artefatos: 61 hashes iguais, com finais de linha preservados. Os 59 arquivos preparados incluem B17a e B17b; não houve conflitos ou alterações rastreadas fora do stage ao fechar. |
| Banco local | Migration 024 acrescentou três tabelas; contagens/hashes das 43 tabelas de dados anteriores ficaram iguais, totalizando 46. [Inventário](../evidencias/b17b/local-migration.json). |

Os ensaios usaram schemas locais descartáveis e dados sintéticos. A aplicação da migration foi limitada ao banco local explícito; não houve acesso a produção ou LLMs externos. Ator técnico não equivale a usuário autenticado ou autorização de uso de dados originais.

## Continuidade

B17 está tecnicamente verificado no recorte demonstrativo com destino na entrada preservada. Isso não encerra B15/B16 científicos ou B18. Próximo foco: preparar a avaliação do segundo exemplo com referências de relevância e protocolo declarados, acompanhando Q01/Q02 e dados autorizados; continuar protocolo/dados empíricos RNF e confirmar o material de Ademar para B19. Uma eventual avaliação sintética deve permanecer identificada como verificação do avaliador.

Faltam avaliação empírica dos artigos, dados/código autorizados, esforço de configuração com participantes, terceiro exemplo sem US e revisão do professor. B13b/B13c continuam condicionantes de bases restritas ou uso multiusuário protegido. O desenvolvimento não deve transformar essas pendências em alegações concluídas.

As alterações necessárias foram preparadas no stage, preservando as adições anteriores. Não foram feitos commit ou push; PDFs e temporários ficaram fora do stage.
