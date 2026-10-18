# Entrega 011 — Perímetro HTTP e dependências corrigidas

Data: 17/10/2026. Escopo: B13a. **B13 permanece em andamento.** Contratos: [proteção de acesso](../seguranca-acesso.md), [triagem das dependências](../dependencias-e-triagem.md) e [ADR 005](../decisoes/005-perimetro-e-identidade.md).

## Resultado

Rotas operacionais antigas de leitura e escrita não aplicavam a chave que protegia os recomendadores configuráveis e a ingestão. Agora uma verificação central protege todo `/api` antes de processar JSON, multipart ou executar handlers. Sem chave, a exceção fica restrita ao desenvolvimento local com socket/Host locais, sem cabeçalhos de proxy. Produção em qualquer plataforma e Vercel recusam a ausência de configuração. A chave configurada é exigida inclusive localmente.

O CORS universal foi substituído por origens permitidas explicitamente pela política. Requisições recusadas não executam o endpoint. Os dados da API usam `no-store`, e cabeçalhos encaminhados não comprovam identidade ou acesso local. O servidor de desenvolvimento escuta em loopback por padrão; o proxy Vite aponta ao IPv4 local explícito.

A leitura de taxonomia pelo worker Python e a consulta da exportação CSV passaram a enviar a credencial técnica. A exportação não grava o segredo no CSV. As regras, as fórmulas e os registros históricos do RNF não foram alterados.

Os 15 pacotes sinalizados pelo npm foram corrigidos. As atualizações compatíveis foram aplicadas sem `--force`; o Vitest recebeu migração controlada de 3.2.7 para 4.1.12, que também contempla dois avisos recentes dos mantenedores ainda ausentes da consulta inicial do npm. O relatório final retornou zero alertas. Isso é evidência datada da árvore JavaScript resolvida, sem equivaler a uma auditoria completa.

## Evidências

| Verificação | Resultado |
| --- | --- |
| API | 79 testes passaram. Os dois novos testes incluem negação de 25 rotas representativas, produção/Vercel/modo inválido, Host hostil via HTTP real, proxy, origem, preflight e importação multipart autorizada. |
| Web | 45 testes passaram no Vitest 4.1.12; não houve relaxamento de expectativas. |
| Python | Dois testes passaram: Bearer em leitura/escrita do worker e exportação CSV sem segredo no arquivo, com rede e `.env` simulados. |
| Build | API e interface compilaram; Vite 7.3.6 preservado. |
| HTTP/PostgreSQL configurável | `check:recommendation-runs` passou: oito saídas de referência, importação/publicação, dependências, concorrência, revisão, deduplicação, rollback e replay. |
| Classificação/revisão | `check:classification-workflow` passou novamente com provedores simulados. |
| RNF legado | `check-nfr-recommendations.mjs` passou: ranking, proveniência, decisões, idempotência e guardas anteriores. |
| Preservação | Sete hashes dos arquivos congelados conferidos; nenhuma migration nova ou regravação de dados anteriores. |
| Navegador real | Edge percorreu novamente taxonomia → definição → importação → execução → destino explícito → aceitar/rejeitar → histórico → replay. Desktop 1440 px e mobile 390 px, sem transbordamento horizontal e sem controles visíveis sem rótulo no recorte verificado. Capturas inspecionadas. |
| Dependências | npm: 15 pacotes sinalizados antes, zero depois. Vitest/mocker 4.1.12, Multer 2.4.0 e proxy-addr 2.0.8 entre as correções; tinypool removido da árvore. |

Artefatos: [audit antes](../evidencias/b13a/audit-before.json), [audit depois](../evidencias/b13a/audit-after.json), [versões selecionadas](../evidencias/b13a/dependency-versions.json), [resumo do navegador](../evidencias/b13a/browser-summary.json), [desktop](../evidencias/b13a/desktop.png) e [mobile](../evidencias/b13a/mobile.png).

O primeiro percurso desta etapa detectou uma corrida no script de navegador: o título da seção aparecia antes do carregamento do campo de destino. O script passou a esperar o controle habilitado e a opção efetivamente disponível, com prazo e diagnóstico em caso de falha. A repetição do percurso completo passou. O primeiro teste de Host também revelou que o `fetch` normalizava esse cabeçalho; a verificação passou a enviar Host hostil pelo cliente HTTP do Node, comprovando a negação real.

Todas as verificações funcionais com banco usaram PostgreSQL local e schemas sintéticos descartados. O artefato do navegador não representa registros persistentes no schema público. Compilação, Vitest, consulta/instalação npm e Edge usaram execução autorizada pela ferramenta quando necessário. Não houve deploy, chamadas reais a provedores de IA, leitura de `.env` reais ou aplicação de migrations no banco operacional.

## Limites e continuidade

**A interface web em ambiente protegido aguarda a sessão pessoal de B13b.** Não enviar a chave de integração ao navegador. O acesso técnico compartilhado não comprova autoria pessoal nem concede permissões distintas; o usuário padrão exibido no contexto continua sendo configuração da aplicação. B13a não conclui acesso entre organizações.

Próximo: B13b, identidade pessoal, sessões revogáveis, permissões e autoria; depois B13c, escopo organizacional de consultas, mutações, dependências, destinos e processos de serviço, com testes entre organizações. A [ADR 005](../decisoes/005-perimetro-e-identidade.md) registra os critérios. Bases restritas aguardam esse fechamento.

O piloto RNF, os métodos de Ednaldo/terceiro exemplo, a adaptação de sentenças e a avaliação empírica permanecem pendentes. As questões metodológicas de Felipe/Ednaldo continuam na [matriz de fidelidade](../referencias-e-fidelidade.md); esta entrega não obteve novos artigos nem encerrou essas questões.
