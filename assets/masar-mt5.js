(function(){
"use strict";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const quizzes=[
[["هل MT5 وسيط يوفر كل الأسواق؟",["نعم تلقائياً","لا، الوسيط يحدد الأدوات والحسابات","نعم إذا ظهر الرمز"],1],["ما الذي يميز Demo؟",["أموال افتراضية ولا تطابق التنفيذ الحقيقي تماماً","أرباح مضمونة","لا اختلاف عن الحقيقي"],0]],
[["أي نافذة تعرض أسعار الرموز في الكمبيوتر؟",["Navigator","Market Watch","Journal"],1],["أين تجد سجل الصفقات في الهاتف عادة؟",["History","Quotes","Settings فقط"],0]],
[["هل XAUUSD موحد لدى كل الوسطاء؟",["نعم دائماً","لا، قد تختلف التسمية واللاحقة","لا يمكن تداوله"],1],["ما المرجع لمواصفات الرمز؟",["لون الشمعة","Specification / Details","اسم الرمز فقط"],1]],
[["ماذا يعني H1؟",["شمعة ساعة","شمعة يوم","شمعة دقيقة"],0],["هل الشمعة الحالية مغلقة؟",["نعم فور ظهورها","لا، قد يتغير شكلها حتى الإغلاق","لا تتغير"],1]],
[["هل المؤشر يضمن اتجاه السعر؟",["نعم","لا، أداة مشتقة من البيانات","فقط RSI"],1],["ما فائدة شرط رسم ثابت؟",["تكرار التحليل دون تحيز","ضمان الربح","إلغاء الوقف"],0]],
[["ما أمر Buy Limit عادة؟",["شراء محدد أسفل السعر الحالي","شراء سوق فوري","بيع عند سعر أعلى"],0],["هل يضمن Stop Loss سعر التنفيذ دائماً؟",["نعم","لا، قد يحدث انزلاق أو فجوة","فقط على الهاتف"],1]],
[["هل الهامش هو أقصى خسارة؟",["نعم","لا، هو متطلب لفتح المركز","هو العمولة"],1],["ما الذي يحدد قيمة الحركة النقدية؟",["حجم المركز ومواصفات الأداة وعملة الحساب","الإطار فقط","لون الرسم"],0]],
[["ما الذي يحكم تعديل الوقف؟",["الخوف من الإغلاق","قاعدة مكتوبة وخطة مسبقة","الرغبة بتجنب الخسارة"],1],["التنبيه السعري يعني:",["إشارة دخول مؤكدة","إشعار تحقق مستوى فقط","تنفيذ تلقائي"],1]],
[["ما الذي يجب فحصه في History؟",["الفترة والعمولات والتمويل وصافي النتيجة","الرابحة فقط","الرمز فقط"],0],["هل نتيجة Demo تثبت الأداء الحقيقي؟",["نعم","لا، تختلف ظروف التنفيذ والسيولة","نعم بعد عدة صفقات"],1]],
[["هل توفر سهم يعني امتلاك السهم؟",["نعم دائماً","لا، قد يكون CFD أو مشتقاً","يعني مساهمة"],1],["هل مواصفات الذهب تطبق على المؤشرات؟",["نعم","لا، لكل أداة مواصفاتها","إذا تشابه السعر"],1]],
[["هل يوجد هدف ربح أو عدد صفقات مطلوب؟",["نعم","لا، الهدف فهم المنصة","التداول يومياً"],1],["ما الترتيب الأفضل للتطبيق؟",["إرسال الأمر فوراً","فحص الأداة ثم التخطيط ثم التجربة والمراجعة","اختيار أكبر حجم"],1]]
];
let course=null,device="auto",current=0,answers={};
const detect=()=>/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||(/Macintosh/i.test(navigator.userAgent)&&navigator.maxTouchPoints>1)?"mobile":"desktop";
const progress=()=>{try{return JSON.parse(localStorage.getItem("masar_mt5_progress_v1")||"{}")}catch{return {}}};
const save=p=>localStorage.setItem("masar_mt5_progress_v1",JSON.stringify(p));
const activeDevice=()=>device==="auto"?detect():device;
function install(){
 const main=document.querySelector("main");if(main&&!document.getElementById("mt5View")){const s=document.createElement("section");s.id="mt5View";s.className="view";main.appendChild(s)}
 const nav=document.querySelector(".nav");
 if(nav&&!nav.querySelector('[data-view="mt5"]')){const b=document.createElement("button");b.dataset.view="mt5";b.textContent="MASAR MT5";b.addEventListener("click",()=>window.showView&&window.showView("mt5"));nav.insertBefore(b,nav.querySelector('[data-view="simulator"]'))}
 if(window.showView&&!window.__mt5Wrapped){const old=window.showView;window.showView=function(n){old(n);if(n==="mt5")render()};window.__mt5Wrapped=true}
}
function render(){
 if(!course)return;install();
 const d=activeDevice(),p=progress(),l=course.lessons[current],root=document.getElementById("mt5View");
 root.innerHTML='<div class="sectionhead"><div><div class="eyebrow">مسار مستقل داخل MASAR PRO</div><h2>'+esc(course.title)+'</h2><p class="muted">'+esc(course.description)+'</p></div><span class="pill">'+course.lessons.length+' درساً</span></div>'+
 '<div class="card notice">'+esc(course.safety)+'<p><b>تنبيه:</b> قد تختلف أسماء القوائم ومواقع الأزرار حسب إصدار MT5 والجهاز والوسيط. الإرشادات تشرح الوظائف الأساسية ولا تمثل لقطة حرفية لكل واجهة.</p></div>'+
 '<div class="card mt5-device"><b>نسخة الشرح</b><div class="mt5-device-controls"><button data-device="auto" class="'+(device==="auto"?"selected":"")+'">تلقائي</button><button data-device="mobile" class="'+(device==="mobile"?"selected":"")+'">الهاتف</button><button data-device="desktop" class="'+(device==="desktop"?"selected":"")+'">الكمبيوتر</button></div><p class="small">الجهاز المحدد: '+(d==="mobile"?"الهاتف":"الكمبيوتر")+'. يمكنك التبديل يدوياً.</p></div>'+
 '<div class="mt5-layout"><aside class="card mt5-list"><h3>دروس الدورة</h3>'+course.lessons.map((x,i)=>'<button class="mt5-lesson-link '+(i===current?"active":"")+'" data-lesson="'+i+'"><span>'+(i+1).toString().padStart(2,"0")+'</span>'+esc(x.title)+'<small>'+(p[i]?"مكتمل":"غير مكتمل")+'</small></button>').join("")+'</aside>'+
 '<article class="card mt5-lesson"><div class="eyebrow">الدرس '+(current+1)+' من '+course.lessons.length+'</div><h2>'+esc(l.title)+'</h2><p class="muted">'+esc(l.intro)+'</p><h3>المفاهيم الأساسية</h3>'+
 l.common.map(x=>'<section class="mt5-topic"><h4>'+esc(x[0])+'</h4><p>'+esc(x[1])+'</p></section>').join("")+
 '<h3>التطبيق على '+(d==="mobile"?"الهاتف":"الكمبيوتر")+'</h3><ol class="mt5-steps">'+l[d].map(x=>'<li>'+esc(x)+'</li>').join("")+'</ol>'+
 '<div class="mt5-practice"><h3>تحقق من فهمك</h3>'+quizzes[current].map((q,i)=>'<div class="quizq"><b>'+(i+1)+'. '+esc(q[0])+'</b>'+q[1].map((o,k)=>'<label class="option"><input type="radio" name="mt5q'+i+'" value="'+k+'" '+(answers[i]===k?"checked":"")+'> '+esc(o)+'</label>').join("")+'</div>').join("")+
 '<button class="btn" id="mt5-check">تصحيح الدرس</button><p id="mt5-feedback" class="feedback" aria-live="polite"></p></div><div class="actions"><button class="btn alt" id="mt5-prev" '+(current===0?"disabled":"")+'>السابق</button><button class="btn" id="mt5-next">'+(current===course.lessons.length-1?"إنهاء العرض":"الدرس التالي")+'</button></div></article></div>'+
 '<div class="card mt5-summary"><b>التقدم في MASAR MT5:</b> '+Object.keys(p).filter(k=>p[k]).length+' / '+course.lessons.length+' دروس مكتملة. لا يوجد شرط يومي أو هدف ربح لإتمام الدورة.</div>';
 root.querySelectorAll("[data-device]").forEach(b=>b.addEventListener("click",()=>{device=b.dataset.device;answers={};render()}));
 root.querySelectorAll("[data-lesson]").forEach(b=>b.addEventListener("click",()=>{current=Number(b.dataset.lesson);answers={};render()}));
 quizzes[current].forEach((q,i)=>root.querySelectorAll('input[name="mt5q'+i+'"]').forEach(el=>el.addEventListener("change",()=>answers[i]=Number(el.value))));
 root.querySelector("#mt5-check").addEventListener("click",()=>{const out=root.querySelector("#mt5-feedback");if(quizzes[current].some((q,i)=>answers[i]===undefined)){out.textContent="أجب عن السؤالين أولاً.";return}const score=quizzes[current].filter((q,i)=>answers[i]===q[2]).length;out.textContent="نتيجتك: "+score+"/2. "+(score===2?"اجتزت الدرس.":"راجع المفاهيم وحاول مرة أخرى.");out.style.color=score===2?"var(--green)":"var(--red)";if(score===2){const st=progress();st[current]=true;save(st);root.querySelectorAll(".mt5-lesson-link")[current].querySelector("small").textContent="مكتمل";root.querySelector(".mt5-summary").innerHTML="<b>تم اجتياز الدرس.</b> حُفظ تقدمك على هذا الجهاز."}});
 root.querySelector("#mt5-prev").addEventListener("click",()=>{current=Math.max(0,current-1);answers={};render()});
 root.querySelector("#mt5-next").addEventListener("click",()=>{if(current<course.lessons.length-1){current++;answers={};render()}else root.querySelector(".mt5-summary").scrollIntoView({behavior:"smooth"})});
}
const original=window.masarInitialize;
window.masarInitialize=function(data){if(original)original(data);course=data.mt5Course||null;install();if(course)render()};
document.addEventListener("DOMContentLoaded",install);
const css=document.createElement("style");css.textContent='#mt5View{padding-bottom:30px}.mt5-device{margin:16px 0}.mt5-device-controls{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.mt5-device-controls button,.mt5-lesson-link{background:#0b1421;color:var(--text);border:1px solid var(--line);border-radius:9px;padding:10px;cursor:pointer}.mt5-device-controls button.selected,.mt5-lesson-link.active{border-color:var(--gold);color:var(--gold)}.mt5-layout{display:grid;grid-template-columns:minmax(220px,290px) 1fr;gap:14px;align-items:start}.mt5-list{position:sticky;top:12px;max-height:78vh;overflow:auto}.mt5-lesson-link{display:grid;grid-template-columns:32px 1fr;gap:6px;text-align:right;width:100%;margin:7px 0;line-height:1.5}.mt5-lesson-link small{grid-column:2;color:var(--muted)}.mt5-topic{padding:10px 0;border-bottom:1px solid var(--line)}.mt5-topic h4{margin:4px 0;color:var(--gold)}.mt5-topic p,.mt5-steps li{line-height:1.9;color:var(--text)}.mt5-steps li{padding:6px 0}.mt5-practice{margin-top:22px;padding:16px;background:#101c2c;border:1px solid var(--line);border-radius:12px}.mt5-summary{margin-top:14px}@media(max-width:800px){.mt5-layout{grid-template-columns:1fr}.mt5-list{position:static;max-height:none}.mt5-lesson{min-width:0}}';document.head.appendChild(css);
})();