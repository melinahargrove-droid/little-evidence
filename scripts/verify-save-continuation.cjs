// Run with node scripts/verify-save-continuation.cjs. Synthetic learners/storage only; no network or DOM writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const planner=require(path.join(root,'assessment-continuation.js'));
const start=html.indexOf('    async function finishAssessment('),end=html.indexOf('    function selectedTaskResponses(',start);
assert.ok(start>=0&&end>start,'finishAssessment source exists');
const source=html.slice(start,end);
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}};

function harness({remote=false,records,definitions,nextKind='tasks'}={}){
  const calls={saves:0,queries:[],opened:[],interviews:0,shown:[],continued:[],libraries:0,status:[],toasts:[]};
  const next={id:'2a',title:'Synthetic next objective',...(nextKind==='tasks'?{tasks:[{prompt:'Synthetic prompt'}]}:nextKind==='scenarios'?{scenarios:[{text:'Synthetic prompt'}]}:{})};
  const defs=definitions||[{id:'1c',title:'Synthetic current objective'},next,{id:'20d',title:'Synthetic optional extension',advanced:true}];
  const nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:''});return nodes.get(id)};
  const ctx=vm.createContext({objectivePersistenceBusy:false,assessmentEditRevision:0,
    leUser:{id:'synthetic-teacher-a'},activeCheckpoint:{id:'synthetic-child-a-fall'},activeCheckpointChildName:'Synthetic Child A',
    activeDefinition:{id:'1c'},screen:'guidedObjectiveScreen',evidenceCaptureRevision:3,assessmentEditRevision:2,assessmentDirty:true,assessmentSaveBusy:false,
    activeScreenId:()=>ctx.screen,objectiveDefinitions:defs,LEAssessmentContinuation:planner,
    document:{getElementById:node},
    openGuidedObjective:id=>calls.opened.push(id),startGuidedInterview:()=>calls.interviews++,
    show:id=>calls.shown.push(id),openLibrary:()=>calls.libraries++,
    toast:message=>calls.toasts.push(message),setSaveStatus:(...args)=>calls.status.push(args),
    LEActivityRemote:{hasTeacherSession:()=>remote,continueWith:async id=>{calls.continued.push(id);return true}},
    leDb:{from(table){return {select(columns){return {eq(field,value){calls.queries.push({table,columns,field,value});return ctx.queryResult}}}}}},
    queryResult:Promise.resolve({data:records||['1a','1b','1c'].map(objective_id=>({objective_id,final_level:4})),error:null})
  });
  vm.runInContext(source,ctx);
  const finish=(save=async()=> 'synthetic-record',context='guided',objectiveId='1c')=>ctx.finishAssessment(context,objectiveId,()=>{calls.saves++;return save()});
  return {ctx,calls,finish,node};
}

function assertNoAdvance(h,label){
  assert.equal(h.calls.opened.length+h.calls.shown.length+h.calls.continued.length+h.calls.libraries,0,label);
  assert.equal(h.calls.interviews,0,label+' does not start another interview');
}

async function waitForQuery(h){
  // A bounded microtask flush, not a real-time wait: save() and its handler are local promises.
  for(let i=0;i<10&&!h.calls.queries.length;i++)await Promise.resolve();
  assert.equal(h.calls.queries.length,1,'saved objective lookup started');
}

