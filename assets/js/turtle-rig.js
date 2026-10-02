export class TurtleRig{
  constructor(host){
    this.host=host;
    this.svg=null;
    this.blinkTimer=0;
    this.mouth="closed";
  }
  async init(){
    const url=new URL("../turtle/turtle-rig.svg",import.meta.url);
    const res=await fetch(url,{cache:"force-cache"});
    if(!res.ok) throw new Error(`Turtle rig failed to load (${res.status})`);
    this.host.innerHTML=await res.text();
    this.svg=this.host.querySelector(".turtle-rig-svg");
    this.setMouth("closed");
    this.scheduleBlink();
    return this;
  }
  setMouth(name){
    if(!this.svg)return;
    const allowed=new Set(["closed","small","open","wide"]);
    const chosen=allowed.has(name)?name:"small";
    this.svg.querySelectorAll(".mouth-shape").forEach(el=>el.classList.remove("is-active"));
    this.svg.querySelector(`.mouth-${chosen}`)?.classList.add("is-active");
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
    if(!on)this.setMouth("closed");
  }
  destroy(){clearTimeout(this.blinkTimer)}
}