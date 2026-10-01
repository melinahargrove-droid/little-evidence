// Run with node scripts/verify-assessment-continuation.cjs. Synthetic data only; no network or persistence.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const helper=require(path.join(root,'assessment-continuation.js'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ids=definitions=>Array.from(definitions,definition=>definition.id);

// Browser and CommonJS entry points expose the same small pure API.
const browser=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(root,'assessment-continuation.js'),'utf8'),browser);
assert.equal(typeof browser.window.LEAssessmentContinuation.next,'function');
assert.deepEqual(ids(browser.window.LEAssessmentContinuation.queue([])),['1a','1b','4']);

const definitions=[
  {id:'23',title:'Patterns'},
  {id:'20a',title:'Counting'},
  {id:'3',title:'Third objective'},
  {id:'10a',title:'Later numbered objective'},
  {id:'1c',title:'Existing self-care title',tasks:[{prompt:'Existing prompt'}]},
  {id:'1a',title:'Existing legacy override'},
  {id:'4',title:'Existing movement override'},
  {id:'20d',title:'Optional extension',advanced:true},
  {id:'24',title:'Outside scope'},
  {id:'0',title:'Outside scope'},
  {id:'not-an-id',title:'Invalid ID'},
  {id:'23invalid!',title:'Invalid suffix'},
  {id:6,title:'Numeric ID'},
  {id:'3',title:'Latest supplied definition'}
];
const before=JSON.stringify(definitions);
const ordered=helper.queue(definitions);
assert.deepEqual(ids(ordered),['1a','1b','1c','3','4','6','10a','20a','23']);
assert.equal(ordered.find(d=>d.id==='1a').title,'Existing legacy override');
assert.equal(ordered.find(d=>d.id==='4').title,'Existing movement override');
assert.equal(ordered.find(d=>d.id==='3').title,'Latest supplied definition');
assert.equal(ordered.find(d=>d.id==='1c').tasks,definitions.find(d=>d.id==='1c').tasks,'existing task data passes through unchanged');
assert.equal(helper.next(definitions,[],null).id,'1a','no current objective starts at the first unfinished');
assert.equal(helper.next(definitions,['1a'],'1a').id,'1b');
assert.equal(helper.next(definitions,['1a','1b'],'1a').id,'1c','saved later objectives are skipped');
assert.equal(helper.next(definitions,['1a','1b','1c','3'],'4').id,'6','numeric order beats lexical order');
assert.equal(helper.next(definitions,[],'20d').id,'23','manually selected optional route continues after its numeric position');
assert.equal(helper.next(definitions,['23'],'20d').id,'1a','wrap when no later ordinary objective remains');
assert.equal(helper.next(definitions,[],'23').id,'1a','wrap fills earlier unfinished gaps');
assert.equal(helper.next(definitions,new Set(['1a','1b','1c','3','4',6]),'4').id,'10a','Set input and numeric saved IDs are supported');
assert.equal(helper.next(definitions,ids(ordered),'20a'),null,'all saved has no next objective');
assert.equal(helper.next(definitions,ids(ordered).filter(id=>id!=='23'),'23'),null,'never reopens the just-saved objective from an older ID snapshot');
assert.equal(helper.next(definitions,ids(ordered),'20d'),null,'optional activities are not mandatory after ordinary completion');
assert.equal(JSON.stringify(definitions),before,'planning does not sort or change caller definitions');
ordered[0].title='Changed returned title';
assert.equal(helper.queue(definitions)[0].title,'Existing legacy override','each call returns fresh top-level definitions');
const legacy=helper.queue([]);legacy[1].title='Changed legacy title';
assert.equal(helper.queue([])[1].title,'Follows Limits and Expectations','legacy fallback is not mutable through a queue result');

// No retained child state: switching to another checkpoint must use its own saved-ID snapshot.
const childASaved=new Set(['1a','1b','1c','3','4','6','10a','20a']);
const childBSaved=new Set(['1a']);
assert.equal(helper.next(definitions,childASaved,'20a').id,'23');
assert.equal(helper.next(definitions,childBSaved,'1a').id,'1b');
assert.equal(helper.next(definitions,childASaved,'20a').id,'23');
assert.deepEqual([...childBSaved],['1a'],'saved IDs are not mutated');

// Load the actual definitions and their activity flags, rather than inventing curriculum fixtures.
const actual=vm.createContext({console,window:{}});
vm.runInContext(fs.readFileSync(path.join(root,'child-activities.js'),'utf8')+'\nvar LEChildActivities=window.LEChildActivities;',actual);
vm.runInContext(fs.readFileSync(path.join(root,'verified-progressions.js'),'utf8'),actual);
const start=html.indexOf('const objectiveDefinitions='),end=html.indexOf('    const objectiveMaterialsById=',start);
assert.ok(start>=0&&end>start,'existing objective definitions are available');
vm.runInContext(html.slice(start,end)+'\nthis.definitions=objectiveDefinitions;',actual);
for(const name of ['objectiveIdCompare','materialsChecklistDefinitions']){
  const match=html.match(new RegExp('    function '+name+'\\([^]*?\\n    }'));
  assert.ok(match,name+' is available');vm.runInContext(match[0],actual);
}
const expected=actual.materialsChecklistDefinitions().filter(d=>Number.parseInt(d.id,10)>=1&&Number.parseInt(d.id,10)<=23&&d.advanced!==true).sort(actual.objectiveIdCompare);
const actualQueue=helper.queue(actual.definitions);
assert.deepEqual(ids(actualQueue),ids(expected),'queue matches the existing numeric/suffix comparator and legacy catalog');
assert.equal(new Set(ids(actualQueue)).size,actualQueue.length,'legacy and catalog entries never duplicate');
for(const definition of actualQueue){
  assert.equal(definition.title,expected.find(d=>d.id===definition.id).title,'existing objective title for '+definition.id);
  assert.notEqual(definition.advanced,true);
}
const optionalIds=ids(actual.definitions.filter(d=>d.advanced===true));
assert.deepEqual(optionalIds.sort(),['18d','18e','20d','20e','20f'],'verified optional catalog routes remain optional');
for(const id of optionalIds)assert.ok(!ids(actualQueue).includes(id));
assert.equal(helper.next(actual.definitions,[], '18d').id,'19a');
assert.equal(helper.next(actual.definitions,[], '20f').id,'21a');
assert.equal(helper.next(actual.definitions,ids(actualQueue),'23'),null);
console.log('PASS: pure next-objective planning; established numeric order; later-then-earlier gaps; legacy deduplication and exact titles; optional/out-of-range exclusion; all-saved completion; independent checkpoint snapshots.');
