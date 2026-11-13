// Supabase Edge Function: provider-neutral, signed subscription event adapter.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-masar-signature", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2,"0")).join("");
async function signature(secret: string, body: string) { const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name:"HMAC", hash:"SHA-256" }, false, ["sign"]); return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))); }
function safeEqual(a: string,b: string) { if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0; }
Deno.serve(async req => {
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return response({error:"method_not_allowed"},405);
  const secret=Deno.env.get("MASAR_WEBHOOK_SECRET"),url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!secret||!url||!service) return response({error:"server_not_configured"},503);
  const raw=await req.text(),provided=(req.headers.get("x-masar-signature")||"").replace(/^sha256=/,"");
  const expected=await signature(secret,raw);
  if(!safeEqual(provided,expected)) return response({error:"invalid_signature"},401);
  let event:any;try{event=JSON.parse(raw)}catch{return response({error:"invalid_json"},400)}
  if(!event.id||!event.type||!event.data?.user_id||!event.data?.provider_subscription_id) return response({error:"invalid_event_shape"},400);
  const allowed=["subscription.created","subscription.updated","subscription.deleted"];
  if(!allowed.includes(event.type)) return response({received:true,ignored:true});
  const status=event.type==="subscription.deleted"?"canceled":event.data.status;
  if(!["trialing","active","past_due","canceled","incomplete","expired"].includes(status)) return response({error:"invalid_subscription_status"},400);
  const db=createClient(url,service,{auth:{persistSession:false}});
  const {error:logError}=await db.from("payment_webhook_events").insert({id:String(event.id),event_type:String(event.type)});
  if(logError?.code==="23505") return response({received:true,duplicate:true});
  if(logError) return response({error:"event_log_failed"},500);
  const row={user_id:event.data.user_id,provider:String(event.data.provider||"external"),provider_customer_id:event.data.provider_customer_id||null,provider_subscription_id:String(event.data.provider_subscription_id),status,price_id:event.data.price_id||null,current_period_start:event.data.current_period_start||null,current_period_end:event.data.current_period_end||null,cancel_at_period_end:!!event.data.cancel_at_period_end,updated_at:new Date().toISOString()};
  const {error}=await db.from("subscriptions").upsert(row,{onConflict:"provider_subscription_id"});
  if(error){await db.from("payment_webhook_events").delete().eq("id",String(event.id));return response({error:"subscription_update_failed"},500)}
  return response({received:true});
});
