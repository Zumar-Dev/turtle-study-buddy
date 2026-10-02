const LEGACY_TO_VISEME={
  closed:"rest",small:"MBP",open:"OH",wide:"AA",
  sil:"rest",PP:"MBP",FF:"FV",E:"EE",I:"EE",O:"OH",U:"OH",aa:"AA"
};
const VISEMES=new Set(["rest","MBP","AA","EE","OH","FV"]);

export class TurtleRig{
  constructor(host){
    this.host=host;
    this.svg=null;
    this.blinkTimer=0;
    this.idleAnimation=null;
    this.mouth="rest";
  }

  async init(){
    const url=new URL("../turtle/turtle-rig.svg",import.meta.url);
    const res=await fetch(url,{cache:"force-cache"});
    if(!res.ok)throw new Error(`Turtle rig failed to load (${res.status})`);
    this.host.innerHTML=await res.text();
    this.svg=this.host.querySelector(".turtle-rig-svg");
    if(!this.svg)throw new Error("Turtle rig SVG is missing.");
    this.setMouth("rest");
    this._startIdleMotion();
    this.scheduleBlink();
    return this;
  }

  setMouth(name){
    if(!this.svg)return;
    const mapped=LEGACY_TO_VISEME[name]||name;
    const chosen=VISEMES.has(mapped)?mapped:"rest";
    this.svg.querySelectorAll(".mouth-shape").forEach(el=>el.classList.remove("is-active"));
    this.svg.querySelector(`.mouth-${chosen.toLowerCase()}`)?.classList.add("is-active");
    this.mouth=chosen;
  }

  blink(){
    if(!this.svg)return;
    this.svg.classList.add("is-blinking");
    setTimeout(()=>this.svg?.classList.remove("is-blinking"),145);
  }

  scheduleBlink(){
    clearTimeout(this.blinkTimer);
    const delay=2600+Math.random()*3600;
    this.blinkTimer=setTimeout(()=>{this.blink();this.scheduleBlink()},delay);
  }

  wave(){
    if(!this.svg)return;
    this.svg.classList.remove("is-waving");
    void this.svg.getBoundingClientRect();
    this.svg.classList.add("is-waving");
    setTimeout(()=>this.svg?.classList.remove("is-waving"),1450);
  }

  speaking(on){
    if(!this.svg)return;
    this.svg.classList.toggle("is-speaking",!!on);
    if(on){
      try{this.idleAnimation?.pause()}catch{}
    }else{
      this.setMouth("rest");
      try{this.idleAnimation?.play()}catch{}
    }
  }

  _startIdleMotion(){
    if(!this.svg||window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)return;
    this.idleAnimation=this.svg.animate([
      {transform:"translateY(0px) rotate(0deg)"},
      {transform:"translateY(-2px) rotate(-0.25deg)"},
      {transform:"translateY(0px) rotate(0deg)"}
    ],{
      duration:3400,
      iterations:Infinity,
      easing:"ease-in-out"
    });
  }

  destroy(){
    clearTimeout(this.blinkTimer);
    try{this.idleAnimation?.cancel()}catch{}
  }
}
