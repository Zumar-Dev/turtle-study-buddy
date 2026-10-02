const NEURAL_MODULE="https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/+esm";
const NEURAL_TIMEOUT_MS=15_000;
const VISEME_TO_MOUTH={sil:"closed",PP:"closed",FF:"small",TH:"small",DD:"small",kk:"small",CH:"small",SS:"small",nn:"small",RR:"small",aa:"wide",E:"open",I:"small",O:"open",U:"small"};
const RHYTHM=["small","open","wide","open","small","closed","small","open"];

function timeout(promise,ms,message){
  let id;
  const gate=new Promise((_,reject)=>{id=setTimeout(()=>reject(new Error(message)),ms)});
  return Promise.race([promise,gate]).finally(()=>clearTimeout(id));
}
function isMobile(){return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||"")}
function cleanText(v){return String(v||"").replace(/\s+/g," ").trim().slice(0,700)}

export class TurtleVoice{
  constructor(rig,{onStatus,onProgress,onReadout}={}){
    this.rig=rig;
    this.onStatus=onStatus||(()=>{});
    this.onProgress=onProgress||(()=>{});
    this.onReadout=onReadout||(()=>{});
    this.tts=null;this.audioCtx=null;this.connected=false;this.connecting=null;
    this.source=null;this.raf=0;this.speaking=false;this.neuralFailed=false;
    this.utterance=null;this.rhythmTimer=0;this.lastBoundary=0;this.rhythmIndex=0;
  }
  async speak(text,{voice="af_sky",speed=.96}={}){
    const clean=cleanText(text);if(!clean)return;
    this.stop();

    const canTryNeural=!!navigator.gpu&&!isMobile()&&!this.neuralFailed;
    if(canTryNeural){
      try{
        await this._speakNeural(clean,{voice,speed});
        return;
      }catch(err){
        console.warn("Neural voice unavailable; falling back",err);
        this.neuralFailed=true;
        this.onProgress(100);
        this.onStatus(`Neural voice did not load within 15 seconds or failed. Using your browser voice instead.`,"fallback");
      }
    }else if(!navigator.gpu){
      this.onStatus("WebGPU is not available here. Using your browser voice instead.","fallback");
    }else if(isMobile()){
      this.onStatus("Mobile browser detected. Using the built-in browser voice for faster startup.","fallback");
    }
    await this._speakBrowser(clean,{voice,speed});
  }
  async _ensureNeural(){
    if(this.connected)return;
    if(this.connecting)return this.connecting;
    this.connecting=(async()=>{
      const started=Date.now();
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      if(!AudioCtx)throw new Error("Web Audio is unavailable.");
      this.audioCtx??=new AudioCtx();
      await this.audioCtx.resume();
      this.onStatus("Loading the free neural voice with WebGPU…","loading");
      this.onProgress(5);
      const remain=()=>Math.max(1,NEURAL_TIMEOUT_MS-(Date.now()-started));
      const mod=await timeout(import(NEURAL_MODULE),remain(),"Neural voice download timed out.");
      const {HeadTTS}=mod;
      this.tts=new HeadTTS({
        endpoints:["webgpu","wasm"],languages:["en-us"],voices:["af_sky","af_heart","af_bella"],
        audioCtx:this.audioCtx,
        workerModule:"https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/modules/worker-tts.mjs",
        dictionaryURL:"https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/dictionaries/",
        dtypeWebgpu:"q8",dtypeWasm:"q4",defaultVoice:"af_sky",defaultLanguage:"en-us",defaultSpeed:.96,
        defaultAudioEncoding:"wav",splitSentences:false,trace:0
      });
      this.tts.onerror=err=>console.warn("HeadTTS",err);
      let pct=5;
      await timeout(this.tts.connect(null,ev=>{
        if(ev?.lengthComputable&&ev.total)pct=Math.max(pct,Math.min(92,Math.round(ev.loaded/ev.total*92)));
        else pct=Math.min(92,pct+2);
        this.onProgress(pct);
      }),remain(),"Neural voice model loading timed out.");
      this.connected=true;
      this.onProgress(100);
    })();
    try{await this.connecting}finally{this.connecting=null}
  }
  async _speakNeural(clean,{voice,speed}){
    await this._ensureNeural();
    await this.audioCtx.resume();
    this.onStatus("Generating Turtle voice…","loading");
    this.onProgress(12);
    await this.tts.setup({voice,language:"en-us",speed:Number(speed)||.96,audioEncoding:"wav"});
    const messages=await timeout(this.tts.synthesize({input:clean}),15_000,"Neural speech generation timed out.");
    const audioMsg=messages.find(m=>m.type==="audio"&&m.data?.audio);
    if(!audioMsg)throw new Error(messages.find(m=>m.type==="error")?.data?.error||"No neural speech audio was returned.");
    const data=audioMsg.data;
    const source=this.audioCtx.createBufferSource();
    source.buffer=data.audio;source.connect(this.audioCtx.destination);this.source=source;
    const startAt=this.audioCtx.currentTime+.08;
    this.speaking=true;this.rig?.speaking(true);this.onProgress(100);
    this.onStatus("Turtle is speaking with the neural voice…","speaking");
    source.onended=()=>{this.stop(false);this.onStatus("Finished.","")};
    source.start(startAt);this._syncNeural(data,startAt);
  }
  _syncNeural(data,startAt){
    cancelAnimationFrame(this.raf);
    const frame=()=>{
      if(!this.speaking)return;
      const ms=Math.max(0,(this.audioCtx.currentTime-startAt)*1000);
      let vi=-1,wi=-1;
      if(data.vtimes?.length){let lo=0,hi=data.vtimes.length-1;while(lo<=hi){const mid=(lo+hi)>>1;if(data.vtimes[mid]<=ms){vi=mid;lo=mid+1}else hi=mid-1}}
      if(data.wtimes?.length){let lo=0,hi=data.wtimes.length-1;while(lo<=hi){const mid=(lo+hi)>>1;if(data.wtimes[mid]<=ms){wi=mid;lo=mid+1}else hi=mid-1}}
      if(vi>=0){const v=data.visemes?.[vi]||"DD";this.rig?.setMouth(VISEME_TO_MOUTH[v]||"small");this.onReadout({viseme:v,phoneme:data.phonemes?.[vi]||"—",word:wi>=0?(data.words?.[wi]||"—"):"—"})}
      this.raf=requestAnimationFrame(frame);
    };
    this.raf=requestAnimationFrame(frame);
  }
  async _voices(){
    const synth=window.speechSynthesis;if(!synth)return[];
    let voices=synth.getVoices();
    if(voices.length)return voices;
    await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;resolve()};const old=synth.onvoiceschanged;synth.onvoiceschanged=()=>{try{old?.()}catch{}finish()};setTimeout(finish,1200)});
    return synth.getVoices();
  }
  _pickVoice(voices){
    const score=v=>{const n=`${v.name} ${v.voiceURI}`.toLowerCase();let s=0;if(/^en\b/i.test(v.lang||""))s+=80;if(/en-us/i.test(v.lang||""))s+=20;if(v.localService)s+=30;if(/jenny|aria|zira|ava|samantha|sonia|female|young|youth/.test(n))s+=35;if(/google us english|microsoft/.test(n))s+=12;if(/david|mark|daniel|male/.test(n))s-=12;return s};
    return voices.slice().sort((a,b)=>score(b)-score(a))[0]||null;
  }
  async _speakBrowser(clean,{voice,speed}){
    const synth=window.speechSynthesis;
    if(!synth||!window.SpeechSynthesisUtterance)throw new Error("Built-in browser speech is not supported on this device.");
    const voices=await this._voices();
    const chosen=this._pickVoice(voices);
    synth.cancel();
    try{synth.resume()}catch{}
    await new Promise(r=>setTimeout(r,80));
    const u=new SpeechSynthesisUtterance(clean);this.utterance=u;
    if(chosen){u.voice=chosen;u.lang=chosen.lang||"en-US"}else u.lang="en-US";
    u.rate=Math.max(.82,Math.min(1.12,Number(speed)||.96));
    u.pitch=voice==="af_sky"?1.24:voice==="af_heart"?1.13:1.08;
    u.volume=1;
    let started=false;
    return new Promise((resolve,reject)=>{
      const startGuard=setTimeout(()=>{if(!started){try{synth.cancel()}catch{};this._stopBrowserRhythm();reject(new Error("Browser voice did not start. Check that media volume is on."))}},3500);
      u.onstart=()=>{
        started=true;clearTimeout(startGuard);this.speaking=true;this.lastBoundary=0;this.rhythmIndex=0;
        this.rig?.speaking(true);this.onProgress(100);
        this.onStatus(`Using ${chosen?.name||"the built-in browser voice"} — speaking now.`,"speaking");
        this._startBrowserRhythm();
      };
      u.onboundary=e=>{
        this.lastBoundary=performance.now();
        const ch=clean.slice(e.charIndex||0,(e.charIndex||0)+1).toLowerCase();
        const shape=/[aou]/.test(ch)?"wide":/[ei]/.test(ch)?"open":RHYTHM[this.rhythmIndex++%RHYTHM.length];
        this.rig?.setMouth(shape);
        this.onReadout({viseme:"browser",phoneme:"boundary",word:clean.slice(e.charIndex||0).split(/\s/)[0]||"—"});
      };
      u.onend=()=>{clearTimeout(startGuard);this._stopBrowserRhythm();this.speaking=false;this.rig?.speaking(false);this.onReadout({viseme:"idle",phoneme:"—",word:"—"});this.onStatus("Finished with browser voice.","");resolve()};
      u.onerror=e=>{clearTimeout(startGuard);this._stopBrowserRhythm();this.speaking=false;this.rig?.speaking(false);if(["canceled","interrupted"].includes(e.error)){resolve();return}reject(new Error(e.error||"Browser voice failed."))};
      synth.speak(u);
    });
  }
  _startBrowserRhythm(){
    this._stopBrowserRhythm();
    this.rhythmTimer=setInterval(()=>{
      if(!this.speaking)return;
      if(performance.now()-this.lastBoundary>150){this.rig?.setMouth(RHYTHM[this.rhythmIndex++%RHYTHM.length])}
    },105);
  }
  _stopBrowserRhythm(){clearInterval(this.rhythmTimer);this.rhythmTimer=0}
  stop(reset=true){
    this.speaking=false;cancelAnimationFrame(this.raf);this._stopBrowserRhythm();
    if(this.source){try{this.source.stop()}catch{}try{this.source.disconnect()}catch{}this.source=null}
    try{this.tts?.clear()}catch{}try{window.speechSynthesis?.cancel()}catch{}
    this.utterance=null;this.rig?.speaking(false);
    if(reset)this.onReadout({viseme:"idle",phoneme:"—",word:"—"});
  }
}