
import {Store,profile} from "./site.js";
const $=s=>document.querySelector(s),p=profile();
$("#nickname").value=p.nickname||"";$("#age").value=p.age||"13-15";$("#subject").value=p.subject||"Math";$("#style").value=p.style||"Step by step";
if(p.photo)$("#profilePreview").src=p.photo;
$("#profileForm")?.addEventListener("submit",e=>{e.preventDefault();const next={...p,nickname:$("#nickname").value.trim().slice(0,24)||"Learner",age:$("#age").value,subject:$("#subject").value,style:$("#style").value};Store.set("tsb_profile",next);$("#saveStatus").textContent="Saved on this device.";setTimeout(()=>$("#saveStatus").textContent="",1800)});
$("#clearProfile")?.addEventListener("click",()=>{if(confirm("Delete your local Turtle profile and app history from this browser?")){["tsb_profile","tsb_chat_sessions","tsb_focus_history"].forEach(Store.del);location.href="start.html"}})