(async()=>{
  let h=harness({remote:true});
  await h.finish();
  assert.deepEqual(h.calls.continued,['2a'],'paired task continues in the existing remote session');
  assert.deepEqual(h.calls.opened,[]);
  assert.deepEqual(h.calls.queries,[{table:'little_evidence_objective_records',columns:'objective_id,final_level',field:'checkpoint_id',value:'synthetic-child-a-fall'}],'reads saved IDs only for the captured checkpoint');
  assert.equal(h.ctx.assessmentSaveBusy,false);

  h=harness({remote:true,nextKind:'scenarios'});await h.finish();assert.deepEqual(h.calls.continued,['2a'],'paired scenario also reuses the session');
  h=harness();await h.finish();assert.deepEqual(h.calls.opened,['2a'],'without a teacher session opens the next objective');assert.equal(h.calls.interviews,0,'task prep remains available');
  h=harness({remote:true,nextKind:'observation'});await h.finish();assert.deepEqual(h.calls.opened,['2a'],'teacher observation stays on teacher surface');assert.equal(h.calls.interviews,1);assert.deepEqual(h.calls.continued,[]);

  // The three older objectives use their existing routes; movement can reuse a paired session.
  h=harness({definitions:[],records:[]});await h.finish(undefined,'movement','4');assert.deepEqual(h.calls.shown,['feelingsObjectiveScreen']);assert.equal(h.node('modeTag').textContent,'TEACHER VIEW · OBJECTIVE 1a');
  h=harness({definitions:[],records:[{objective_id:'1a',final_level:4}]});await h.finish(undefined,'feelings','1a');assert.deepEqual(h.calls.shown,['limitsObjectiveScreen']);
  h=harness({definitions:[]});await h.finish(undefined,'limits','1b');assert.deepEqual(h.calls.shown,['objectiveScreen']);
  h=harness({definitions:[],remote:true});await h.finish(undefined,'limits','1b');assert.deepEqual(h.calls.continued,['4']);

  h=harness();await h.finish(async()=>null);assertNoAdvance(h,'failed/unsigned save never advances');assert.equal(h.calls.queries.length,0);assert.equal(h.ctx.assessmentSaveBusy,false);
  h=harness();await h.finish(async()=>{throw Error('Synthetic save failure')});assertNoAdvance(h,'thrown save never advances');assert.equal(h.calls.queries.length,0);assert.match(h.calls.status[0][1],/Could not save this assessment: Synthetic save failure/);assert.doesNotMatch(h.calls.toasts[0],/saved assessment is kept/);
  h=harness();h.ctx.queryResult=Promise.resolve({data:null,error:Error('Synthetic lookup failure')});await h.finish();assertNoAdvance(h,'saved-ID lookup failure never advances');assert.match(h.calls.status[0][1],/Your saved assessment is kept/);assert.equal(h.ctx.assessmentSaveBusy,false);
  h=harness({remote:true});h.ctx.LEActivityRemote.continueWith=async()=>false;await h.finish();assertNoAdvance(h,'rejected paired continuation does not open another surface');assert.match(h.calls.status[0][1],/original child checkpoint is required/);assert.match(h.calls.toasts[0],/saved assessment is kept/);

  const mutations={
    child(ctx){ctx.activeCheckpoint={id:'synthetic-child-b-fall'};ctx.activeCheckpointChildName='Synthetic Child B'},
    account(ctx){ctx.leUser={id:'synthetic-teacher-b'}},
    signout(ctx){ctx.leUser=null},
    screen(ctx){ctx.screen='objectiveLibraryScreen'},
    'away-and-back'(ctx){ctx.screen='objectiveLibraryScreen';ctx.evidenceCaptureRevision++;ctx.screen='guidedObjectiveScreen'},
    objective(ctx){ctx.activeDefinition={id:'2a'}},
    edit(ctx){ctx.assessmentEditRevision++;ctx.assessmentDirty=false}
  };
  for(const [name,mutate] of Object.entries(mutations)){
    // A save may finish, but old completion must not steer another child, account, screen, or edit.
    h=harness();let pendingSave=deferred();let run=h.finish(()=>pendingSave.promise);mutate(h.ctx);pendingSave.resolve('synthetic-record');await run;
    assertNoAdvance(h,name+' during save');assert.equal(h.calls.queries.length,0,name+' blocks subsequent lookup');assert.equal(h.ctx.assessmentSaveBusy,false);
    if(name==='edit')assert.equal(h.ctx.assessmentDirty,true,'new answers remain dirty after an older save finishes');
    // Repeat while the post-save record lookup is pending.
    h=harness();let pendingQuery=deferred();h.ctx.queryResult=pendingQuery.promise;run=h.finish();await waitForQuery(h);mutate(h.ctx);pendingQuery.resolve({data:[],error:null});await run;
    assertNoAdvance(h,name+' during lookup');assert.equal(h.ctx.assessmentSaveBusy,false);
  }
  h=harness();const staleFailure=deferred();const staleRun=h.finish(()=>staleFailure.promise);h.ctx.evidenceCaptureRevision++;staleFailure.reject(Error('Stale failure'));await staleRun;assert.equal(h.calls.status.length,0,'stale failures do not overwrite a newer screen');assert.equal(h.calls.toasts.length,0);

  // Null final levels remain unfinished; Not Yet (0) is a saved teacher decision.
  h=harness({records:[{objective_id:'1a',final_level:4},{objective_id:'1b',final_level:4},{objective_id:'1c',final_level:4},{objective_id:'2a',final_level:null}]});await h.finish();assert.deepEqual(h.calls.opened,['2a']);
  h=harness({records:[{objective_id:'1a',final_level:4},{objective_id:'1b',final_level:4},{objective_id:'1c',final_level:4},{objective_id:'2a',final_level:0}]});await h.finish();assert.deepEqual(h.calls.shown,['objectiveScreen'],'saved Not Yet is not repeated');
  h=harness();h.ctx.queryResult=Promise.resolve({data:planner.queue(h.ctx.objectiveDefinitions).map(d=>({objective_id:d.id,final_level:4})),error:null});await h.finish();assert.equal(h.calls.libraries,1,'completion returns to the library');assert.equal(h.calls.opened.length+h.calls.continued.length+h.calls.shown.length,0);assert.match(h.calls.toasts[0],/All regular objectives are saved for Synthetic Child A/);assert.match(h.calls.toasts[0],/Optional extensions are still available/);

  h=harness();const slowSave=deferred();const first=h.finish(()=>slowSave.promise);await h.finish();assert.equal(h.calls.saves,1,'a double click cannot start another save');assert.equal(h.ctx.assessmentSaveBusy,true);slowSave.resolve('synthetic-record');await first;assert.equal(h.calls.queries.length,1);assert.deepEqual(h.calls.opened,['2a']);assert.equal(h.ctx.assessmentSaveBusy,false);await h.finish();assert.equal(h.calls.saves,2,'busy flag is released after completion');
  console.log('PASS: successful save continues to paired/local/legacy routes; failed saves/lookups stay put; child/account/screen/navigation/edit races are blocked; unfinished vs Not Yet respected; all-complete library; duplicate save guard.');
})().catch(error=>{console.error(error);process.exitCode=1});
