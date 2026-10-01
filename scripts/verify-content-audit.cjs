// Synthetic-only checks for accepted answers and source-verified report/interview corrections.
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert/strict');
const root=require('path').resolve(__dirname,'..'),html=fs.readFileSync(root+'/index.html','utf8');
const dom=new JSDOM(html,{url:'https://synthetic.example/',runScripts:'outside-only'}),w=dom.window;
w.scrollTo=()=>{};w.structuredClone=structuredClone;w.fetch=async()=>{throw Error('No external network')};
const deps=['vendor/qrcode-generator.js','child-activities.js','verified-progressions.js','assessment-continuation.js','activity-remote.js'].map(f=>fs.readFileSync(root+'/'+f,'utf8')).join('\n');
const js=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean).join('\n').replace(/const leDbReady=import\([\s\S]*?return null;\}\);/,'const leDbReady=Promise.resolve(null);');
w.eval(deps+'\n'+js+`\nwindow.test={
 definition:id=>objectiveDefinitions.find(d=>d.id===id),feelingsParentLanguage,limitsParentLanguage,parentPracticeCopy,feelingsBranches,feelingsLevels,feelingsProgressionVersion,
 resume(id,data){leUser=null;activeCheckpoint=null;openGuidedObjective(id);resumeGuidedObjectiveRecord(activeDefinition,data);return selectedTaskResponses(activeDefinition);},
 responses(id,answers){taskAnswers=answers;const d=objectiveDefinitions.find(d=>d.id===id);return {tasks:selectedTaskResponses(d),score:scoreChildTasks(d)};},
 async loadFeelings(data){leUser={id:'synthetic-owner'};activeCheckpoint={id:'synthetic-checkpoint',season:'fall',school_year:'2026-2027'};activeCheckpointChildName='Synthetic Child';feelingsAnswers.behavior=null;feelingsAnswers.detail=null;feelingsAnswers.frequency=null;feelingsStep=0;clearFeelingsResult();renderFeelingsQuestion();leDb={from:()=>({select:()=>({eq(){return this},maybeSingle:async()=>({data,error:null}),order:async()=>({data:[],error:null})})})};await hydrateFeelingsObjectiveRecord();return {behavior:feelingsAnswers.behavior,selected:feelingsSelected,record:evidenceRecordIds.feelings};},
 async saveFeelings(){persistObjectiveRecord=async(context,payload)=>payload;return saveFeelingsObjectiveRecord();}
};`);
(async()=>{
 await Promise.resolve();
 for(const [id,index,valid] of [['15b',2,[1,2]],['15c',0,[0,1]],['17b',2,[0,1,2]]]){
  const d=w.test.definition(id);assert.equal(d.activityVersion,2);
  for(let choice=0;choice<d.tasks[index].choices.length;choice++){
   const answers=Array(d.tasks.length).fill(null);answers[index]=choice;const result=w.test.responses(id,answers);assert.equal(result.tasks[index].matched,valid.includes(choice),id+' choice '+choice);assert.equal(result.score,valid.includes(choice)?1:0);assert.equal(result.tasks[index].activity_version,2);assert.ok(result.tasks[index].expected.includes(' or '));
  }
  for(const value of [null,'__skipped__']){const answers=Array(d.tasks.length).fill(null);answers[index]=value;assert.equal(w.test.responses(id,answers).tasks[index].matched,null,id+' skips/unanswered remain unscored')}
 }
 for(const [id,index,selected] of [['15b',2,'🐝 Bee'],['15c',0,'I see a dog.'],['17b',2,'?']]){
  const d=w.test.definition(id),restored=w.test.resume(id,{suggested_level:4,final_level:4,teacher_answers:{anchor:4,detail:'matches',frequency:'repeated'},child_responses:{tasks:[{prompt:d.tasks[index].prompt,selected,matched:false,activity_version:1}]}});
  assert.equal(restored[index].selected,selected);assert.equal(restored[index].matched,true,id+' reviewing older selection uses corrected valid alternatives');
 }
 assert.equal(w.test.responses('15b',[0,1,1]).score,3);assert.equal(w.test.responses('15b',[0,1,2]).score,3);
 const expectations={feelingsParentLanguage:[[1,/accept comfort/],[2,/seek a familiar person/],[3,/seek a familiar person/],[4,/wait or try another plan/],[6,/express strong feelings/],[8,/choose a helpful strategy/],[10,/show patience.*affect others/],[12,/keep showing patience/]],limitsParentLanguage:[[1,/tone or expression/],[2,/accept an adult’s redirection/],[3,/accept an adult’s redirection/],[4,/occasional reminders/],[6,/new but similar/],[8,/explain why/],[10,/safety, kindness, and respect/],[12,/keep using these ideas/]]};
 for(const [fn,values] of Object.entries(expectations))for(const [level,re] of values)assert.match(w.test[fn](level).split('Next,')[1],re,fn+' next step at '+level);
 assert.match(w.test.limitsParentLanguage(6),/occasional reminders/);assert.match(w.test.feelingsParentLanguage(12),/patience.*affect others/);
 for(const fn of Object.keys(expectations)){assert.equal(w.test[fn](0),w.test[fn]('Not Yet'));assert.doesNotMatch(w.test[fn](null),/Next,/)}
 const letters=w.test.definition('16a');assert.match(w.test.parentPracticeCopy({objective_id:'16a',child_responses:{}},letters),/lowercase a, uppercase M, and lowercase s/);
 const copy=w.test.parentPracticeCopy({objective_id:'16a',child_responses:{tasks:letters.tasks.map(t=>({prompt:t.prompt,matched:false}))}},letters);assert.match(copy,/lowercase a and uppercase M and lowercase s/);assert.doesNotMatch(copy,/uppercase-letter hunt/);
 assert.match(w.test.feelingsBranches.anticipate.choices[1].label,/patience.*affect others/);assert.match(w.test.feelingsBranches.unsure.choices.find(c=>c.point===12).label,/patience.*others/);
 const saved={id:'synthetic-record',suggested_level:12,final_level:12,teacher_answers:{behavior:'anticipate',detail:{id:'detail-1',point:12},frequency:'repeated'},teacher_notes:'Earlier synthetic observation'};
 let restored=await w.test.loadFeelings(saved);assert.equal(restored.behavior,null,'old anticipation evidence is not relabeled');assert.equal(restored.selected,null);assert.equal(restored.record,'synthetic-record');assert.equal(w.document.getElementById('feelingsNotes').value,saved.teacher_notes);assert.match(w.document.getElementById('feelingsSaveStatus').textContent,/Review the updated questions/);
 restored=await w.test.loadFeelings({...saved,teacher_answers:{...saved.teacher_answers,progression_version:w.test.feelingsProgressionVersion}});assert.equal(restored.behavior,'anticipate');assert.equal(restored.selected,12);assert.match(w.document.getElementById('feelingsAnswerSummary').textContent,/patience.*affect others/);
 restored=await w.test.loadFeelings(saved);assert.equal(restored.selected,null);assert.equal(w.document.getElementById('feelingsSuggested').textContent,'Review the updated questions');assert.doesNotMatch(w.document.getElementById('feelingsRationale').textContent,/Your answers/);assert.doesNotMatch(w.document.getElementById('feelingsParentCopy').textContent,/showing patience/);assert.match(w.document.getElementById('feelingsNextEvidence').textContent,/review this saved result/);
 await w.test.loadFeelings({...saved,teacher_answers:{...saved.teacher_answers,progression_version:w.test.feelingsProgressionVersion}});
 const payload=await w.test.saveFeelings();assert.equal(payload.teacher_answers.progression_version,w.test.feelingsProgressionVersion);assert.equal(payload.final_level,12);
 console.log('PASS: all valid alternative answers, neutral skips, saved response versioning, letter-case reports, source-aligned next steps/Level 12, and old-evidence review guard');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});
