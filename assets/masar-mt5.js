(function(){
"use strict";
let guides=[],device="auto";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const detect=()=>/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||(/Macintosh/i.test(navigator.userAgent)&&navigator.maxTouchPoints>1)?"mobile":"desktop";
function render(index){
 const guide=guides[index]; if(!guide)return;
 const root=document.getElementById("lessonContent"); if(!root)return;
 const d=device==="auto"?detect():device;
 let panel=document.getElementById("masarMt5Practice");
 if(panel)panel.remove();
 panel=document.createElement("section");panel.id="masarMt5Practice";panel.className="mt5-practice";
 panel.innerHTML='<div class="mt5-practice-head"><div><span class="eyebrow">تطبيق عملي داخل الوحدة</span><h3>التطبيق على MetaTrader 5: '+esc(guide.title)+'</h3></div><div class="mt5-device-controls" aria-label="اختيار الجهاز"><button type="button" data-device="auto" class="'+(device==="auto"?"selected":"")+'">تلقائي</button><button type="button" data-device="mobile" class="'+(device==="mobile"?"selected":"")+'">الهاتف</button><button type="button" data-device="desktop" class="'+(device==="desktop"?"selected":"")+'">الكمبيوتر</button></div></div>'+
 '<p class="small">عرض التعليمات: '+(d==="mobile"?"الهاتف":"الكمبيوتر")+'. يمكنك تغيير الاختيار يدوياً.</p>'+
 '<h4>قبل التطبيق</h4><p>'+esc(guide.common)+'</p><h4>خطوات التطبيق على '+(d==="mobile"?"الهاتف":"الكمبيوتر")+'</h4><p>'+esc(guide[d])+'</p>'+
 '<p class="small">التطبيق تعليمي على حساب Demo فقط. قد تختلف أسماء القوائم حسب إصدار MT5 والوسيط.</p>';
 root.appendChild(panel);
 panel.querySelectorAll("[data-device]").forEach(b=>b.addEventListener("click",()=>{device=b.dataset.device;render(index)}));
}
const oldInit=window.masarInitialize;
window.masarInitialize=function(data){if(oldInit)oldInit(data);guides=Array.isArray(data.mt5UnitGuides)?data.mt5UnitGuides:[];};
const oldOpen=window.openUnit;
if(typeof oldOpen==="function"&&!window.__masarMt5Integrated){window.openUnit=function(i){oldOpen(i);render(i)};window.__masarMt5Integrated=true;}
const css=document.createElement("style");
css.textContent='#masarMt5Practice{margin-top:20px;padding:16px;background:linear-gradient(145deg,#17283d,#101c2b);border:1px solid #53617a;border-radius:14px}#masarMt5Practice h3{margin:5px 0 8px;color:var(--gold2)}#masarMt5Practice h4{margin:12px 0 4px;color:var(--gold)}#masarMt5Practice p{line-height:1.9}.mt5-practice-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.mt5-device-controls{display:flex;gap:6px;flex-wrap:wrap}.mt5-device-controls button{background:#0b1421;color:var(--text);border:1px solid var(--line);border-radius:8px;padding:6px 10px}.mt5-device-controls button.selected{border-color:var(--gold);color:var(--gold2)}';
document.head.appendChild(css);
})();