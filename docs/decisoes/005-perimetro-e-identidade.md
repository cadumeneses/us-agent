# ADR 005 — Fechar o perímetro antes da identidade pessoal

Data: 17/10/2026. Estado: implementado para B13a; B13b/B13c permanecem pendentes.

Prioridade revista após o pedido do usuário de conferir o escopo: o [piloto RNF local B14](../revisao-de-escopo.md), com dados sintéticos ou públicos autorizados, pode avançar antes de B13b/B13c. As exigências abaixo permanecem antes de bases restritas/empresariais ou uso multiusuário protegido. A sequência B13a–B13c descreve dependências internas de segurança, não uma obrigação de adiar todos os outros incrementos.

## Problema e decisão

Os recomendadores configuráveis e a ingestão validavam uma chave compartilhada, mas as rotas operacionais antigas, inclusive consultas e mutações, não aplicavam essa barreira. A ausência de chave era negada apenas na Vercel. O CORS universal também permitia que páginas de outras origens lessem uma API local aberta.

Centralizar a verificação antes de todos os parsers/routers sob `/api`. Sem chave, liberar apenas desenvolvimento local direto, com socket e Host locais e sem cabeçalhos de encaminhamento. Exigir chave fora desse cenário, em qualquer plataforma, inclusive se `API_ACCESS_MODE=local` for levado indevidamente a produção. Recusar origens não permitidas antes da execução. Manter a credencial técnica fora do frontend.

Este recorte é uma barreira transitória verificável. Preserva dados, métodos científicos e a identidade técnica registrada anteriormente. Não atribuir nomes pessoais a ações de uma chave compartilhada e não reescrever históricos como se houvesse autenticação anterior.

## Sequência para concluir B13

| Incremento | Resultado necessário | Revisão exigida antes de fechar |
| --- | --- | --- |
| B13a — perímetro e dependências | Proteção de rotas antigas/novas, regras locais/origens e correções dos alertas identificados. | Negação anterior a efeitos/parsers; compatibilidade RNF e importação; relatório de dependências antes/depois. |
| B13b — identidade, sessões e permissões | Login individual, expiração/revogação/logout, papéis e autoria real nas alterações. Credenciais de serviço separadas das sessões e com escopo explícito. | Usuário desativado/sessão revogada recusados; leitura e mutação verificadas por papel; autor vem da sessão, sem confiar no corpo/headers de identidade. Interface autenticada sem segredo de integração. |
| B13c — organizações e auditoria integrada | Escopo organizacional obrigatório em consultas, mutações, dependências e destinos, incluindo o caminho legado; histórico auditável. | Duas organizações com IDs iguais/diferentes não leem, vinculam ou alteram dados entre si; IDs ou hashes conhecidos não contornam o escopo; transações, replay e processos de serviço respeitam o isolamento. |

A arquitetura atual usa tabelas e consultas globais. Não declarar isolamento apenas acrescentando um campo ou filtro ao frontend. A implementação de B13c deve conferir todas as consultas e relações, migração/preservação do workspace existente e comportamento dos processos de integração. O mecanismo de isolamento será decidido e registrado com o contrato executável correspondente.

## Consequências

Sem sessão pessoal, a interface em produção fica bloqueada pela mesma regra das integrações. Essa limitação é explícita e deve ser resolvida por B13b; distribuir a chave compartilhada no navegador não é uma solução. O desenvolvimento local e os ensaios sintéticos continuam disponíveis.

O resultado sem alertas do npm é uma consulta datada às dependências JavaScript resolvidas. Não prova ausência de vulnerabilidades nem conclui a segurança de aplicação. O piloto com bases restritas aguarda B13b/B13c. Não há mudanças nas políticas científicas de Felipe ou Ednaldo.
