// Run with node scripts/verify-progressions.cjs. Synthetic evidence; no network or real child records.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const context=vm.createContext({console,evidenceCaptureRevision:0,window:{},document:{getElementById:()=>({value:''})}});
vm.runInContext(fs.readFileSync(path.join(root,'child-activities.js'),'utf8')+'\nvar LEChildActivities=window.LEChildActivities;',context);
vm.runInContext(fs.readFileSync(path.join(root,'verified-progressions.js'),'utf8'),context);
const start=html.indexOf('const objectiveDefinitions='),end=html.indexOf('    const objectiveMaterialsById=',start);
vm.runInContext(html.slice(start,end)+'\nthis.defs=objectiveDefinitions;this.verified=LEVerifiedProgressions;',context);
const ranges={'18a':15,'18b':9,'18c':15,'18d':9,'18e':9,'19a':15,'19b':19,'19c':9,'20a':15,'20b':15,'20c':15,'20d':9,'20e':9,'20f':9,'21a':9,'21b':15,'22a':15,'22b':13,'22c':11,'23':15};
for(const [id,max] of Object.entries(ranges)){
 const d=context.defs.find(d=>d.id===id);assert.equal(d.maxLevel,max,id);assert.equal(d.draft,false,id);
 for(const a of d.anchors){
  assert.equal(context.progressionSuggestedLevel(d,{anchor:a.n,detail:'matches'}),a.n,id);
  assert.equal(context.progressionSuggestedLevel(d,{anchor:a.n,detail:'support'}),a.n-1,id);
  assert.equal(context.progressionSuggestedLevel(d,{anchor:a.n,detail:'independent'}),a.n<max-1?a.n+1:a.n,id);
  assert.ok(a.text.length>12&&a.family.length>12);
 }
 assert.equal(context.progressionSuggestedLevel(d,{anchor:0,detail:'support'}),0);
 assert.equal(context.progressionSuggestedLevel(d,{anchor:0,detail:'independent'}),1);
 assert.match(context.progressionDescription(d,3),/Level 2.*Level 4/);
}
assert.match(context.verified['22c'].anchors[1].text,/graphs/);
assert.match(context.verified['20d'].anchors[0].text,/11–19/);
assert.match(context.verified['19b'].anchors.at(-1).text,/complex/);
function loadFunction(name){const re=new RegExp('    (?:async )?function '+name+'\\(');const start=html.search(re);assert.ok(start>=0,name);const tail=html.slice(start+4);const end=tail.slice(1).search(/\n    (?:async )?function |\n    const /)+1;vm.runInContext(end>0?tail.slice(0,end):tail,context);}
for(const name of ['escapeHTML','selectedTaskResponses','scoreChildTasks','taskEvidenceSummary','persistObjectiveRecord','saveGuidedObjectiveRecord','resumeGuidedObjectiveRecord','familySkillCopy','parentPracticeCopy','parentObjectiveDefinition','renderParentReport'])loadFunction(name);
let row=null;const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',classList:{add(){},remove(){}}});return elements.get(id)};
Object.assign(context,{document:{getElementById:el,querySelector:()=>el('app')},leUser:{id:'synthetic-owner'},activeCheckpoint:{id:'synthetic-checkpoint',season:'fall',school_year:'2026–2027'},activeCheckpointChildName:'Test Learner',guidedAnswers:{anchor:4,detail:'independent',frequency:'often'},guidedResult:{suggested:5,selected:5},taskAnswers:[0,'__skipped__',null],scenarioAnswers:[],evidenceRecordIds:{},setSaveStatus:(_,message)=>el('status').textContent=message,setEvidenceStatus(){},toast(){},refreshCheckpointRecords:async()=>{},loadEvidenceItems:async()=>{},activeCheckpointCaption:()=> 'Test Learner · Fall',leDb:{from(){return {upsert(value){row=JSON.parse(JSON.stringify(value));return {select(){return {single:async()=>({data:{id:'synthetic-record'},error:null})}}}}}}},guidedHome:el('home'),guidedChild:el('child'),guidedCheck:el('check'),renderGuidedQuestion(){},familyDomainOrder:['Literacy','Mathematics'],familyDomainNames:{Literacy:'Early Literacy',Mathematics:'Math'}});
(async()=>{
 const d=context.defs.find(d=>d.id==='22c');
 await context.saveGuidedObjectiveRecord(d);assert.equal(row.final_level,5);assert.equal(row.teacher_answers.detail,'independent');
 assert.equal(row.child_responses.tasks[0].matched,true);assert.equal(row.child_responses.tasks[1].matched,null);assert.equal(row.child_responses.tasks[2].matched,null);
 assert.equal(row.child_responses.tasks[1].skipped,true);assert.match(el('status').textContent,/Saved/);
 context.resumeGuidedObjectiveRecord(d,row);assert.equal(context.guidedResult.selected,5);assert.equal(context.taskAnswers[1],'__skipped__');
 const observed=context.defs.find(d=>d.id==='19b');context.taskAnswers=[{presented:true,observation:'supported'},'__skipped__'];context.guidedResult={suggested:18,selected:19};
 await context.saveGuidedObjectiveRecord(observed);assert.equal(row.final_level,19);assert.equal(row.child_responses.tasks[0].matched,null);assert.equal(row.child_responses.tasks[0].observation,'supported');
 context.renderParentReport([{objective_id:'22c',final_level:4,updated_at:'2026-10-01',child_responses:{}},{objective_id:'19b',final_level:18,updated_at:'2026-10-01',child_responses:{}}]);
 assert.match(el('parentReportPages').innerHTML,/makes and reads simple graphs/);assert.match(el('parentReportPages').innerHTML,/Next goal/);assert.match(el('parentReportPages').innerHTML,/plans, writes, and revises/);
 await context.persistObjectiveRecord('feelings',{objective_id:'1a',suggested_level:'Not Yet',final_level:'Not Yet'});assert.equal(row.final_level,0);assert.equal(row.suggested_level,0);
 context.leUser=null;row=null;await context.saveGuidedObjectiveRecord(d);assert.equal(row,null);assert.match(el('status').textContent,/Not saved/);
 console.log('PASS: 20 source ranges; anchor and in-between suggestions; touch/skipped/observed evidence; save and resume with synthetic storage; report strengths and next steps; signed-out save guard.');
})().catch(e=>{console.error(e);process.exitCode=1});
