// Synthetic in-memory doubles only: no network, microphone, or child records.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(new URL('../index.html',`file://${__filename}`),'utf8');
const source=html.slice(html.indexOf('    function evidenceTarget('),html.indexOf('    function wireLegacyEvidenceButtons('));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
function setup(){
 const nodes=new Map(),uploads=[],rows=[],statuses=[],recorders=[];let stops=0;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',click(){}});return nodes.get(id)};
 const ctx=vm.createContext({objectivePersistenceBusy:false,assessmentEditRevision:0,console,Blob,File,Date,Set,crypto:{randomUUID:()=> 'synthetic-id'},evidenceCaptureRevision:0,pendingEvidenceUpload:null,voiceCapture:null,voiceRecorder:null,voiceStream:null,voiceButton:null,voiceContext:null,leUser:{id:'owner-A'},activeCheckpoint:{id:'checkpoint-A'},evidenceRecordIds:{guided:'record-A'},LE_EVIDENCE_BUCKET:'synthetic',escapeHTML:String,document:{getElementById:node},setEvidenceStatus:(...args)=>statuses.push(args)});
 const stream={getTracks:()=>[{stop(){stops++}}]};
 ctx.navigator={mediaDevices:{getUserMedia:async()=>stream}};
 ctx.MediaRecorder=class {static isTypeSupported(){return true}constructor(){this.state='inactive';this.mimeType='audio/webm';recorders.push(this)}start(){this.state='recording'}stop(){this.state='inactive';this.stopped=Promise.resolve().then(()=>{this.ondataavailable({data:new Blob(['synthetic'])});return this.onstop()})}};
 ctx.leDb={storage:{from:()=>({upload:async(path)=>{uploads.push(path);return {error:null}},createSignedUrl:async()=>({data:{signedUrl:'https://example.invalid/synthetic'}}),remove:async()=>({error:null})})},from:()=>({insert(row){rows.push(row);return {select:()=>({single:async()=>({error:null})})}},select:()=>({eq:()=>({order:async()=>({data:[],error:null})})})})};
 vm.runInContext(source,ctx);
 const button={dataset:{captureEvidence:'photo',evidenceContext:'guided'},textContent:'＋ Voice note'};
 const choose=()=>ctx.handleEvidenceButtonClick({target:{closest:()=>button}});
 const switchChild=()=>{ctx.cancelEvidenceCapture();ctx.activeCheckpoint={id:'checkpoint-B'};ctx.evidenceRecordIds.guided='record-B'};
 return {ctx,nodes,node,uploads,rows,statuses,recorders,stream,button,choose,switchChild,get stops(){return stops}};
}
const file={name:'synthetic.jpg',type:'image/jpeg',size:12};
(async()=>{
 let h=setup();h.choose();h.switchChild();await h.ctx.handleEvidenceFileChosen({target:{files:[file]}});assert.equal(h.uploads.length,0,'cancel picker on child switch');
 h=setup();h.choose();h.ctx.evidenceRecordIds.guided='other-objective';await h.ctx.handleEvidenceFileChosen({target:{files:[file]}});assert.equal(h.uploads.length,0,'do not retarget objective');
 h=setup();h.choose();await h.ctx.handleEvidenceFileChosen({target:{files:[]}});assert.equal(h.ctx.pendingEvidenceUpload,null,'cancelled picker clears pending target');
 h=setup();h.choose();await h.ctx.handleEvidenceFileChosen({target:{files:[file]}});assert.match(h.uploads[0],/^owner-A\/checkpoint-A\/record-A\//);assert.equal(h.rows[0].record_id,'record-A');
 h=setup();let upload=deferred();h.ctx.leDb.storage.from=()=>({upload:async path=>{h.uploads.push(path);return upload.promise}});const saving=h.ctx.uploadEvidenceFile('guided','photo',file);h.switchChild();h.ctx.leUser={id:'owner-B'};upload.resolve({error:null});await saving;assert.equal(h.rows[0].owner_id,'owner-A');assert.equal(h.rows[0].record_id,'record-A');assert.equal(h.statuses.length,1,'no completion notice on next child');
 h=setup();let query=deferred();h.ctx.leDb.from=()=>({select:()=>({eq:()=>({order:()=>query.promise})})});h.node('guidedEvidenceList').innerHTML='new child view';const loading=h.ctx.loadEvidenceItems('guided');h.switchChild();query.resolve({data:[{file_name:'synthetic.jpg',storage_path:'synthetic'}]});await loading;assert.equal(h.node('guidedEvidenceList').innerHTML,'new child view');
 h=setup();let signed=deferred();h.ctx.leDb.from=()=>({select:()=>({eq:()=>({order:async()=>({data:[{file_name:'synthetic.jpg',storage_path:'synthetic'}]})})})});h.ctx.leDb.storage.from=()=>({createSignedUrl:()=>signed.promise});const signing=h.ctx.loadEvidenceItems('guided');await Promise.resolve();await Promise.resolve();h.switchChild();h.node('guidedEvidenceList').innerHTML='new view';signed.resolve({data:{signedUrl:'https://example.invalid/synthetic'}});await signing;assert.equal(h.node('guidedEvidenceList').innerHTML,'new view');
 h=setup();let permission=deferred();h.ctx.navigator.mediaDevices.getUserMedia=()=>permission.promise;const requesting=h.ctx.toggleVoiceRecording(h.button,'guided');await h.ctx.toggleVoiceRecording(h.button,'guided');h.switchChild();permission.resolve(h.stream);await requesting;assert.equal(h.recorders.length,0);assert.ok(h.stops>0);assert.equal(h.ctx.voiceCapture,null);
 h=setup();await h.ctx.toggleVoiceRecording(h.button,'guided');h.switchChild();await h.recorders[0].stopped;assert.equal(h.uploads.length,0);assert.ok(h.stops>0);assert.equal(h.ctx.voiceCapture,null);
 h=setup();await h.ctx.toggleVoiceRecording(h.button,'guided');await h.ctx.toggleVoiceRecording(h.button,'guided');await h.recorders[0].stopped;assert.equal(h.rows[0].record_id,'record-A');assert.equal(h.ctx.voiceCapture,null);
 h=setup();h.ctx.navigator.mediaDevices.getUserMedia=async()=>{throw new Error('denied')};await h.ctx.toggleVoiceRecording(h.button,'guided');assert.equal(h.ctx.voiceCapture,null);assert.equal(h.uploads.length,0);
 h=setup();h.choose();const oldTarget=h.ctx.pendingEvidenceUpload.target;h.switchChild();h.ctx.activeCheckpoint={id:'checkpoint-A'};h.ctx.evidenceRecordIds.guided='record-A';assert.equal(h.ctx.evidenceTargetIsCurrent(oldTarget),false,'A to B to A does not revive cancelled capture');
 h=setup();upload=deferred();h.ctx.leDb.storage.from=()=>({upload:()=>upload.promise});await h.ctx.toggleVoiceRecording(h.button,'guided');await h.ctx.toggleVoiceRecording(h.button,'guided');const oldStopped=h.recorders[0].stopped;await Promise.resolve();h.switchChild();await h.ctx.toggleVoiceRecording(h.button,'guided');upload.resolve({error:null});await oldStopped;assert.equal(h.button.textContent,'Stop recording','old upload cannot relabel new recorder');h.ctx.cancelEvidenceCapture();await h.recorders[1].stopped;
 h=setup();query=deferred();h.ctx.leDb.from=()=>({select:()=>({eq:()=>({order:()=>query.promise})})});vm.runInContext(html.slice(html.indexOf('    async function refreshCheckpointRecords('),html.indexOf('    function objectiveIdCompare(')),h.ctx);const refreshing=h.ctx.refreshCheckpointRecords();h.switchChild();query.resolve({data:[{id:'old-A',objective_id:'4'}]});await refreshing;assert.equal(h.ctx.evidenceRecordIds.movement,undefined,'old refresh cannot poison new capture target');
 assert.match(html,/await loadCheckpointChildren\(\);\s*await refreshCheckpointRecords\(\)/);
 assert.match(html,/function show\(id\)\{cancelEvidenceCapture\(\)/);
 assert.match(html,/function renderGuidedQuestion\(\)\{\s*cancelEvidenceCapture\(\)/);
 assert.match(html,/function resetAssessmentForChild\(\)\{\s*cancelEvidenceCapture\(\)/);
 console.log('PASS: picker/voice identity, child/objective/account changes, A→B→A cancellation, interrupted permission, recording cleanup, delayed uploads/previews, and unchanged-target saves.');
})().catch(e=>{console.error(e);process.exitCode=1});
