(function(){
"use strict";
let strategies=[],selected=0,caseIndex=0,revealed=8,caseData=null,completed={};
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cases=[
 {kind:"valid",label:"فرصة تستوفي الشروط",expected:"buy",why:"اكتملت شروط السيناريو التعليمي. القرار الصحيح هو انتظار إغلاق التأكيد ثم تقييم الدخول والوقف والهدف."},
 {kind:"false",label:"إشارة فاشلة",expected:"skip",why:"الحركة الظاهرة لا تستوفي شروط التأكيد أو فشلت في الحفاظ على المستوى. تجاوز الصفقة أفضل من مطاردة الإشارة."},
 {kind:"range",label:"لا توجد أفضلية واضحة",expected:"wait",why:"السوق لا يقدم شرطاً مكتملاً وفق القواعد. الانتظار قرار تداولي صحيح."}
];
const ids=["sr-zones","break-retest","trend-follow","ma-pullback","indicators","candles-range"];
function makeBars(kind,seed){
 let vals=[],p=100+(seed%7)*.7;
 for(let i=0;i<34;i++){
  let d=0;
  if(kind==="valid"){d=i<10?.12:i<17?.04:i<24?-.16:i<29?.32:.22;if(selected%2===1)d=-d}
  if(kind==="false"){d=i<12?.1:i<20?.04:i<25?.35:i<30?-.48:-.22;if(selected%2===1)d=-d}
  if(kind==="range"){d=Math.sin(i*1.4+seed)*.12+(i%4===0?.04:-.02)}
  p+=d;const o=p-(Math.sin(i*2+seed)*.11),c=p+(Math.cos(i*1.3+seed)*.12),hi=Math.max(o,c)+.12+(i%3)*.025,lo=Math.min(o,c)-.1-(i%2)*.03;
  vals.push({o,h:hi,l:lo,c});
 }
 return vals;
}
function currentStrategy(){return strategies[selected]||{id:ids[selected],name:["الدعم والمقاومة","الاختراق وإعادة الاختبار","اتباع الاتجاه","المتوسط المتحرك والتراجع","RSI وMACD وBollinger Bands","الشموع الانعكاسية والتداول داخل النطاق"][selected]}}
function mount(){
 const view=$("simulatorView");if(!view||$("strategyReplay"))return;
 const box=document.createElement("section");box.id="strategyReplay";box.className="card";
 box.innerHTML='<div class="sectionhead"><div><div class="eyebrow">مختبر الاستراتيجيات</div><h2>محاكي بصري قبل حساب Demo</h2><p class="muted">تدرّب على قراءة السيناريو واتخاذ القرار داخل مسار محاكاة مستقل عن MT5.</p></div><span class="pill">بيانات اصطناعية تعليمية</span></div>'+
 '<div class="notice"><b>تنبيه:</b> الرسوم والسيناريوهات هنا مولّدة للتدريب وليست أسعاراً تاريخية أو مباشرة، ولا تمثل نتائج أداء أو دليلاً على ربحية أي استراتيجية. لا يوجد اتصال بوسيط.</div>'+
 '<div class="toolgrid"><div class="field"><label>الاستراتيجية</label><select id="srStrategy"></select></div><div class="field"><label>نوع السيناريو</label><select id="srCase"><option value="0">فرصة تستوفي الشروط</option><option value="1">إشارة فاشلة</option><option value="2">لا توجد أفضلية واضحة</option></select></div></div>'+
 '<div class="card"><div class="sectionhead"><h3 id="srTitle">إعادة تشغيل الرسم</h3><span id="srProgress" class="pill">8 / 34 شمعة</span></div><canvas id="srChart" width="900" height="330" style="width:100%;height:260px;background:#091321;border:1px solid var(--line);border-radius:10px"></canvas><div class="actions"><button class="btn" id="srNext">كشف الشمعة التالية</button><button class="btn alt" id="srReset">إعادة السيناريو</button><button class="ghost" id="srShowAll">عرض الرسم كاملاً</button></div><p id="srHint" class="small">اكشف الشموع تدريجياً. سجّل ملاحظتك قبل اتخاذ القرار.</p></div>'+
 '<div class="toolgrid"><div class="card"><h3>قرارك في هذا السيناريو</h3><div class="field"><label>ماذا ستفعل؟</label><select id="srDecision"><option value="">اختر القرار</option><option value="buy">أبحث عن شراء بعد التأكيد</option><option value="sell">أبحث عن بيع بعد التأكيد</option><option value="wait">أنتظر ولا أدخل الآن</option><option value="skip">أتجاوز السيناريو</option></select></div><div class="field"><label>سبب القرار وشرط التأكيد أو الإبطال</label><textarea id="srReason" rows="3" maxlength="500" placeholder="اكتب ما رأيته على الرسم والشرط الذي تنتظره..."></textarea></div><button class="btn" id="srCheck">قيّم قراري</button><div id="srFeedback" class="feedback" aria-live="polite"></div></div><div class="card"><h3>مراجعة السيناريو</h3><p id="srExplanation" class="muted">بعد تقييم قرارك ستظهر المراجعة التعليمية.</p><div id="srRule" class="small"></div></div></div>'+
 '<div class="card"><div class="sectionhead"><h3>تقدمك في المحاكي</h3><span id="srScore" class="pill">0 / 18 سيناريو</span></div><div id="srHistory" class="small">لم تُسجّل محاولات بعد.</div><p class="small">يُحفظ التقدم على هذا الجهاز فقط. جرّب كل نوع سيناريو لكل استراتيجية، ولا تنتقل إلى حساب الوسيط التجريبي قبل فهم القواعد ومراجعة أخطائك.</p></div>';
 view.insertBefore(box,view.firstChild);
 const sel=$("srStrategy");sel.innerHTML=(strategies.length?strategies:ids.map((id,i)=>({id,name:["الدعم والمقاومة","الاختراق وإعادة الاختبار","اتباع الاتجاه","المتوسط المتحرك والتراجع","RSI وMACD وBollinger Bands","الشموع الانعكاسية والتداول داخل النطاق"][i]}))).map((x,i)=>'<option value="'+i+'">'+esc(x.name)+'</option>').join("");
 try{completed=JSON.parse(localStorage.getItem("masar_strategy_replay_v1")||"{}")}catch{completed={}}
 sel.addEventListener("change",()=>{selected=+sel.value;reset()});
 $("srCase").addEventListener("change",()=>{caseIndex=+$("srCase").value;reset()});
 $("srNext").onclick=()=>{if(revealed<34){revealed=Math.min(34,revealed+1);draw()}};
 $("srShowAll").onclick=()=>{revealed=34;draw()};
 $("srReset").onclick=reset;
 $("srCheck").onclick=check;
 reset();
}
function reset(){
 revealed=8;caseData=cases[caseIndex];$("srDecision").value="";$("srReason").value="";$("srFeedback").textContent="";
 $("srExplanation").textContent="بعد تقييم قرارك ستظهر المراجعة التعليمية.";
 const rules=[
 "راقب حدود المنطقة، ورد فعل السعر، وهل ظهر إغلاق يؤكد الرفض أو الكسر. لا تعتبر اللمس وحده إشارة.",
 "راقب إغلاقاً خارج النطاق ثم عودة لاختبار المستوى من الجهة الأخرى. لا تطارد أول شمعة اختراق.",
 "راقب تسلسل القمم والقيعان واتجاه السياق، ثم انتظر تصحيحاً لا يبطل البنية قبل التفكير بالدخول.",
 "راقب اتجاه المتوسطات وموقع السعر والتراجع إليها، ولا تعتبر مجرد لمس المتوسط تأكيداً.",
 "راقب توافق شروط المؤشرات مع حركة السعر والإطار الأعلى. قراءة مؤشر منفرد لا تكفي.",
 "راقب إغلاق نموذج الشمعة قرب حد النطاق، ولا تصنّف الشمعة قبل اكتمالها."
 ];
 $("srRule").textContent="قاعدة المراقبة: "+rules[selected%rules.length];
 $("srTitle").textContent=currentStrategy().name+" — "+caseData.label;draw()
}
function draw(){
 const canvas=$("srChart");if(!canvas)return;const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height,bars=makeBars(caseData.kind,selected*13+caseIndex*5+3),shown=bars.slice(0,revealed);
 ctx.clearRect(0,0,w,h);ctx.strokeStyle="#26384e";ctx.lineWidth=1;
 for(let k=0;k<5;k++){const y=24+k*(h-48)/4;ctx.beginPath();ctx.moveTo(35,y);ctx.lineTo(w-15,y);ctx.stroke()}
 const min=Math.min(...bars.map(x=>x.l))-.25,max=Math.max(...bars.map(x=>x.h))+.25,py=v=>h-25-(v-min)/(max-min)*(h-50),step=(w-65)/34,cw=Math.max(5,step*.48);
 shown.forEach((b,i)=>{const x=42+i*step+step/2,up=b.c>=b.o;ctx.strokeStyle=up?"#72d1aa":"#f29b91";ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.moveTo(x,py(b.h));ctx.lineTo(x,py(b.l));ctx.stroke();const top=py(Math.max(b.o,b.c)),bottom=py(Math.min(b.o,b.c));ctx.fillRect(x-cw/2,top,cw,Math.max(2,bottom-top))});
 ctx.fillStyle="#b0bdcc";ctx.font="15px system-ui";ctx.fillText("شموع ظاهرة: "+revealed+" / 34",42,20);
 $("srProgress").textContent=revealed+" / 34 شمعة";
 $("srNext").disabled=revealed>=34;
 $("srHint").textContent=revealed<34?"اكشف الشموع تدريجياً. لا تتخذ قراراً من شمعة منفردة.":"اكتمل السيناريو. اختر قرارك واكتب السبب قبل التقييم.";
}
function check(){
 if(revealed<34){$("srFeedback").textContent="أكمل كشف الشموع أولاً حتى لا تحكم من بيانات ناقصة.";return}
 const decision=$("srDecision").value;if(!decision){$("srFeedback").textContent="اختر قرارك أولاً.";return}
 const expected=caseData.kind==="valid"?(selected%2===0?"buy":"sell"):caseData.expected,ok=decision===expected;
 const key=currentStrategy().id+"_"+caseIndex;
 completed[key]={ok,decision,at:new Date().toISOString(),reason:$("srReason").value.slice(0,500)};
 try{localStorage.setItem("masar_strategy_replay_v1",JSON.stringify(completed))}catch{}
 $("srFeedback").textContent=ok?"قرار مناسب لهذا السيناريو التعليمي.":"قرار غير مناسب لهذا السيناريو. راجع القاعدة ثم أعد المحاولة.";
 $("srFeedback").style.color=ok?"var(--green)":"var(--red)";
 $("srExplanation").textContent=caseData.why;
 $("srRule").textContent="القرار المرجعي: "+({buy:"انتظار تأكيد الشراء ثم تقييم المخاطرة",sell:"انتظار تأكيد البيع ثم تقييم المخاطرة",wait:"الانتظار حتى تتضح الشروط",skip:"تجاوز الإشارة غير المكتملة"})[expected]+".";
 renderScore();
}
function renderScore(){
 const total=ids.length*3,done=Object.keys(completed).length,correct=Object.values(completed).filter(x=>x&&x.ok).length;
 $("srScore").textContent=done+" / "+total+" سيناريو · "+correct+" قرار مناسب";
 $("srHistory").textContent=done?"محاولات محفوظة: "+done+" · القرارات المناسبة: "+correct+" · المتبقي: "+(total-done):"لم تُسجّل محاولات بعد.";
}
window.openStrategyReplay=function(id){const index=strategies.findIndex(x=>x.id===id);if(index<0)return;selected=index;caseIndex=0;const s=$("srStrategy");if(s)s.value=String(index);const c=$("srCase");if(c)c.value="0";reset();if(typeof window.showView==="function")window.showView("simulator");setTimeout(()=>{const panel=$("strategyReplay");if(panel)panel.scrollIntoView({behavior:"smooth",block:"start"})},80)};
function init(){
 mount();
 const old=window.masarInitialize;
 if(typeof old==="function"&&!window.__strategyReplayWrapped){
  window.masarInitialize=function(data){old(data);strategies=Array.isArray(data.strategyLibrary)?data.strategyLibrary:[];const s=$("srStrategy");if(s){const oldValue=s.value;s.innerHTML=strategies.map((x,i)=>'<option value="'+i+'">'+esc(x.name)+'</option>').join("");s.value=oldValue;renderScore()}};
  window.__strategyReplayWrapped=true;
 }
 document.addEventListener("click",e=>{if(e.target.closest('[data-view="simulator"]'))setTimeout(()=>{mount();renderScore()},0)});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();