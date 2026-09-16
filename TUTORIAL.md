# Guia de uso — US-Agent

O US-Agent classifica histórias de usuário, apoia a evolução da taxonomia e recomenda
requisitos não funcionais a partir de histórias semelhantes já cadastradas.

## Preparar as histórias

1. Em **Meus projetos**, crie ou selecione um projeto e suas US.
2. Em **Classificar histórias**, execute a classificação. A pesquisa de comitê,
   confiança, incerteza e classificação multi-label continua disponível.
3. Resolva pendências em **Fila de revisão**. Lacunas podem gerar propostas de
   evolução na área **Taxonomia**.
4. Em **Meus projetos**, preencha o **Perfil do projeto**: plataforma, domínio de
   aplicação, objetivo (produto ou protótipo), arquitetura e tecnologias.
5. Cadastre tarefas e suas categorias. Use a mesma categoria para tarefas equivalentes;
   associe linguagens, frameworks, APIs e persistência quando aplicáveis.

O domínio de aplicação do projeto, como Educação, é diferente do domínio usado
para organizar a taxonomia. Valores de tags são comparados exatamente: mantenha
uma nomenclatura consistente.

## Preparar o histórico

O motor precisa de outras US com classificação aceita, perfil de projeto completo
e RNFs cadastrados. Cada RNF deve informar **tipo, atributo e sentença**.

O vizinho deve possuir o mesmo módulo/operação e a mesma versão de taxonomia do
alvo. Projetos de protótipo não são usados como fonte. O catálogo original da tese
não vem pré-carregado na aplicação.

## Recomendar RNFs

1. Abra **Recomendadores · RNFs**, ou use **Recomendar RNFs** na sprint.
2. Selecione uma US e o par módulo/operação a consultar. Para US multi-label, execute
   separadamente para cada par de interesse.
3. Clique em **Recomendar RNFs**.
4. Confira a US vizinha e a tabela de características. O método usa Manhattan e k=1.
5. Leia cada sentença e escolha **Aceitar e vincular** ou **Rejeitar**.

Aceitar adiciona o RNF à US, visível em **Meus projetos**. Rejeitar registra a avaliação
sem adicioná-lo. Similaridade não significa probabilidade de acerto; confirme se as
restrições da sentença servem ao projeto antes de aceitá-la.

Se faltarem dados, o sistema informa quais precisam ser preenchidos. Se não houver
vizinho compatível ou o vizinho não tiver RNFs do recorte usado, o sistema explica
a ausência de recomendações. Não são geradas sentenças por IA para preencher esse vazio.

## Consultar execuções

A tela de RNFs lista as 50 execuções mais recentes da classificação selecionada.
Cada resultado registra sua data, versão do método, classificação, vizinho e decisões.
Alterações posteriores no perfil exigem uma nova execução. Se a classificação tiver
mudado, gere uma recomendação atualizada antes de aceitar novos RNFs.

O menu **Execuções** continua mostrando o histórico da pesquisa de classificação.
Plano de qualidade e geração de casos de teste foram retirados do fluxo atual.
