const NEURAL_MODULE="https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/+esm";
const NEURAL_TIMEOUT_MS=15_000;

const HEAD_VISEME_TO_SIMPLE={
  sil:"rest",PP:"MBP",FF:"FV",TH:"EE",DD:"EE",kk:"AA",CH:"EE",SS:"EE",nn:"EE",RR:"OH",
  aa:"AA",E:"EE",I:"EE",O:"OH",U:"OH"
};

function timeout(promise,ms,message){
  let id;
  const gate=new Promise((_,reject)=>{id=setTimeout(()=>reject(new Error(message)),ms)});
  return Promise.race([promise,gate]).finally(()=>clearTimeout(id));
}

function isMobile(){return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||"")}
function cleanText(v){return String(v||"").replace(/\s+/g," ").trim().slice(0,700)}

function wordAt(text,index){
  const start=Math.max(0,Number(index)||0);
  const tail=text.slice(start);
  const m=tail.match(/^\s*([^\s,.;:!?]+)/);
  if(m?.[1])return m[1];
  return text.slice(0,start).trim().split(/\s+/).pop()||"";
}

function wordIndexAt(text,index){
  const before=text.slice(0,Math.max(0,Number(index)||0)).trim();
  return before?before.split(/\s+/).length:0;
}

function charToViseme(ch){
  const c=String(ch||"").toLowerCase();
  if(/[mbp]/.test(c))return "MBP";
  if(/[fv]/.test(c))return "FV";
  if(/[ouqwr]/.test(c))return "OH";
  if(/[eiy]/.test(c))return "EE";
  if(/[a]/.test(c))return "AA";
  if(/[dtlnszcjxkg]/.test(c))return "EE";
  if(/[h]/.test(c))return "AA";
  return "rest";
}

function wordToVisemes(word){
  const clean=String(word||"").toLowerCase().replace(/[^a-z]/g,"");
  if(!clean)return ["rest"];
  const seq=[];
  for(const ch of clean){
    const v=charToViseme(ch);
    if(v!==seq[seq.length-1])seq.push(v);
  }
  if(!seq.length)seq.push("EE");
  if(seq[seq.length-1]!=="rest")seq.push("rest");
  return seq;
}

export class TurtleVoice{
  constructor(rig,{onStatus,onProgress,onReadout}={}){
    this.rig=rig;
    this.onStatus=onStatus||(()=>{});
    this.onProgress=onProgress||(()=>{});
    this.onReadout=onReadout||(()=>{});
    this.tts=null;
    this.audioCtx=null;
    this.connected=false;
    this.connecting=null;
    this.source=null;
    this.analyser=null;
    this.raf=0;
    this.speaking=false;
    this.neuralFailed=false;
    this.utterance=null;
    this.browserTimer=0;
    this.browserState=null;
    this.lastEnergyViseme="rest";
    this.energyFlip=false;
  }

  async speak(text,{voice="af_sky",speed=.96}={}){
    const clean=cleanText(text);
    if(!clean)return;
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
        this.onStatus("Neural voice did not load within 15 seconds or failed. Using your browser voice instead.","fallback");
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
        endpoints:["webgpu","wasm"],
        languages:["en-us"],
        voices:["af_sky","af_heart","af_bella"],
        audioCtx:this.audioCtx,
        workerModule:"https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/modules/worker-tts.mjs",
        dictionaryURL:"https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/dictionaries/",
        dtypeWebgpu:"q8",
        dtypeWasm:"q4",
        defaultVoice:"af_sky",
        defaultLanguage:"en-us",
        defaultSpeed:.96,
        defaultAudioEncoding:"wav",
        splitSentences:false,
        trace:0
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
    const analyser=this.audioCtx.createAnalyser();
    analyser.fftSize=256;
    analyser.smoothingTimeConstant=.45;

    source.buffer=data.audio;
    source.connect(analyser);
    analyser.connect(this.audioCtx.destination);
    this.source=source;
    this.analyser=analyser;

    const startAt=this.audioCtx.currentTime+.08;
    this.speaking=true;
    this.rig?.speaking(true);
    this.onProgress(100);
    this.onStatus("Turtle is speaking with the neural voice…","speaking");

    source.onended=()=>{
      this.stop(false);
      this.onReadout({viseme:"rest",phoneme:"—",word:"—"});
      this.onStatus("Finished.","");
    };

    source.start(startAt);
    this._syncNeural(data,startAt,analyser);
  }

