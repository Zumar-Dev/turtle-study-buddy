
import {Store} from "./site.js";
import {TurtleRig} from "./turtle-rig.js";

const $=s=>document.querySelector(s);
const historyEl=$("#historyList"),messagesEl=$("#messages"),form=$("#chatForm"),input=$("#chatInput"),modeEl=$("#chatMode");
let sessions=Store.get("tsb_chat_sessions",[]);
let current=null;
let rig=null,voice=null,voiceModule=null;

function uid(){return `${Date.now()}-${Math.random().toString(36).slice(2,8)}`}
function cleanText(v,max=3000){return String(v||"").replace(/\u0000/g,"").trim().slice(0,max)}
function profile(){return Store.get("tsb_profile",{})||{}}
function visitorId(){
  let id=Store.get("tsb_visitor_id","");
  if(!id){id=(crypto.randomUUID?.()||`v-${Date.now()}-${Math.random().toString(36).slice(2)}`);Store.set("tsb_visitor_id",id)}
  return id;
}

async function initRig(){
  try{
    rig=await new TurtleRig($("#chatTurtle")).init();

  }catch(e){console.warn(e)}
}

function renderHistory(){
  historyEl.replaceChildren();
  if(!sessions.length){
    const empty=document.createElement("div");
    empty.className="empty";
    empty.innerHTML="<strong>No chats yet.</strong><br>Your first real question will create the first history item.";
    historyEl.append(empty);return;
  }
  sessions.slice().reverse().forEach(s=>{
    const b=document.createElement("button");
    b.type="button";b.className="history-item";
    b.textContent=s.title||"Study chat";
    b.addEventListener("click",()=>{current=s;renderMessages()});
    historyEl.append(b);
  });
}

function addBubble(role,text,withSpeak=false){
  const row=document.createElement("div");
  row.className=`message ${role}`;
  const bubble=document.createElement("div");
  bubble.className="bubble";
  bubble.textContent=text;
  row.append(bubble);
  if(role==="assistant"&&withSpeak){
    const speak=document.createElement("button");
    speak.type="button";speak.className="speaker";speak.textContent="🔊 Read aloud";
    speak.addEventListener("click",()=>speakText(text));
    bubble.append(document.createElement("br"),speak);
  }
  messagesEl.append(row);
}

function renderMessages(){
  messagesEl.replaceChildren();
  if(!current||!current.messages?.length){
    const w=document.createElement("div");w.className="welcome-chat";
    const img=document.createElement("img");img.src="assets/turtle/turtle-base@2x.png";img.alt="";img.className="turtle-small";
    const h=document.createElement("h2");h.textContent="What are you stuck on?";
    const p=document.createElement("p");p.textContent="Ask in your own words. Turtle will explain, demonstrate, then give you a way to try it yourself.";
    w.append(img,h,p);messagesEl.append(w);return;
  }
  current.messages.forEach(m=>addBubble(m.role,m.content,m.role==="assistant"));
  messagesEl.scrollTop=messagesEl.scrollHeight;
}

function save(){
  if(!current)return;
  const i=sessions.findIndex(s=>s.id===current.id);
  if(i>=0)sessions[i]=current;else sessions.push(current);
  sessions=sessions.slice(-20);
  Store.set("tsb_chat_sessions",sessions);
  renderHistory();
}

