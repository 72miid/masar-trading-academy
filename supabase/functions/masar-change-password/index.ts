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
 if(user.app_metadata?.must_change_password!==true)return out({error:"password_change_not_required"},409);
 let body:any;try{body=await req.json()}catch{return out({error:"invalid_json"},400)}
 const password=String(body.password||"");
 if(password.length<8||password.length>128)return out({error:"password_minimum_8_characters"},400);
 const db=createClient(url,key,{auth:{persistSession:false}});
 const appMetadata={...(user.app_metadata||{}),must_change_password:false};
 const {data,error:updateError}=await db.auth.admin.updateUserById(user.id,{password,app_metadata:appMetadata});
 if(updateError||!data.user){console.error("first_password_change_failed",updateError?.message||"unknown");return out({error:"password_update_failed"},400)}
 return out({changed:true});
});
