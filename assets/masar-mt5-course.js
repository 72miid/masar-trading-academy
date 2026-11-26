(function(){
"use strict";
const KEY="masar_mt5_course_v1";let course=null,state={completed:[],scores:[],finalScore:null};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function read(){try{const v=JSON.parse(localStorage.getItem(KEY)||"{}");return {completed:Array.isArray(v.completed)?v.completed:[],scores:v.scores&&typeof v.scores==="object"?v.scores:{},finalScore:Number.isFinite(v.finalScore)?v.finalScore:null}}catch{return {completed:[],scores:{},finalScore:null}}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function render(){
 if(!course)return;
 document.getElementById("mt5CourseTitle").textContent=course.title;
 document.getElementById("mt5CourseIntro").textContent=course.intro;
 document.getElementById("mt5CourseProgress").textContent=state.completed.length+" / "+course.lessons.length+" مكتملة";
 document.getElementById("mt5CourseLessons").innerHTML=course.lessons.map(l=>'<article class="card unit"><div class="num">الدرس '+l.id+'</div><h3>'+esc(l.title)+'</h3><div class="lessonbody mt5-course-body">'+format(l.body)+'</div><button class="btn '+(state.completed.includes(l.id)?"alt":"")+'" data-complete="'+l.id+'">'+(state.completed.includes(l.id)?"تمت القراءة ✓":"إكمال الدرس")+'</button></article>').join("");
 document.querySelectorAll("[data-complete]").forEach(b=>b.addEventListener("click",()=>{const id=Number(b.dataset.complete);state.completed=state.completed.includes(id)?state.completed.filter(x=>x!==id):[...state.completed,id].sort((a,b)=>a-b);save();render()}));
 const host=document.getElementById("mt5CourseExamQuestions");
 host.innerHTML=course.exam.map((q,i)=>'<div class="quizq"><b>'+(i+1)+'. '+esc(q[0])+'</b>'+q[1].map((a,j)=>'<label class="option"><input type="radio" name="mt5q'+i+'" value="'+j+'"> '+esc(a)+'</label>').join("")+'</div>').join("");
 document.getElementById("mt5CourseExamSubmit").disabled=state.completed.length!==course.lessons.length;
 document.getElementById("mt5CourseExamFeedback").textContent=state.finalScore===null?"":("آخر نتيجة: "+state.finalScore+"/10"+(state.finalScore>=course.passingScore?" — اجتزت الاختبار.":" — راجع الدروس وأعد المحاولة."));
}
function format(text){return String(text).split(/\n/).map(line=>{const s=line.trim();if(!s)return "";if(s.startsWith("- "))return "<p>• "+esc(s.slice(2))+"</p>";return "<p>"+esc(s.replace(/^\*\*|\*\*$/g,""))+"</p>"}).join("")}
function submit(){if(state.completed.length!==course.lessons.length){document.getElementById("mt5CourseExamFeedback").textContent="أكمل الدروس الاثني عشر أولاً.";return}let score=0;course.exam.forEach((q,i)=>{const a=document.querySelector('input[name="mt5q'+i+'"]:checked');if(a&&Number(a.value)===q[2])score++});state.finalScore=score;save();render()}
const oldInit=window.masarInitialize;
window.masarInitialize=function(data){if(oldInit)oldInit(data);course=data?.mt5Course||null;state=read();render();};
document.addEventListener("DOMContentLoaded",()=>{const btn=document.getElementById("mt5CourseExamSubmit");if(btn)btn.addEventListener("click",submit)});
const css=document.createElement("style");css.textContent=".mt5-course-body{margin:12px 0}.mt5-course-body p{margin:8px 0;color:#d4dce7}.mt5-course-body p:first-child{font-weight:600;color:var(--gold2)}#mt5CourseLessons .card{align-self:start}#mt5CourseExamSubmit:disabled{opacity:.5;cursor:not-allowed}";document.head.appendChild(css);
})();