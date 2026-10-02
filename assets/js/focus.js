
const $=s=>document.querySelector(s);
let total=25*60,remaining=total,running=false,timer=null;
function format(){const m=Math.floor(remaining/60).toString().padStart(2,"0");const s=(remaining%60).toString().padStart(2,"0");$("#timer").textContent=`${m}:${s}`}
function stop(){running=false;clearInterval(timer);timer=null;$("#toggleTimer").textContent="Start focus"}
function setMinutes(min){stop();total=min*60;remaining=total;format();$("#timerStatus").textContent=`${min}-minute focus session ready.`}
function start(){
  if(remaining<=0) remaining=total; // bug fix: completed timer starts again
  running=true;$("#toggleTimer").textContent="Pause";
  timer=setInterval(()=>{remaining=Math.max(0,remaining-1);format();if(remaining===0){stop();$("#timerStatus").textContent="Focus session complete. Nice work.";document.title="Done — Turtle Study Buddy"}},1000)
}
$("#toggleTimer")?.addEventListener("click",()=>running?stop():start());
$("#resetTimer")?.addEventListener("click",()=>setMinutes(Math.round(total/60)));
document.querySelectorAll("[data-minutes]").forEach(b=>b.addEventListener("click",()=>setMinutes(Number(b.dataset.minutes))));
format();
