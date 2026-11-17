(()=> {
"use strict";
const KEYS=new Set(["masar_v2","masar_paper_v1","masar_marketlab_v1","masar_strategy_replay_v1","masar_practice_v1"]);
const EXERCISE=/^masar_ex_[0-9]$/;
const EXERCISE_UPDATED=/^masar_ex_updated_[0-9]$/;
const storage=window.localStorage;
const nativeSet=Storage.prototype.setItem;
const nativeGet=Storage.prototype.getItem;
const nativeKey=Storage.prototype.key;
const nativeRemove=Storage.prototype.removeItem;
let storagePrefix="",storageScoped=false;
let userId="",base="",ready=false,busy=false,dirty=false,timer=null,statusNode=null,lastError="",generation=0,retryAttempt=0;
const MAX_RETRIES=5,MAX_CONFLICT_RETRIES=5;
const isKey=k=>KEYS.has(k)||EXERCISE.test(k)||EXERCISE_UPDATED.test(k);
function activateUserStorage(id){
 const prefix="masar_user_"+String(id)+"__";
 const legacyOwner=nativeGet.call(storage,"masar_local_owner");
 if(legacyOwner===String(id)){
  const legacy={},current={},legacyKeys=[];
  for(let i=0;i<storage.length;i++){
   const key=nativeKey.call(storage,i);
   if(isKey(key)){const value=nativeGet.call(storage,key);if(value!==null){const parsed=parseRaw(key,value);if(parsed!==undefined){legacy[key]=parsed;legacyKeys.push(key)}}}
   else if(typeof key==="string"&&key.startsWith(prefix)){const logical=key.slice(prefix.length);if(isKey(logical)){const value=nativeGet.call(storage,key);if(value!==null){const parsed=parseRaw(logical,value);if(parsed!==undefined)current[logical]=parsed}}}
  }
  if(legacyKeys.length){
   const merged=mergeProgress(current,legacy);
   for(const key of Object.keys(merged)){if(isKey(key))nativeSet.call(storage,prefix+key,rawValue(key,merged[key]))}
   for(const key of legacyKeys)nativeRemove.call(storage,key);
  }
 }
 storagePrefix=prefix;
 if(storageScoped)return;
 const proto=Storage.prototype;
 proto.getItem=function(key){const name=String(key);return this===storage&&storagePrefix&&isKey(name)?nativeGet.call(this,storagePrefix+name):nativeGet.call(this,key)};
 proto.setItem=function(key,value){const name=String(key),scoped=this===storage&&storagePrefix&&isKey(name);const result=nativeSet.call(this,scoped?storagePrefix+name:key,value);if(scoped&&ready)schedule(900,true);return result};
 proto.removeItem=function(key){const name=String(key);return this===storage&&storagePrefix&&isKey(name)?nativeRemove.call(this,storagePrefix+name):nativeRemove.call(this,key)};
 proto.key=function(index){const key=nativeKey.call(this,index);if(this!==storage||!storagePrefix||key===null)return key;if(key.startsWith(storagePrefix))return key.slice(storagePrefix.length);return isKey(key)?null:key};
 storageScoped=true;
}
const parseRaw=(key,raw)=>{if(raw===null)return undefined;if(EXERCISE.test(key))return raw;try{return JSON.parse(raw)}catch{return undefined}};
const rawValue=(key,value)=>EXERCISE.test(key)?String(value??""):JSON.stringify(value);
function localSnapshot(){const out={};for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!isKey(key))continue;const value=parseRaw(key,storage.getItem(key));if(value!==undefined)out[key]=value}return out}
function uniqueArray(a,b){const out=[],seen=new Set();for(const item of [...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])]){const k=JSON.stringify(item);if(!seen.has(k)){seen.add(k);out.push(item)}}return out}
function mergeObject(remote,local){if(Array.isArray(remote)||Array.isArray(local))return uniqueArray(remote,local);if(remote&&typeof remote==="object"&&local&&typeof local==="object"){const out={...remote};for(const k of Object.keys(local))out[k]=k in out?mergeObject(out[k],local[k]):local[k];return out}return local===undefined?remote:local}
function mergeById(remote,local){const out=[],positions=new Map(),seen=new Set();for(const item of [...(Array.isArray(remote)?remote:[]),...(Array.isArray(local)?local:[])]){const id=item&&item.id;if(id===undefined||id===null){const signature=JSON.stringify(item);if(!seen.has(signature)){seen.add(signature);out.push(item)}continue}if(positions.has(id)){out[positions.get(id)]=item}else{positions.set(id,out.length);out.push(item)}}return out.slice(-500)}
function mergePaperTrades(remote,local){const out=mergeById(remote,local),remoteById=new Map((Array.isArray(remote)?remote:[]).filter(item=>item?.id!==undefined).map(item=>[item.id,item]));for(let i=0;i<out.length;i++){const previous=remoteById.get(out[i]?.id);if(previous?.status==="closed"&&out[i]?.status==="open")out[i]=previous}return out}
function mergeReplay(remote,local){const out={...(remote&&typeof remote==="object"?remote:{})};for(const [key,value] of Object.entries(local&&typeof local==="object"?local:{})){const old=out[key];if(!old||Date.parse(value?.at||0)>=Date.parse(old?.at||0))out[key]=value}return out}
function mergeMarketLab(remote,local){const out=mergeObject(remote,local),localCases=local&&typeof local==="object"?local:{};for(const [key,value] of Object.entries(remote&&typeof remote==="object"?remote:{})){const current=localCases[key];if(!current)continue;if(value?.correct===true&&current.correct!==true){out[key]=value;continue}if(current.correct===true)continue;const remoteAt=Date.parse(value?.at||""),localAt=Date.parse(current?.at||"");if(Number.isFinite(remoteAt)&&Number.isFinite(localAt)&&remoteAt>localAt)out[key]=value;else if(Number.isFinite(remoteAt)&&!Number.isFinite(localAt))out[key]=value}return out}
function newest(remoteValue,localValue,remoteStamp,localStamp){if(remoteValue===undefined)return {value:localValue,remote:false};if(localValue===undefined)return {value:remoteValue,remote:true};const r=Date.parse(remoteStamp||""),l=Date.parse(localStamp||"");if(Number.isFinite(r)&&!Number.isFinite(l))return {value:remoteValue,remote:true};if(Number.isFinite(r)&&Number.isFinite(l)&&r>l)return {value:remoteValue,remote:true};return {value:localValue,remote:false}}
function mergePractice(remote,local){const out=mergeObject(remote,local),r=remote&&typeof remote==="object"?remote:{},l=local&&typeof local==="object"?local:{};if(r.result!==undefined||l.result!==undefined)out.result=newest(r.result,l.result,r.result?.meta?.createdAt,l.result?.meta?.createdAt).value;if(r.frozen!==undefined||l.frozen!==undefined)out.frozen=newest(r.frozen,l.frozen,r.frozen?.at,l.frozen?.at).value;if(r.rubric!==undefined||l.rubric!==undefined){const picked=newest(r.rubric,l.rubric,r.rubricUpdatedAt,l.rubricUpdatedAt);out.rubric=picked.value;out.rubricUpdatedAt=picked.remote?r.rubricUpdatedAt:l.rubricUpdatedAt}return out}
function mergeProgress(remote,local){
 const out={...(remote&&typeof remote==="object"?remote:{})};
 for(const [key,value] of Object.entries(local&&typeof local==="object"?local:{})){
  if(key==="masar_v2"){
   const r=out[key]&&typeof out[key]==="object"?out[key]:{};
   const l=value&&typeof value==="object"?value:{};
   const scores={...(r.scores||{}),...(l.scores||{})};
   for(let i=0;i<10;i++){const a=Number(r.scores?.[i]),b=Number(l.scores?.[i]);if(Number.isFinite(a)&&Number.isFinite(b))scores[i]=Math.max(a,b);else if(Number.isFinite(a))scores[i]=a;else if(Number.isFinite(b))scores[i]=b}
   const rf=Number(r.finalScore),lf=Number(l.finalScore),finalScore=Number.isFinite(rf)&&Number.isFinite(lf)?Math.max(rf,lf):Number.isFinite(rf)?rf:Number.isFinite(lf)?lf:null;
   out[key]={...r,...l,completed:[...new Set([...(Array.isArray(r.completed)?r.completed:[]),...(Array.isArray(l.completed)?l.completed:[])])],scores,finalScore,journal:mergeById(r.journal,l.journal)};
  }else if(key==="masar_paper_v1")out[key]=mergePaperTrades(out[key],value);
  else if(key==="masar_strategy_replay_v1")out[key]=mergeReplay(out[key],value);
  else if(key==="masar_marketlab_v1")out[key]=mergeMarketLab(out[key],value);
  else if(key==="masar_practice_v1")out[key]=mergePractice(out[key],value);
  else if(EXERCISE.test(key))out[key]=typeof value==="string"&&value.length?value:(out[key]??value);
  else out[key]=value;
 }
 for(let index=0;index<10;index++){
  const noteKey="masar_ex_"+index,updatedKey="masar_ex_updated_"+index,r=remote?.[noteKey],l=local?.[noteKey];
  if(typeof r!=="string"||!r.length){if(typeof l==="string"&&l.length)out[noteKey]=l;continue}
  if(typeof l!=="string"||!l.length){out[noteKey]=r;continue}
  const remoteAt=Number(remote?.[updatedKey]),localAt=Number(local?.[updatedKey]);
  if(Number.isFinite(remoteAt)&&Number.isFinite(localAt)){if(remoteAt>localAt){out[noteKey]=r;out[updatedKey]=remoteAt}}
  else if(Number.isFinite(remoteAt)&&!Number.isFinite(localAt)){out[noteKey]=r;out[updatedKey]=remoteAt}
 }
 return out;
}
function writeLocal(progress){for(const key of Object.keys(progress||{})){if(!isKey(key))continue;try{nativeSet.call(storage,storagePrefix+key,rawValue(key,progress[key]))}catch(e){setStatus("تعذر استعادة بعض بيانات التقدم محلياً؛ تحقق من مساحة المتصفح.",true)}}}
function setStatus(message,bad=false){if(!statusNode){const app=document.getElementById("academyApp");if(app){statusNode=document.createElement("div");statusNode.id="masarCloudSyncStatus";statusNode.setAttribute("role","status");statusNode.style.cssText="max-width:1100px;margin:0 auto 12px;padding:8px 12px;border:1px solid #38516b;border-radius:9px;background:#142438;color:#dbe6f2;font:13px/1.7 system-ui,Tahoma,sans-serif";app.insertBefore(statusNode,app.firstChild)}}if(statusNode){statusNode.textContent=message;statusNode.style.borderColor=bad?"#a65c5c":"#38516b";statusNode.style.color=bad?"#ffd2d2":"#dbe6f2"}}
function httpError(action,response,detail=""){const error=new Error("تعذر "+action+" تقدم المتعلم في قاعدة البيانات ("+response.status+"). "+detail.slice(0,160));error.retryable=response.status===429||response.status>=500;return error}
async function sessionFetch(url,options={}){try{return await window.MASARAuthSession.authorizedFetch(url,{...options,headers:{apikey:window.MASAR_CONFIG.supabaseAnonKey,...options.headers}})}catch(error){if(error.code==="MASAR_AUTH_TEMPORARY"||error.name==="TypeError")error.retryable=true;throw error}}
async function authUser(){const r=await sessionFetch(base+"/auth/v1/user");const data=await r.json().catch(()=>({}));if(!r.ok||!data.id)throw httpError("تحديد",r);return data}
async function readRemote(){const url=base+"/rest/v1/user_progress?select=progress,updated_at&user_id=eq."+encodeURIComponent(userId)+"&limit=1";const r=await sessionFetch(url);if(!r.ok)throw httpError("قراءة",r);const rows=await r.json();const row=Array.isArray(rows)?rows[0]:null;return {progress:row&&row.progress&&typeof row.progress==="object"?row.progress:{},updatedAt:row?.updated_at||null,exists:!!row}}
async function writeRemote(progress,snapshot){const body=JSON.stringify({user_id:userId,progress});if(new TextEncoder().encode(body).length>950000)throw new Error("حجم بيانات التقدم تجاوز الحد الآمن للمزامنة.");const headers={"Content-Type":"application/json","Prefer":"return=representation"};let url=base+"/rest/v1/user_progress",method="POST";if(snapshot.exists){method="PATCH";url+="?user_id=eq."+encodeURIComponent(userId)+"&updated_at=eq."+encodeURIComponent(snapshot.updatedAt)}const r=await sessionFetch(url,{method,headers,body});if(r.status===409&&!snapshot.exists)return false;if(!r.ok)throw httpError("حفظ",r,await r.text().catch(()=>""));const rows=await r.json().catch(()=>[]);return !snapshot.exists||Array.isArray(rows)&&rows.length>0}
async function flush(){
 if(!ready)return false;if(busy){dirty=true;return false}busy=true;dirty=false;
 const run=generation,owner=userId;
 try{const currentUser=await authUser();if(run!==generation)return false;if(currentUser.id!==owner)return false;let saved=false;for(let attempt=0;attempt<MAX_CONFLICT_RETRIES;attempt++){const snapshot=await readRemote();if(run!==generation)return false;const merged=mergeProgress(snapshot.progress,localSnapshot());writeLocal(merged);if(!Object.keys(merged).length||await writeRemote(merged,snapshot)){saved=true;break}if(attempt+1<MAX_CONFLICT_RETRIES)await new Promise(resolve=>setTimeout(resolve,Math.min(25*(attempt+1),100)))}if(!saved){const error=new Error("تعارضت تحديثات التقدم عدة مرات؛ بقيت بياناتك على هذا الجهاز وستُعاد المحاولة.");error.retryable=true;throw error}lastError="";retryAttempt=0;setStatus("تمت مزامنة تقدمك مع حسابك. يمكنك متابعة التعلم من جهاز آخر.");return true}
 catch(e){if(run!==generation)return false;lastError=e.message||"تعذر الاتصال بالحفظ السحابي.";setStatus(lastError+" بيانات هذا الجهاز ما زالت محفوظة محلياً.",true);if(e.retryable&&retryAttempt<MAX_RETRIES){const delay=Math.min(1000*2**retryAttempt,30000);retryAttempt++;schedule(delay,false,false)}return false}
 finally{if(run===generation){busy=false;if(dirty)schedule(500,false)}}
}
function schedule(delay=900,resetRetries=true,markDirty=true){if(!ready)return;if(resetRetries)retryAttempt=0;if(markDirty)dirty=true;if(timer!==null)clearTimeout(timer);timer=setTimeout(()=>{timer=null;flush()},delay)}
async function initialize(){
 const run=++generation;if(timer!==null)clearTimeout(timer);timer=null;ready=false;busy=false;dirty=false;retryAttempt=0;userId="";base=String(window.MASAR_CONFIG?.supabaseUrl||"").replace(/\/$/,"");
 if(!base||!window.MASAR_CONFIG?.supabaseAnonKey||!window.MASARAuthSession)throw new Error("إعدادات حفظ التقدم أو الجلسة غير مكتملة.");
 setStatus("جارٍ تحميل تقدمك المحفوظ من حسابك…");
 const user=await authUser();if(run!==generation)return {ok:false,superseded:true};
 activateUserStorage(user.id);
 userId=user.id;
 const remote=await readRemote();if(run!==generation)return {ok:false,superseded:true};const merged=mergeProgress(remote.progress,localSnapshot());
 writeLocal(merged);ready=true;
 setStatus(Object.keys(merged).length?"تم تحميل تقدمك المحفوظ. جارٍ تأكيد المزامنة…":"حفظ التقدم السحابي جاهز لهذا الحساب.");
 if(Object.keys(merged).length)await flush();
 return {ok:true,userId};
}
if(typeof window.addEventListener==="function")window.addEventListener("online",()=>{retryAttempt=0;if(ready){if(timer!==null)clearTimeout(timer);timer=null;return flush()}if(base&&window.MASARAuthSession)return initialize().catch(error=>{lastError=error.message||"تعذر الاتصال بالحفظ السحابي.";setStatus(lastError+" بيانات هذا الجهاز ما زالت محفوظة محلياً.",true)})});
window.MASARProgressSync={initialize,flush,getStatus:()=>({ready,userId,lastError}),showError:message=>setStatus((message||"تعذر تفعيل الحفظ السحابي.")+" بيانات هذا الجهاز ما زالت محفوظة محلياً.",true)};
if(window.__MASAR_PROGRESS_SYNC_TEST__)window.__MASAR_PROGRESS_SYNC_TEST__={mergeProgress,isKey,mergeObject,mergeById,mergePaperTrades,mergeMarketLab,mergePractice};
})();
