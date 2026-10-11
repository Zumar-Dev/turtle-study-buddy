import {Store,profile} from "./site.js";
import {isSignedIn,hydrateFromCloud,currentEmail} from "./supabase.js";
const $=s=>document.querySelector(s);
function escapeText(v){return String(v||"").replace(/[<>]/g,"")}
function render(){
  const p=profile(),sessions=Store.get("tsb_chat_sessions",[])||[],focus=Store.get("tsb_focus_history",[])||[];
  document.querySelectorAll("[data-profile-name]").forEach(el=>el.textContent=p.nickname||"Learner");
  const recent=$("#recentLearning");
  if(sessions.length){recent.innerHTML=sessions.slice().reverse().slice(0,4).map(s=>`<a class="time-log" href="chat.html"><span>${escapeText(s.title||"Study chat")}</span><small>${new Date(s.updatedAt||s.createdAt||Date.now()).toLocaleDateString()}</small></a>`).join("")}
  else recent.innerHTML="Your real chats will appear here after you ask a question.";
  $("#statSessions").textContent=String(sessions.length);
  $("#statFocus").textContent=`${Math.round(focus.reduce((a,b)=>a+(b.seconds||0),0)/60)} min`;
  const badge=$("#accountBadge");if(badge){badge.textContent=isSignedIn()?`Synced account${currentEmail()?` · ${currentEmail()}`:""}`:"Guest · this browser only";badge.classList.toggle("free-pill",isSignedIn())}
}
async function init(){render();if(isSignedIn()){try{await hydrateFromCloud();render()}catch(err){console.warn("Dashboard sync",err)}}}
init();
