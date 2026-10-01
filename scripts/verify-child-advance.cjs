const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{textContent:'',classList:{toggle(){}},addEventListener(type,fn){this[type]=fn}});return elements.get(id)};
let buttons=[],advances=0,clock=0;
const ctx=vm.createContext({Date:{now:()=>clock+=400},childTapReadyAt:0,window:{},document:{getElementById:el},escapeHTML:String,LEChildActivities:{label:String,choice:String},taskIndex:0,taskAnswers:[],advanceChildTask(){advances++},guidedChild:{innerHTML:'',querySelectorAll(){return buttons}},activeDefinition:null});
const start=html.indexOf('    function renderChildTask(){'),end=html.indexOf('    function advanceChildTask(){',start);vm.runInContext(html.slice(start,end),ctx);
function render(task){ctx.activeDefinition={id:'test',tasks:[task]};ctx.taskAnswers=[];advances=0;buttons=(task.choices||[]).map((_,i)=>({dataset:{childTaskChoice:String(i)}}));ctx.renderChildTask();}
render({prompt:'Choose',choices:['a','b'],answer:0});buttons[1].onclick();assert.equal(advances,1);assert.equal(ctx.taskAnswers[0],1);assert.match(ctx.guidedChild.innerHTML,/id="taskNext" hidden/);
render({prompt:'Order',choices:['a','b','c'],order:[0,1,2]});buttons[0].onclick();assert.equal(advances,0);buttons[0].onclick();assert.equal(ctx.taskAnswers[0].length,1);buttons[2].onclick();assert.equal(advances,0);buttons[1].onclick();assert.equal(advances,1);assert.deepEqual(Array.from(ctx.taskAnswers[0]),[0,2,1]);
render({prompt:'Tell me',mode:'observed'});assert.equal(advances,0);assert.match(ctx.guidedChild.innerHTML,/Teacher: next/);assert.doesNotMatch(ctx.guidedChild.innerHTML,/Finished trying|Finish activity/);el('taskNext').onclick();assert.equal(advances,1);assert.equal(ctx.taskAnswers[0].presented,true);assert.equal(ctx.taskAnswers[0].observation,null);
render({prompt:'Choose',choices:['a'],answer:0});el('taskSkip').onclick();assert.equal(advances,1);assert.equal(ctx.taskAnswers[0],'__skipped__');
assert.match(html,/scenarioNext'\)\.disabled=false;document.getElementById\('scenarioNext'\)\.click\(\)/);
console.log('PASS: touch answers auto-advance regardless of correctness; sequence waits for every selection; observation requires teacher action; skip stays unscored; scenarios advance on selection.');
