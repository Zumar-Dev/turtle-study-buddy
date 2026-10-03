import {visitorId} from "./site.js";

const textEncoder=new TextEncoder();
async function digest(text){
  if(globalThis.crypto?.subtle){
    const buf=await crypto.subtle.digest("SHA-256",textEncoder.encode(text));
    return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,"0")).join("");
  }
  let h=2166136261;for(const ch of text){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return Math.abs(h>>>0).toString(16);
}
function clean(v){return String(v||"").replace(/\s+/g," ").trim().slice(0,250)}
function chooseBrowserVoice(){
  const voices=speechSynthesis.getVoices();
  const score=v=>{
    const n=`${v.name} ${v.voiceURI}`.toLowerCase();let s=0;
    if(/^en/i.test(v.lang||""))s+=60;if(/en-us/i.test(v.lang||""))s+=10;if(v.localService)s+=15;
    if(/ana|ava|jenny|aria|zira|samantha|sonia|young|child|female/.test(n))s+=35;
    if(/david|mark|daniel|male/.test(n))s-=10;return s;
  };
  return voices.slice().sort((a,b)=>score(b)-score(a))[0]||null;
}
async function voicesReady(){
  if(!("speechSynthesis"in window))return[];
  let v=speechSynthesis.getVoices();if(v.length)return v;
  await new Promise(resolve=>{const t=setTimeout(resolve,900);speechSynthesis.addEventListener?.("voiceschanged",()=>{clearTimeout(t);resolve()},{once:true})});
  return speechSynthesis.getVoices();
}
export class TurtleAudio{
  constructor({image,status,wave,onProvider}={}){
    this.image=image;this.status=status;this.wave=wave;this.onProvider=onProvider||(()=>{});
    this.audio=null;this.source=null;this.utterance=null;this.ctx=null;
    const unlock=()=>this.unlock();
    document.addEventListener("pointerdown",unlock,{passive:true});
    document.addEventListener("keydown",unlock,{passive:true});
  }
  unlock(){
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(!Ctx)return;
      this.ctx??=new Ctx();
      if(this.ctx.state!=="running")this.ctx.resume().catch(()=>{});
    }catch{}
  }
  setSpeaking(on){
    this.image?.classList.toggle("speaking-glow",!!on);
    this.wave?.classList.toggle("active",!!on);
  }
  setStatus(msg){if(this.status)this.status.textContent=msg}
  stop(){
    try{this.source?.stop()}catch{};this.source=null;
    try{this.audio?.pause()}catch{};this.audio=null;
    try{speechSynthesis.cancel()}catch{};this.utterance=null;this.setSpeaking(false);
  }
  async playServer(res,cleanText){
    const provider=res.headers.get("x-tsb-voice-provider")||"server voice";
    const bytes=await res.arrayBuffer();
    this.onProvider(provider);this.setStatus(`Voice: ${provider}.`);
    this.unlock();
    if(this.ctx){
      try{
        await this.ctx.resume();
        const decoded=await this.ctx.decodeAudioData(bytes.slice(0));
        const source=this.ctx.createBufferSource();source.buffer=decoded;
        if(provider.toLowerCase().includes("cloudflare aura"))source.playbackRate.value=1.05;
        source.connect(this.ctx.destination);this.source=source;
        source.onended=()=>{if(this.source===source)this.source=null;this.setSpeaking(false);this.setStatus(`Finished · ${provider}.`)};
        this.setSpeaking(true);source.start(0);return true;
      }catch(err){console.warn("Web Audio playback fallback",err)}
    }
    try{
      const blob=new Blob([bytes],{type:res.headers.get("content-type")||"audio/mpeg"}),url=URL.createObjectURL(blob),audio=new Audio(url);
      if(provider.toLowerCase().includes("cloudflare aura")){audio.playbackRate=1.05;try{audio.preservesPitch=false}catch{}}
      this.audio=audio;audio.onplay=()=>this.setSpeaking(true);audio.onended=()=>{this.setSpeaking(false);URL.revokeObjectURL(url);this.setStatus(`Finished · ${provider}.`)};
      audio.onerror=()=>{this.setSpeaking(false);URL.revokeObjectURL(url);this.browser(cleanText,"Server audio could not play.")};
      await audio.play();return true;
    }catch(err){console.warn("HTML audio fallback",err);return false}
  }
  async speak(text){
    const cleanText=clean(text);if(!cleanText)return;
    this.stop();this.unlock();let fallbackReason="";
    try{
      const key=await digest(cleanText),cache=typeof caches!=="undefined"?await caches.open("tsb-tts-v2"):null,cacheReq=new Request(`${location.origin}/__tts-cache/${key}`);
      let res=cache?await cache.match(cacheReq):null;
      if(!res){
        res=await fetch("/api/tts",{method:"POST",headers:{"content-type":"application/json","x-tsb-visitor":visitorId()},body:JSON.stringify({text:cleanText})});
        if(res.ok&&(res.headers.get("content-type")||"").startsWith("audio/"))await cache?.put(cacheReq,res.clone());
      }
      if(res?.ok&&(res.headers.get("content-type")||"").startsWith("audio/")){
        if(await this.playServer(res,cleanText))return;
        fallbackReason="Server audio could not play on this device.";
      }else{
        const data=await res?.json().catch(()=>({}));
        if(res?.status===429)fallbackReason=data.message||"The free voice limit has been reached for today.";
        else if(data?.message)fallbackReason=data.message;
      }
      if(fallbackReason)this.setStatus(`${fallbackReason} Using the browser voice instead.`);
    }catch(err){console.warn("Server voice fallback",err);fallbackReason="Cloud voice is unavailable right now."}
    return this.browser(cleanText,fallbackReason);
  }
  async browser(text,reason=""){
    if(!("speechSynthesis"in window)){this.setStatus("Voice is not available in this browser.");return}
    await voicesReady();const u=new SpeechSynthesisUtterance(text),v=chooseBrowserVoice();if(v){u.voice=v;u.lang=v.lang||"en-US"}else u.lang="en-US";
    u.rate=.94;u.pitch=1.28;u.volume=1;this.utterance=u;const name=v?.name||"browser voice";this.onProvider(`browser · ${name}`);
    u.onstart=()=>{this.setSpeaking(true);this.setStatus(reason?`${reason} Using browser voice: ${name}.`:`Voice: browser · ${name}.`)};
    u.onend=()=>{this.setSpeaking(false);this.setStatus(`Finished · browser · ${name}.`)};
    u.onerror=()=>{this.setSpeaking(false);this.setStatus("The browser voice could not start.")};
    speechSynthesis.cancel();speechSynthesis.speak(u);
  }
}
