
import {TurtleRig} from "./turtle-rig.js";
import {TurtleVoice} from "./voice-engine.js";
const $=s=>document.querySelector(s);
let rig,voice;
function setStatus(t,state=""){const e=$("#voiceStatus");e.textContent=t;e.className=`status ${state}`}
function setProgress(p){$("#voiceProgress").style.width=`${Math.max(0,Math.min(100,p))}%`}
function readout(v){$("#viseme").textContent=v.viseme||"idle";$("#phoneme").textContent=v.phoneme||"—";$("#word").textContent=v.word||"—"}
(async()=>{
  try{
    rig=await new TurtleRig($("#voiceTurtle")).init();
    voice=new TurtleVoice(rig,{onStatus:setStatus,onProgress:setProgress,onReadout:readout});
    rig.wave();
  }catch(e){setStatus(`Turtle rig error: ${e.message}`,"error")}
})();
$("#speakForm")?.addEventListener("submit",async e=>{
  e.preventDefault();
  const text=$("#speechText").value.trim().slice(0,500);
  if(!text||!voice)return;
  $("#speakBtn").disabled=true;
  try{await voice.speak(text,{voice:$("#voiceChoice").value,speed:Number($("#voiceSpeed").value)})}
  catch(err){setStatus(`Voice failed: ${err.message}`,"error")}
  finally{$("#speakBtn").disabled=false}
});
$("#stopVoice")?.addEventListener("click",()=>{voice?.stop();setStatus("Stopped.")});
$("#waveVoice")?.addEventListener("click",()=>rig?.wave());
$("#voiceSpeed")?.addEventListener("input",()=>$("#speedLabel").textContent=Number($("#voiceSpeed").value).toFixed(2));
