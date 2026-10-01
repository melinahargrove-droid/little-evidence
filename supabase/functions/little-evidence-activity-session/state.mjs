export function config(input){
  if(!input||!/^([1-9]|1[0-9]|2[0-3])[a-f]?$/.test(String(input.objective_id)))throw Error('Invalid objective');
  if(!Array.isArray(input.tasks)||!input.tasks.length||input.tasks.length>64)throw Error('Invalid tasks');
  return {objective_id:String(input.objective_id),tasks:input.tasks.map(t=>{
    if(!['touch','order','observed','scenario'].includes(t.mode))throw Error('Invalid task mode');
    if(t.mode==='observed')return {mode:t.mode};
    if(!Number.isInteger(t.choices)||t.choices<1||t.choices>64)throw Error('Invalid choices');
    if(t.mode==='order'&&(!Number.isInteger(t.length)||t.length<1||t.length>t.choices))throw Error('Invalid sequence');
    return {mode:t.mode,choices:t.choices,...(t.mode==='order'?{length:t.length}:{})};
  })};
}
export function initial(c){return {config:config(c),status:'waiting',prompt_index:0,responses:[],speech_seq:0,revision:0};}
export function transition(state,role,body){
  if(body.revision!==state.revision)throw Error('STALE');
  const s=structuredClone(state),action=body.action;
  if(action==='configure'&&role==='teacher')return {...initial(body.config),revision:state.revision+1,speech_seq:state.speech_seq};
  if(action==='start'&&role==='teacher'&&s.status==='waiting')s.status='active';
  else if(action==='speak'&&role==='teacher'&&s.status==='active')s.speech_seq++;
  else if(action==='stop'&&role==='teacher')s.status='complete';
  else if((action==='back'||action==='retry')&&role==='teacher'&&s.status!=='waiting'){
    s.prompt_index=action==='retry'||s.status==='complete'?s.prompt_index:Math.max(0,s.prompt_index-1);
    s.responses=s.responses.slice(0,s.prompt_index);s.status='active';
  }else if(s.status==='active'&&body.prompt_index===s.prompt_index){
    const task=s.config.tasks[s.prompt_index];let answer;
    if(action==='skip'&&role==='teacher')answer='__skipped__';
    else if(action==='observe'&&role==='teacher'&&task.mode==='observed'){
      if(!['independent','supported','not-demonstrated','not-observed'].includes(body.observation))throw Error('Choose an observation');
      answer={presented:true,observation:body.observation};
    }else if(action==='answer'&&role==='display'&&task.mode!=='observed'){
      const valid=n=>Number.isInteger(n)&&n>=0&&n<task.choices;
      if(task.mode==='order'){
        if(!Array.isArray(body.answer)||body.answer.length!==task.length||new Set(body.answer).size!==task.length||!body.answer.every(valid))throw Error('Invalid sequence answer');
      }else if(!valid(body.answer))throw Error('Invalid answer');
      answer=body.answer;
    }else throw Error('Action not permitted');
    s.responses[s.prompt_index]=answer;
    if(s.prompt_index<s.config.tasks.length-1)s.prompt_index++;else s.status='complete';
  }else throw Error('Action not available');
  s.revision++;return s;
}
