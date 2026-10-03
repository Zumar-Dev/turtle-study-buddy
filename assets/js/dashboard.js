
import {Store,profile} from "./site.js";
const p=profile(),sessions=Store.get("tsb_chat_sessions",[])||[],focus=Store.get("tsb_focus_history",[])||[];
document.querySelectorAll("[data-profile-name]").forEach(el=>el.textContent=p.nickname||"Learner");
const recent=document.querySelector("#recentLearning");
if(sessions.length){recent.innerHTML=sessions.slice().reverse().slice(0,4).map(s=>`<a class="time-log" href="chat.html"><span>${(s.title||"Study chat").replace(/[<>]/g,"")}</span><small>${new Date(s.updatedAt||s.createdAt||Date.now()).toLocaleDateString()}</small></a>`).join("")}
document.querySelector("#statSessions").textContent=String(sessions.length);
document.querySelector("#statFocus").textContent=`${Math.round(focus.reduce((a,b)=>a+(b.seconds||0),0)/60)} min`;
