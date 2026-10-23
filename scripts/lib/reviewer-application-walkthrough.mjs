import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

export async function walkthrough({evaluate,navigate,until,click,edit,expand,scroll,screenshot,cdp,folder,imageFolder,origin}){
 const credentials=JSON.parse(await readFile(folder+'/credentials.json','utf8'));
 const checks=[],images=[];
 const shot=async name=>{await screenshot(resolve(imageFolder,name+'.png'));images.push(name+'.png');console.log('Captured '+name);};
 async function select(label,value){await evaluate(`{const l=[...document.querySelectorAll('label')].find(e=>[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()===${JSON.stringify(label)});const s=l?.querySelector('select');if(!s)throw Error('Missing select '+${JSON.stringify(label)});Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,${JSON.stringify(value)});s.dispatchEvent(new Event('change',{bubbles:true}));}`);}
 async function api(path,method='GET',body){return evaluate(`(async()=>{const r=await fetch(${JSON.stringify(path)},{method:${JSON.stringify(method)},headers:{'X-Organization-Id':'icse2027-review',...( ${body!==undefined} ? {'Content-Type':'application/json'} : {})},...(${body!==undefined}?{body:${JSON.stringify(JSON.stringify(body))}}:{})});const value=await r.json();if(!r.ok)throw Error(r.status+' '+JSON.stringify(value));return value;})()`);}
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await navigate('/projects',"document.querySelector('#private-username')");
 await edit('#private-username',credentials.username);await edit('#private-password',credentials.password);await click('Sign in');
 await until("document.querySelectorAll('.project-overview').length>=6",'existing projects');await shot('projects');
 const access=await api('/api/access/context');assert.deepEqual(access.organizations.map(o=>o.id),['icse2027-review']);
 const original=await api('/api/project-stories/269'),source86=await api('/api/project-stories/86');
 const task=source86.details.tasks.find(t=>/retrieve|load|database|fetch|read|information|access/i.test(t.title))??source86.details.tasks[0];assert.ok(task?.title);
 const taskForPractice={title:'Listar as notas dos alunos para apoiar a consolidação.',category:task.category??''};
 // Earlier rehearsal copies used the unadapted source task. Correct only these known rehearsal records.
 for(const id of ['270','271','272']){
  const copy=await api('/api/project-stories/'+id);
  if(copy.project==='P03'&&copy.sprint==='Reviewer walkthrough'&&copy.details.tasks[0]?.title===task.title){
   const details=structuredClone(copy.details);details.tasks[0].title=taskForPractice.title;
   await api('/api/project-stories/'+id,'PUT',{revision:copy.revision,classificationId:copy.classificationId,text:copy.text,details});
  }
 }
 const taxonomy=await api('/api/taxonomy?version=1.0.0');
 const context=await api('/api/context');assert.ok(context.executionModes.some(row=>row.key==='preview'));
 await navigate('/projects/P02?story=86',"document.body.innerText.includes('Linked NFRs') && document.querySelector('.story-header')");
 await expand('Project profile');await shot('project-profile');
 await evaluate("document.querySelector('.research-profile').open=false");await scroll('Project stories','h2');await shot('story-tasks');
 await navigate('/projects/P03',"document.querySelector('.project-details-page')");
 await click('Add user story');await until("document.querySelector('[role=dialog] textarea')",'story editor');
 await edit('[role=dialog] input','Reviewer walkthrough');await edit('[role=dialog] textarea',original.text);await shot('add-story');await click('Save story');
 await until("[...document.querySelectorAll('a')].some(a=>a.textContent==='Classify story')",'saved draft');
 const classifyUrl=await evaluate("[...document.querySelectorAll('a')].find(a=>a.textContent==='Classify story').getAttribute('href')");
 const storyId=new URL(classifyUrl,origin).searchParams.get('storyId');assert.match(storyId,/^\d+$/);
 await evaluate("document.querySelector('.detail-card .detail-head button').click()");await until("document.querySelector('[role=dialog] textarea')",'task editor');
 await edit('[role=dialog] textarea',taskForPractice.title);
 if(task.category)await edit('[role=dialog] input[list="ramos-task-categories"]',task.category);
 await shot('task-editor');await click('Save');
 await until("!document.querySelector('[role=dialog]') && document.querySelectorAll('.detail-row').length>0",'prepared task saved');
 const prepared=await api('/api/project-stories/'+storyId);assert.equal(prepared.classificationId,null);assert.equal(prepared.details.tasks[0].title,taskForPractice.title);
 await navigate(classifyUrl,"document.querySelector('.classify-grid textarea') && document.querySelector('.config select option[value=\"1.0.0\"]')");
 await select('Taxonomy','1.0.0');await select('Mode','preview');await shot('classification');await click('Start classification');
 await until("document.body.innerText.includes('Classification saved')",'classification saved');await scroll('Classification saved','h2');await shot('classification-result');
 const classified=await api('/api/project-stories/'+storyId);assert.equal(classified.status,'pending_review');assert.equal(classified.details.tasks[0].title,taskForPractice.title);
 const reviewUrl='/review?classificationId='+classified.classificationId;
 await navigate(reviewUrl,"document.body.innerText.includes('Why this story needs review') && document.body.innerText.includes('Run provenance') && !document.body.innerText.includes('Loading review context')");
 await expand('Run provenance');await shot('review-context');
 const domain=taxonomy.moduleDomains.Registry;assert.ok(domain);await select('Domain',domain);await select('Module','Registry');await select('Operation','Retrieve data');await click('Add pair');
 await edit('.review-grid textarea[placeholder="Record the reason for the decision…"]','The coordinator must retrieve student grades before consolidating them. Confirmed against the existing grade-consolidation story and the selected WIS taxonomy.');
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await scroll('Pairs to confirm','h3');await shot('human-review');await click('Confirm classification');
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 for(let n=0;n<40;n++){if((await api('/api/project-stories/'+storyId)).status==='reviewed')break;await delay(250);}
 const reviewed=await api('/api/project-stories/'+storyId);assert.equal(reviewed.status,'reviewed');assert.deepEqual(reviewed.labels,[{module:'Registry',operation:'Retrieve data'}]);
 checks.push('Create saved story using existing text; add an existing task; local classification preserves identity/tasks; confirm human classification');
 await navigate('/runs',"document.querySelector('input[type=search]') && document.querySelector('table')");await edit('input[type=search]','P03');await shot('classification-history');
 const history=await api('/api/stories');assert.ok(history.some(row=>row.id===reviewed.classificationId&&row.status==='reviewed'));
 await navigate('/dashboard',"document.querySelectorAll('.metric').length>=4 || document.body.innerText.includes('Classified stories') && document.querySelector('table')");await shot('dashboard');
 const dashboard=await api('/api/dashboard');assert.equal(dashboard.total,history.length);checks.push('Search classification history and reconcile dashboard with current classifications');
 await navigate('/taxonomy',"document.querySelector('.reference-card button')");await click('Open taxonomy');await until("document.body.innerText.includes('Read-only version')",'published WIS');
 await edit('.node-workspace input[type=search]','Retrieve data');
 await evaluate("[...document.querySelectorAll('.node-list button')].find(b=>b.querySelector('span')?.textContent==='Retrieve data').click()");await scroll('Modules and operations','h3');await shot('taxonomy');
 checks.push('Inspect published WIS version and operation without modifying it');
 await navigate('/recommender-setup',"document.body.innerText.includes('Definitions') && document.querySelector('.configured-page') || document.querySelector('.configured-tabs') || document.querySelector('button') && document.querySelector('.page h1')");
 await click('Import dataset');await until("document.body.innerText.includes('Import and publish dataset')",'dataset importer');await select('Import definition',JSON.stringify(['project-risk-recommender','2']));await click('Load dataset schema');await until("document.body.innerText.includes('Use US-Agent record mapping')",'loaded published import schema');await shot('dataset-import');
 await navigate('/recommendations?recommender=tests&project=Projeto%20Emanuel&classificationId=269&source=published',"document.body.innerText.includes('No compatible recommender has been published.')");await shot('test-case-availability');
 // Leave a second copy ready for a reviewer to inspect the pending-review workflow immediately.
 const pendingDraft=await api('/api/project-stories','POST',{project:'P03',sprint:'Reviewer walkthrough',text:original.text,requestId:randomUUID()});
 const pendingDetails={...pendingDraft.details,tasks:[{title:taskForPractice.title,done:false,category:task.category??'',technologies:task.technologies}]};
 const pendingPrepared=await api('/api/project-stories/'+pendingDraft.storyId,'PUT',{revision:pendingDraft.revision,classificationId:null,text:pendingDraft.text,details:pendingDetails});
 const pendingResult=await api('/api/project-stories/'+pendingDraft.storyId+'/classify','POST',{revision:pendingPrepared.revision,classificationId:null,mode:'preview',taxonomyVersion:'1.0.0'});
 const pending=await api('/api/project-stories/'+pendingDraft.storyId);assert.equal(pending.status,'pending_review');assert.equal(pendingResult.results[0].id,pending.classificationId);
 assert.deepEqual(await api('/api/project-stories/269'),original);assert.deepEqual(await api('/api/project-stories/86'),source86);
 const sampleStories=[source86.text,(await api('/api/project-stories/91')).text,original.text];
 await writeFile(resolve(imageFolder,'existing-stories.txt'),sampleStories.join('\n')+'\n');
 const report={checkedAt:new Date().toISOString(),origin,organization:'icse2027-review',sourceStory:{storyId:'269',text:original.text,taskSourceStoryId:'86',task},taskForPractice,taxonomyVersion:'1.0.0',taxonomyDomain:domain,localPreview:{confidence:classified.confidence,labels:classified.labels,status:classified.status},reviewed:{storyId,classificationId:reviewed.classificationId},pending:{storyId:pending.storyId,classificationId:pending.classificationId},screenshots:images,checks,originalStoriesUnchanged:true};
 await writeFile(folder+'/application-guide.json',JSON.stringify(report,null,2)+'\n');
 await click('Sign out');await until("document.querySelector('#private-username')",'signed out');
 console.log(JSON.stringify({passed:true,images:images.length,pending:report.pending,reviewed:report.reviewed,checks},null,2));
}