  _syncNeural(data,startAt,analyser){
    cancelAnimationFrame(this.raf);
    const hasTimedVisemes=Array.isArray(data.vtimes)&&data.vtimes.length&&Array.isArray(data.visemes)&&data.visemes.length;

    if(!hasTimedVisemes){
      this._syncEnergy(analyser);
      return;
    }

    const frame=()=>{
      if(!this.speaking)return;
      const ms=Math.max(0,(this.audioCtx.currentTime-startAt)*1000);
      let vi=-1,wi=-1;

      if(data.vtimes?.length){
        let lo=0,hi=data.vtimes.length-1;
        while(lo<=hi){const mid=(lo+hi)>>1;if(data.vtimes[mid]<=ms){vi=mid;lo=mid+1}else hi=mid-1}
      }
      if(data.wtimes?.length){
        let lo=0,hi=data.wtimes.length-1;
        while(lo<=hi){const mid=(lo+hi)>>1;if(data.wtimes[mid]<=ms){wi=mid;lo=mid+1}else hi=mid-1}
      }

      if(vi>=0){
        const raw=data.visemes?.[vi]||"sil";
        const simple=HEAD_VISEME_TO_SIMPLE[raw]||"EE";
        this._applyViseme(simple,{phoneme:data.phonemes?.[vi]||raw,word:wi>=0?(data.words?.[wi]||"—"):"—"});
      }else{
        const simple=this._energyViseme(analyser);
        this._applyViseme(simple,{phoneme:"audio-energy",word:wi>=0?(data.words?.[wi]||"—"):"—"});
      }

      this.raf=requestAnimationFrame(frame);
    };

    this.raf=requestAnimationFrame(frame);
  }

  _syncEnergy(analyser){
    cancelAnimationFrame(this.raf);
    const frame=()=>{
      if(!this.speaking)return;
      const simple=this._energyViseme(analyser);
      this._applyViseme(simple,{phoneme:"audio-energy",word:"—"});
      this.raf=requestAnimationFrame(frame);
    };
    this.raf=requestAnimationFrame(frame);
  }

  _energyViseme(analyser){
    if(!analyser)return "rest";
    const time=new Uint8Array(analyser.fftSize);
    const freq=new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(time);
    analyser.getByteFrequencyData(freq);

    let sum=0;
    for(const x of time){const n=(x-128)/128;sum+=n*n}
    const rms=Math.sqrt(sum/time.length);

    let low=0,high=0;
    const split=Math.floor(freq.length*.58);
    for(let i=0;i<freq.length;i++){
      if(i<split)low+=freq[i];else high+=freq[i];
    }
    const highRatio=high/Math.max(1,low+high);

    let viseme="rest";
    if(rms<.018)viseme="rest";
    else if(highRatio>.42&&rms<.11)viseme="FV";
    else if(rms>.17)viseme="AA";
    else if(rms>.10)viseme=this.energyFlip?"OH":"AA";
    else if(rms>.055)viseme=this.energyFlip?"EE":"OH";
    else viseme=this.energyFlip?"MBP":"EE";

    this.energyFlip=!this.energyFlip;
    this.lastEnergyViseme=viseme;
    return viseme;
  }

  async _voices(){
    const synth=window.speechSynthesis;
    if(!synth)return[];
    let voices=synth.getVoices();
    if(voices.length)return voices;

    await new Promise(resolve=>{
      let done=false;
      const finish=()=>{if(done)return;done=true;resolve()};
      const old=synth.onvoiceschanged;
      synth.onvoiceschanged=()=>{try{old?.()}catch{}finish()};
      setTimeout(finish,1200);
    });
    return synth.getVoices();
  }

