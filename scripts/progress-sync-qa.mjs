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
assert.equal(merged.masar_strategy_replay_v1.s0.score,90,"newer strategy replay attempt wins");
assert.equal(merged.masar_ex_0,"ملاحظة سابقة","non-empty saved exercise is not overwritten by empty state");
assert.equal(merged.masar_ex_1,"ملاحظة جديدة","new exercise note is retained");

const timers=[];
const liveStorage=new Storage();
liveStorage.setItem("masar_local_owner","learner-a");
liveStorage.setItem("masar_v2",JSON.stringify({completed:[1],scores:{1:5},finalScore:null,journal:[]}));
let remoteProgress={masar_v2:{completed:[0],scores:{0:4},finalScore:8,journal:[]}};
const appNode={firstChild:null,insertBefore(node){this.status=node}};
const liveWindow={localStorage:liveStorage,MASAR_CONFIG:{supabaseUrl:"https://example.supabase.co",supabaseAnonKey:"public-anon-key"}};
const liveDocument={getElementById(id){return id==="academyApp"?appNode:null},createElement(){return {style:{},setAttribute(){},textContent:""}}};
async function fakeFetch(url,options={}){
 if(url.endsWith("/auth/v1/user"))return {ok:true,json:async()=>({id:"learner-a"})};
 if(url.includes("/rest/v1/user_progress")&&(!options.method||options.method==="GET"))return {ok:true,json:async()=>[{progress:remoteProgress}]};
 if(url.includes("/rest/v1/user_progress")&&options.method==="POST"){remoteProgress=JSON.parse(options.body).progress;return {ok:true,text:async()=>""}};
 throw new Error("Unexpected URL in progress sync QA: "+url);
}
vm.runInNewContext(source,{window:liveWindow,Storage,localStorage:liveStorage,document:liveDocument,fetch:fakeFetch,TextEncoder,JSON,Date,Set,Object,Array,String,Number,Math,RegExp,setTimeout(fn){timers.push(fn);return timers.length},clearTimeout(){}});
await liveWindow.MASARProgressSync.initialize("learner-token");
assert.deepEqual(Array.from(remoteProgress.masar_v2.completed).sort(),[0,1],"initialization uploads a merged local/cloud learning history");
assert.equal(remoteProgress.masar_v2.scores[0],4,"cloud quiz score survives initial sync");
assert.equal(remoteProgress.masar_v2.scores[1],5,"local quiz score is uploaded");
liveStorage.setItem("masar_ex_0","ملاحظة تدريبية");
await liveWindow.MASARProgressSync.flush();
assert.equal(remoteProgress.masar_ex_0,"ملاحظة تدريبية","later local changes are uploaded through the Storage hook");
assert.equal(liveWindow.MASARProgressSync.getStatus().ready,true,"cloud sync is marked ready after authentication");

console.log("MASAR progress sync QA passed: account-scoped key allowlist, cross-device merge, course scores, journal, paper trades, strategy replay, and exercise notes.");
