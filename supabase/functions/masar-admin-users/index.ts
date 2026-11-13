import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"https://72miid.github.io","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return out({error:"method_not_allowed"},405);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!anon||!key)return out({error:"server_not_configured"},503);
 const auth=req.headers.get("Authorization")||"",token=auth.startsWith("Bearer ")?auth.slice(7):"";
 if(!token)return out({error:"unauthorized"},401);
 const callerClient=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false}});
 const {data:{user:caller},error:authError}=await callerClient.auth.getUser(token);
 if(authError||!caller)return out({error:"unauthorized"},401);
 const {data:admin,error:adminCheckError}=await callerClient.from("admin_users").select("user_id").eq("user_id",caller.id).maybeSingle();
 if(adminCheckError){console.error("admin_membership_check_failed",adminCheckError.code||"unknown");return out({error:"admin_check_failed",code:adminCheckError.code||"unknown"},500)}
 if(!admin)return out({error:"admin_only"},403);
 const db=createClient(url,key,{auth:{persistSession:false}});
 let body:any;try{body=await req.json()}catch{return out({error:"invalid_json"},400)}
 if(body.action==="whoami")return out({admin:true});
 if(body.action==="list_users"){
  const {data:rows,error}=await db.from("subscriptions").select("user_id,status,current_period_start,current_period_end").eq("provider","manual").order("created_at",{ascending:false}).limit(200);
  if(error){console.error("admin_list_query_failed",error.code||"unknown",error.message||"");return out({error:"list_failed",code:error.code||"unknown",message:error.message||"Database query failed"},500);}
  const users=[];
  for(const row of rows||[]){const {data,error}=await db.auth.admin.getUserById(row.user_id);if(!error&&data.user)users.push({id:data.user.id,email:data.user.email,status:row.status,current_period_start:row.current_period_start,current_period_end:row.current_period_end});}
  return out({users});
 }
 if(body.action==="set_access"){
  const userId=String(body.user_id||""),days=Number(body.days);
  if(!/^[0-9a-f-]{36}$/i.test(userId)||!Number.isInteger(days)||days<0||days>3650)return out({error:"invalid_input"},400);
  const {data:userData,error:userError}=await db.auth.admin.getUserById(userId);
  if(userError||!userData.user)return out({error:"user_not_found"},404);
  if(days===0){const {error}=await db.from("subscriptions").update({status:"canceled",current_period_end:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("user_id",userId).eq("provider","manual");if(error)return out({error:"update_failed"},500);return out({updated:true,active:false});}
  const now=Date.now();
  const {data:existing}=await db.from("subscriptions").select("status,current_period_start,current_period_end").eq("user_id",userId).eq("provider","manual").maybeSingle();
  const stillActive=existing?.status==="active"&&existing.current_period_end&&Date.parse(existing.current_period_end)>now;
  const start=stillActive&&existing.current_period_start?existing.current_period_start:new Date(now).toISOString();
  const base=stillActive?Date.parse(existing.current_period_end):now;
  const end=new Date(base+days*86400000).toISOString();
  const sub={user_id:userId,provider:"manual",provider_subscription_id:"manual:"+userId,status:"active",current_period_start:start,current_period_end:end,cancel_at_period_end:false,updated_at:new Date().toISOString()};
  const {error}=await db.from("subscriptions").upsert(sub,{onConflict:"provider_subscription_id"});
  if(error)return out({error:"update_failed"},500);
  return out({updated:true,active:true,current_period_end:end});
 }
 if(body.action==="create_user"){
  const email=String(body.email||"").trim().toLowerCase(),days=Number(body.days);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!Number.isInteger(days)||days<1||days>3650)return out({error:"invalid_input"},400);
  const pick=(chars:string)=>chars[crypto.getRandomValues(new Uint32Array(1))[0]%chars.length];
  const chars=[...Array.from({length:5},()=>pick("abcdefghijkmnopqrstuvwxyz")),...Array.from({length:5},()=>pick("ABCDEFGHJKLMNPQRSTUVWXYZ")),...Array.from({length:6},()=>pick("23456789"))];
  for(let i=chars.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[chars[i],chars[j]]=[chars[j],chars[i]];}
  const tempPassword=chars.join("");
  const {data,error}=await db.auth.admin.createUser({email,password:tempPassword,email_confirm:true,app_metadata:{must_change_password:true}});
  if(error||!data.user)return out({error:error?.message||"user_creation_failed"},400);
  const end=new Date(Date.now()+days*86400000).toISOString();
  const sub={user_id:data.user.id,provider:"manual",provider_subscription_id:"manual:"+data.user.id,status:"active",current_period_start:new Date().toISOString(),current_period_end:end,cancel_at_period_end:false,updated_at:new Date().toISOString()};
  const {error:subError}=await db.from("subscriptions").upsert(sub,{onConflict:"provider_subscription_id"});
  if(subError){await db.auth.admin.deleteUser(data.user.id);return out({error:"subscription_creation_failed"},500)}
  return out({created:true,user:{id:data.user.id,email:data.user.email},temporary_password:tempPassword,must_change_password:true,current_period_end:end});
 }
 return out({error:"unknown_action"},400);
});
