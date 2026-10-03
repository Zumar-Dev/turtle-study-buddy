
import {Store,formatDuration} from "./site.js";
const $=s=>document.querySelector(s);let minutes=25,remaining=1500,deadline=0,timer=0,running=false;
const history=Store.get("tsb_focus_history",[])||[];
function render(){remaining=running?Math.max(0,Math.ceil((deadline-Date.now())/1000)):remaining;$("#timerValue").textContent=formatDuration(remaining);$("#timerRing").style.setProperty("--pct",`${Math.min(100,Math.max(0,(minutes*60-remaining)/(minutes*60)*100))}%`);if(running&&remaining<=0)finish(true)}
function choose(m){pause();minutes=m;remaining=m*60;document.querySelectorAll("[data-minutes]").forEach(b=>b.classList.toggle("selected",Number(b.dataset.minutes)===m));render();$("#focusStatus").textContent=`${m}-minute study block ready.`}
function start(){if(remaining<=0)remaining=minutes*60;if(running)return;deadline=Date.now()+remaining*1000;running=true;$("#focusStart").textContent="Pause";timer=setInterval(render,250);$("#focusStatus").textContent="Focus time is running."}
function pause(){if(running){render();running=false;clearInterval(timer);$("#focusStart").textContent="Resume";$("#focusStatus").textContent="Paused."}}
function finish(completed=false){render();running=false;clearInterval(timer);const done=Math.max(0,minutes*60-remaining);history.push({at:Date.now(),subject:$("#focusSubject").value,goal:$("#focusGoal").value.trim(),seconds:done,completed});Store.set("tsb_focus_history",history.slice(-50));remaining=completed?0:remaining;$("#focusStart").textContent="Start";$("#focusStatus").textContent=completed?"Study block complete. Nice work.":"Study block saved.";renderHistory()}
function renderHistory(){const host=$("#focusHistory");host.innerHTML=history.slice().reverse().slice(0,8).map(x=>`<div class="time-log"><span>${String(x.subject).replace(/[<>]/g,"")}</span><small>${Math.round((x.seconds||0)/60)} min</small></div>`).join("")||'<p class="small-muted">No focus sessions yet.</p>'}
document.querySelectorAll("[data-minutes]").forEach(b=>b.addEventListener("click",()=>choose(Number(b.dataset.minutes))));
$("#focusStart").addEventListener("click",()=>running?pause():start());$("#focusFinish").addEventListener("click",()=>finish(false));choose(25);renderHistory();
