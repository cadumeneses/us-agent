# Revisão da criação de recomendadores — 21/10/2026

A criação ganhou uma aba própria, **New recommender**, em `/recommenders/new`. Ela usa um assistente com cinco etapas e mantém a gestão de versões, importações e catálogos em **Configuration and datasets**.

## Avaliação e decisões

Foi utilizada a skill [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), disponível localmente em `tmp/ui-ux-skills/ui-ux-pro-max`, a mesma registrada na [revisão anterior do dia](revisao-ui-ux-wis.md). Foram lidos `SKILL.md`, `references/quick-reference.md` e `references/pro-rules.md`. As consultas locais de UX verificaram os resultados **Progress Indicators**, **Submit Feedback**, **Focusable Error Summary**, **Error Messages** e **Error Placement**. A consulta de React foi complementada pelas regras específicas de formulário e foco da referência.

As sugestões de composição geradas por `--design-system` eram voltadas a páginas de divulgação; não foram adotadas como layout do formulário nem persistidas como sistema de design. Foram mantidos a marca azul, a tipografia e os tokens de cores existentes. A revisão aplicou as regras pertinentes de divulgação progressiva, agrupamento de campos, navegação previsível, foco, feedback e adaptação de layout.

| Problema encontrado | Alteração |
| --- | --- |
| Criação misturada com definições, modelos, bases e versões | Aba **New recommender**, rota direta e indicação da localização atual. |
| Muitos parâmetros e conceitos técnicos apresentados juntos | Etapas **Name**, **Inputs**, **Recommendations**, **Matching** e **Review**, com apenas a etapa atual visível. |
| ID, papel, escopo e representação exigidos de quem está começando | ID gerado automaticamente; ID/versão recolhidos em opções avançadas. Papel, escopo e representação são definidos pelo tipo de campo. |
| Dificuldade para distinguir o que comparar do que recomendar | Entradas e saídas em etapas distintas, com exemplos e explicação da necessidade de associações nos dados. |
| Regras de validação exibidas antes de qualquer interação | Validação ao avançar, com mensagens junto aos campos, resumo com links e foco após tentativa inválida. |
| Falta de um momento claro para confirmar | Revisão com nome, entradas, saídas, vizinhos e pesos. **Create recommender** salva e publica apenas após essa confirmação. |
| Dúvida sobre o passo seguinte | Sucesso com ação principal **Add reference data**, transferindo a definição publicada para a importação. |
| Risco de perder respostas ao voltar ou após erro | Voltar preserva campos; falhas preservam a configuração e permitem tentar novamente. A publicação incerta reutiliza o rascunho salvo. Recarregar/fechar uma página com alterações dispara a proteção de saída do navegador. |
| Indicador de etapas com rótulos longos no celular | Etapas numeradas e nome da etapa atual acima do indicador; controles com nomes acessíveis completos. |

## Evidências

- [Primeira etapa em desktop](evidencias/recommender-creation-2026-10-21/name-1440.png).
- [Entradas em celular](evidencias/recommender-creation-2026-10-21/inputs-375.png).
- [Revisão em desktop](evidencias/recommender-creation-2026-10-21/review-1440.png).
- [Conclusão e próxima ação em celular](evidencias/recommender-creation-2026-10-21/created-375.png).
- [Resultados automatizados do navegador](evidencias/recommender-creation-2026-10-21/browser-checks.json).

O roteiro [check-recommender-creation-ux.mjs](../scripts/check-recommender-creation-ux.mjs) utiliza Edge headless, API compilada e um schema descartável no PostgreSQL local. Confere as cinco etapas em 1440, 1024, 768 e 375 px, conclusão e catálogo em desktop/celular, além de paisagem com movimento reduzido: 25 verificações de layout e 12 verificações de fluxo. Verifica ausência de rolagem horizontal, rótulos dos campos, controles de pelo menos 44 px, resumo de erros com foco, retorno entre etapas, ausência de escrita antes da revisão e publicação real da configuração. Nenhum erro de execução do navegador foi registrado.

Passaram 84 testes de interface e o build de API/interface. Os testes incluem execução KNN pelo formulário gerado, troca entre instâncias, revisão da base de projetos e recuperação de falha na publicação.

Essa é uma revisão de engenharia com dados sintéticos. Ela não mede a facilidade de uso com participantes nem representa certificação de acessibilidade. Não houve deploy ou alteração de dados de produção. A criação e a gestão usam os contratos de backend e migrations existentes.
