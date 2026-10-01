// Run with node scripts/verify-save-lock.cjs. Synthetic local storage promises; no network or child records.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=html.indexOf('    let objectivePersistenceBusy=false;'),end=html.indexOf('    function selectedTaskResponses(',start);
assert.ok(start>=0&&end>start,'shared save lock and handlers exist');
const source=html.slice(start,end)+'\nthis.saveLocks=()=>({persistence:objectivePersistenceBusy,continuation:assessmentSaveBusy});';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}};

function harness(){
  const pending=deferred(),calls={upserts:[],queries:[],statuses:[],evidence:[],toasts:[],opened:[],refreshes:0,loads:0};
  const payload={objective_id:'1c',suggested_level:4,final_level:4,teacher_answers:{anchor:4},teacher_notes:'Synthetic original note'};
  const ctx=vm.createContext({
    leUser:{id:'synthetic-teacher'},activeCheckpoint:{id:'synthetic-child-fall'},activeCheckpointChildName:'Synthetic Child',
    screen:'guidedObjectiveScreen',activeDefinition:{id:'1c'},evidenceCaptureRevision:4,assessmentEditRevision:2,assessmentDirty:true,evidenceRecordIds:{},
    activeScreenId:()=>ctx.screen,activeCheckpointCaption:()=> 'Synthetic Child · Fall',
    objectiveDefinitions:[{id:'1c',title:'Synthetic current'},{id:'2a',title:'Synthetic next',tasks:[]}],
    LEAssessmentContinuation:require(path.join(root,'assessment-continuation.js')),
    LEActivityRemote:{hasTeacherSession:()=>false},document:{getElementById:()=>({textContent:''})},
    openGuidedObjective:id=>calls.opened.push(id),startGuidedInterview:()=>calls.opened.push('interview'),
    openLibrary:()=>calls.opened.push('library'),show:id=>calls.opened.push(id),toast:message=>calls.toasts.push(message),
    setSaveStatus:(...args)=>calls.statuses.push(args),setEvidenceStatus:(...args)=>calls.evidence.push(args),
    refreshCheckpointRecords:async()=>{calls.refreshes++;await ctx.refreshResult},loadEvidenceItems:async()=>{calls.loads++;await ctx.loadResult},
    refreshResult:Promise.resolve(),loadResult:Promise.resolve(),
    queryResult:Promise.resolve({data:['1a','1b','1c'].map(objective_id=>({objective_id,final_level:4})),error:null}),
    upsertResult:pending.promise,
    leDb:{from(table){return {
      upsert(row,options){calls.upserts.push({table,row:JSON.parse(JSON.stringify(row)),options});return {select(column){assert.equal(column,'id');return {single:()=>ctx.upsertResult}}}},
      select(columns){return {eq(field,value){calls.queries.push({table,columns,field,value});return ctx.queryResult}}}
    }}}
  });
  vm.runInContext(source,ctx);
  const save=()=>ctx.persistObjectiveRecord('guided',payload);
  return {ctx,calls,payload,pending,save,stay:()=>ctx.saveAndStay(save),next:()=>ctx.finishAssessment('guided','1c',save)};
}

function assertUnlocked(h){const flags=h.ctx.saveLocks();assert.equal(flags.persistence,false);assert.equal(flags.continuation,false)}
async function flushUntil(predicate,label){for(let i=0;i<20&&!predicate();i++)await Promise.resolve();assert.ok(predicate(),label)}
const savedResult={data:{id:'synthetic-objective-record'},error:null};