function offlineTutor(q){
  const lower=q.toLowerCase();
  const ar=q.match(/(-?\d+(?:\.\d+)?)\s*([+\-×x*÷/])\s*(-?\d+(?:\.\d+)?)/i);
  if(ar){
    const a=Number(ar[1]),op=ar[2],b=Number(ar[3]);let ans;
    if(op==="+")ans=a+b;else if(op==="-")ans=a-b;else if(["×","x","*"].includes(op))ans=a*b;else if(b!==0)ans=a/b;
    if(Number.isFinite(ans))return `Let’s do it step by step. ${a} ${op} ${b} = ${ans}. Now try a similar one with different numbers and tell me what you get.`;
  }
  const eq=q.match(/(-?\d*)x\s*([+\-])\s*(\d+)\s*=\s*(-?\d+)/i);
  if(eq){
    const c=eq[1]===""?1:Number(eq[1]),sign=eq[2],k=Number(eq[3]),rhs=Number(eq[4]);
    const moved=sign==="+"?rhs-k:rhs+k;const x=moved/c;
    return `Start by undoing the ${sign==="+"?"addition":"subtraction"}: ${c===1?"x":c+"x"} = ${moved}. Then divide by ${c}. So x = ${x}. Want a similar practice equation?`;
  }
  if(lower.includes("photosynthesis"))return "Photosynthesis is how plants use light energy to make sugar from carbon dioxide and water. A useful memory line is: light energy goes in, stored chemical energy comes out. Can you name the gas plants take in?";
  if(lower.includes("gravity"))return "Gravity is the attraction between masses. Near Earth, it pulls objects toward the planet’s center. Try this: if you drop a ball and a book at the same time, what do you predict happens?";
  if(lower.includes("noun"))return "A noun names a person, place, thing, or idea. In “The turtle studies science,” both “turtle” and “science” are nouns. Can you find the noun in “Music helps me focus”?";
  return "I’m in offline tutor mode on this computer, so I can only handle a few built-in examples. The live free AI tutor is already wired into this package and starts working after the Cloudflare Workers AI binding is connected.";
}

async function askAI(q){
  const payload={
    message:q,
    profile:profile(),
    history:(current?.messages||[]).slice(0,-1).slice(-10).map(m=>({role:m.role,content:m.content}))
  };
  try{
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
    const res=await fetch("/api/chat",{method:"POST",headers:{"content-type":"application/json","x-tsb-visitor":visitorId()},body:JSON.stringify(payload),signal:controller.signal});
    clearTimeout(timer);
    const data=await res.json().catch(()=>({}));
    if(!res.ok){
      if(res.status===429){modeEl.textContent="Free AI limit";return cleanText(data.message||data.error||"Turtle has reached a free usage limit. Please try again later.",1200)}
      throw new Error(data.error||`AI service ${res.status}`);
    }
    const answer=cleanText(data.answer,6000);
    if(!answer)throw new Error("Empty AI response");
    modeEl.textContent="Live AI tutor";
    return answer;
  }catch(err){
    console.warn("Falling back to offline tutor",err);
    modeEl.textContent="Offline tutor";
    return offlineTutor(q);
  }
}

async function speakText(text){
  try{
    if(!rig)return;
    if(!voice){
      voiceModule??=import("./voice-engine.js");
      const {TurtleVoice}=await voiceModule;
      voice=new TurtleVoice(rig,{
        onStatus:(t,state)=>{const el=$("#voiceStatus");if(el){el.textContent=t;el.className=`typing ${state||""}`}},
        onProgress:()=>{},
        onReadout:()=>{}
      });
    }
    const chosen=$("#voiceChoice")?.value||"af_sky";
    await voice.speak(text,{voice:chosen,speed:.96});
  }catch(e){
    const el=$("#voiceStatus");if(el)el.textContent=`Voice unavailable: ${e.message}`;
  }
}

form?.addEventListener("submit",async e=>{
  e.preventDefault();
  const q=cleanText(input.value,1200);
  if(!q)return;
  input.value="";
  if(!current){
    current={id:uid(),title:q.slice(0,46),createdAt:Date.now(),messages:[]};
  }
  current.messages.push({role:"user",content:q});
  current.messages=current.messages.slice(-24);
  renderMessages();save();
  const typing=document.createElement("div");typing.className="typing";typing.textContent="Turtle is thinking…";messagesEl.append(typing);messagesEl.scrollTop=messagesEl.scrollHeight;
  $("#sendBtn").disabled=true;
  const answer=await askAI(q);
  typing.remove();
  current.messages.push({role:"assistant",content:answer});
  current.messages=current.messages.slice(-24);
  renderMessages();save();
  $("#sendBtn").disabled=false;
  if($("#autoSpeak")?.checked) speakText(answer);
});

$("#newChat")?.addEventListener("click",()=>{current=null;renderMessages();input.focus()});
$("#waveBtn")?.addEventListener("click",()=>rig?.wave());

renderHistory();renderMessages();initRig();
