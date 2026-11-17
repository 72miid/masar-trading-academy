import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source=readFileSync(new URL("../assets/masar-progress-sync.js",import.meta.url),"utf8");

function createTab(userId,backing){
  class TabStorage{
    get length(){return Object.keys(backing).length}
    key(i){return Object.keys(backing)[i]??null}
    getItem(key){return Object.prototype.hasOwnProperty.call(backing,key)?backing[key]:null}
    setItem(key,value){backing[key]=String(value)}
    removeItem(key){delete backing[key]}
  }
  const localStorage=new TabStorage(),status={};
  const document={getElementById(){return null},createElement(){return {style:{},setAttribute(){}}}};
  const window={localStorage,MASAR_CONFIG:{supabaseUrl:"https://example.supabase.co",supabaseAnonKey:"public-anon-key"}};
  let remote={progress:{},updated_at:null},writes=0;
  async function authorizedFetch(url,options={}){
    if(url.endsWith("/auth/v1/user"))return {ok:true,json:async()=>({id:userId})};
    if(url.includes("/rest/v1/user_progress")&&(!options.method||options.method==="GET"))return {ok:true,json:async()=>remote.updated_at?[remote]:[]};
    if(url.includes("/rest/v1/user_progress")&&options.method==="POST"){writes++;remote={progress:JSON.parse(options.body).progress,updated_at:"2026-11-17T10:00:00.000Z"};return {ok:true,json:async()=>[remote]}}
    if(url.includes("/rest/v1/user_progress")&&options.method==="PATCH"){writes++;remote={progress:JSON.parse(options.body).progress,updated_at:"2026-11-17T10:00:01.000Z"};return {ok:true,json:async()=>[remote]}}
    throw new Error("Unexpected request: "+url);
  }
  window.MASARAuthSession={authorizedFetch};
  vm.runInNewContext(source,{window,Storage:TabStorage,document,Headers,TextEncoder,JSON,Date,Set,Object,Array,String,Number,Math,RegExp,setTimeout,clearTimeout});
  return {window,localStorage,backing,get remote(){return remote},get writes(){return writes}};
}

const backing={masar_local_owner:"learner-a",masar_v2:JSON.stringify({completed:[1],scores:{1:5},finalScore:null,journal:[]})};
const tabA=createTab("learner-a",backing);
await tabA.window.MASARProgressSync.initialize();
assert.deepEqual(Array.from(JSON.parse(tabA.localStorage.getItem("masar_v2")).completed),[1],"legacy progress is migrated to its original owner");
assert.ok(Object.keys(backing).some(key=>key.startsWith("masar_user_learner-a__masar_v2")),"legacy data is stored under the original user's namespace");
assert.equal(backing.masar_v2,undefined,"legacy shared progress key is removed only after migration");
assert.deepEqual(Array.from(tabA.remote.progress.masar_v2.completed),[1],"original user's legacy progress is uploaded to that user's cloud record");

const tabB=createTab("learner-b",backing);
await tabB.window.MASARProgressSync.initialize();
assert.equal(tabB.localStorage.getItem("masar_v2"),null,"a second account cannot read the first account's local progress");
assert.equal(tabB.writes,0,"an empty second account does not upload another user's data");
tabB.localStorage.setItem("masar_v2",JSON.stringify({completed:[2],scores:{2:4},finalScore:null,journal:[]}));
await tabB.window.MASARProgressSync.flush();
assert.deepEqual(Array.from(JSON.parse(tabB.localStorage.getItem("masar_v2")).completed),[2],"second account reads its own isolated progress");
assert.ok(Object.keys(backing).some(key=>key.startsWith("masar_user_learner-b__masar_v2")),"second account writes to its own namespace");
assert.deepEqual(Array.from(JSON.parse(tabA.localStorage.getItem("masar_v2")).completed),[1],"first account remains unchanged after second account writes");

const tabAAgain=createTab("learner-a",backing);
await tabAAgain.window.MASARProgressSync.initialize();
assert.deepEqual(Array.from(JSON.parse(tabAAgain.localStorage.getItem("masar_v2")).completed),[1],"returning to first account restores its own local progress");

console.log("MASAR multi-account storage QA passed: legacy ownership migration, per-user namespaces, same-browser account isolation, independent writes, and account return.");
