import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
const source=readFileSync(new URL("../assets/masar-progress-sync.js",import.meta.url),"utf8");
class Storage { constructor(){this.data={}} get length(){return Object.keys(this.data).length} key(i){return Object.keys(this.data)[i]??null} getItem(k){return Object.prototype.hasOwnProperty.call(this.data,k)?this.data[k]:null} setItem(k,v){this.data[k]=String(v)} removeItem(k){delete this.data[k]} }
const localStorage=new Storage(),window={localStorage,__MASAR_PROGRESS_SYNC_TEST__:true};
vm.runInNewContext(source,{window,Storage,localStorage,JSON,Date,Set,Object,Array,String,Number,Math,RegExp});
const api=window.__MASAR_PROGRESS_SYNC_TEST__;
assert.ok(api,"progress sync exposes a QA-only merge API");
assert.equal(api.isKey("masar_v2"),true);
assert.equal(api.isKey("masar_ex_9"),true);
assert.equal(api.isKey("masar_ex_updated_9"),true,"exercise update timestamps are included in sync");
assert.equal(api.isKey("masar_ex_10"),false);
assert.equal(api.isKey("masar_local_owner"),false);
const merged=api.mergeProgress(
 {masar_v2:{completed:[0,1],scores:{0:4,1:3},finalScore:7,journal:[{id:"j1",asset:"EURUSD"}]},masar_paper_v1:[{id:"t1",status:"open"}],masar_strategy_replay_v1:{s0:{at:"2026-11-10T00:00:00Z",score:60}},masar_ex_0:"ملاحظة سابقة"},
 {masar_v2:{completed:[1,2],scores:{0:2,1:5,2:4},finalScore:9,journal:[{id:"j2",asset:"XAUUSD"}]},masar_paper_v1:[{id:"t1",status:"closed"},{id:"t2",status:"open"}],masar_strategy_replay_v1:{s0:{at:"2026-11-12T00:00:00Z",score:90}},masar_ex_0:"",masar_ex_1:"ملاحظة جديدة"}
);
assert.deepEqual(Array.from(merged.masar_v2.completed).sort(),[0,1,2],"unit completion merges across devices");
assert.equal(merged.masar_v2.scores[0],4,"higher historical quiz score is preserved");
assert.equal(merged.masar_v2.scores[1],5,"higher score from the other device is preserved");
assert.equal(merged.masar_v2.finalScore,9,"higher final exam score is preserved");
assert.equal(merged.masar_v2.journal.length,2,"journal entries are combined");
assert.equal(merged.masar_paper_v1.length,2,"paper trades merge by ID");
assert.equal(merged.masar_paper_v1.find(x=>x.id==="t1").status,"closed","local update replaces the same trade ID");
const tradeMerge=api.mergeProgress({masar_paper_v1:[{id:"t3",status:"closed",closedAt:"2026-11-16T10:00:00Z",pnl:4}]},{masar_paper_v1:[{id:"t3",status:"open",openedAt:"2026-11-15T10:00:00Z"}]});
assert.deepEqual(JSON.parse(JSON.stringify(tradeMerge.masar_paper_v1[0])),{id:"t3",status:"closed",closedAt:"2026-11-16T10:00:00Z",pnl:4},"an older open trade cannot reopen a trade already closed in cloud progress");
assert.equal(merged.masar_strategy_replay_v1.s0.score,90,"newer strategy replay attempt wins");
assert.equal(merged.masar_ex_0,"ملاحظة سابقة","non-empty saved exercise is not overwritten by empty state");
assert.equal(merged.masar_ex_1,"ملاحظة جديدة","new exercise note is retained");
const marketLabMerge=api.mergeProgress({masar_marketlab_v1:{caseA:{answer:1,correct:true}}},{masar_marketlab_v1:{caseA:{answer:2,correct:false},caseB:{answer:0,correct:false}}});
assert.deepEqual(JSON.parse(JSON.stringify(marketLabMerge.masar_marketlab_v1.caseA)),{answer:1,correct:true},"an incorrect local attempt cannot erase a correct cloud result");
assert.deepEqual(JSON.parse(JSON.stringify(marketLabMerge.masar_marketlab_v1.caseB)),{answer:0,correct:false},"unique local market lab attempts are retained");
const marketConflict=api.mergeProgress({masar_marketlab_v1:{caseC:{answer:0,correct:false,at:"2026-11-15T12:00:00Z"}}},{masar_marketlab_v1:{caseC:{answer:1,correct:false,at:"2026-11-14T12:00:00Z"}}});
assert.equal(marketConflict.masar_marketlab_v1.caseC.answer,0,"newer cloud market-lab attempt wins a stale local conflict");
const noteConflict=api.mergeProgress({masar_ex_2:"newer cloud note",masar_ex_updated_2:200},{masar_ex_2:"older local note",masar_ex_updated_2:100});
assert.equal(noteConflict.masar_ex_2,"newer cloud note","newer cloud exercise note wins a stale local conflict");
const newerNote=api.mergeProgress({masar_ex_2:"older cloud note",masar_ex_updated_2:100},{masar_ex_2:"newer local note",masar_ex_updated_2:200});
assert.equal(newerNote.masar_ex_2,"newer local note","newer local exercise note wins a stale cloud conflict");
const newerPractice=api.mergeProgress(
 {masar_practice_v1:{result:{marker:"remote-latest",meta:{createdAt:"2026-11-16T12:00:00Z"}},frozen:{name:"v2",at:"2026-11-16T12:00:00Z"},rubric:[8,9],rubricUpdatedAt:"2026-11-16T12:00:00Z",analyses:[{time:"2026-11-16T12:00:00Z",text:"remote"}]}},
 {masar_practice_v1:{result:{marker:"local-old",meta:{createdAt:"2026-11-15T12:00:00Z"}},frozen:{name:"v1",at:"2026-11-15T12:00:00Z"},rubric:[2,3],rubricUpdatedAt:"2026-11-15T12:00:00Z",analyses:[{time:"2026-11-15T12:00:00Z",text:"local"}]}}
);
assert.equal(newerPractice.masar_practice_v1.result.marker,"remote-latest","newer practical-lab result is not overwritten by an older run");
assert.equal(newerPractice.masar_practice_v1.frozen.name,"v2","newer frozen practical-lab rules win a stale device conflict");
assert.deepEqual(Array.from(newerPractice.masar_practice_v1.rubric),[8,9],"newer rubric evaluation wins a stale device conflict");
assert.equal(newerPractice.masar_practice_v1.analyses.length,2,"practical-lab analysis logs from both devices are retained");

