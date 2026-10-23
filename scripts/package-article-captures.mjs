import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const output=resolve('artifacts/article-screenshots-2026-10-23');
const manifest=JSON.parse(await readFile(resolve(output,'capture-manifest.json'),'utf8'));
for(const c of manifest.clips){const png=await readFile(resolve(output,c.file));assert.equal(createHash('sha256').update(png).digest('hex'),c.sha256);}
for(const name of ['figure-project-risk','figure-project-risk-compact']){
 const html=await readFile(resolve(output,name+'.html'),'utf8');
 assert.ok(!html.includes('<figcaption>')&&!html.includes('(a)')&&!html.includes('(b)'));
}
await mkdir(resolve(output,'sources/scripts/lib'),{recursive:true});
for(const file of ['scripts/capture-article-panels.mjs','scripts/render-article-panels.mjs','scripts/lib/article-risk-captures.mjs','scripts/lib/prepare-article-figure.mjs'])await copyFile(file,resolve(output,'sources',file));
const file=resolve(output,'README.md');let text=await readFile(file,'utf8');
text+='\n\nReprodução no repositório: `node scripts/capture-article-panels.mjs`. Para regenerar apenas a composição: `node scripts/render-article-panels.mjs`. Os scripts utilizados estão em sources/. A autenticação é lida localmente; nenhuma credencial acompanha este pacote.\n\nO trecho LaTeX foi compilado em preview-ieee.pdf, usando IEEEtran. As legendas desse exemplo são texto LaTeX fora dos PNGs. Os arquivos figure-project-risk.png/.pdf e os PNGs individuais não contêm legendas nem marcadores (a)/(b). A versão compacta oferece letras maiores em relação à largura; prefira-a quando reduzir bastante a figura no artigo.\n';
await writeFile(file,text);
manifest.delivery={nativePngScale:4,captionsEmbedded:false,sourcePngHashesVerified:true,compositePdfsSinglePage:true,latexPreviewCompiled:true};
await writeFile(resolve(output,'capture-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({sourcePngHashesVerified:true,captionsEmbedded:false,output}));
