// Synthetic learners and deferred in-memory queries only. No authentication or child data.
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert/strict');
const root=require('path').resolve(__dirname,'..'),html=fs.readFileSync(root+'/index.html','utf8');
const deps=['vendor/qrcode-generator.js','child-activities.js','verified-progressions.js','assessment-continuation.js','activity-remote.js'].map(f=>fs.readFileSync(root+'/'+f,'utf8')).join('\n');
const code=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean).join('\n').replace(/const leDbReady=import\([\s\S]*?return null;\}\);/,'const leDbReady=Promise.resolve(null);');
async function setup(){
 const dom=new JSDOM(html,{url:'https://synthetic.example/',runScripts:'outside-only'}),w=dom.window;
 w.scrollTo=()=>{};w.structuredClone=structuredClone;w.fetch=async()=>{throw Error('No external network')};
 w.eval(deps+'\n'+code+`\nwindow.test={
 setChild(name='A'){leUser={id:'synthetic-owner'};activeCheckpoint={id:name,child_id:name,season:'fall',school_year:'2026-2027'};activeCheckpointChildName='Synthetic Child '+name;assessmentCheckpointId=name;},
 setOwner(id){leUser=id?{id}:null},setDB(db){leDb=db},show,openGoldEntrySheet,openParentReport,
 hydrators:{movement:hydrateMovementObjectiveRecord,feelings:hydrateFeelingsObjectiveRecord,limits:hydrateLimitsObjectiveRecord,guided:()=>hydrateGuidedObjectiveRecord(activeDefinition)},
 prepareGuided(){activeDefinition=objectiveDefinitions.find(d=>d.id==='20a');document.getElementById('guidedObjectiveCheck').innerHTML='<textarea id="guidedTeacherNotes"></textarea>';},
 edit(context){if(context==='movement'){selectedLevel=8;ratings[0]=3;}if(context==='feelings')feelingsAnswers.behavior='new-answer';if(context==='limits')limitsAnswers.behavior='new-answer';const id={movement:'notes',feelings:'feelingsNotes',limits:'limitsNotes',guided:'guidedTeacherNotes'}[context];const node=document.getElementById(id);node.value='New unsaved observation';node.dispatchEvent(new Event('input',{bubbles:true}));},
 snapshot:()=>({level:selectedLevel,rating:ratings[0],feelings:feelingsAnswers.behavior,limits:limitsAnswers.behavior,dirty:assessmentDirty,ids:{...evidenceRecordIds}}),
 changeObjective(){activeDefinition=objectiveDefinitions.find(d=>d.id==='20b');}
 };`);
 await Promise.resolve();w.test.setChild();w.test.show('checkpointScreen');
 const queries=[];
 w.test.setDB({from:()=>({select:()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j});const query={eq(){return this},order(){return this},maybeSingle(){queries.push({resolve,reject});return promise},then(...args){queries.push({resolve,reject});return promise.then(...args)}};return query;}})});
 return {dom,w,t:w.test,queries,close:()=>dom.window.close()};
}
const rows=[{objective_id:'20a',final_level:8,teacher_answers:{},child_responses:{}}];
(async()=>{
 for(const flow of ['openGoldEntrySheet','openParentReport']){
  const contentId=flow==='openGoldEntrySheet'?'goldEntrySheetContent':'parentReportPages',screen=flow==='openGoldEntrySheet'?'goldEntrySheetScreen':'parentReportScreen',buttonId=flow==='openGoldEntrySheet'?'createGoldEntrySheet':'createParentReport';
  for(const action of ['child','owner','logout','navigation','roundtrip','error']){
   const h=await setup(),pending=h.t[flow]();await Promise.resolve();
   if(action==='child'||action==='error')h.t.setChild('B');
   if(action==='owner')h.t.setOwner('different-owner');if(action==='logout')h.t.setOwner(null);
   if(action==='navigation')h.t.show('objectiveLibraryScreen');
   if(action==='roundtrip'){h.t.show('objectiveLibraryScreen');h.t.show('checkpointScreen');}
   const before=h.w.document.querySelector('.screen.active').id;
   if(action==='error')h.queries[0].reject(Error('stale error'));else h.queries[0].resolve({data:rows,error:null});
   await pending;assert.equal(h.w.document.getElementById(contentId).innerHTML,'',flow+' discards '+action);assert.equal(h.w.document.querySelector('.screen.active').id,before);assert.equal(h.w.document.getElementById(buttonId).disabled,false);h.close();
  }
  let h=await setup(),pending=h.t[flow]();await Promise.resolve();h.queries[0].resolve({data:rows,error:null});await pending;
  assert.match(h.w.document.getElementById(contentId).textContent,/Synthetic Child A/);assert.match(h.w.document.getElementById(contentId).textContent,/Fall 2026-2027/);assert.equal(h.w.document.querySelector('.screen.active').id,screen);h.close();
  h=await setup();const first=h.t[flow]();await Promise.resolve();const second=h.t[flow]();await Promise.resolve();h.queries[0].resolve({data:rows,error:null});await first;assert.equal(h.w.document.getElementById(buttonId).disabled,true,'old request cannot release newer button');h.queries[1].resolve({data:rows,error:null});await second;assert.equal(h.w.document.getElementById(buttonId).disabled,false);assert.equal(h.w.document.querySelector('.screen.active').id,screen);h.close();
 }
 for(const context of ['movement','feelings','limits','guided']){
  const h=await setup();if(context==='guided')h.t.prepareGuided();const pending=h.t.hydrators[context]();h.t.edit(context);
  h.queries[0].resolve({data:{id:'old-record',suggested_level:2,final_level:2,teacher_answers:{ratings:[0,0,0],behavior:'old-answer'},teacher_notes:'Old saved note'},error:null});await pending;
  const id={movement:'notes',feelings:'feelingsNotes',limits:'limitsNotes',guided:'guidedTeacherNotes'}[context];assert.equal(h.w.document.getElementById(id).value,'New unsaved observation',context+' preserves newer note');assert.equal(h.t.snapshot().ids[context],null);assert.equal(h.t.snapshot().dirty,true);
  if(context==='movement'){assert.equal(h.t.snapshot().level,8);assert.equal(h.t.snapshot().rating,3)}if(context==='feelings'||context==='limits')assert.equal(h.t.snapshot()[context],'new-answer');h.close();
 }
 console.log('PASS: report child/account/navigation/request isolation and all four hydration paths preserve newer edits');
})().catch(e=>{console.error(e);process.exitCode=1});
