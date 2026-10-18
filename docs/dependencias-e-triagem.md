# Dependências — triagem B13a

Consulta e correções em 17/10/2026. Fontes: relatório do registro npm e avisos dos mantenedores. [Antes](evidencias/b13a/audit-before.json): 15 pacotes sinalizados (cinco críticos, seis altos e quatro moderados, incluindo propagação para dependentes). [Depois](evidencias/b13a/audit-after.json): zero alertas reportados para o lockfile consultado. Contagem de pacotes não é contagem de vulnerabilidades distintas.

## Atualizações resolvidas

| Pacote | Versão anterior | Versão corrigida / estado final | Uso relevante no repositório |
| --- | --- | --- | --- |
| `multer` | 2.2.0 | 2.4.0 | Importação textual e bases multipart na API. Há caminhos alcançáveis em runtime. |
| `proxy-addr` | 2.0.7 | 2.0.8 | Dependência do Express. `trust proxy` está desativado e a exceção local usa o socket. |
| `qs` | 6.15.3 | 6.16.1 | Dependência da pilha HTTP/Express. |
| `react-router` / `react-router-dom` | 7.18.1 | 7.18.4 | Rotas React da SPA. O alerta identificado trata RSC, que não está habilitado aqui; ainda assim o pacote foi corrigido. |
| `concurrently` | 9.2.4 | 9.2.5 | Inicialização do desenvolvimento. |
| `shell-quote` | 1.9.0 | 1.12.0 | Dependência do concurrently; comandos do projeto são estáticos. |
| `browserslist` | 4.28.6 | 4.29.3 | Compilação; não recebe consultas fornecidas pelos usuários do US-Agent. |
| `baseline-browser-mapping` | 2.10.44 | 2.11.29 | Compilação. |
| `nanoid` | 3.3.16 | 3.3.20 | Dependência da cadeia de CSS/build. |
| `postcss` | 8.5.21 | 8.5.30 | Compilação de CSS. |
| `source-map-js` | 1.2.1 | 1.2.2 | Cadeia de source maps/build. |
| `vitest` / `@vitest/mocker` | 3.2.7 | 4.1.12 | Testes; não compõem o bundle da aplicação. |
| `tinypool` | 1.1.1 | Removido da árvore resolvida | Dependência do Vitest anterior. |

As correções compatíveis foram aplicadas com `npm audit fix --ignore-scripts`, sem `--force`. O Vitest foi migrado explicitamente para `~4.1.12`, compatível com Vite 7 e Node 24.11.1 instalados, seguindo o [guia oficial de migração para v4](https://v4.vitest.dev/guide/migration.html). As versões mínimas diretas de Multer, React Router DOM e Concurrently também foram elevadas nos manifests. O lockfile foi sincronizado e a árvore não usa overrides para forçar APIs incompatíveis.

## Avisos conferidos nas fontes

- A [lista de avisos do Multer](https://github.com/expressjs/multer/security/advisories) inclui múltiplas falhas de negação de serviço por multipart. O [aviso de gravações órfãs](https://github.com/expressjs/multer/security/advisories/GHSA-3pph-fpjx-jg34) indica a correção 2.4.0. O projeto usa armazenamento em memória, mas os demais caminhos de parsing justificam atualizar a dependência e reverificar os uploads.
- O [aviso do proxy-addr](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h) trata confiança indevida em sub-redes IPv6 mapeadas; a versão 2.0.8 corrige esse comportamento. A configuração atual não habilita essa confiança.
- Os mantenedores do Vitest publicaram em 16/10/2026 dois avisos relevantes para o mocker: [contorno da validação de caminhos no Windows](https://github.com/vitest-dev/vitest/security/advisories/GHSA-xp26-3454-mjgp) e [registro manual de mocks](https://github.com/vitest-dev/vitest/security/advisories/GHSA-qxg6-89mg-rqv8), ambos corrigidos na linha 4.1.12. Esses avisos novos não apareciam no JSON inicial consultado do npm. Escolher somente 4.1.11 não seria suficiente nesta máquina Windows.
- O [aviso de exposição de arquivos pelo Vitest 5](https://github.com/vitest-dev/vitest/security/advisories/GHSA-p458-7748-mcp3) delimita outra faixa, de 5.0.0-beta.6 a anterior a 5.0.5. A linha 4.1.12 escolhida não pertence a essa faixa.

O repositório executa testes em modo `run`, sem Vitest UI, Browser Mode ou servidor de mocks público. A inferência de menor exposição nesses caminhos decorre desse uso; não é uma demonstração de inexistência de vulnerabilidade. As correções foram aplicadas mesmo quando os pré-requisitos do alerta não estão presentes no fluxo atual.

## Evidência e limites

Foram verificados testes de API, interface e fronteiras Python, compilação, importação HTTP/PostgreSQL, revisão/classificação e referência RNF. O fluxo completo no navegador e seus artefatos estão registrados na [entrega 011](entregas/011-perimetro-e-dependencias.md).

Os JSONs preservam respostas da consulta datada ao registro; devem ser repetidos ao mudar o lockfile e periodicamente. `npm.cmd run check:dependencies` permite repetir a verificação com falha em qualquer severidade. Zero alertas nessa consulta não constitui auditoria completa, não cobre dependências Python e não conclui identidade, permissões ou isolamento da B13.
