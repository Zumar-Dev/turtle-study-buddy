
import { HeadTTS } from "https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/+esm";

const VOICE_LABELS={
  af_sky:"Sky",
  af_heart:"Heart",
  af_bella:"Bella"
};
const VISEME_TO_MOUTH={
  sil:"closed",PP:"closed",FF:"small",TH:"small",DD:"small",kk:"small",CH:"small",
  SS:"small",nn:"small",RR:"small",aa:"wide",E:"open",I:"small",O:"open",U:"small"
};

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
    this.raf=0;
    this.speaking=false;
  }
  async ensure(){
    if(this.connected)return;
    if(this.connecting)return this.connecting;
    this.connecting=this._connect();
    await this.connecting;
    this.connecting=null;
  }
  async _connect(){
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)throw new Error("This browser does not support Web Audio.");
    this.audioCtx??=new AudioCtx();
    await this.audioCtx.resume();
    const hasWebGPU=!!navigator.gpu;
    this.onStatus(`Loading the free neural voice${hasWebGPU?" with WebGPU":" with WASM"}…`,"loading");
    this.onProgress(4);
    this.tts=new HeadTTS({
      endpoints:hasWebGPU?["webgpu","wasm"]:["wasm"],
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
    this.tts.onerror=err=>this.onStatus(`Voice error: ${err?.message||err}`,"error");
    let pct=4;
    await this.tts.connect(null,ev=>{
      if(ev?.lengthComputable&&ev.total)pct=Math.max(pct,Math.round(ev.loaded/ev.total*88));
      else pct=Math.min(88,pct+2);
      this.onProgress(pct);
    });
    this.connected=true;
    this.onProgress(100);
    this.onStatus("Voice ready.","");
  }
  async speak(text,{voice="af_sky",speed=.96}={}){
    const clean=String(text||"").replace(/\s+/g," ").trim().slice(0,500);
    if(!clean) return;
    this.stop();
    await this.ensure();
    await this.audioCtx.resume();
    this.onStatus(`Generating ${VOICE_LABELS[voice]||"Turtle"} voice…`,"loading");
    this.onProgress(12);
    await this.tts.setup({voice,language:"en-us",speed:Number(speed)||.96,audioEncoding:"wav"});
    const messages=await this.tts.synthesize({input:clean});
    const audioMsg=messages.find(m=>m.type==="audio"&&m.data?.audio);
    if(!audioMsg){
      const err=messages.find(m=>m.type==="error");
      throw new Error(err?.data?.error||"No speech audio was returned.");
    }
    const data=audioMsg.data;
    this.onProgress(100);
    const source=this.audioCtx.createBufferSource();
    source.buffer=data.audio;
    source.connect(this.audioCtx.destination);
    this.source=source;
    const startAt=this.audioCtx.currentTime+.10;
    this.speaking=true;
    this.rig?.speaking(true);
    this.rig?.wave();
    this.onStatus("Turtle is speaking…","speaking");
    source.onended=()=>{this.stop(false);this.onStatus("Finished.","")};
    source.start(startAt);
    this._sync(data,startAt);
  }
  _sync(data,startAt){
    cancelAnimationFrame(this.raf);
    const frame=()=>{
      if(!this.speaking)return;
      const ms=Math.max(0,(this.audioCtx.currentTime-startAt)*1000);
      let vi=-1;
      if(data.vtimes?.length){
        let lo=0,hi=data.vtimes.length-1;
        while(lo<=hi){const mid=(lo+hi)>>1;if(data.vtimes[mid]<=ms){vi=mid;lo=mid+1}else hi=mid-1}
      }
      if(vi>=0){
        const v=data.visemes?.[vi]||"DD";
        this.rig?.setMouth(VISEME_TO_MOUTH[v]||"small");
        const phoneme=data.phonemes?.[vi]||"—";
        let wi=-1;
        if(data.wtimes?.length){
          let lo=0,hi=data.wtimes.length-1;
          while(lo<=hi){const mid=(lo+hi)>>1;if(data.wtimes[mid]<=ms){wi=mid;lo=mid+1}else hi=mid-1}
        }
        this.onReadout({viseme:v,phoneme,word:wi>=0?(data.words?.[wi]||"—"):"—"});
      }
      this.raf=requestAnimationFrame(frame);
    };
    this.raf=requestAnimationFrame(frame);
  }
  stop(reset=true){
    this.speaking=false;
    cancelAnimationFrame(this.raf);
    if(this.source){try{this.source.stop()}catch{} try{this.source.disconnect()}catch{} this.source=null}
    try{this.tts?.clear()}catch{}
    this.rig?.speaking(false);
    if(reset)this.onReadout({viseme:"idle",phoneme:"—",word:"—"});
  }
}
