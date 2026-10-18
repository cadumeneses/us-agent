# Entrega 009 — Configuração, publicação e importação pela web

Data: 17/10/2026. Escopo: B12b concluído. B12 permanece aberto para decisões por item e verificação do vertical completo em navegador. Continuidade: [pendências](../pendencias-e-proximos-passos.md).

## Resultado

A área **Configurar e importar bases**, acessível a partir de **Bases publicadas**, acrescenta editores de definições/atributos, taxonomias e importação CSV/JSON. As abas conservam os formulários. Publicações existentes ficam somente para consulta; uma cópia exige informar outra versão antes de salvar.

O modelo RNF carrega o contrato preservado. Permite editar nomes, IDs, tipos, cardinalidade, papéis, obrigatoriedade, campos de registros, referências taxonômicas, vínculos e correspondências explícitas entre IDs e nomes científicos. O método disponível permanece o RNF implementado; não são oferecidos algoritmos ou parâmetros científicos fictícios.

Taxonomias têm origem, lista/árvore, seleção de qualquer nó/folha, IDs, descrições e pais. A API continua recusando rascunhos estruturalmente inválidos, inclusive ciclos, pais ausentes e IDs duplicados.

A importação informa definição exata, arquivo, origem, autorização e mapeamento. Os caminhos usam uma chave por linha, distinguindo JSON aninhado de cabeçalhos com pontos. Um botão aplica explicitamente o formato de registros US-Agent; o mapeamento permanece revisável. Arrays/registros/números/booleanos em CSV usam células JSON quando declaradas.

A prévia preservada exibe arquivo, hashes, origem, mapeamento, registros, problemas e campos não mapeados. Não há exclusão automática. Duplicatas podem ser resolvidas conservando uma ocorrência válida. Trocar arquivo, metadados ou mapeamento invalida a prévia exibida. Uma prévia anterior pode ser recuperada pelo ID; sua publicação usa o conteúdo e a identidade preservados, exibidos na revisão.

## Proteção da revisão

Salvar e publicar são ações distintas. A publicação fica desabilitada durante edição local não salva. O cliente envia `expectedDraftSha256`; o backend confere esse hash depois de bloquear a linha na transação e retorna 409 se o rascunho mudou. Definições retornam `draftSha256`, calculado sobre o conteúdo no estado `draft`; taxonomias usam o snapshot existente.

O parâmetro é opcional na API para preservar clientes anteriores; a interface sempre o envia. Repetir publicação com o mesmo hash/conteúdo retorna a mesma versão. Uma retirada impede republicação. Não houve migration nem alteração de fórmula RNF.

## Evidências

| Verificação | Resultado |
| --- | --- |
| API | 75 testes passaram. |
| Web | 39 testes passaram: 26 anteriores e 13 novos. |
| Contratos reais na UI | Editores passaram pelos validadores reais; importações JSON/CSV passaram pelo importador real, preservando dois pares, texto curto, arrays e exclusões. O mapeamento científico foi validado com uma taxonomia publicada. |
| Revisão concorrente | Checks HTTP recusaram hash antigo sem publicar, aceitaram hash atual e confirmaram repetição idempotente e compatibilidade com corpo vazio. |
| Persistência/regressão | Checks de taxonomias, definições, bases e execuções passaram em schemas temporários locais; os oito resultados RNF permaneceram iguais. |
| Build | API e web compilaram. |
| Preservação | Sete hashes inventariados do legado permanecem iguais. Nenhuma alteração de schema ou publicação no banco da aplicação. |

Testes/build web exigiram execução fora do sandbox pela restrição de leitura do Vite já registrada. Os checks de banco usam e removem seus próprios schemas locais. Não houve acesso a produção ou a modelos externos.

## Limites e continuidade

O acesso respeita a autorização interna existente, sem expor chave ao frontend. Autoria pessoal, permissões e isolamento continuam em B13. Não houve nova obtenção de artigos, reprodução empírica ou encerramento das questões metodológicas de Felipe/Ednaldo.

As interações foram verificadas em jsdom e com validadores/importador reais; persistência foi verificada por HTTP/PostgreSQL separadamente. Não houve inspeção visual/manual em navegador. Próximo: **B12c**, com avaliação por item, aceitação/rejeição persistida e vínculo explícito com artefato. O fechamento de B12 exige demonstração integrada em navegador.
