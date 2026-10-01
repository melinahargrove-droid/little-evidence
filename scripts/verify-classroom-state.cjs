const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const nodes=new Map(),el=id=>{if(!nodes.has(id))nodes.set(id,{value:'old note',classList:{add(){},remove(){}}});return nodes.get(id)};
let cleared=0,loaded=0;
const ctx=vm.createContext({leUser:{id:'teacher'},activeCheckpoint:{id:'child-a-fall'},activeCheckpointChildName:'A',resetAssessmentForChild(){cleared++},renderCheckpointAuth(){},loadCheckpointChildren:async()=>loaded++});
function load(name){const start=html.search(new RegExp('    (?:async )?function '+name+'\\('));assert.ok(start>=0);const tail=html.slice(start+4),end=tail.slice(1).search(/\n    (?:async )?function |\n    (?:window|document)\./)+1;vm.runInContext(tail.slice(0,end),ctx);}
(async()=>{
 load('handleCheckpointAuthSession');await ctx.handleCheckpointAuthSession({user:{id:'teacher'}});assert.equal(ctx.activeCheckpoint.id,'child-a-fall');assert.equal(cleared,0);assert.equal(loaded,0);
 await ctx.handleCheckpointAuthSession(null);assert.equal(ctx.activeCheckpoint,null);assert.equal(cleared,1);
 Object.assign(ctx,{childEvidenceByObjective:{'22c':{answers:[1]}},taskAnswers:[1],scenarioAnswers:[1],ratings:[1,2,3],observedAnchors:new Set([8]),feelingsAnswers:{behavior:'old'},limitsAnswers:{behavior:'old'},clearFeelingsResult(){},limitsClearResult(){},updateCheckpointContext(){},document:{getElementById:el,querySelector:()=>el('app')}});
 load('resetAssessmentForChild');ctx.resetAssessmentForChild();assert.equal(Object.keys(ctx.childEvidenceByObjective).length,0);assert.equal(ctx.taskAnswers.length,0);assert.equal(ctx.activeDefinition,null);assert.deepEqual(ctx.ratings,[null,null,null]);assert.equal(ctx.feelingsAnswers.behavior,null);assert.equal(ctx.limitsAnswers.behavior,null);assert.equal(ctx.returnScreenAfterWorkspace,'objectiveLibraryScreen');assert.equal(el('notes').value,'');
 assert.match(html,/if\(assessmentCheckpointId&&assessmentCheckpointId!==data.id\)/);
 assert.doesNotMatch(html,/disabled=!document.getElementById\('controllerWait'\).dataset.childDone/);
 assert.match(html,/if\(pairRole==='display'&&pairSessionId===pollingId\)pairPollTimer/);
 console.log('PASS: same-user auth refresh retains checkpoint; sign-out resets state; child switch clears answers/notes/results; movement advances without child-finished signal; cancelled display polling cannot restart.');
})().catch(e=>{console.error(e);process.exitCode=1});
