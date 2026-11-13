(()=> {
"use strict";
const KEYS=new Set(["masar_v2","masar_paper_v1","masar_marketlab_v1","masar_strategy_replay_v1","masar_practice_v1"]);
const EXERCISE=/^masar_ex_[0-9]$/;
const storage=window.localStorage;
const nativeSet=Storage.prototype.setItem;
const nativeRemove=Storage.prototype.removeItem;
let token="",userId="",base="",ready=false,busy=false,dirty=false,timer=null,statusNode=null,lastError="";
const isKey=k=>KEYS.has(k)||EXERCISE.test(k);
const parseRaw=(key,raw)=>{if(raw===null)return undefined;if(EXERCISE.test(key))return raw;try{return JSON.parse(raw)}catch{return undefined}};
const rawValue=(key,value)=>EXERCISE.test(key)?String(value??""):JSON.stringify(value);
function localSnapshot(){const out={};for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!isKey(key))continue;const value=parseRaw(key,storage.getItem(key));if(value!==undefined)out[key]=value}return out}
function uniqueArray(a,b){const out=[],seen=new Set();for(const item of [...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])]){const k=JSON.stringify(item);if(!seen.has(k)){seen.add(k);out.push(item)}}return out}
function mergeObject(remote,local){if(Array.isArray(remote)||Array.isArray(local))return uniqueArray(remote,local);if(remote&&typeof remote==="object"&&local&&typeof local==="object"){const out={...remote};for(const k of Object.keys(local))out[k]=k in out?mergeObject(out[k],local[k]):local[k];return out}return local===undefined?remote:local}
function mergeById(remote,local){const out=[],positions=new Map();for(const item of [...(Array.isArray(remote)?remote:[]),...(Array.isArray(local)?local:[])]){const id=item&&item.id;if(id===undefined||id===null){out.push(item);continue}if(positions.has(id)){out[positions.get(id)]=item}else{positions.set(id,out.length);out.push(item)}}return out.slice(-500)}
function mergeReplay(remote,local){const out={...(remote&&typeof remote==="object"?remote:{})};for(const [key,value] of Object.entries(local&&typeof local==="object"?local:{})){const old=out[key];if(!old||Date.parse(value?.at||0)>=Date.parse(old?.at||0))out[key]=value}return out}
function mergeProgress(remote,local){
 const out={...(remote&&typeof remote==="object"?remote:{})};
 for(const [key,value] of Object.entries(local&&typeof local==="object"?local:{})){
  if(key==="masar_v2"){
   const r=out[key]&&typeof out[key]==="object"?out[key]:{};
   const l=value&&typeof value==="object"?value:{};
   out[key]={...r,...l,completed:[...new Set([...(Array.isArray(r.completed)?r.completed:[]),...(Array.isArray(l.completed)?l.completed:[])])],scores:{...(r.scores||{}),...(l.scores||{})},journal:mergeById(r.journal,l.journal)};
   for(let i=0;i<10;i++){const a=Number(r.scores?.[i]),b=Number(l.scores?.[i]);if(Number.isFinite(a)&&Number.isFinite(b))out[key].scores[i]=Math.max(a,b)}
   if(Number.isFinite(r.finalScore)&&Number.isFinite(l.finalScore))out[key].finalScore=Math.max(r.finalScore,l.finalScore);
  }else if(key==="masar_paper_v1")out[key]=mergeById(out[key],value);
  else if(key==="masar_strategy_replay_v1")out[key]=mergeReplay(out[key],value);
  else if(key==="masar_marketlab_v1"||key==="masar_practice_v1")out[key]=mergeObject(out[key],value);
  else if(EXERCISE.test(key))out[key]=typeof value==="string"&&value.length?value:(out[key]??value);
  else out[key]=value;
 }
 return out;
}
function writeLocal(progress){for(const key of Object.keys(progress||{})){if(!isKey(key))continue;try{nativeSet.call(storage,key,rawValue(key,progress[key]))}catch(e){setStatus("تعذر استعادة بعض بيانات التقدم محلياً؛ تحقق من مساحة المتصفح.",true)}}}
function setStatus(message,bad=false){if(!statusNode){const app=document.getElementById("academyApp");if(app){statusNode=document.createElement("div");statusNode.id="masarCloudSyncStatus";statusNode.setAttribute("role","status");statusNode.style.cssText="max-width:1100px;margin:0 auto 12px;padding:8px 12px;border:1px solid #38516b;border-radius:9px;background:#142438;color:#dbe6f2;font:13px/1.7 system-ui,Tahoma,sans-serif";app.insertBefore(statusNode,app.firstChild)}}if(statusNode){statusNode.textContent=message;statusNode.style.borderColor=bad?"#a65c5c":"#38516b";statusNode.style.color=bad?"#ffd2d2":"#dbe6f2"}}
async function authUser(){const r=await fetch(base+"/auth/v1/user",{headers:{apikey:window.MASAR_CONFIG.supabaseAnonKey,Authorization:"Bearer "+token}});const data=await r.json().catch(()=>({}));if(!r.ok||!data.id)throw new Error("تعذر تحديد حساب المتعلم الحالي.");return data}
async function readRemote(){const url=base+"/rest/v1/user_progress?select=progress&user_id=eq."+encodeURIComponent(userId)+"&limit=1";const r=await fetch(url,{headers:{apikey:window.MASAR_CONFIG.supabaseAnonKey,Authorization:"Bearer "+token}});if(!r.ok)throw new Error("تعذر قراءة تقدم المتعلم من قاعدة البيانات ("+r.status+").");const rows=await r.json();return Array.isArray(rows)&&rows[0]&&rows[0].progress&&typeof rows[0].progress==="object"?rows[0].progress:{}}
async function writeRemote(progress){const body=JSON.stringify({user_id:userId,progress});if(new TextEncoder().encode(body).length>950000)throw new Error("حجم بيانات التقدم تجاوز الحد الآمن للمزامنة.");const url=base+"/rest/v1/user_progress?on_conflict=user_id";const r=await fetch(url,{method:"POST",headers:{apikey:window.MASAR_CONFIG.supabaseAnonKey,Authorization:"Bearer "+token,"Content-Type":"application/json","Prefer":"resolution=merge-duplicates,return=minimal"},body});if(!r.ok){const detail=await r.text().catch(()=> "");throw new Error("تعذر حفظ تقدم المتعلم في قاعدة البيانات ("+r.status+"). "+detail.slice(0,160))}}
async function flush(){
 if(!ready)return false;if(busy){dirty=true;return false}busy=true;dirty=false;
 try{const remote=await readRemote(),merged=mergeProgress(remote,localSnapshot());writeLocal(merged);if(Object.keys(merged).length)await writeRemote(merged);lastError="";setStatus("تمت مزامنة تقدمك مع حسابك. يمكنك متابعة التعلم من جهاز آخر.");return true}
 catch(e){lastError=e.message||"تعذر الاتصال بالحفظ السحابي.";setStatus(lastError+" بيانات هذا الجهاز ما زالت محفوظة محلياً.",true);return false}
 finally{busy=false;if(dirty)schedule(500)}
}
function schedule(delay=900){if(!ready)return;dirty=true;if(timer!==null)clearTimeout(timer);timer=setTimeout(()=>{timer=null;flush()},delay)}
async function initialize(accessToken){
 token=String(accessToken||"");base=String(window.MASAR_CONFIG?.supabaseUrl||"").replace(/\/$/,"");
 if(!token||!base||!window.MASAR_CONFIG?.supabaseAnonKey)throw new Error("إعدادات حفظ التقدم غير مكتملة.");
 setStatus("جارٍ تحميل تقدمك المحفوظ من حسابك…");
 const user=await authUser();userId=user.id;
 const owner=storage.getItem("masar_local_owner");
 if(owner&&owner!==userId)throw new Error("بيانات هذا الجهاز مرتبطة بحساب آخر. أوقفنا المزامنة لحماية خصوصية الحسابين.");
 if(!owner)nativeSet.call(storage,"masar_local_owner",userId);
 const remote=await readRemote(),local=localSnapshot(),merged=mergeProgress(remote,local);
 writeLocal(merged);ready=true;
 const proto=Storage.prototype;
 if(!proto.__masarProgressPatched){const wrapped=function(key,value){const result=nativeSet.call(this,key,value);if(this===storage&&isKey(String(key)))schedule();return result};Object.defineProperty(proto,"__masarProgressPatched",{value:true});proto.setItem=wrapped}
 setStatus(Object.keys(merged).length?"تم تحميل تقدمك المحفوظ. جارٍ تأكيد المزامنة…":"حفظ التقدم السحابي جاهز لهذا الحساب.");
 if(Object.keys(merged).length)await flush();
 return {ok:true,userId};
}
window.MASARProgressSync={initialize,flush,getStatus:()=>({ready,userId,lastError})};
if(window.__MASAR_PROGRESS_SYNC_TEST__)window.__MASAR_PROGRESS_SYNC_TEST__={mergeProgress,isKey,mergeObject,mergeById};
})();