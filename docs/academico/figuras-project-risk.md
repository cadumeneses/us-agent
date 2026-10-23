# Capturas da configuração e do resultado de riscos

Os arquivos `figures/fig2a-config-enhanced.png` e `figures/fig2b-distributed-enhanced.png` são os recortes nativos em paisagem capturados da aplicação em produção em 23/10/2026. Os pixels não foram alterados. Os PNGs não incluem legendas nem os marcadores (a)/(b).

Para usar o bloco com menor altura no artigo, carregue `graphicx` no preâmbulo e substitua a figura correspondente por:

```latex
\input{figures/project-risk-panels.tex}
```

O bloco usa duas minipages e limita cada imagem a 42 mm de altura, preservando a proporção com `keepaspectratio`. As legendas são texto LaTeX fora dos PNGs. O arquivo `main.tex` não foi alterado para selecionar essa figura: o autor pode aplicar o trecho no ponto desejado. Confira a leitura da interface no tamanho final de impressão.

As duas capturas mostram a definição publicada `project-risk-recommender`, versão 2, com KNN, k=1 e pesos 1/1/1/5, e o resultado do vizinho P09, com similaridade 93,75% e distância 1. As associações de riscos e os valores de distribuição das equipes são exemplos sintéticos de demonstração. A similaridade não expressa probabilidade de ocorrência do risco. As referências da publicação, execução e hashes dos arquivos constam em `figures/project-risk-panels.manifest.json`.

Os arquivos finais em `figures/` permitem compilar o artigo a partir de um checkout do Git, sem credenciais ou arquivos temporários. As capturas brutas, prévias, pacotes de entrega e vídeos permanecem em `artifacts/`, que é ignorado pelo Git.

Para refazer a captura, é necessário preparar a conta e o estado local do ambiente demonstrativo em `tmp/icse2027-reviewer/`. Esses arquivos privados não são versionados. Execute na raiz do repositório:

```text
node scripts/capture-article-panels.mjs
node scripts/package-compact-article-figure.mjs --sync-paper-files
```

O primeiro comando acessa a aplicação para capturar a interface; o segundo copia os recortes em paisagem, o trecho LaTeX e a procedência para `figures/`. Nenhum deles altera `main.tex`.