class LiveStorage { constructor(){this.data={}} get length(){return Object.keys(this.data).length} key(i){return Object.keys(this.data)[i]??null} getItem(k){return Object.prototype.hasOwnProperty.call(this.data,k)?this.data[k]:null} setItem(k,v){this.data[k]=String(v)} removeItem(k){delete this.data[k]} }
const timers=[];
const nativeSetTimeout=setTimeout,nativeClearTimeout=clearTimeout;
function mockSetTimeout(fn,delay=0){if(delay<=100)return nativeSetTimeout(fn,delay);timers.push({fn,delay,cancelled:false});return timers.length}
function mockClearTimeout(handle){if(typeof handle==="object")nativeClearTimeout(handle);else if(Number.isInteger(handle)&&timers[handle-1])timers[handle-1].cancelled=true}
const liveStorage=new LiveStorage();
liveStorage.setItem("masar_local_owner","learner-a");
liveStorage.setItem("masar_v2",JSON.stringify({completed:[1],scores:{1:5},finalScore:null,journal:[]}));
let remoteProgress={masar_v2:{completed:[0],scores:{0:4},finalScore:8,journal:[]}};
let remoteUpdatedAt="2026-11-15T10:00:00.000Z",raceNextWrite=false,deferNextRead=false,resolveRead,writeCount=0,activeToken="learner-token",activeUser="learner-a";
const observedTokens=[];
const appNode={firstChild:null,insertBefore(node){this.status=node}};
const liveWindow={localStorage:liveStorage,MASAR_CONFIG:{supabaseUrl:"https://example.supabase.co",supabaseAnonKey:"public-anon-key"}};
const liveDocument={getElementById(id){return id==="academyApp"?appNode:null},createElement(){return {style:{},setAttribute(){},textContent:""}}};
async function fakeFetch(url,options={}){
 observedTokens.push(options.headers?.get?.("Authorization")||"");
 if(url.endsWith("/auth/v1/user"))return {ok:true,json:async()=>({id:activeUser})};
 if(url.includes("/rest/v1/user_progress")&&(!options.method||options.method==="GET")){if(deferNextRead){deferNextRead=false;return new Promise(resolve=>{resolveRead=()=>resolve({ok:true,json:async()=>[{progress:remoteProgress,updated_at:remoteUpdatedAt}]})})}return {ok:true,json:async()=>[{progress:remoteProgress,updated_at:remoteUpdatedAt}]}}
 if(url.includes("/rest/v1/user_progress")&&options.method==="PATCH"){
  const target=(new URL(url).searchParams.get("updated_at")||"").replace(/^eq\./,"");
  if(raceNextWrite){raceNextWrite=false;remoteProgress={...remoteProgress,masar_marketlab_v1:{...(remoteProgress.masar_marketlab_v1||{}),fromOtherDevice:{answer:1,correct:true}}};remoteUpdatedAt="2026-11-15T10:00:01.000Z";return {ok:true,json:async()=>[]}}
  if(target!==remoteUpdatedAt)return {ok:true,json:async()=>[]};
  writeCount++;remoteProgress=JSON.parse(options.body).progress;remoteUpdatedAt="2026-11-15T10:00:02.000Z";return {ok:true,json:async()=>[{progress:remoteProgress,updated_at:remoteUpdatedAt}]};
 }
 throw new Error("Unexpected URL in progress sync QA: "+url);
}
liveWindow.MASARAuthSession={async getValidSession(){return {access_token:activeToken}},async authorizedFetch(url,options={}){const headers=new Headers(options.headers||{});headers.set("Authorization","Bearer "+activeToken);return fakeFetch(url,{...options,headers})}};
vm.runInNewContext(source,{window:liveWindow,Storage:LiveStorage,localStorage:liveStorage,document:liveDocument,fetch:fakeFetch,Headers,TextEncoder,JSON,Date,Set,Object,Array,String,Number,Math,RegExp,setTimeout:mockSetTimeout,clearTimeout:mockClearTimeout});
await liveWindow.MASARProgressSync.initialize("learner-token");
assert.deepEqual(Array.from(remoteProgress.masar_v2.completed).sort(),[0,1],"initialization uploads a merged local/cloud learning history");
assert.equal(remoteProgress.masar_v2.scores[0],4,"cloud quiz score survives initial sync");
assert.equal(remoteProgress.masar_v2.scores[1],5,"local quiz score is uploaded");
liveStorage.setItem("masar_ex_0","ملاحظة تدريبية");
liveStorage.setItem("masar_ex_updated_0",String(Date.now()));
raceNextWrite=true;
await liveWindow.MASARProgressSync.flush();
assert.equal(remoteProgress.masar_ex_0,"ملاحظة تدريبية","later local changes are uploaded through the Storage hook");
assert.equal(remoteProgress.masar_marketlab_v1.fromOtherDevice.correct,true,"a concurrent cloud update survives a stale conditional write and retry");
assert.ok(Number.isFinite(Number(remoteProgress.masar_ex_updated_0)),"exercise-note update timestamps are synced with their notes");
assert.equal(liveWindow.MASARProgressSync.getStatus().ready,true,"cloud sync is marked ready after authentication");
activeToken="learner-token-rotated";
liveStorage.setItem("masar_ex_0","تغيير بعد تدوير الرمز");
await liveWindow.MASARProgressSync.flush();
assert.ok(observedTokens.includes("Bearer learner-token-rotated"),"progress reads and writes use the current shared access token after rotation");
deferNextRead=true;
const writesBeforeSwitch=writeCount;
const oldAccountFlush=liveWindow.MASARProgressSync.flush();
while(!resolveRead)await new Promise(resolve=>setImmediate(resolve));
activeUser="learner-b";
remoteProgress={};remoteUpdatedAt=null;
await liveWindow.MASARProgressSync.initialize();
resolveRead();
assert.equal(await oldAccountFlush,false,"an in-flight progress read for the prior account is discarded after switching context");
assert.equal(writeCount,writesBeforeSwitch,"an old progress request cannot write after account context changes");
assert.equal(liveWindow.MASARProgressSync.getStatus().ready,true,"switching accounts initializes a separate progress context instead of blocking the second account");
assert.equal(await liveWindow.MASARProgressSync.flush(),false,"the second account remains isolated when it has no local or cloud progress");