  _pickVoice(voices){
    const score=v=>{
      const n=`${v.name} ${v.voiceURI}`.toLowerCase();
      let s=0;
      if(/^en\b/i.test(v.lang||""))s+=80;
      if(/en-us/i.test(v.lang||""))s+=20;
      if(v.localService)s+=30;
      if(/jenny|aria|zira|ava|samantha|sonia|female|young|youth/.test(n))s+=35;
      if(/google us english|microsoft/.test(n))s+=12;
      if(/david|mark|daniel|male/.test(n))s-=12;
      return s;
    };
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

    const u=new SpeechSynthesisUtterance(clean);
    this.utterance=u;
    if(chosen){u.voice=chosen;u.lang=chosen.lang||"en-US"}else u.lang="en-US";
    u.rate=Math.max(.82,Math.min(1.12,Number(speed)||.96));
    u.pitch=voice==="af_sky"?1.24:voice==="af_heart"?1.13:1.08;
    u.volume=1;

    let started=false;
    return new Promise((resolve,reject)=>{
      const startGuard=setTimeout(()=>{
        if(!started){
          try{synth.cancel()}catch{}
          this._stopBrowserAnimation();
          reject(new Error("Browser voice did not start. Check that media volume is on."));
        }
      },3500);

      u.onstart=()=>{
        started=true;
        clearTimeout(startGuard);
        this.speaking=true;
        this.rig?.speaking(true);
        this.onProgress(100);
        this.onStatus(`Using ${chosen?.name||"the built-in browser voice"} — speaking now.`,"speaking");
        this._startBrowserAnimation(clean,u.rate);
      };

      u.onboundary=e=>{
        const word=wordAt(clean,e.charIndex||0);
        const index=wordIndexAt(clean,e.charIndex||0);
        this._setBrowserWord(word,index,true);
      };

      u.onend=()=>{
        clearTimeout(startGuard);
        this._stopBrowserAnimation();
        this.speaking=false;
        this.rig?.speaking(false);
        this.onReadout({viseme:"rest",phoneme:"—",word:"—"});
        this.onStatus("Finished with browser voice.","");
        resolve();
      };

      u.onerror=e=>{
        clearTimeout(startGuard);
        this._stopBrowserAnimation();
        this.speaking=false;
        this.rig?.speaking(false);
        if(["canceled","interrupted"].includes(e.error)){resolve();return}
        reject(new Error(e.error||"Browser voice failed."));
      };

      synth.speak(u);
    });
  }

  _startBrowserAnimation(text,rate){
    this._stopBrowserAnimation();
    const words=text.split(/\s+/).filter(Boolean);
    this.browserState={
      text,words,rate:Math.max(.82,Number(rate)||.96),
      wordIndex:0,word:"",sequence:["rest"],sequenceIndex:0,
      boundarySeen:false,lastBoundaryAt:0,nextWordAt:performance.now()
    };
    this._setBrowserWord(words[0]||"",0,false);

    const tickMs=Math.max(65,Math.round(92/this.browserState.rate));
    this.browserTimer=setInterval(()=>{
      if(!this.speaking||!this.browserState)return;
      const s=this.browserState;
      const now=performance.now();

      if(!s.boundarySeen&&now>=s.nextWordAt){
        const word=s.words[s.wordIndex]||"";
        this._setBrowserWord(word,s.wordIndex,false);
        const hold=Math.max(230,Math.min(700,(word.length||3)*72/s.rate));
        s.nextWordAt=now+hold;
        s.wordIndex=Math.min(s.words.length-1,s.wordIndex+1);
      }

      const sequence=s.sequence?.length?s.sequence:["rest"];
      const viseme=sequence[s.sequenceIndex%sequence.length];
      s.sequenceIndex++;
      this._applyViseme(viseme,{phoneme:"word-map",word:s.word||"—"});
    },tickMs);
  }

  _setBrowserWord(word,index,fromBoundary){
    if(!this.browserState)return;
    const s=this.browserState;
    s.word=word||s.word||"";
    s.sequence=wordToVisemes(s.word);
    s.sequenceIndex=0;
    s.wordIndex=Math.max(s.wordIndex,Number(index)||0);
    if(fromBoundary){
      s.boundarySeen=true;
      s.lastBoundaryAt=performance.now();
    }
    const first=s.sequence[0]||"rest";
    this._applyViseme(first,{phoneme:"word-map",word:s.word||"—"});
  }

  _applyViseme(viseme,{phoneme="—",word="—"}={}){
    const allowed=new Set(["rest","MBP","AA","EE","OH","FV"]);
    const simple=allowed.has(viseme)?viseme:"rest";
    this.rig?.setMouth(simple);
    this.onReadout({viseme:simple,phoneme,word});
  }

  _stopBrowserAnimation(){
    clearInterval(this.browserTimer);
    this.browserTimer=0;
    this.browserState=null;
  }

  stop(reset=true){
    this.speaking=false;
    cancelAnimationFrame(this.raf);
    this._stopBrowserAnimation();

    if(this.source){
      try{this.source.stop()}catch{}
      try{this.source.disconnect()}catch{}
      this.source=null;
    }
    if(this.analyser){
      try{this.analyser.disconnect()}catch{}
      this.analyser=null;
    }

    try{this.tts?.clear()}catch{}
    try{window.speechSynthesis?.cancel()}catch{}
    this.utterance=null;
    this.rig?.speaking(false);
    if(reset)this.onReadout({viseme:"rest",phoneme:"—",word:"—"});
  }
}
