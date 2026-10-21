import assert from 'node:assert/strict';
import test from 'node:test';
import {parseRecommenderTaxonomy} from './recommender-taxonomy.js';
import {validateWisTaxonomy} from './wis-taxonomy.js';
const wis=()=>parseRecommenderTaxonomy({schemaVersion:1,id:'wis',version:'1',name:'WIS',source:'WIS taxonomy',kind:'tree',selection:'leaf',nodes:[
  {id:'module',name:'Registry',description:'',parentId:null,selectable:false},
  {id:'operation',name:'Read',description:'',parentId:'module',selectable:true}]});
test('WIS is a shared taxonomy tree with module roots and operation children',()=>{validateWisTaxonomy(wis());});
test('WIS rejects domains/third levels, selectable modules and duplicate module names',()=>{
  const deeper=wis();deeper.nodes.push({id:'extra',name:'Third',description:'',parentId:'operation',selectable:true});assert.throws(()=>validateWisTaxonomy(deeper),/two levels/);
  const selectable=wis();selectable.nodes[0].selectable=true;assert.throws(()=>validateWisTaxonomy(selectable),/organizers/);
  const duplicate=wis();duplicate.nodes.push({...duplicate.nodes[0],id:'another'});assert.throws(()=>validateWisTaxonomy(duplicate),/distinct/);
});
test('other taxonomy trees keep their own depth and selection rules',()=>{const other=wis();other.id='another';other.nodes.push({id:'third',name:'Third',description:'',parentId:'operation'});validateWisTaxonomy(other);});
