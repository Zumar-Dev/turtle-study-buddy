
import {Store,profile,visitorId,dayGroup,esc} from "./site.js";
import {TurtleAudio} from "./audio.js";
const $=s=>document.querySelector(s);
let sessions=Store.get("tsb_chat_sessions",[])||[],current=null;
const history=$("#threadList"),messages=$("#messages"),input=$("#chatInput"),form=$("#chatForm");
const speaker=new TurtleAudio({image:$("#chatTurtle"),status:$("#voiceStatus"),onProvider:p=>$("#voiceProvider").textContent=p});
function uid(){return crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}
function clean(v,max=4000){return String(v||"").replace(/\u0000/g,"").trim().slice(0,max)}
function renderHistory(){
  history.innerHTML="";
  for(const group of ["Today","Yesterday","Previous"]){
    const h=document.createElement("div");h.className="rail-heading";h.textContent=group;history.append(h);
    const list=sessions.filter(s=>dayGroup(s.updatedAt||s.createdAt)===group).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    if(!list.length&&group==="Today"){const e=document.createElement("p");e.className="history-empty";e.textContent="Your chats will appear here.";history.append(e)}
    list.forEach(s=>{const b=document.createElement("button");b.className=`thread ${current?.id===s.id?"active":""}`;b.type="button";b.textContent=s.title||"Study chat";b.onclick=()=>{current=s;renderHistory();renderMessages()};history.append(b)})
  }
}
function bubble(m,i){
  const row=document.createElement("article");row.className=`message-row ${m.role==="user"?"user":"assistant"}`;
  const face=document.createElement("div");face.className=`chat-face ${m.role==="user"?"person":""}`;
  if(m.role==="assistant"){const img=document.createElement("img");img.src="assets/turtle/turtle-static.png";img.alt="Turtle";face.append(img)}else face.textContent="🙂";
  const box=document.createElement("div"),b=document.createElement("div");b.className="bubble";b.textContent=m.content;box.append(b);
  if(m.role==="assistant"){const actions=document.createElement("div");actions.className="msg-actions";
    const speak=document.createElement("button");speak.type="button";speak.textContent="🔊 Read aloud";speak.onclick=()=>speaker.speak(m.content);
    const study=document.createElement("button");study.type="button";study.textContent="🧑‍🏫 See on whiteboard";study.onclick=()=>{sessionStorage.setItem("tsb_class_question",current?.lastQuestion||"");location.href="classroom.html"};
    actions.append(speak,study);box.append(actions)}
  row.append(face,box);return row
}
function renderMessages(){
  messages.innerHTML="";
  if(!current?.messages?.length){messages.innerHTML=`<div class="welcome-chat"><img id="chatTurtle" class="turtle-small" src="assets/turtle/turtle-static.png" alt="Turtle Study Buddy"><h2>Ask Turtle anything you're studying.</h2><p class="muted">Ask in your own words. Turtle will explain without pretending you said things you didn't.</p></div>`;speaker.image=$("#chatTurtle");return}
  current.messages.forEach((m,i)=>messages.append(bubble(m,i)));messages.scrollTop=messages.scrollHeight;speaker.image=messages.querySelector(".message-row.assistant:last-of-type img")||$("#chatTurtle")||speaker.image
}
function save(){if(!current)return;const i=sessions.findIndex(x=>x.id===current.id);if(i>=0)sessions[i]=current;else sessions.push(current);sessions=sessions.slice(-30);Store.set("tsb_chat_sessions",sessions);renderHistory()}
async function askAI(q){
  const res=await fetch("/api/chat",{method:"POST",headers:{"content-type":"application/json","x-tsb-visitor":visitorId()},body:JSON.stringify({message:q,profile:profile(),history:(current?.messages||[]).slice(0,-1).slice(-10).map(m=>({role:m.role,content:m.content}))})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.message||data.error||"Turtle is temporarily unavailable.");
  return clean(data.answer,6000)
}
form?.addEventListener("submit",async e=>{e.preventDefault();const q=clean(input.value,1200);if(!q)return;input.value="";
  if(!current)current={id:uid(),title:q.slice(0,44),createdAt:Date.now(),updatedAt:Date.now(),messages:[]};
  current.lastQuestion=q;current.messages.push({role:"user",content:q});current.updatedAt=Date.now();save();renderMessages();
  const t=document.createElement("div");t.className="typing";t.textContent="Turtle is thinking…";messages.append(t);messages.scrollTop=messages.scrollHeight;$("#sendBtn").disabled=true;
  try{const a=await askAI(q);t.remove();current.messages.push({role:"assistant",content:a});current.updatedAt=Date.now();save();renderMessages()}
  catch(err){t.textContent=err.message;t.classList.add("limit-note")}
  finally{$("#sendBtn").disabled=false}
});
$("#newChat")?.addEventListener("click",()=>{current=null;renderHistory();renderMessages();input.focus()});
renderHistory();renderMessages();

for(const b of document.querySelectorAll("[data-suggest]"))b.addEventListener("click",()=>{input.value=b.dataset.suggest;input.focus()});
