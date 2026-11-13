(function(){
"use strict";
let strategies=[],selected=0,caseIndex=0,revealed=20,caseData=null,completed={};
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ids=["sr-zones","break-retest","trend-follow","ma-pullback","indicators","candles-range"];
const fallbackNames=["الدعم والمقاومة","الاختراق وإعادة الاختبار","اتباع الاتجاه","المتوسط المتحرك والتراجع","RSI وMACD وBollinger Bands","الشموع الانعكاسية والتداول داخل النطاق"];
const cases=[
 {kind:"valid",label:"فرصة تستوفي الشروط",expected:"trade",expectedSide:"buy",why:"تكوّن الشرط المحدد في هذه الاستراتيجية قبل نقطة القرار. كان يمكن إعداد صفقة افتراضية بعد تحديد نقطة الإبطال والحجم، وليس الدخول العشوائي."},
 {kind:"false",label:"إشارة فاشلة",expected:"skip",why:"الإشارة لم تستوفِ شرط التأكيد أو فشلت في الحفاظ على البنية. تجاوزها يحمي المتعلم من مطاردة الحركة."},
 {kind:"range",label:"لا توجد أفضلية واضحة",expected:"wait",why:"السعر لا يقدم إعداداً مكتملاً وفق قواعد الاستراتيجية. الانتظار قرار صحيح وليس فرصة ضائعة."}
];
function currentStrategy(){return strategies[selected]||{id:ids[selected],name:fallbackNames[selected]}}
function pathFor(){
 const k=caseData.kind,idx=selected,seed=idx*17+caseIndex*11+5;let p=100+(idx%3)*.8,arr=[];
 const wave=(i,a)=>Math.sin(i*1.45+seed)*a;
 for(let i=0;i<34;i++){
  let d=0;
  if(idx===0){ // support / resistance
   d=k==="valid"?(i<9?.08:i<16?-.09:i<22?-.025:i<27?.02:.12):k==="false"?(i<9?.08:i<17?-.1:i<22?-.05:i<27?-.18:-.12):wave(i,.07);
  }else if(idx===1){ // breakout / retest
   d=k==="valid"?(i<15?wave(i,.035):i<21?.20:i<26?-.11:.18):k==="false"?(i<15?wave(i,.035):i<21?.24:i<26?-.28:-.09):wave(i,.045);
  }else if(idx===2){ // trend
   d=k==="valid"?(i<10?.16:i<17?.06:i<23?-.10:.18):k==="false"?(i<10?.16:i<17?.06:i<23?-.10:-.22):wave(i,.075);
  }else if(idx===3){ // moving average pullback
   d=k==="valid"?(i<12?.14:i<19?-.12:i<24?-.02:.17):k==="false"?(i<12?.14:i<19?-.12:i<24?-.18:-.15):wave(i,.06);
  }else if(idx===4){ // momentum indicators
   d=k==="valid"?(i<12?.015:i<19?.025:i<24?.12:.17):k==="false"?(i<12?.02:i<19?.025:i<24?.18:i<29?-.24:-.16):wave(i,.035);
  }else{ // candlestick / range
   d=k==="valid"?(i<12?wave(i,.08):i<19?-.045:i<23?-.02:.16):k==="false"?(i<12?wave(i,.08):i<19?-.045:i<23?-.02:-.18):wave(i,.11);
  }
  if(k==="range")d=wave(i,.045)+(i%5===0?.012:-.008);
  p+=d;
  const noise=wave(i,.035),o=p-noise,c=p+noise+(i%2?.015:-.01);
  const h=Math.max(o,c)+.045+(i%3)*.012,l=Math.min(o,c)-.04-(i%2)*.01;
  arr.push({o,h,l,c});
 }
 return arr;
}
function mount(){
 const view=$("simulatorView");if(!view||$("strategyReplay"))return;
 const box=document.createElement("section");box.id="strategyReplay";box.className="card";
 box.innerHTML='<div class="sectionhead"><div><div class="eyebrow">مختبر الاستراتيجيات</div><h2>محاكي بصري قبل حساب Demo</h2><p class="muted">اقرأ الرسم، اتخذ قرارك قبل كشف النتيجة، ثم راجع منطق الاستراتيجية.</p></div><span class="pill">بيانات اصطناعية تعليمية</span></div>'+
 '<div class="notice"><b>تنبيه:</b> هذه سيناريوهات اصطناعية مصممة للتعليم، وليست بيانات سوق أو اختباراً تاريخياً. لا تقيس ربحية الاستراتيجية ولا تتنبأ بالسوق.</div>'+
 '<div class="toolgrid"><div class="field"><label>الاستراتيجية</label><select id="srStrategy"></select></div><div class="field"><label>السيناريو</label><select id="srCase"><option value="0">إعداد محتمل</option><option value="1">إشارة فاشلة</option><option value="2">لا توجد أفضلية</option></select></div></div>'+
 '<div class="card"><div class="sectionhead"><h3 id="srTitle"></h3><span id="srProgress" class="pill"></span></div><canvas id="srChart" width="900" height="330" style="width:100%;height:260px;background:#091321;border:1px solid var(--line);border-radius:10px"></canvas><div class="actions"><button class="btn" id="srNext">كشف الشمعة التالية</button><button class="btn alt" id="srReset">إعادة السيناريو</button></div><p id="srHint" class="small"></p></div>'+
 '<div class="toolgrid"><div class="card"><h3>قرارك قبل معرفة النتيجة</h3><div class="field"><label>ماذا ستفعل؟</label><select id="srDecision"><option value="">اختر القرار</option><option value="trade">أجهز صفقة بعد تحقق الشروط</option><option value="wait">أنتظر تأكيداً إضافياً</option><option value="skip">أتجاوز الإشارة</option></select></div><div id="srPlanFields" class="hide"><div class="notice"><b>خطة افتراضية تعليمية:</b> أدخل الأسعار بوحدات السعر المعروضة في السيناريو. حجم الصفقة وحدات افتراضية فقط؛ لا نحسب مخاطرة مالية أو قيمة نقطة أو عقد.</div><p class="small">التقييم: اتجاه الصفقة 25، هندسة الوقف والهدف 20، العائد إلى المخاطرة 15، قرب الدخول 10، الحجم 10، وتوثيق السبب والإبطال 20. فحص النص يعتمد على كلمات فنية قابلة للملاحظة، ولا يفهم المعنى الكامل مثل المدرب البشري.</p><div class="toolgrid"><div class="field"><label>اتجاه الصفقة</label><select id="srSide"><option value="buy">شراء</option><option value="sell">بيع</option></select></div><div class="field"><label>سعر الدخول</label><input id="srEntry" type="number" min="0" step="any" inputmode="decimal"></div><div class="field"><label>وقف الخسارة</label><input id="srStop" type="number" min="0" step="any" inputmode="decimal"></div><div class="field"><label>الهدف</label><input id="srTarget" type="number" min="0" step="any" inputmode="decimal"></div><div class="field"><label>حجم الصفقة الافتراضي (وحدات)</label><input id="srSize" type="number" min="0" step="any" inputmode="decimal"></div></div><div class="field"><label>شرط إلغاء الفكرة</label><textarea id="srCancel" rows="2" maxlength="300" placeholder="ما الذي يبطل الفكرة قبل الدخول أو أثناء الانتظار؟"></textarea></div><div id="srPlanMetrics" class="small" aria-live="polite">ستظهر مسافات الوقف والهدف ونسبة المخاطرة إلى العائد بعد إدخال الأسعار.</div></div><div class="field"><label>سبب القرار / سبب الدخول</label><textarea id="srReason" rows="3" maxlength="500" placeholder="اذكر إشارة الاستراتيجية والسبب الذي يدعم قرارك..."></textarea></div><button class="btn" id="srCheck">ثبّت القرار والخطة واكشف النتيجة</button><div id="srFeedback" class="feedback" aria-live="polite"></div></div><div class="card"><h3>مراجعة المدرب</h3><p id="srExplanation" class="muted">لن تظهر المراجعة إلا بعد تثبيت قرارك.</p><div id="srRule" class="small"></div></div></div>'+
 '<div class="card"><h3>تقدمك</h3><span id="srScore" class="pill">0 / 18 سيناريو</span><div id="srHistory" class="small"></div><p class="small">يُحفظ تقدمك على هذا الجهاز. لكل استراتيجية ثلاثة سيناريوهات مختلفة، بإجمالي 18 سيناريو.</p></div>';
 view.insertBefore(box,view.firstChild);
 $("srDecision").addEventListener("change",syncPlanFields);["srSide","srEntry","srStop","srTarget","srSize"].forEach(id=>$(id).addEventListener("input",previewPlan));
 const sel=$("srStrategy");sel.innerHTML=(strategies.length?strategies:ids.map((id,i)=>({id,name:fallbackNames[i]}))).map((x,i)=>'<option value="'+i+'">'+esc(x.name)+'</option>').join("");
 try{completed=JSON.parse(localStorage.getItem("masar_strategy_replay_v1")||"{}")}catch{completed={}}
 sel.addEventListener("change",()=>{selected=+sel.value;reset()});
 $("srCase").addEventListener("change",()=>{caseIndex=+$("srCase").value;reset()});
 $("srNext").onclick=()=>{if(revealed<24){revealed++;draw()}};
 $("srReset").onclick=reset;$("srCheck").onclick=check;
 reset();renderScore();
}
const rules=[
 "الدعم والمقاومة: حدد المنطقة من تفاعلات سابقة، وانتظر رفضاً أو إغلاقاً واضحاً. اللمس وحده ليس إشارة.",
 "الاختراق وإعادة الاختبار: اشترط إغلاقاً خارج النطاق ثم عودة واختباراً ناجحاً للمستوى.",
 "اتباع الاتجاه: تحقق من تسلسل القمم والقيعان، وانتظر تصحيحاً لا يبطل البنية قبل الاستمرار.",
 "المتوسط المتحرك والتراجع: راقب اتجاه المتوسط وموقع السعر، وانتظر إشارة استئناف بعد التراجع؛ مجرد اللمس لا يكفي.",
 "المؤشرات: اشترط توافق قواعد المؤشرات مع حركة السعر والسياق. لا تتخذ القرار من RSI أو MACD منفرداً.",
 "الشموع والنطاق: حدد الحد أولاً، وانتظر إغلاق نموذج الشمعة قربه؛ لا تحكم قبل اكتمال الشمعة."
];
function requiresTradePlan(decision){return decision==="trade"}
function evaluateTradePlan(input){
 const errors=[],warnings=[];
 const side=input.side,entry=Number(input.entry),stop=Number(input.stop),target=Number(input.target),size=Number(input.size),reference=Number(input.referencePrice),range=Number(input.averageRange);
 const prices=[entry,stop,target];
 if(![entry,stop,target].every(Number.isFinite)||prices.some(x=>x<=0))errors.push("أدخل أسعاراً موجبة وصحيحة للدخول والوقف والهدف.");
 const geometry=side==="buy"?(stop<entry&&target>entry):side==="sell"?(stop>entry&&target<entry):false;
 if(!geometry)errors.push(side==="buy"?"للشراء يجب أن يكون وقف الخسارة أسفل الدخول والهدف أعلى الدخول.":"للبيع يجب أن يكون وقف الخسارة أعلى الدخول والهدف أسفل الدخول.");
 if(input.expectedSide&&side!==input.expectedSide)errors.push("اتجاه الصفقة لا يتوافق مع اتجاه الإعداد في هذا السيناريو.");
 if(side==="buy"&&Number.isFinite(Number(input.structureLow))&&Number.isFinite(stop)&&stop>=Number(input.structureLow))errors.push("وقف الشراء يجب أن يكون أسفل قاع البنية القريبة التي تُبطل الفكرة.");
 if(side==="sell"&&Number.isFinite(Number(input.structureHigh))&&Number.isFinite(stop)&&stop<=Number(input.structureHigh))errors.push("وقف البيع يجب أن يكون أعلى قمة البنية القريبة التي تُبطل الفكرة.");
 if(!Number.isFinite(size)||size<=0)errors.push("حجم الصفقة الافتراضي يجب أن يكون أكبر من صفر.");
 const reasonText=String(input.reason||"").trim(),cancelText=String(input.cancel||"").trim();
 const reasonEvidence=/(دعم|مقاومة|اختراق|إعادة\\s*اختبار|اتجاه|متوسط|شمعة|ارتداد|تأكيد|إغلاق|قمة|قاع|زخم|نطاق|rsi|macd|bollinger|support|resistance|breakout|retest|trend|candle|range)/i.test(reasonText);
 const cancelEvidence=/(إغلاق|كسر|اختراق|فشل|عودة|تجاوز|منطقة|مستوى|قمة|قاع|إبطال|شمعة|close|break|invalid|level|zone|below|above)/i.test(cancelText);
 if(reasonText.length<12)errors.push("اكتب سبب دخول واضحاً لا يقل عن 12 حرفاً.");
 else if(!reasonEvidence)errors.push("اذكر إشارة فنية محددة في سبب الدخول، مثل دعم أو اختراق أو اتجاه أو شمعة تأكيد.");
 if(cancelText.length<8)errors.push("حدد شرط إلغاء واضحاً لا يقل عن 8 أحرف.");
 else if(!cancelEvidence)errors.push("اكتب شرط إلغاء قابل للملاحظة، مثل إغلاق أسفل المستوى أو فشل إعادة الاختبار.");
 const riskDistance=Number.isFinite(entry)&&Number.isFinite(stop)?Math.abs(entry-stop):null;
 const rewardDistance=Number.isFinite(entry)&&Number.isFinite(target)?Math.abs(target-entry):null;
 const riskReward=riskDistance>0&&rewardDistance>0?rewardDistance/riskDistance:null;
 if(Number.isFinite(reference)&&reference>0&&Number.isFinite(range)&&range>0&&Number.isFinite(entry)&&Math.abs(entry-reference)>Math.max(range*3,reference*.001))errors.push("سعر الدخول بعيد عن سعر القرار مقارنة بمدى الحركة الأخيرة؛ راجع السعر أو انتظر إعداداً جديداً.");
 if(riskReward!==null&&riskReward<1)warnings.push("العائد المحتمل أقل من مسافة المخاطرة؛ راجع جودة الإعداد ولا تعتمد على النسبة وحدها.");
 else if(riskReward!==null&&riskReward<1.5)warnings.push("نسبة العائد إلى المخاطرة أقل من 1:1.5؛ هذه ملاحظة تعليمية وليست قاعدة إلزامية لكل استراتيجية.");
 const directionScore=input.expectedSide?(side===input.expectedSide?25:0):25;
 const geometryScore=geometry?20:0;
 const rrScore=riskReward===null?0:riskReward>=1.5?15:riskReward>=1?10:0;
 const proximityScore=Number.isFinite(reference)&&reference>0&&Number.isFinite(range)&&range>0&&Number.isFinite(entry)&&Math.abs(entry-reference)<=Math.max(range*3,reference*.001)?10:0;
 const sizeScore=Number.isFinite(size)&&size>0?10:0;
 const reasonScore=String(input.reason||"").trim().length>=12?10:0;
 const cancelScore=String(input.cancel||"").trim().length>=8?10:0;
 return {valid:errors.length===0,errors,warnings,riskDistance,rewardDistance,riskReward,score:directionScore+geometryScore+rrScore+proximityScore+sizeScore+reasonScore+cancelScore};
}
function decisionReference(){const bars=pathFor();const recent=bars.slice(19,24);return {price:bars[23].c,averageRange:recent.reduce((sum,b)=>sum+(b.h-b.l),0)/Math.max(1,recent.length),structureLow:Math.min(...recent.map(b=>b.l)),structureHigh:Math.max(...recent.map(b=>b.h))}}
function readPlan(){const ref=decisionReference();return {side: $("srSide").value,entry:$("srEntry").value,stop:$("srStop").value,target:$("srTarget").value,size:$("srSize").value,reason:$("srReason").value,cancel:$("srCancel").value,expectedSide:caseData.expectedSide||null,referencePrice:ref.price,averageRange:ref.averageRange,structureLow:ref.structureLow,structureHigh:ref.structureHigh}}
function syncPlanFields(){const show=requiresTradePlan($("srDecision").value);$("srPlanFields").classList.toggle("hide",!show);if(show)previewPlan()}
function previewPlan(){const box=$("srPlanMetrics");if(!box)return;const p=readPlan(),entry=Number(p.entry),stop=Number(p.stop),target=Number(p.target);if(![entry,stop,target].every(x=>Number.isFinite(x)&&x>0)){box.textContent="أدخل سعر الدخول والوقف والهدف لعرض المسافات ونسبة المخاطرة إلى العائد.";return}const risk=Math.abs(entry-stop),reward=Math.abs(target-entry),rr=risk>0?reward/risk:null;box.textContent="مسافة المخاطرة السعرية: "+risk.toFixed(5)+" · مسافة الهدف: "+reward.toFixed(5)+" · العائد إلى المخاطرة: "+(rr===null?"غير محسوب":rr.toFixed(2)+":1")+" · لا تمثل هذه الأرقام قيمة مالية أو مخاطرة نقدية."}
function reset(){
 revealed=20;caseData=cases[caseIndex];
 $("srDecision").value="";$("srReason").value="";$("srSide").value="buy";$("srEntry").value="";$("srStop").value="";$("srTarget").value="";$("srSize").value="";$("srCancel").value="";$("srPlanFields").classList.add("hide");$("srPlanMetrics").textContent="ستظهر مسافات الوقف والهدف ونسبة المخاطرة إلى العائد بعد إدخال الأسعار.";$("srFeedback").textContent="";
 $("srExplanation").textContent="لن تظهر المراجعة إلا بعد تثبيت قرارك.";
 $("srRule").textContent="قاعدة هذه الاستراتيجية: "+rules[selected];
 $("srTitle").textContent=currentStrategy().name+" — "+caseData.label;
 $("srNext").disabled=false;$("srDecision").disabled=false;$("srCheck").disabled=false;["srReason","srSide","srEntry","srStop","srTarget","srSize","srCancel"].forEach(id=>$(id).disabled=false);draw();
}
function draw(){
 const canvas=$("srChart");if(!canvas)return;
 const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height,bars=pathFor(),shown=bars.slice(0,revealed);
 ctx.clearRect(0,0,w,h);ctx.strokeStyle="#26384e";ctx.lineWidth=1;
 for(let k=0;k<5;k++){const y=24+k*(h-48)/4;ctx.beginPath();ctx.moveTo(35,y);ctx.lineTo(w-15,y);ctx.stroke()}
 const min=Math.min(...bars.map(x=>x.l))-.15,max=Math.max(...bars.map(x=>x.h))+.15,py=v=>h-25-(v-min)/(max-min)*(h-50),step=(w-65)/34,cw=Math.max(5,step*.48);
 shown.forEach((b,i)=>{const x=42+i*step+step/2,up=b.c>=b.o;ctx.strokeStyle=up?"#72d1aa":"#f29b91";ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.moveTo(x,py(b.h));ctx.lineTo(x,py(b.l));ctx.stroke();const top=py(Math.max(b.o,b.c)),bottom=py(Math.min(b.o,b.c));ctx.fillRect(x-cw/2,top,cw,Math.max(2,bottom-top))});
 ctx.fillStyle="#b0bdcc";ctx.font="15px system-ui";ctx.fillText("شموع مكشوفة: "+revealed+" / 34",42,20);
 $("srProgress").textContent=revealed+" / 34 شمعة";
 $("srNext").disabled=revealed>=24;
 $("srHint").textContent=revealed<24?"اكشف الشموع حتى نقطة القرار. لن تظهر الشموع اللاحقة قبل تثبيت اختيارك.":revealed===24?"نقطة القرار: ثبّت اختيارك الآن لكشف بقية السيناريو.":"ظهرت بقية الحركة. قارن النتيجة بقرارك الأول.";
}
function check(){
 if(revealed<24){$("srFeedback").textContent="اكشف الشموع حتى نقطة القرار أولاً.";return}
 if(revealed>24){$("srFeedback").textContent="أعد السيناريو لاتخاذ قرار قبل كشف النتيجة.";return}
 const decision=$("srDecision").value;if(!decision){$("srFeedback").textContent="اختر قرارك أولاً.";return}
 let plan=null,planReview=null;
 if(requiresTradePlan(decision)){plan=readPlan();planReview=evaluateTradePlan(plan);if(!planReview.valid){$("srFeedback").textContent="لا يمكن تثبيت الخطة بعد. "+planReview.errors.join(" ");$("srFeedback").style.color="var(--red)";return}plan={side:plan.side,entry:Number(plan.entry),stop:Number(plan.stop),target:Number(plan.target),size:Number(plan.size),reason:plan.reason.trim(),cancel:plan.cancel.trim(),riskDistance:planReview.riskDistance,rewardDistance:planReview.rewardDistance,riskReward:planReview.riskReward,score:planReview.score,warnings:planReview.warnings}}
 const expected=caseData.expected,ok=decision===expected,key=currentStrategy().id+"_"+caseIndex;
 const score=decision==="trade"?(ok?Math.round(20+planReview.score*.8):Math.round(planReview.score*.4)):(ok?100:0);
 completed[key]={ok,decision,score,at:new Date().toISOString(),reason:$("srReason").value.slice(0,500),plan};
 try{localStorage.setItem("masar_strategy_replay_v1",JSON.stringify(completed))}catch{}
 revealed=34;draw();
 $("srFeedback").textContent=(ok?"قرارك متوافق مع قواعد السيناريو. ":"القرار لا يطابق الاختيار المتوقع لهذا السيناريو. ")+(plan?"درجة القرار والخطة: "+score+"/100. نسبة العائد إلى المخاطرة "+plan.riskReward.toFixed(2)+":1."+(plan.warnings.length?" ملاحظة: "+plan.warnings.join(" "):""):"لم تكن هناك حاجة إلى خطة صفقة؛ الانتظار أو التجاوز لا يتطلبان إدخال أسعار.");
 $("srFeedback").style.color=ok?"var(--green)":"var(--red)";
 $("srExplanation").textContent=caseData.why+(plan?"\n\nمراجعة الخطة: مسافة المخاطرة السعرية "+plan.riskDistance.toFixed(5)+"، ومسافة الهدف "+plan.rewardDistance.toFixed(5)+". حجم الصفقة الافتراضي "+plan.size+" وحدة. التقييم لا يحسب خسارة أو ربحاً نقدياً.":"");
 $("srRule").textContent="القاعدة: "+rules[selected]+" التقييم يراجع الالتزام بالاتجاه والهندسة السعرية وجودة التوثيق؛ ولا يمثل عائداً مالياً.";
 $("srDecision").disabled=true;$("srCheck").disabled=true;["srReason","srSide","srEntry","srStop","srTarget","srSize","srCancel"].forEach(id=>$(id).disabled=true);renderScore();
}
function renderScore(){
 const total=18,done=Object.keys(completed).length,correct=Object.values(completed).filter(x=>x&&x.ok).length,points=Object.values(completed).reduce((sum,x)=>sum+(Number(x&&x.score)||0),0);
 $("srScore").textContent=done+" / "+total+" سيناريو · "+correct+" قرارات متوافقة · "+points+" نقطة";
 $("srHistory").textContent=done?"محاولات محفوظة: "+done+" · المتبقي: "+(total-done):"لم تُسجّل محاولات بعد.";
}
window.openStrategyReplay=function(id){
 const index=strategies.findIndex(x=>x.id===id);if(index<0)return;
 selected=index;caseIndex=0;
 const s=$("srStrategy");if(s)s.value=String(index);
 const c=$("srCase");if(c)c.value="0";
 reset();if(typeof window.showView==="function")window.showView("simulator");
 setTimeout(()=>{const panel=$("strategyReplay");if(panel)panel.scrollIntoView({behavior:"smooth",block:"start"})},80);
};
if(window.__MASAR_STRATEGY_SIM_TEST__){window.__MASAR_STRATEGY_SIM_TEST__={requiresTradePlan,evaluateTradePlan}}
function init(){
 mount();const old=window.masarInitialize;
 if(typeof old==="function"&&!window.__strategyReplayWrapped){
  window.masarInitialize=function(data){old(data);strategies=Array.isArray(data.strategyLibrary)?data.strategyLibrary:[];const s=$("srStrategy");if(s){const oldValue=s.value;s.innerHTML=strategies.map((x,i)=>'<option value="'+i+'">'+esc(x.name)+'</option>').join("");s.value=oldValue;renderScore()}};
  window.__strategyReplayWrapped=true;
 }
 document.addEventListener("click",e=>{if(e.target.closest('[data-view="simulator"]'))setTimeout(()=>{mount();renderScore()},0)});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();