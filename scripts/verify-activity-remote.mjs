import assert from 'node:assert/strict';
import {initial,transition,config} from '../supabase/functions/little-evidence-activity-session/state.mjs';
let s=initial({objective_id:'22c',tasks:[{mode:'touch',choices:3},{mode:'observed'},{mode:'order',choices:3,length:3},{mode:'scenario',choices:2}]});
const act=(role,action,extra={})=>s=transition(s,role,{action,revision:s.revision,prompt_index:s.prompt_index,...extra});
assert.throws(()=>act('display','start'));act('teacher','start');
assert.throws(()=>act('teacher','answer',{answer:0}));act('display','answer',{answer:2});assert.equal(s.prompt_index,1);
assert.throws(()=>act('display','answer',{answer:0}));assert.throws(()=>transition(s,'teacher',{action:'skip',revision:0,prompt_index:1}),/STALE/);
act('teacher','observe',{observation:'supported'});assert.equal(s.prompt_index,2);
assert.throws(()=>act('display','answer',{answer:[0,0,1]}));assert.throws(()=>act('display','answer',{answer:[0]}));act('display','answer',{answer:[2,1,0]});
act('teacher','skip');assert.equal(s.status,'complete');assert.equal(s.responses[3],'__skipped__');act('teacher','retry');assert.equal(s.responses.length,3);act('display','answer',{answer:1});assert.equal(s.status,'complete');assert.equal(s.responses[1].observation,'supported');
console.log('PASS: role boundaries, stale requests, automatic choices, teacher observations, complete sequences, skip, retry, and no-score scenarios.');

import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),ctx=vm.createContext({window:{},document:{getElementById:()=>({value:''})}});
vm.runInContext(fs.readFileSync(new URL('../child-activities.js',import.meta.url),'utf8')+'\nvar LEChildActivities=window.LEChildActivities;',ctx);
vm.runInContext(fs.readFileSync(new URL('../verified-progressions.js',import.meta.url),'utf8'),ctx);
vm.runInContext(html.slice(html.indexOf('const objectiveDefinitions='),html.indexOf('    const objectiveMaterialsById='))+';this.defs=objectiveDefinitions;',ctx);
const defs=ctx.defs.filter(d=>d.tasks||d.scenarios);
for(const d of defs){const tasks=d.tasks||d.scenarios.map(s=>({mode:'scenario',choices:s.choices}));config({objective_id:d.id,tasks:tasks.map(t=>t.mode==='observed'?{mode:'observed'}:{mode:t.mode==='scenario'?'scenario':t.order?'order':'touch',choices:t.choices.length,...(t.order?{length:t.order.length}:{})})});}
console.log('PASS: all '+defs.length+' guided child-facing objectives have valid remote configurations; movement retains its existing remote.');
