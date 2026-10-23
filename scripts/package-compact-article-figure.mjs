// Reuse the native production screenshots without changing their pixels.
// Keep the page-space adjustment in LaTeX, and all captions outside the PNGs.
import assert from 'node:assert/strict';
import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const source=resolve('artifacts/article-screenshots-2026-10-23');
const output=resolve('artifacts/article-figure-short-2026-10-23');
await mkdir(resolve(output,'figures'),{recursive:true});
const files=[
 ['a-knn-configuration.png','fig2a-config-enhanced.png'],
 ['b-neighbor-and-contributions.png','fig2b-distributed-enhanced.png'],
];
const manifest={source:'../article-screenshots-2026-10-23/capture-manifest.json',maximumImageHeightMm:42,captionsEmbedded:false,images:[]};
for(const [original,name] of files){
 const from=resolve(source,original),to=resolve(output,'figures',name);
 await copyFile(from,to);
 const before=await readFile(from),after=await readFile(to);
 assert.ok(before.equals(after),'Screenshot pixels must remain unchanged.');
 manifest.images.push({file:'figures/'+name,sourceFile:original,width:after.readUInt32BE(16),height:after.readUInt32BE(20),sha256:createHash('sha256').update(after).digest('hex')});
}
await writeFile(resolve(output,'figure-project-risk.tex'),String.raw`% Requires \usepackage{graphicx} in the article preamble.
% Copy figures/ into the article root. Captions are LaTeX text, outside the PNGs.
\begin{figure*}[t]
\centering
\begin{minipage}[t]{0.49\textwidth}
\vspace{0pt}
\centering
\includegraphics[width=\linewidth,height=42mm,keepaspectratio]{figures/fig2a-config-enhanced.png}
\par\vspace{0.5mm}
{\footnotesize\textbf{(a)} Configure KNN, \textit{k}=1, and feature weights.\par}
\end{minipage}
\hfill
\begin{minipage}[t]{0.49\textwidth}
\vspace{0pt}
\centering
\includegraphics[width=\linewidth,height=42mm,keepaspectratio]{figures/fig2b-distributed-enhanced.png}
\par\vspace{0.5mm}
{\footnotesize\textbf{(b)} Execute the recommender and inspect the retrieved neighbor and feature contributions.\par}
\end{minipage}
\caption{Project-risk recommender configuration and execution in US-Agent. The recorded run retrieves P09 with 93.75\% similarity and distance 1. Risk associations and team-distribution values are synthetic demonstration data.}
\label{fig:project-risk-configuration-result}
\end{figure*}
`);
await writeFile(resolve(output,'preview-ieee.tex'),String.raw`\documentclass[10pt,conference]{IEEEtran}
\usepackage[T1]{fontenc}
\usepackage{graphicx}
\usepackage{microtype}
\makeatletter
\setlength{\@dblfptop}{0pt}
\makeatother
\begin{document}
\input{figure-project-risk.tex}
\end{document}
`);
await writeFile(resolve(output,'README.md'),`# Figura com menor altura

Copie a pasta figures/ para o artigo e substitua o bloco da figura pelo conteúdo de figure-project-risk.tex. O preâmbulo deve carregar graphicx.

Os arquivos usam os nomes do seu trecho LaTeX. São cópias idênticas dos recortes nativos em paisagem já capturados em produção. Não use os PNGs da pasta compact/ do pacote anterior: aquele layout responsivo tem maior altura.

Cada imagem tem altura máxima de 42 mm e largura máxima igual à da minipage. keepaspectratio preserva a proporção. As legendas permanecem exclusivamente no LaTeX; os PNGs não contêm legendas nem marcadores (a)/(b). Os dois painéis têm a mesma altura nesta largura do IEEEtran.

preview-ieee.pdf mostra o bloco compilado na largura do IEEEtran de duas colunas. Esta redução prioriza ocupar espaço semelhante ao exemplo anterior; confira a leitura dos textos da interface no tamanho final do artigo.

O artigo main.tex e a aplicação não foram alterados. As associações de risco e os valores de distribuição das equipes são dados sintéticos de demonstração; a interface e os resultados foram capturados da aplicação.

Reprodução na raiz do repositório: node scripts/package-compact-article-figure.mjs. Compile preview-ieee.tex com uma distribuição LaTeX que contenha IEEEtran.
`);
await writeFile(resolve(output,'layout-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await copyFile(resolve('scripts/package-compact-article-figure.mjs'),resolve(output,'package-compact-article-figure.mjs'));
if(process.argv.includes('--sync-paper-files')){
 const figures=resolve('figures');
 await mkdir(figures,{recursive:true});
 for(const [,name] of files)await copyFile(resolve(output,'figures',name),resolve(figures,name));
 await copyFile(resolve(output,'figure-project-risk.tex'),resolve(figures,'project-risk-panels.tex'));
 const capture=JSON.parse(await readFile(resolve(source,'capture-manifest.json'),'utf8'));
 await writeFile(resolve(figures,'project-risk-panels.manifest.json'),JSON.stringify({
  capturedAt:capture.capturedAt,origin:capture.origin,definition:capture.definition,
  dataset:capture.dataset??capture.run.dataset,run:capture.run,maximumImageHeightMm:42,
  captionsEmbedded:false,uiContentReplaced:false,images:manifest.images,
 },null,2)+'\n');
 console.log('Copied native screenshots, LaTeX snippet, and provenance into figures/.');
}
console.log(JSON.stringify({output,maximumImageHeightMm:42,imagesUnmodified:true,captionsEmbedded:false}));
