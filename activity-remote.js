/* Temporary, role-separated iPad controls for every guided child activity. */
const LEActivityRemote=(()=>{
  let session=null,state=null,timer=null,busy=false,shown='',speech=-1,reviewing=false,workspaceOpen=false,target=null,movementRatings=[],pendingObservation=null,pendingConfigure=null,restoring=false,restoreAttempt='',restoreMessage='',privateHandoff=false,mappingVerified=false,creating=false;
  const esc=v=>escapeHTML(v),by=id=>document.getElementById(id);
  function definition(id){if(id==='4')return {id:'4',title:'Demonstrates Traveling Skills',family:'Demonstrates Traveling Skills',tasks:prompts.map(p=>({mode:'observed',prompt:p.text,visual:art(p.kind),note:p.tip}))};const d=objectiveDefinitions.find(d=>d.id===id);if(!d)throw Error('This activity is unavailable. Refresh both screens.');return d.scenarios?{...d,tasks:d.scenarios.map(s=>({prompt:s.text,visual:scenarioIllustration(s),choices:s.choices,mode:'scenario'}))}:d;}
  function config(id){const d=definition(id);return {objective_id:id,tasks:d.tasks.map(t=>t.mode==='observed'?{mode:'observed'}:{mode:t.mode==='scenario'?'scenario':t.order?'order':'touch',choices:t.choices.length,...(t.order?{length:t.order.length}:{})})};}
  async function api(body){const r=await fetch(PAIR_API.replace('little-evidence-session','little-evidence-activity-session'),{method:'POST',headers:{'Content-Type':'application/json',apikey:PAIR_PUBLIC_KEY},body:JSON.stringify({...session,...body})});const data=await r.json();if(!r.ok)throw Error(data.error||'Connection interrupted');return data;}
  function status(text){let e=by('remoteConnection');if(!e){e=document.createElement('p');e.id='remoteConnection';e.setAttribute('role','status');guidedChild.append(e);}e.textContent=text;}
  function surface(){show('guidedObjectiveScreen');guidedHome.classList.add('hidden');guidedCheck.classList.add('hidden');guidedChild.classList.remove('hidden');document.querySelector('.app').classList.toggle('scenario-mode',session.role==='display');}
  function remember(){rememberRemoteCheckpoint(session.id,{...target,movementRatings,pendingObservation})}
  function reconcileObservation(next){
    if(!pendingObservation)return;
    const p=pendingObservation;
    if(next.revision<=p.revision)return;
    // Reconcile this device’s original rating only with the immediate matching transition.
    // Later/nonmatching revisions may have replaced a response; never guess their precise rating.
    if(next.revision===p.revision+1&&next.config.objective_id===p.objectiveId&&
       next.responses[p.promptIndex]?.observation===p.observation&&
       (next.prompt_index===p.promptIndex+1||next.status==='complete'&&next.prompt_index===p.promptIndex)){
      movementRatings[p.promptIndex]=p.rating;
    }
    pendingObservation=null;remember();
  }
  function accept(next,showState=true){if(state&&next.revision<state.revision)return;reconcileObservation(next);state=next;if(showState)render();void restoreCheckpoint();}
  async function action(action,extra={}){
    if(busy||!state)return;
    if(session.role==='teacher'){
      if(privateHandoff&&(!mappingVerified||!remoteCheckpointMatches(target))){document.getElementById('openCheckpoints').click();return;}
      if(action==='start'){
        if(!checkpointAuthReady||restoring)return;
        if(!leUser||!activeCheckpoint){document.getElementById('openCheckpoints').click();return}
        if(!privateHandoff)target={ownerId:leUser.id,checkpointId:activeCheckpoint.id};
        if(state.config.objective_id==='4'){movementRatings=[];pendingObservation=null;ratings.fill(null)}
        remember();
      }else if(!remoteCheckpointMatches(target)){status('Return to the original child checkpoint on this iPad before continuing.');return}
    }
    busy=true;
    const {localMovementRating,...remoteExtra}=extra;
    const payload={action,revision:state.revision,prompt_index:state.prompt_index,...remoteExtra};
    const objectiveId=state.config.objective_id;
    if(action==='observe'&&objectiveId==='4'&&session.role==='teacher'){
      // Persist on the teacher device BEFORE sending: the relay may commit even if its reply is lost.
      // Keep the original intent on a stale retry, rather than replacing it with the reset dropdown.
      if(!pendingObservation)pendingObservation={objectiveId,promptIndex:payload.prompt_index,revision:payload.revision,observation:payload.observation,rating:localMovementRating};
      else {payload.observation=pendingObservation.observation;}
      remember();
    }
    try{
      const data=await api(payload);
      if(!data.conflict&&objectiveId==='4'&&session.role==='teacher'){
        if(action==='skip')movementRatings[payload.prompt_index]=0;
        if(action==='back'||action==='retry'){movementRatings=movementRatings.slice(0,data.state.prompt_index);pendingObservation=null;}
        remember();
      }
      accept(data.state);
      if(data.conflict)status('Screen updated. Please try your action again.');
    }catch(e){status(e.message+' Your place is kept. Try again.');if(session.role==='display'){shown='';render();status(e.message+' Tap your answer again.');}}
    finally{busy=false;}
  }
  function poll(){clearTimeout(timer);if(!session)return;const current=session;api({action:'state'}).then(data=>{if(session===current){accept(data.state);if(!reviewing)status('● Connected');}}).catch(e=>{if(session===current)status('Reconnecting… '+e.message)}).finally(()=>{if(session===current&&!reviewing)timer=setTimeout(poll,900)});}
  function render(){if(reviewing||workspaceOpen)return;if(session.role==='display'){if(state.speech_seq!==speech&&speech!==-1&&state.status==='active')by('taskHear')?.click();speech=state.speech_seq;}const key=state.config.objective_id+':'+state.status+':'+state.prompt_index+':'+(session.role==='teacher'?[state.revision,checkpointAuthReady,leUser?.id,activeCheckpoint?.id,restoring,restoreMessage,mappingVerified].join(':'):'');if(key===shown)return;shown=key;surface();const d=definition(state.config.objective_id),t=d.tasks[state.prompt_index];
    if(session.role==='display'){
      document.body.classList.add('remote-child-display');
      if(state.status==='active'){activeDefinition=d;taskIndex=state.prompt_index;taskAnswers=structuredClone(state.responses);taskSequence=[];childTapReadyAt=Date.now()+350;renderChildTask();}
      else if(state.status==='complete')guidedChild.innerHTML='<section class="panel child-scenario celebration"><h1>Thank you for trying!</h1><p>You shared your ideas. Your teacher will choose what comes next.</p></section>';
      else if(!by('remotePairQr'))guidedChild.innerHTML='<section class="panel child-scenario"><h1>Ready when you are!</h1><p>Your teacher will start the activity from the iPad.</p></section>';
      if(state.speech_seq!==speech&&speech!==-1&&state.status==='active')by('taskHear')?.click();speech=state.speech_seq;return;
    }
    document.body.classList.remove('remote-child-display');updateCheckpointContext();by('modeTag').textContent='TEACHER IPAD · OBJECTIVE '+d.id;
    guidedChild.innerHTML='<section class="panel activity-prep"><p class="eyebrow">iPad remote · Objective '+esc(d.id)+'</p><h1>'+esc(d.title)+'</h1><p id="remoteConnection" role="status">● Connected</p>'+(state.status==='waiting'?'<p>'+(privateHandoff?'The child and checkpoint chosen on the computer will open here after you sign in with the same teacher account. No need to select them again.':'The QR code connects the activity screens. Sign in here with the same teacher account used on the computer, then choose your existing child. You do not need to add the child again.')+'</p><ul>'+materialsForObjective(d.id,d).map(item=>'<li>'+esc(item)+'</li>').join('')+'</ul>'+(d.advanced?'<p>Optional extension: use only when the child is ready.</p>':'')+'<button id="remoteStart" class="primary" '+(!checkpointAuthReady||restoring?'disabled':'')+'>'+(!checkpointAuthReady?'Checking sign-in…':restoring?'Opening selected child…':privateHandoff&&(!mappingVerified||!remoteCheckpointMatches(target))?(leUser?'Open original child checkpoint':'Sign in to open selected child'):activeCheckpoint&&leUser?'Start activity →':leUser?'Choose existing child →':'Sign in & choose child →')+'</button>':state.status==='complete'?'<h2>Activity complete</h2><p>Continue to teacher review on this iPad to save your evidence.</p><button id="remoteReview" class="primary">Teacher review and save →</button><button id="remoteRetry" class="secondary">Repeat last prompt</button>':'<p>Prompt '+(state.prompt_index+1)+' of '+d.tasks.length+'</p><h2>'+esc(t.prompt)+'</h2>'+(t.note?'<p>'+esc(t.note)+'</p>':'')+(t.mode==='observed'?'<p>Watch or listen. Advance when you are ready.</p><label>Optional observation<select id="remoteObservation"><option value="not-observed">Not recorded / not enough evidence</option><option value="independent">Demonstrated independently</option><option value="supported">Demonstrated with support</option><option value="not-demonstrated">Not demonstrated this time</option></select></label><button id="remoteNext" class="primary">'+(state.prompt_index===d.tasks.length-1?'Complete activity ✓':'Next prompt →')+'</button>':'<p>The child’s selection advances automatically on the SmartBoard.</p>')+'<div class="guided-actions"><button class="secondary" id="remoteBack">Previous prompt</button><button class="secondary" id="remoteSpeak">Repeat direction</button><button class="secondary" id="remoteSkip">Skip this prompt →</button></div>')+'</section>';
    const setup=document.createElement('p');setup.id='remoteSetup';setup.className='small-note';setup.setAttribute('role','status');setup.textContent=restoring?'Restoring the child checkpoint selected on this device…':restoreMessage||(!checkpointAuthReady?'Checking teacher sign-in…':!leUser?'Sign in on this device with the same teacher email to see your existing children.':target&&!remoteCheckpointMatches(target)?'Reopen the original child checkpoint on this device before continuing.':!privateHandoff&&!target&&state.status!=='waiting'?'This activity was started in another browser tab. Return to that tab, or start a new pairing; choosing a child here cannot safely identify those responses.':!activeCheckpoint?'Choose the existing child from your account on this device.':'');guidedChild.querySelector('.panel').prepend(setup);
    if((target&&!remoteCheckpointMatches(target)&&leUser?.id===target.ownerId||privateHandoff&&!mappingVerified&&leUser)&&!restoring){const retry=document.createElement('button');retry.className='secondary';retry.id='remoteRestore';retry.textContent='Restore original child checkpoint';retry.onclick=()=>{restoreAttempt='';void restoreCheckpoint(true)};setup.after(retry);}
    if(d.id==='4'&&by('remoteObservation'))by('remoteObservation').innerHTML=ratingNames.map((name,i)=>'<option value="'+['not-observed','supported','independent','independent'][i]+'" data-rating-value="'+i+'">'+esc(name)+'</option>').join('');
    const bind=(id,fn)=>{if(by(id))by(id).onclick=fn};bind('remoteStart',()=>action('start'));bind('remoteNext',()=>action('observe',{observation:by('remoteObservation').value,...(d.id==='4'?{localMovementRating:Number(by('remoteObservation').selectedOptions[0].dataset.ratingValue)}:{})}));bind('remoteBack',()=>action('back'));bind('remoteSpeak',()=>action('speak'));bind('remoteSkip',()=>action('skip'));bind('remoteRetry',()=>action('retry'));bind('remoteReview',review);
    if(!checkpointAuthReady||restoring||privateHandoff&&(!mappingVerified||!remoteCheckpointMatches(target)))for(const id of ['remoteObservation','remoteNext','remoteBack','remoteSpeak','remoteSkip','remoteRetry','remoteReview'])if(by(id))by(id).disabled=true;
  }
  function review(){
    if(privateHandoff&&!mappingVerified||!remoteCheckpointMatches(target)){status('Choose the original child checkpoint on this iPad before reviewing these responses.');return}
    const id=state.config.objective_id,answers=structuredClone(state.responses);reviewing=true;clearTimeout(timer);
    if(id==='4'){
      ratings.fill(null);answers.forEach((answer,i)=>{ratings[i]=answer==='__skipped__'?0:Number.isInteger(movementRatings[i])?movementRatings[i]:answer?.observation==='supported'?1:answer?.observation==='independent'?2:0});
      movementCompleted=true;renderRatingSelections();openRecording(true);
    }else{
      const d=objectiveDefinitions.find(d=>d.id===id);
      childEvidenceByObjective[id]={mode:d.scenarios?'child_scenarios':'touch',answers};openGuidedObjective(id);startGuidedInterview();
    }
  }
  async function continueWith(id,shouldContinue=()=>true){
    if(busy||session?.role!=='teacher'||privateHandoff&&!mappingVerified||!remoteCheckpointMatches(target))return false;
    const continuingSession=session,wanted=config(id);
    let configured=false;
    busy=true;
    try{
      // A failed request may already have configured the display. Read before resending so
      // a retry cannot reset an objective that has started or collected responses meanwhile.
      if(pendingConfigure){
        const current=await api({action:'state'});
        if(session!==continuingSession)return false;
        accept(current.state,false);
        if(pendingConfigure.id===id&&JSON.stringify(state.config)===JSON.stringify(wanted)&&state.revision>pendingConfigure.revision){
          pendingConfigure=null;configured=true;
        }else if(state.revision>pendingConfigure.revision){
          pendingConfigure=null;
          throw Error('The paired screen changed. Review it before continuing again.');
        }else pendingConfigure=null;
      }
      if(JSON.stringify(state.config)!==JSON.stringify(wanted)){
        if(!shouldContinue()||!remoteCheckpointMatches(target))return false;
        pendingConfigure={id,revision:state.revision};
        const data=await api({action:'configure',revision:state.revision,prompt_index:state.prompt_index,config:wanted});
        if(session!==continuingSession)return false;
        accept(data.state,false);
        if(data.conflict){pendingConfigure=null;throw Error('The paired screen changed. Try continuing again.');}
        pendingConfigure=null;configured=true;
      }
      if(configured&&id==='4'){movementRatings=[];pendingObservation=null;remember();}
      if(!shouldContinue()||!remoteCheckpointMatches(target))return false;
      reviewing=false;shown='';workspaceOpen=false;render();poll();return true;
    }finally{busy=false;}
  }
  function checkpointSelected(){
    if(session?.role!=='teacher'||privateHandoff||state?.status!=='waiting'||!leUser||!activeCheckpoint)return;
    target={ownerId:leUser.id,checkpointId:activeCheckpoint.id};remember();restoreAttempt=target.ownerId+':'+target.checkpointId;restoreMessage='';
  }
  function refreshContext(){if(session?.role==='teacher'){if(!leUser||target&&target.ownerId!==leUser.id){restoreAttempt='';mappingVerified=false;}if(state)render();}}
  async function restoreCheckpoint(explicit=false){
    if(session?.role!=='teacher'||!state||!checkpointAuthReady||!leUser||restoring||workspaceOpen&&!privateHandoff&&!explicit)return;
    if(!privateHandoff&&(!target||leUser.id!==target.ownerId||activeCheckpoint))return;
    if(privateHandoff&&mappingVerified&&remoteCheckpointMatches(target))return;
    const currentSession=session,ownerId=leUser.id,selectionRevision=checkpointSelectionRevision,key=ownerId+':'+(privateHandoff?session.id:target.checkpointId);
    if(restoreAttempt===key&&!explicit)return;
    restoreAttempt=key;restoring=true;restoreMessage='';render();
    const current=()=>session===currentSession&&leUser?.id===ownerId&&checkpointSelectionRevision===selectionRevision;
    try{
      if(privateHandoff&&!mappingVerified){
        const {data,error}=await leDb.from('little_evidence_pairing_checkpoints').select('checkpoint_id,expires_at').eq('pairing_id',session.id).eq('owner_id',ownerId).maybeSingle();
        if(!current())return;
        if(error)throw error;
        if(!data||Date.parse(data.expires_at)<=Date.now())throw Error('Use the same teacher account as on the computer. If the pairing has expired, create a new QR code.');
        if(target&&(target.ownerId!==ownerId||target.checkpointId!==data.checkpoint_id)){movementRatings=[];pendingObservation=null;}
        target={ownerId,checkpointId:data.checkpoint_id};mappingVerified=true;remember();
      }
      const currentTarget=target;
      if(activeCheckpoint&&!remoteCheckpointMatches(target)){
        // Opening a mapped QR in a fresh tab must not silently adopt another local child.
        throw Error('This pairing belongs to the child chosen on the computer. Reopen the QR code in a new tab to use that checkpoint.');
      }
      await restorePrivateRemoteCheckpoint(target,()=>current()&&target===currentTarget);
    }catch(e){if(current())restoreMessage='Could not open the selected child. '+(e.message||'Try again when connected.');}
    finally{if(session===currentSession){restoring=false;render();}}
    if(current()&&privateHandoff&&mappingVerified&&remoteCheckpointMatches(target)){workspaceOpen=false;remoteCheckpointReturn=null;shown='';render();if(state.status==='waiting')await action('start');}
  }
  async function start(id){
    if(creating)return;creating=true;
    const startRevision=evidenceCaptureRevision,selectionRevision=checkpointSelectionRevision;
    const source=activeCheckpoint&&leUser?{ownerId:leUser.id,checkpointId:activeCheckpoint.id}:null;
    try{
      const data=await api({action:'create',config:config(id)});
      if(startRevision!==evidenceCaptureRevision||selectionRevision!==checkpointSelectionRevision)throw Error('The selection changed. Start the pairing again.');
      if(source){
        if(startRevision!==evidenceCaptureRevision||selectionRevision!==checkpointSelectionRevision||leUser?.id!==source.ownerId||activeCheckpoint?.id!==source.checkpointId)throw Error('The selected child changed. Start the pairing again.');
        const {error}=await leDb.from('little_evidence_pairing_checkpoints').insert({pairing_id:data.id,owner_id:source.ownerId,checkpoint_id:source.checkpointId,expires_at:data.expires_at});
        if(error)throw Error('Could not prepare the private child handoff. Please try again.');
        if(startRevision!==evidenceCaptureRevision||selectionRevision!==checkpointSelectionRevision||leUser?.id!==source.ownerId||activeCheckpoint?.id!==source.checkpointId)throw Error('The selected child changed. Start the pairing again.');
      }
      session={id:data.id,role:'display',token:data.display_token};state=data.state;shown='';reviewing=false;workspaceOpen=false;target=null;restoring=false;restoreAttempt='';restoreMessage='';privateHandoff=!!source;mappingVerified=false;surface();
      const url=new URL(location.origin+location.pathname);url.hash='activityRemote='+data.id+'.'+data.teacher_token+(source?'.private':'');const link=url.toString();history.replaceState(null,'','#activityDisplay='+data.id+'.'+data.display_token);
      guidedChild.innerHTML='<section class="panel activity-prep"><h1>Connect your phone or iPad</h1><p>'+(source?'Scan this code to open the selected child and checkpoint on your teacher device. If asked, sign in with the same teacher account. You only need to choose the child once.':'Scan this code, sign in with your teacher account, then choose the existing child on your phone or iPad.')+'</p><div id="remotePairQr"></div><p><a id="remotePairLink">Open teacher remote</a></p><button id="remoteCopy">Copy teacher link</button><p id="remoteConnection">Waiting for your teacher device…</p></section>';
      by('remotePairLink').href=link;by('remoteCopy').onclick=()=>navigator.clipboard.writeText(link).then(()=>toast('Teacher link copied.')).catch(()=>toast('Scan the QR code with your phone or iPad camera.'));const qr=window.qrcode(0,'M');qr.addData(link);qr.make();by('remotePairQr').innerHTML='<img alt="Scan with your phone or iPad camera" src="'+qr.createDataURL(6,4)+'">';poll();
    }catch(e){toast(e.message);}
    finally{creating=false;}
  }
  function button(container,id){if(!container||container.querySelector('[data-remote-start]'))return;const b=document.createElement('button');b.dataset.remoteStart='true';b.className='primary';b.textContent='Use iPad remote';b.onclick=()=>start(id);container.append(b);}
  function init(){const style=document.createElement('style');style.textContent='.remote-child-display #taskBack,.remote-child-display #taskSkip,.remote-child-display #taskNext,.remote-child-display .topbar,.remote-child-display #checkpointContext{display:none!important} #remotePairQr img{max-width:100%;width:280px} #remoteNext{display:block;margin:20px 0} #remoteObservation{display:block;min-height:48px;width:100%;font:inherit;margin:10px 0}';document.head.append(style);const match=location.hash.match(/^#activity(Remote|Display)=([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})(\.private)?$/i);if(match){session={id:match[2],role:match[1].toLowerCase()==='remote'?'teacher':'display',token:match[3]};privateHandoff=session.role==='teacher'&&!!match[4];mappingVerified=false;target=session.role==='teacher'?recallRemoteCheckpoint(session.id):null;movementRatings=target?.movementRatings||[];pendingObservation=target?.pendingObservation||null;surface();guidedChild.innerHTML='<section class="panel"><h1>Connecting to your activity…</h1></section>';poll();}}
  return {init,start,button,continueWith,checkpointSelected,refreshContext,restoreCheckpoint,hasTeacherSession:()=>session?.role==='teacher',objectiveId:()=>session?.role==='teacher'&&!reviewing?state?.config.objective_id:null,isTeacher:()=>session?.role==='teacher'&&!reviewing,lockedCheckpoint:()=>session?.role==='teacher'&&!reviewing&&(privateHandoff&&mappingVerified||state?.status!=='waiting')?target:null,pauseForCheckpoint:()=>{workspaceOpen=true},resumeAfterCheckpoint:()=>{workspaceOpen=false;shown='';if(state)render();else surface()},isDisplay:()=>session?.role==='display',answer:()=>action('answer',{answer:taskAnswers[taskIndex]}),decorate:()=>{if(session?.role==='display')for(const id of ['taskBack','taskSkip','taskNext'])by(id).hidden=true;}};
})();
