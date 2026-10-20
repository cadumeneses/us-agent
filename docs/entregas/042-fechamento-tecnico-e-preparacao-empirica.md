# 042 — Fechamento das pendências técnicas e preparação empírica

20/10/2026. Continuidade do pedido para concluir o plano: implementação, material acadêmico e preparação de avaliação executados localmente. Esta entrega **não declara o plano empírico concluído**, não inventa pessoas/observações e não atribui aprovação à orientação. Não houve deploy ou alteração de produção.

## Entregas concluídas neste incremento

| Frente | Resultado revisável | Estado |
| --- | --- | --- |
| Adaptação RNF / RF11 | [Cópias versionadas](../adaptacao-rnf.md), motivo, autoria, cadeia de hashes, histórico e exportação pela interface; origem, decisão, run/base/história preservados. Migration 030. | Implementado e verificado no fluxo RNF com base publicada. |
| Papéis, autoria e auditoria / B13 | [Organizações e acesso](../acesso-organizacoes-e-auditoria.md), papéis na API, seleção/administração pela interface, escopo transacional por schema, atribuição do ator autenticado e auditoria imutável. Migration 031. | Implementado e verificado em HTTP/PostgreSQL local, inclusive acesso cruzado, concorrência e revogação. Implantação pendente. |
| Estudo de configuração dos três exemplos | [Tarefas e instrumento v3](../estudo-tres-casos-v3.md), propostas D01–D12, geração/replay, arquivos de participante separados do gabarito e verificação de artefatos/publicações/execução. | Preparação técnica concluída. Revisão/coleta humana não realizadas. |
| Material acadêmico | [Artigo técnico](../academico/artigo-us-agent.md) e [capítulo de implementação/avaliação](../academico/capitulo-implementacao-avaliacao.md), com arquitetura, métodos, resultados técnicos, ameaças e limites empíricos. | Textos redigidos e vinculados à evidência disponível; revisão acadêmica/submissão não presumidas. |
| Avaliação integrada | 23 condições preservadas, duas repetições por condição, oito resultados RNF iguais, quatro comparações de risco preservadas e falhas/vazios contabilizados. | Gate técnico aprovado; relevância e esforço empíricos não medidos. |

Os demais tipos/representações, LLM genérico por atributo, adaptação operacional de riscos e a troca definitiva da leitura WIS não são declarados implicitamente implementados por este fechamento. A preparação WIS 029 permanece no release e o classificador continua com seu caminho compatível até um incremento de troca explícita.

## Verificações executadas

- Build API e web aprovados; 154 testes API e 65 web existentes aprovados. O teste existente de avaliação RNF também exercita salvar a adaptação e preservar o original.
- `check:recommendation-runs`: destinos, decisões, duas revisões RNF, repetição, conflitos, imutabilidade, fonte preservada e replay.
- `check:organization-access`: dois schemas, papéis, acessos cruzados, 12 consultas intercaladas, revogação imediata, último administrador, autoria e auditoria imutável.
- `check:private-web-access`: login/sessão, rotação/revogação, origens, limites e migrations idempotentes com 32 arquivos.
- `check:legacy-taxonomy-migration`: quatro versões de ensaio, três rascunhos, uma versão vazia, 38 nós e três operações desativadas; fonte intacta, rollback, repetição e divergência detectada. Contagens são do fixture local.
- `check:configuration-v3`: três métodos, registro vazio, conclusão sem checkpoints recusada, coleta sem revisão recusada, geração/replay, snapshots/artefatos e adulteração detectada. Eventos de verificação são explicitamente sintéticos.
- `evaluate:integrated`: 23 condições técnicas, hash determinístico `40ec09df722e799c02afc27f03a36d8f586f805b5b2edc1b853f2ae991b60871`. Uma tentativa de replay de pacote criado antes de terminar as alterações foi corretamente recusada por diferença de fontes. O pacote `tmp/integrated-close042-final` foi então gerado com as fontes finais do avaliador e seu replay passou, sem relaxar a checagem.
- Release SQL conferido por hash; migrations antigas e pacotes científicos congelados não foram reescritos. Mudanças de código recebem novas identidades de fonte.

## Instalação do conjunto atual

O release contém **32 arquivos**, até 031. Os dados antigos permanecem preservados, mas o código novo depende de 030/031, enquanto o parser antigo não aceita o campo `selectable` dos rascunhos 029. Portanto a sequência do incremento 041 isolado não serve para instalar este conjunto completo sem uma janela de transição.

1. Conferir o destino e ensaiar em uma branch/cópia atual de produção, com arquivo de ambiente separado. Usar conexão direta, revisar vínculos existentes e guardar evidência do ensaio. Esta entrega fez somente ensaios locais.
2. Preparar o build e o deploy do código compatível. Abrir janela de manutenção no gateway/hosting, impedindo uso/escritas e roteamento para versões antigas durante a transição.
3. Na raiz, conferir arquivos/status e aplicar o release pendente **sem `--through 028`** neste conjunto:

```powershell
npm.cmd run db:release:check
node --env-file=.env.vercel.production scripts/migrate-deployment.mjs --status
node --env-file=.env.vercel.production scripts/migrate-deployment.mjs --apply --expect-target "HOST_DIRETO:5432/BANCO"
node --env-file=.env.vercel.production scripts/verify-legacy-taxonomy-migration.mjs --expect-target "HOST_DIRETO:5432/BANCO"
```

4. Publicar a API/interface compatíveis e aguardar substituição das instâncias antigas. Conferir login, projetos/histórias, rascunhos WIS, RNF/replay, **Access and audit**, autoria e permissões. Verificar os papéis no registry; usuários ativos pré-existentes conservaram acesso como administradores de `default`, sem atribuição arbitrária de um novo papel restrito a uma pessoa.
5. Reabrir o tráfego somente após as conferências. Registrar migrations/destino/versão observados. Novas organizações são provisionadas pelo script explícito descrito no guia de acesso, sem compartilhar dados antigos ou entregar a chave técnica ao navegador.

O runner aplica cada migration em transação e ignora nomes já registrados. Falha em 030/031 não reverte migrations anteriores confirmadas; manter manutenção, corrigir a causa e repetir com destino conferido. Não fazer downgrade para código que ignore os novos controles/formatos enquanto o ambiente estiver aberto. Se for necessária restauração do ambiente, usar o procedimento do provedor a partir da cópia/ponto preservado e uma versão de código correspondente. Não há migration destrutiva automática de retorno.

## O que ainda impede declarar o plano inteiro concluído

O repositório contém ensaios e anotações sintéticas; não foi identificada uma coleta observada utilizável. O registro v3 tem zero sessões. Para encerrar B14/B18/B22 empiricamente, são necessários dados autorizados e julgamentos independentes, previsões/revisões reais pareadas quando aplicáveis, protocolo revisado, participantes e observações efetivas com artefatos auditados. A ferramenta já aceita e confere os registros, mas não pode produzir o comportamento das pessoas.

B23 agora tem textos acadêmicos concretos e instrumento para os três exemplos. A incorporação de resultados empíricos e a revisão acadêmica permanecem dependentes dessas evidências. A implantação de 029–031 também continua pendente. Não marcar essas condições como cumpridas com base em testes ou em uma proposta metodológica preenchida pelo desenvolvimento.
