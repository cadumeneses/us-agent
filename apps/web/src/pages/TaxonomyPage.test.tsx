// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {TaxonomyPage} from './TaxonomyPage';
import {recommenderApi} from '../services/recommender-api';
import {snapshotContent} from '../../../api/src/domain/content-snapshot';
import type {ConfiguredTaxonomy,TaxonomyRecord} from '../types/configurable-recommendations';
vi.mock('../services/recommender-api',()=>({supportsWebMethod:()=>true,recommenderApi:{pageSize:50,taxonomyVersions:vi.fn(),taxonomyVersion:vi.fn(),saveTaxonomy:vi.fn(),publishTaxonomy:vi.fn()}}));
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
const wis:ConfiguredTaxonomy={schemaVersion:1,id:'wis',version:'1.0.0',name:'WIS',kind:'tree',selection:'leaf',source:'WIS module and operation taxonomy',nodes:[
  {id:'registry',name:'Registry',description:'Stored records',parentId:null,selectable:false},
  {id:'read',name:'Read data',description:'Retrieve a stored record',parentId:'registry',selectable:true}]};
const other:ConfiguredTaxonomy={schemaVersion:1,id:'platforms',version:'1',name:'Platforms',kind:'list',selection:'any',source:'Project platforms',nodes:[{id:'web',name:'Web',description:'Web platform',parentId:null}]};
const record=(content:ConfiguredTaxonomy,state:'published'|'draft'='published'):TaxonomyRecord=>({state,snapshot:snapshotContent(content)});
let root:Root,container:HTMLDivElement;
beforeEach(()=>{
  vi.resetAllMocks();
  vi.mocked(recommenderApi.taxonomyVersions).mockResolvedValue([wis,other].map(content=>({id:content.id,version:content.version,name:content.name,kind:content.kind,nodeCount:content.nodes.length,state:'published',snapshot:snapshotContent(content)})));
  vi.mocked(recommenderApi.taxonomyVersion).mockImplementation(async id=>record(id==='wis'?wis:other));
  vi.mocked(recommenderApi.saveTaxonomy).mockImplementation(async content=>record(content,'draft'));
  vi.mocked(recommenderApi.publishTaxonomy).mockImplementation(async()=>record(vi.mocked(recommenderApi.saveTaxonomy).mock.calls.at(-1)![0]));
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
const render=async()=>{await act(async()=>root.render(<MemoryRouter><TaxonomyPage/></MemoryRouter>));};
const button=(text:string,scope:ParentNode=container)=>[...scope.querySelectorAll('button')].find(node=>node.textContent===text)!;
const click=async(node:HTMLElement)=>{await act(async()=>node.click());};
const field=(name:string)=>[...container.querySelectorAll('label')].find(label=>label.firstChild?.textContent===name)!.querySelector('input,select,textarea') as HTMLInputElement;
async function change(node:HTMLInputElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node),'value')!.set!.call(node,value);node.dispatchEvent(new Event(node.tagName==='SELECT'?'change':'input',{bubbles:true}));});}
const open=async(name:string)=>{const card=[...container.querySelectorAll('article')].find(node=>node.querySelector('h3')?.textContent===name)!;await click(button('Open taxonomy',card));};
test('WIS and other taxonomies share one catalog and one open/edit flow',async()=>{
  await render();expect(container.querySelectorAll('.reference-card').length).toBe(2);expect(container.querySelector('textarea')).toBeNull();
  expect(container.textContent).not.toContain('WIS classification');expect(container.textContent).not.toContain('Prepare WIS reference');
  await open('WIS');expect(recommenderApi.taxonomyVersion).toHaveBeenCalledWith('wis','1.0.0');
  expect(field('ID').value).toBe('wis');expect(field('Module name').value).toBe('Registry');expect(field('Structure').matches(':disabled')).toBe(true);
  expect([...container.querySelectorAll('.node-list button')].map(node=>node.getAttribute('data-depth'))).toEqual(['0','1']);
});
test('a new WIS version adds operations under modules and uses ordinary save/publication APIs',async()=>{
  await render();await open('WIS');await click(button('Create a new taxonomy version'));await change(field('Version'),'2.0.0');
  await click(button('Add operation'));await change(field('Operation name'),'Create data');await click(button('Save taxonomy draft'));
  const saved=vi.mocked(recommenderApi.saveTaxonomy).mock.calls[0][0];
  expect(saved.id).toBe('wis');expect(saved.nodes.at(-1)?.parentId).toBe('registry');expect(saved.nodes.at(-1)?.selectable).toBe(true);
  await click(button('Publish reviewed taxonomy'));
  expect(recommenderApi.publishTaxonomy).toHaveBeenCalledWith('wis','2.0.0',snapshotContent(saved).sha256);
});
test('WIS parent choices contain modules, never operations',async()=>{
  await render();await open('WIS');await click(button('Create a new taxonomy version'));await click(button('Add operation'));
  const parents=field('Module') as unknown as HTMLSelectElement;
  expect([...parents.options].map(option=>option.value)).toEqual(['','registry']);
});
test('failed saves preserve the WIS draft and error without publishing',async()=>{
  vi.mocked(recommenderApi.saveTaxonomy).mockRejectedValue(new Error('Connection interrupted'));
  await render();await open('WIS');await click(button('Create a new taxonomy version'));await change(field('Version'),'2.0.0');await change(field('Module name'),'Records');await click(button('Save taxonomy draft'));
  expect(field('Module name').value).toBe('Records');expect(container.querySelector('[role=alert]')?.textContent).toContain('Connection interrupted');expect(recommenderApi.publishTaxonomy).not.toHaveBeenCalled();
});
test('ordinary list taxonomies retain the same editor and node fields',async()=>{
  await render();await open('Platforms');expect(field('ID').value).toBe('platforms');expect(field('Node name').value).toBe('Web');
});
