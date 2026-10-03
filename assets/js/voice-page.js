
import {TurtleAudio} from "./audio.js";
const $=s=>document.querySelector(s),image=$("#voiceTurtle"),wave=$("#voiceWave"),status=$("#voiceStatus");
const audio=new TurtleAudio({image,status,wave,onProvider:p=>{$("#voiceProvider").textContent=p}});
const sample="Hello! I’m Turtle. Tell me what you’re studying, and we’ll work through it one step at a time.";
function play(){audio.speak(($("#voiceText").value||sample).trim())}
$("#voiceStart").addEventListener("click",play);$("#voicePreview").addEventListener("click",play);$("#voiceStop").addEventListener("click",()=>audio.stop());
$("#typeInstead").addEventListener("click",()=>location.href="chat.html");
