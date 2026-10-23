// Assemble native screenshot files; caption text is kept outside the unmodified UI images.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import express from 'express';

export async function prepareArticleFigure({cdp,evaluate,until,output}){
 const files=['a-knn-configuration.png','b-neighbor-and-contributions.png'];
 const tex=String.raw`% Add \usepackage{graphicx} to the preamble. Copy the PNG files next to this snippet.
\begin{figure*}[t]
  \centering
  \begin{minipage}[t]{0.48\textwidth}
    \vspace{0pt}\centering
    \includegraphics[width=\linewidth]{a-knn-configuration.png}
    \par\smallskip{\footnotesize (a) Configure KNN, k=1, and feature weights.}
  \end{minipage}\hfill
  \begin{minipage}[t]{0.48\textwidth}
    \vspace{0pt}\centering
    \includegraphics[width=\linewidth]{b-neighbor-and-contributions.png}
    \par\smallskip{\footnotesize (b) Inspect the retrieved risk, neighbor, and feature contributions.}
  \end{minipage}
  \caption{Actual US-Agent production interface with synthetic risk associations. The published configuration uses k=1, weight 5 for team distribution, and weight 1 for the other features. The recorded run retrieves P09 with 93.75\% similarity and distance 1.}
  \label{fig:project-risk-configuration-result}
\end{figure*}
`;
 await writeFile(resolve(output,'figure-project-risk.tex'),tex);
 await writeFile(resolve(output,'preview-ieee.tex'),String.raw`\documentclass[10pt,conference]{IEEEtran}
\usepackage[T1]{fontenc}
\usepackage{graphicx}
\usepackage{microtype}
\begin{document}
\section*{Project-risk configuration and recorded result}
The two panels capture the hosted application. The selected definition and dataset are both version 2. Risk associations and team-distribution values are synthetic demonstration examples. Similarity is not a probability of a risk occurring.
\input{figure-project-risk.tex}
\end{document}
`);
 const app=express();app.use(express.static(output));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const local='http://127.0.0.1:'+server.address().port;
 try{
  for(const variant of ['desktop','compact']){
   const prefix=variant==='compact'?'compact/':'';
   const dimensions=await Promise.all(files.map(async file=>{const b=await readFile(resolve(output,prefix+file));return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)};}));
   const imageHeight=Math.ceil(Math.max(...dimensions.map(d=>330*d.height/d.width)));
   const pageHeight=imageHeight;
   const name=variant==='desktop'?'figure-project-risk':'figure-project-risk-compact';
   const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>US-Agent project-risk configuration and result</title><style>@page{size:680px ${pageHeight}px;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:white}.figure{width:680px;padding:0 4px;display:grid;grid-template-columns:330px 330px;column-gap:12px}.panel{margin:0}.image-frame{height:${imageHeight}px;display:flex;align-items:flex-start}.image-frame img{display:block;width:330px;height:auto}</style><div class="figure"><figure class="panel"><div class="image-frame"><img src="${prefix+files[0]}" alt="Published KNN configuration with k one and weights one, one, one and five."></div></figure><figure class="panel"><div class="image-frame"><img src="${prefix+files[1]}" alt="Recorded risk, P09 neighbor, similarity 93.75 percent, distance one and feature contributions."></div></figure></div></html>`;
   await writeFile(resolve(output,name+'.html'),html);
   await cdp('Emulation.setDeviceMetricsOverride',{width:680,height:pageHeight,deviceScaleFactor:4,mobile:false});
   await cdp('Page.navigate',{url:local+'/'+name+'.html'});await until("document.images.length===2 && [...document.images].every(i=>i.complete&&i.naturalWidth>0)",'figure images loaded');
   await evaluate('document.fonts.ready.then(()=>true)');
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
   assert.equal(await evaluate("document.querySelectorAll('figcaption').length===0 && document.querySelector('.figure').innerText.trim()===''"),true,'No captions or panel markers may be embedded in the images.');
   const png=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:680,height:pageHeight,scale:1}});
   await writeFile(resolve(output,name+'.png'),Buffer.from(png.data,'base64'));
   const pdf=await cdp('Page.printToPDF',{printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
   await writeFile(resolve(output,name+'.pdf'),Buffer.from(pdf.data,'base64'));console.log('Assembled '+name+' PNG/PDF');
  }
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
 const readme=`# Capturas para o artigo — US-Agent\n\nCapturadas diretamente de https://us-agent-api.vercel.app/ em 23/10/2026.\n\n- a-knn-configuration.png: painel (a), com KNN, k=1 e pesos 1/1/1/5.\n- b-neighbor-and-contributions.png: painel (b), com risco recuperado, P09, similaridade 93,75%, distância 1 e tabela de contribuições.\n- figure-project-risk.png e .pdf: composição lado a lado, com as legendas (a)/(b) em inglês.\n- figure-project-risk.tex: trecho LaTeX usando os dois PNGs. Copie os PNGs e o trecho para a mesma pasta do artigo ou ajuste os caminhos. Requer graphicx.\n- compact/: capturas do layout responsivo nativo com texto maior em relação à largura. A composição figure-project-risk-compact.png/.pdf oferece essa alternativa quando a legibilidade exigir mais espaço.\n- raw/: capturas de origem com contexto da interface.\n- capture-manifest.json: viewport, recortes, dimensões, hashes, dependências e identificação da execução.\n\nOs PNGs são capturas sem perdas, com escala de dispositivo 4×. Não houve reconstrução, substituição de texto nem alteração de CSS/valores da interface. A composição somente posiciona os PNGs e adiciona legendas fora deles. Não houve edição de dados em produção; o replay foi verificado. Credenciais não aparecem nas capturas.\n\nAs associações de risco e os valores de distribuição da equipe são exemplos sintéticos já preparados na aplicação. O projeto-alvo é Information Resources Web Project. P09 é o identificador mostrado nesta execução; não é o identificador reference-b de uma demonstração histórica anterior. O main.tex do projeto não foi alterado.\n`;
 await writeFile(resolve(output,'README.md'),readme.replace('com as legendas (a)/(b) em inglês.','sem legendas nem marcadores (a)/(b) embutidos. As sugestões de legenda ficam somente no arquivo LaTeX.').replace('A composição somente posiciona os PNGs e adiciona legendas fora deles.','A composição somente posiciona os PNGs; não adiciona texto à imagem.'));
 const manifest=JSON.parse(await readFile(resolve(output,'capture-manifest.json'),'utf8'));manifest.composition={captionsEmbedded:false,panelMarkersEmbedded:false,sourceImagesUnmodified:true};await writeFile(resolve(output,'capture-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
}
