
import {profile,visitorId} from "./site.js";
import {TurtleAudio} from "./audio.js";
const $=s=>document.querySelector(s);
const input=$("#studyQuery"),subject=$("#studySubject"),board=$("#boardContent"),progress=$("#studyProgress");
const teacher=$("#teacherTurtle"),status=$("#speakingLabel");
const audio=new TurtleAudio({image:teacher,status,onProvider:p=>$("#classVoiceProvider").textContent=p});
let lesson=null,step=0,practice=false;
const labels=["Explain","Show on whiteboard","Try it"];
function clean(v,max=1200){return String(v||"").replace(/\u0000/g,"").trim().slice(0,max)}
function steps(){return lesson?[lesson.explain,lesson.whiteboard,lesson.try]:[]}
function render(){
  if(!lesson)return;
  const s=steps(),content=s[step]||"";
  board.innerHTML=`<span class="board-label">${escapeHtml(subject.value.toUpperCase())} · STEP ${step+1}/3</span><div class="board-question"><small>YOUR QUESTION</small>${escapeHtml(lesson.question)}</div><div class="board-step-title">${labels[step]}</div><p class="board-text">${escapeHtml(content)}</p><div class="board-progress">${s.map((_,i)=>`<span class="${i<=step?"on":""}"></span>`).join("")}</div>`;
  progress.innerHTML=labels.map((x,i)=>`<div class="side-step ${i===step?"on":""}"><span>${i+1}. ${x}</span>${i<step?"✓":i===step?"●":""}</div>`).join("")+`<div class="side-step ${practice?"on":""}"><span>4. Practice</span>${practice?"●":""}</div>`;
  $("#studyPrev").disabled=step===0;$("#studyNext").textContent=step===2?"Start practice →":"Next step →";
  $("#practiceQuestion").textContent=practice?lesson.practiceQuestion:"Use “Start practice” after the whiteboard steps.";
  $("#practiceBox").classList.toggle("practice-hidden",!practice);$("#practiceFeedback").textContent="";
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
async function buildLesson(){
  const q=clean(input.value,600);if(!q)return;
  $("#teachBtn").disabled=true;status.textContent="Turtle is building your lesson…";board.setAttribute("aria-busy","true");
  try{
    const res=await fetch("/api/chat",{method:"POST",headers:{"content-type":"application/json","x-tsb-visitor":visitorId()},body:JSON.stringify({mode:"classroom",message:q,profile:profile(),subject:subject.value})});
    const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.message||data.error||"Classroom is temporarily unavailable.");
    lesson={...data.lesson,question:q};step=0;practice=false;render();status.textContent="🧑‍🏫 Teacher Turtle";await audio.speak(lesson.explain)
  }catch(err){status.textContent=err.message;board.innerHTML=`<span class="board-label">CLASSROOM</span><div class="board-question">${escapeHtml(q)}</div><p class="board-text">${escapeHtml(err.message)}</p>`}
  finally{$("#teachBtn").disabled=false;board.removeAttribute("aria-busy")}
}
$("#studyForm").addEventListener("submit",e=>{e.preventDefault();buildLesson()});
$("#studyNext").addEventListener("click",()=>{if(!lesson)return;if(step<2){step++;render();audio.speak(steps()[step])}else{$("#startPractice").click()}});
$("#studyPrev").addEventListener("click",()=>{if(lesson&&step>0){step--;render()}});
$("#studyHint").addEventListener("click",()=>{if(!lesson)return;$("#practiceFeedback").textContent=`💡 ${lesson.hint}`;$("#practiceFeedback").className="feedback";audio.speak(lesson.hint)});
$("#studySpeak").addEventListener("click",()=>lesson&&audio.speak(steps()[step]));
$("#studyMute").addEventListener("click",()=>audio.stop());
$("#startPractice").addEventListener("click",()=>{if(!lesson)return;practice=true;render();$("#practiceAnswer").focus();audio.speak(`Practice time. ${lesson.practiceQuestion}`)});
$("#practiceHint").addEventListener("click",()=>{if(!lesson)return;$("#practiceFeedback").textContent=`💡 ${lesson.hint}`;$("#practiceFeedback").className="feedback"});
$("#answerForm").addEventListener("submit",e=>{e.preventDefault();if(!lesson||!practice)return;const a=clean($("#practiceAnswer").value,200).toLowerCase(),expected=clean(lesson.practiceAnswer,200).toLowerCase();const good=expected&&a===expected;$("#practiceFeedback").textContent=good?"✓ Correct — nice work!":`Not quite. ${lesson.hint}`;$("#practiceFeedback").className=`feedback ${good?"good":"bad"}`;audio.speak($("#practiceFeedback").textContent)});
for(const b of document.querySelectorAll("[data-study-example]"))b.addEventListener("click",()=>{input.value=b.dataset.studyExample;buildLesson()});
let carried="";try{carried=sessionStorage.getItem("tsb_class_question")||"";if(carried)sessionStorage.removeItem("tsb_class_question")}catch{}if(carried){input.value=carried}
