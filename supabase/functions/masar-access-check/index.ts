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
 const caller=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false}});
 const {data:{user},error}=await caller.auth.getUser(token);
 if(error||!user)return out({error:"unauthorized"},401);
 if(user.app_metadata?.must_change_password===true)return out({error:"password_change_required"},403);
 const db=createClient(url,key,{auth:{persistSession:false}});
 const {data:admin}=await db.from("admin_users").select("user_id").eq("user_id",user.id).maybeSingle();
 if(admin)return out({allowed:true,role:"admin"});
 const {data:sub,error:subError}=await db.from("subscriptions").select("status,current_period_end").eq("user_id",user.id).eq("provider","manual").order("created_at",{ascending:false}).limit(1).maybeSingle();
 if(subError){console.error("subscription_check_failed",subError.code||"unknown");return out({error:"subscription_check_failed"},500)}
 const active=!!sub&&sub.status==="active"&&!!sub.current_period_end&&Date.parse(sub.current_period_end)>Date.now();
 if(!active)return out({error:"subscription_inactive"},403);
 return out({allowed:true,role:"subscriber",current_period_end:sub.current_period_end});
});