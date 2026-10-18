# Entrega 008 — Seleção, execução e histórico configuráveis na web

Data: 17/10/2026. Escopo: B12a concluído; B12 permanece em andamento. Contrato e demonstração: [recomendadores web](../recomendadores-web.md).

## Resultado

A nova área **Bases publicadas** permite escolher explicitamente definição/versão e base/versão, preencher os atributos publicados e executar a política RNF existente. A compatibilidade das opções de base exige o mesmo ID, versão, formato e hash da definição. Há paginação e nenhuma versão é escolhida automaticamente.

O formulário é gerado a partir dos atributos, inclusive contextos adicionais, números, booleanos, enumerações, listas, registros e referências taxonômicas. Nomes/caminhos apresentam os nós; IDs são enviados. A escolha de um par módulo/operação conserva os demais rótulos.

O resultado abre no histórico com entrada preservada, vizinho, itens, dimensões, candidatos, exclusões, dependências, origem e hashes. Consulta direta, replay e download da evidência não alteram o original. Respostas atrasadas são descartadas; falhas de execução mantêm os campos e o UUID para repetição idempotente. Atualizar o histórico não descarta o formulário.

O novo cliente usa as rotas protegidas existentes, sem expor a chave interna ao frontend. Ambientes que exigem autorização continuam recusando chamadas sem credencial e exibem a restrição. O controle por pessoa/organização continua em B13. Nenhum endpoint, método científico ou migration foi alterado neste incremento.

## Evidências

| Verificação | Resultado |
| --- | --- |
| API | 75 testes passaram. |
| Interface | 26 testes passaram: sete anteriores e 19 novos. |
| Build | API e web compilaram; a verificação final da interface inclui os últimos ajustes de apresentação. |
| Formulário → executor | O payload da interação real em jsdom passou pelo executor publicado, preservando entrada, dois pares e escolha do segundo par com seu vizinho correto. |
| Tipos e taxonomias | Valores numéricos/booleanos, opcionais ausentes, listas de registros, IDs e seleção de folhas verificados; hash taxonômico diferente não resolve opções. |
| Integridade da escolha | Bases de outra versão/hash não aparecem como compatíveis; execução exige seleção explícita. |
| Concorrência/falhas na UI | Resposta atrasada de definição, duplo envio, repetição com o mesmo UUID, mudança de entrada, paginação com falha e recuperação verificados. Carregar bases não dispara a execução do formulário. |
| Histórico | Quatro estados distintos, acesso direto sem publicações ativas, replay verificado/divergente e preservação do formulário ao atualizar a lista verificados. |
| Compatibilidade RNF | Os oito cenários congelados passaram; hashes dos sete arquivos inventariados permanecem iguais. |
| HTTP/PostgreSQL | `check:recommendation-runs` passou novamente em schema descartável local: oito resultados integrais, isolamento entre bases, dependências exatas, concorrência, imutabilidade, rollback e replay após retirada. |

Vite encontrou a restrição de leitura do sandbox; testes/build web foram executados fora dele com autorização da ferramenta. O check com banco usou exclusivamente seu schema temporário local. Não foram publicados dados no banco da aplicação nem acessados produção ou provedores externos.

## Limites e continuidade

Os testes web são de interação em jsdom e integração com o executor puro; a persistência HTTP é verificada por check separado. Não houve inspeção visual/manual em navegador. B12 só será encerrado após os incrementos restantes e a verificação do fluxo completo.

O RNF continua no recorte de Felipe já documentado; reconstruções sintéticas não comprovam desempenho no dataset original. Não foram obtidos novos artigos ou resolvidas as questões científicas de Ednaldo nesta entrega. Revisão técnica não equivale a aprovação do professor.

Próximo: **B12b**, com editores/publicação e importação pela interface. Depois, **B12c**, com decisões persistidas e vínculo explícito com o artefato. Controle de acesso pessoal (B13), piloto, demais recomendadores e avaliação científica seguem na [lista de pendências](../pendencias-e-proximos-passos.md).
