/* Pure planning for the existing objective order. No child, checkpoint, or save state is kept here. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.LEAssessmentContinuation=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  // These legacy routes are outside objectiveDefinitions. Titles match their existing library/materials entries.
  const legacyDefinitions=[
    {id:'1a',title:'Manages Feelings',domain:'Social-Emotional'},
    {id:'1b',title:'Follows Limits and Expectations',domain:'Social-Emotional'},
    {id:'4',title:'Demonstrates Traveling Skills',domain:'Physical'}
  ];

  // Keep identical to the app's objectiveIdCompare: number first, then the letter suffix.
  function objectiveIdCompare(a,b){
    const left=String(a.id).match(/^(\d+)([a-z]*)$/i)||[,Number.MAX_SAFE_INTEGER,String(a.id)];
    const right=String(b.id).match(/^(\d+)([a-z]*)$/i)||[,Number.MAX_SAFE_INTEGER,String(b.id)];
    return Number(left[1])-Number(right[1])||String(left[2]).localeCompare(String(right[2]),'en',{sensitivity:'base'});
  }

  function included(id){
    const match=id.match(/^(\d+)([a-z]*)$/i);
    return !!match&&Number(match[1])>=1&&Number(match[1])<=23;
  }

  /** Return fresh, deduplicated definitions in the established order, excluding optional extensions. */
  function queue(definitions=[]){
    const byId=new Map();
    for(const definition of [...legacyDefinitions,...definitions]){
      if(!definition||definition.id===null||definition.id===undefined)continue;
      const id=String(definition.id);
      if(included(id))byId.set(id,{...definition,id});
    }
    return [...byId.values()].filter(definition=>definition.advanced!==true).sort(objectiveIdCompare);
  }

  /**
   * Plan only after a successful save. savedIds must come from that same child's checkpoint.
   * Continue after currentId; once the end is reached, return the earliest unfinished objective.
   * A manually selected optional objective is an ordering position, never added to the queue.
   * Exclude the just-saved current objective even if the caller's saved-ID snapshot predates its save.
   * null means no ordinary objective remains. The caller owns all save/race/navigation guards.
   */
  function next(definitions,savedIds=[],currentId=null){
    const saved=new Set(Array.from(savedIds,id=>String(id)));
    const current=currentId===null||currentId===undefined?null:{id:String(currentId)};
    const unfinished=queue(definitions).filter(definition=>!saved.has(definition.id)&&definition.id!==current?.id);
    if(!unfinished.length)return null;
    return (current&&unfinished.find(definition=>objectiveIdCompare(definition,current)>0))||unfinished[0];
  }

  return Object.freeze({queue,next});
});