(async()=>{
  // Save & add evidence first: duplicate stays and Save & next share one upsert lock.
  let h=harness(),run=h.stay();
  assert.equal(h.ctx.saveLocks().persistence,true);assert.equal(h.ctx.saveLocks().continuation,false);
  await h.stay();await h.next();await h.save();
  assert.equal(h.calls.upserts.length,1,'stay/next/direct save cannot overlap an existing persistence write');
  h.pending.resolve(savedResult);assert.equal(await run,'synthetic-objective-record');
  assert.equal(h.calls.queries.length,0);assert.deepEqual(h.calls.opened,[],'Save & add evidence does not navigate');
  assert.equal(h.ctx.assessmentDirty,false);assert.equal(h.ctx.evidenceRecordIds.guided,'synthetic-objective-record');assertUnlocked(h);
  h.ctx.upsertResult=Promise.resolve(savedResult);await h.next();assert.equal(h.calls.upserts.length,2,'a later deliberate save is allowed');assert.deepEqual(h.calls.opened,['2a']);assertUnlocked(h);

  // Save & next first: both locks block a second action, including its later lookup phase.
  h=harness();const query=deferred();h.ctx.queryResult=query.promise;run=h.next();
  await h.stay();await h.next();assert.equal(h.calls.upserts.length,1);assert.equal(h.ctx.saveLocks().continuation,true);
  h.pending.resolve(savedResult);await flushUntil(()=>h.calls.queries.length===1,'post-save lookup started');
  assert.equal(h.ctx.saveLocks().persistence,false);assert.equal(h.ctx.saveLocks().continuation,true);
  await h.stay();await h.next();assert.equal(h.calls.upserts.length,1,'continuation lookup cannot overlap a second write');
  query.resolve({data:['1a','1b','1c'].map(objective_id=>({objective_id,final_level:4})),error:null});await run;assert.deepEqual(h.calls.opened,['2a']);assertUnlocked(h);

  // Supporting saved-record refresh and evidence loading remain within the same persistence lock.
  h=harness();const refresh=deferred(),load=deferred();h.ctx.refreshResult=refresh.promise;h.ctx.loadResult=load.promise;run=h.stay();h.pending.resolve(savedResult);
  await flushUntil(()=>h.calls.refreshes===1,'refresh started');await h.next();assert.equal(h.calls.upserts.length,1);assert.equal(h.ctx.saveLocks().persistence,true);
  refresh.resolve();await flushUntil(()=>h.calls.loads===1,'evidence loading started');await h.stay();assert.equal(h.calls.upserts.length,1);assert.equal(h.ctx.saveLocks().persistence,true);
  load.resolve();await run;assertUnlocked(h);

  // Both save buttons preserve edits made after the upsert payload was captured.
  for(const button of ['stay','next']){
    h=harness();run=h[button]();h.ctx.assessmentEditRevision++;h.ctx.assessmentDirty=true;h.payload.final_level=6;h.payload.teacher_notes='Synthetic newer note';
    h.pending.resolve(savedResult);await run;
    assert.equal(h.calls.upserts[0].row.final_level,4,'already-started save retains the original level');
    assert.equal(h.calls.upserts[0].row.teacher_notes,'Synthetic original note');
    assert.equal(h.ctx.assessmentDirty,true,button+' keeps newer changes dirty');
    assert.match(h.calls.statuses.at(-1)[1],/Earlier version saved.*Your newer changes still need saving/);
    assert.equal(h.calls.queries.length,0,button+' does not plan past a newer edit');assert.deepEqual(h.calls.opened,[]);assertUnlocked(h);
  }

  // Save & next cannot navigate after a newer edit or an away-and-back navigation while lookup is pending.
  for(const change of ['edit','navigation']){
    h=harness();const lookup=deferred();h.ctx.queryResult=lookup.promise;run=h.next();h.pending.resolve(savedResult);await flushUntil(()=>h.calls.queries.length===1,'lookup in flight');
    if(change==='edit'){h.ctx.assessmentEditRevision++;h.ctx.assessmentDirty=true}else{h.ctx.screen='objectiveLibraryScreen';h.ctx.evidenceCaptureRevision++;h.ctx.screen='guidedObjectiveScreen'}
    lookup.resolve({data:[],error:null});await run;assert.deepEqual(h.calls.opened,[],change+' invalidates pending continuation');assertUnlocked(h);
  }
  h=harness();run=h.next();h.ctx.evidenceCaptureRevision++;h.pending.resolve(savedResult);await run;assert.deepEqual(h.calls.opened,[]);assert.equal(h.calls.queries.length,0);assert.equal(h.ctx.assessmentDirty,true);assert.equal(h.calls.statuses.length,0,'old save does not overwrite a newer screen');assertUnlocked(h);

  // A transport rejection belongs to the captured child, not whoever is on screen when it arrives.
  h=harness();run=h.next();h.ctx.activeCheckpoint={id:'synthetic-child-b-fall'};h.ctx.activeCheckpointChildName='Synthetic Child B';h.ctx.evidenceCaptureRevision++;
  h.pending.reject(Error('Synthetic stale network failure'));await run;
  assert.equal(h.calls.statuses.length,0,'rejected child-A upsert must not overwrite child-B save status');
  assert.equal(h.calls.toasts.length,0,'stale rejection must not display an error on the new child');
  assert.equal(h.calls.queries.length,0);assert.deepEqual(h.calls.opened,[]);assert.equal(h.ctx.assessmentDirty,true);assertUnlocked(h);

  // API failures and thrown transport failures free both locks and retain unsaved answers.
  for(const failure of ['error','throw']){
    h=harness();run=h.next();if(failure==='error')h.pending.resolve({data:null,error:{message:'Synthetic storage failure'}});else h.pending.reject(Error('Synthetic transport failure'));
    await run;assertUnlocked(h);assert.equal(h.ctx.assessmentDirty,true);assert.equal(h.calls.queries.length,0);assert.deepEqual(h.calls.opened,[]);assert.match(h.calls.statuses.at(-1)[1],/Could not save this assessment/);
    h.ctx.upsertResult=Promise.resolve(savedResult);await h.stay();assert.equal(h.calls.upserts.length,2,'retry after '+failure+' is possible');assertUnlocked(h);
  }
  h=harness();h.payload.final_level=null;await h.next();assert.equal(h.calls.upserts.length,0);assert.equal(h.calls.queries.length,0);assertUnlocked(h);
  console.log('PASS: shared persistence/continuation locks prevent overlapping saves; evidence-save stays put; next advances once; newer edits remain dirty with explicit status; stale navigation/edits stop continuation; failures release locks for retry.');
})().catch(error=>{console.error(error);process.exitCode=1});