const protectedStorage=new LiveStorage();
protectedStorage.setItem("masar_local_owner","learner-a");
protectedStorage.setItem("masar_v2",JSON.stringify({completed:[2],scores:{2:5},finalScore:null,journal:[]}));
const protectedWindow={localStorage:protectedStorage,MASAR_CONFIG:{supabaseUrl:"https://example.supabase.co",supabaseAnonKey:"public-anon-key"}};
const protectedDoc={getElementById(){return null},createElement(){return {style:{},setAttribute(){}}}};
const ownerFetch=async url=>url.endsWith("/auth/v1/user")?{ok:true,json:async()=>({id:"learner-b"})}:url.includes("/rest/v1/user_progress")?{ok:true,json:async()=>[]}:Promise.reject(new Error("unexpected request"));
protectedWindow.MASARAuthSession={async getValidSession(){return {access_token:"learner-b-token"}},async authorizedFetch(url,options={}){return ownerFetch(url,{...options,headers:new Headers({Authorization:"Bearer learner-b-token"})})}};
vm.runInNewContext(source,{window:protectedWindow,Storage:LiveStorage,localStorage:protectedStorage,document:protectedDoc,fetch:ownerFetch,Headers,TextEncoder,JSON,Date,Set,Object,Array,String,Number,Math,RegExp,setTimeout(){return 1},clearTimeout(){} });
await protectedWindow.MASARProgressSync.initialize();
assert.equal(protectedWindow.MASARProgressSync.getStatus().ready,true,"a second account can initialize while another account owns legacy local progress");
assert.equal(protectedStorage.getItem("masar_v2"),null,"the second account cannot read the first account's legacy progress");
assert.equal(protectedStorage.getItem("masar_local_owner"),"learner-a","the original legacy owner marker is preserved");
assert.ok(protectedStorage.data.masar_v2,"legacy progress remains preserved for its original owner");


