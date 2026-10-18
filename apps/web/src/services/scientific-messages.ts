// Presentation only: historical messages and hashes remain in their original language.
const messages: Record<string, string> = {
  'A classificação precisa ser aceita ou revisada antes da recomendação.': 'The classification must be accepted or reviewed before recommendation.',
  'Informe a plataforma do projeto.': 'Enter the project platform.',
  'Informe o domínio de aplicação do projeto.': 'Enter the project application domain.',
  'Informe a arquitetura do projeto.': 'Enter the project architecture.',
  'Informe o objetivo do projeto (produto ou protótipo).': 'Enter the project purpose (product or prototype).',
  'Classifique as tarefas cadastradas com uma categoria antes de recomendar.': 'Assign a category to every registered task before requesting recommendations.',
  'Selecione um par módulo/operação válido da classificação.': 'Select a valid module/operation pair from the classification.',
  'Nenhuma US histórica compatível: verifique perfis, classificação aceita e módulo/operação. Projetos de protótipo e a própria US são excluídos.': 'No compatible historical story was found. Check profiles, accepted classification, and module/operation. Prototype projects and the current story are excluded.',
  'Empate: selecionada a classificação de menor identificador. Política determinística do US-Agent; k permanece igual a 1.': 'Tie: the classification with the lowest identifier was selected. This is the deterministic US-Agent policy; k remains 1.',
  'O vizinho mais próximo não possui RNFs no recorte de Felipe. O motor mantém k=1 e não substitui esse vizinho por outro.': 'The nearest neighbor has no eligible NFRs. The engine keeps k=1 and does not replace it with another neighbor.',
  'O vizinho não compartilha características com o alvo: similaridade e utilidade iguais a zero.': 'The neighbor shares no characteristics with the target, so similarity and utility are zero.'
};
export function displayScientificMessage(message: string): string { return messages[message] ?? message; }
