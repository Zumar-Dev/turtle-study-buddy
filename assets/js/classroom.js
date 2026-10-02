import {Store} from "./site.js";
import {TurtleRig} from "./turtle-rig.js";
const $=s=>document.querySelector(s);
const input=$("#classQuestion"),out=$("#classLesson"),title=$("#boardQuestion"),button=$("#teachBtn"),status=$("#classStatus");
let rig=null;
function clean(v,max=1000){return String(v||"").replace(/\u0000/g,"").trim().slice(0,max)}
function visitorId(){let id=Store.get("tsb_visitor_id","");if(!id){id=(crypto.randomUUID?.()||`v-${Date.now()}-${Math.random().toString(36).slice(2)}`);Store.set("tsb_visitor_id",id)}return id}
function profile(){return Store.get("tsb_profile",{})||{}}
function section(label,text){const wrap=document.createElement("section");const h=document.createElement("strong");h.textContent=label;const p=document.createElement("p");p.textContent=text;wrap.append(h,p);return wrap}
function renderLesson(lesson){out.replaceChildren(section("Explain",lesson.explain),section("Demonstrate",lesson.demonstrate),section("Try",lesson.try));}
async function teach(){
  const q=clean(input.value,600);if(!q)return;
  title.textContent=q;button.disabled=true;status.textContent="Turtle is building your lesson…";out.setAttribute("aria-busy","true");
  try{
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
    const res=await fetch("/api/chat",{method:"POST",headers:{"content-type":"application/json","x-tsb-visitor":visitorId()},body:JSON.stringify({mode:"classroom",message:q,profile:profile()}),signal:controller.signal});
    clearTimeout(timer);const data=await res.json().catch(()=>({}));
    if(!res.ok){if(res.status===429){status.textContent=data.message||"Turtle has reached a free usage limit. Please try again later.";return}throw new Error(data.error||`Tutor service ${res.status}`)}
    if(!data.lesson?.explain||!data.lesson?.demonstrate||!data.lesson?.try)throw new Error("The lesson response was incomplete.");
    renderLesson(data.lesson);status.textContent="Lesson ready.";rig?.wave();
  }catch(err){status.textContent=err.name==="AbortError"?"The lesson took too long. Please try again.":`Classroom is temporarily unavailable: ${err.message}`}
  finally{button.disabled=false;out.removeAttribute("aria-busy")}
}
button?.addEventListener("click",teach);
input?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();teach()}});
(async()=>{try{rig=await new TurtleRig($("#classTurtle")).init()}catch(e){console.warn(e)}})();