const recoveryStorage=new LiveStorage();
recoveryStorage.setItem("masar_local_owner","learner-recover");
recoveryStorage.setItem("masar_v2",JSON.stringify({completed:[0],scores:{0:4},finalScore:null,journal:[]}));
const onlineHandlers={};let connected=false,recoveredRow=null;
const recoveryWindow={localStorage:recoveryStorage,MASAR_CONFIG:{supabaseUrl:"https://example.supabase.co",supabaseAnonKey:"public-anon-key"},addEventListener(name,handler){onlineHandlers[name]=handler}};
async function recoveryFetch(url,options={}){
 if(!connected)throw new TypeError("offline");
 if(url.endsWith("/auth/v1/user"))return {ok:true,json:async()=>({id:"learner-recover"})};
 if(url.includes("/rest/v1/user_progress")&&(!options.method||options.method==="GET"))return {ok:true,json:async()=>recoveredRow?[recoveredRow]:[]};
 if(url.includes("/rest/v1/user_progress")&&options.method==="POST"){recoveredRow={progress:JSON.parse(options.body).progress,updated_at:"2026-11-16T10:00:00.000Z"};return {ok:true,json:async()=>[recoveredRow]}}
 if(url.includes("/rest/v1/user_progress")&&options.method==="PATCH"){recoveredRow={progress:JSON.parse(options.body).progress,updated_at:"2026-11-16T10:00:01.000Z"};return {ok:true,json:async()=>[recoveredRow]}}
 throw new Error("Unexpected URL in recovery QA: "+url);
}
recoveryWindow.MASARAuthSession={async getValidSession(){return {access_token:"recovery-token"}},async authorizedFetch(url,options={}){return recoveryFetch(url,{...options,headers:new Headers({Authorization:"Bearer recovery-token"})})}};
vm.runInNewContext(source,{window:recoveryWindow,Storage:LiveStorage,localStorage:recoveryStorage,document:protectedDoc,fetch:recoveryFetch,Headers,TextEncoder,JSON,Date,Set,Object,Array,String,Number,Math,RegExp,setTimeout:mockSetTimeout,clearTimeout:mockClearTimeout});
await assert.rejects(recoveryWindow.MASARProgressSync.initialize(),error=>error.retryable===true,"offline initialization is reported as a retryable failure");
assert.deepEqual(JSON.parse(recoveryStorage.getItem("masar_v2")).completed,[0],"offline initialization preserves local learner progress");
connected=true;
await onlineHandlers.online();
assert.equal(recoveryWindow.MASARProgressSync.getStatus().ready,true,"the online event reinitializes and recovers cloud sync");
assert.deepEqual(Array.from(recoveredRow.progress.masar_v2.completed),[0],"local progress is uploaded after connectivity returns");
connected=false;
recoveryStorage.setItem("masar_ex_0","ملاحظة أثناء انقطاع الشبكة");
for(let attempt=0;attempt<7;attempt++)assert.equal(await recoveryWindow.MASARProgressSync.flush(),false,"temporary failures leave the progress write pending");
const pendingRetries=timers.filter(timer=>!timer.cancelled&&timer.delay>900);
assert.equal(pendingRetries.length,1,"automatic retry scheduling remains bounded rather than creating a retry loop");
assert.equal(pendingRetries[0].delay,16000,"retry delay backs off and stops after the configured maximum attempts");
assert.equal(recoveryStorage.getItem("masar_ex_0"),"ملاحظة أثناء انقطاع الشبكة","offline write failure retains the local note");
connected=true;
await onlineHandlers.online();
assert.equal(recoveredRow.progress.masar_ex_0,"ملاحظة أثناء انقطاع الشبكة","connectivity restoration immediately retries the pending learner data");
assert.equal(recoveryWindow.MASARProgressSync.getStatus().lastError,"","successful reconnect clears the visible sync error state");

console.log("MASAR progress sync QA passed: merge rules, account isolation and reinitialization, current-session requests, conditional multi-device writes, offline retention and reconnect recovery, course scores, journals, notes, labs, and strategy replay.");
