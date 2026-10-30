import {hasAuthPayload,validateSession} from "./supabase.js";
if(hasAuthPayload())location.replace("/auth-callback.html"+location.search+location.hash);
else void validateSession().then(session=>{
  if(!session)return;
  const links=document.querySelectorAll('.head-right a[href="start.html"]');
  if(links[0]){links[0].textContent="My profile";links[0].href="profile.html"}
  if(links[1]){links[1].textContent="Dashboard →";links[1].href="dashboard.html"}
}).catch(()=>{});
import {profile,visitorId} from "./site.js";

const input=document.querySelector("#homeDemoInput");
const ask=document.querySelector("#homeDemoAsk");
const response=document.querySelector("#homeDemoResponse");

const fallbackExample={
  title:"Here’s an example of how Turtle teaches:",
  text:"Photosynthesis is how plants make their own food. They use sunlight for energy, take in carbon dioxide from the air, and absorb water through their roots. Those ingredients help the plant make sugar for energy and release oxygen. Think of a leaf like a tiny solar-powered food factory."
};

function clean(value,max=600){
  return String(value||"").replace(/\u0000/g,"").trim().slice(0,max);
}

function render(title,text,state="ready"){
  response.dataset.state=state;
  const bubble=response.querySelector(".try-bubble");
  bubble.replaceChildren();
  const strong=document.createElement("strong");
  strong.textContent=title;
  const p=document.createElement("p");
  p.textContent=text;
  bubble.append(strong,p);
}

async function askTurtle(){
  const message=clean(input?.value,600);
  if(!message){
    input?.focus();
    render("Type a question first.","Try a topic you are studying, such as fractions, photosynthesis or grammar.","error");
    return;
  }

  ask.disabled=true;
  ask.textContent="Turtle is thinking…";
  render("Turtle is thinking…","I’m turning your question into a short explanation.","loading");

  try{
    const res=await fetch("/api/chat",{
      method:"POST",
      headers:{
        "content-type":"application/json",
        "x-tsb-visitor":visitorId()
      },
      body:JSON.stringify({
        message,
        profile:profile(),
        history:[]
      })
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||data.error||"The live tutor is temporarily unavailable.");
    const answer=clean(data.answer,1800);
    if(!answer)throw new Error("The live tutor returned an empty answer.");
    render("Turtle explains:",answer,"success");
  }catch(err){
    console.warn("Homepage demo fallback",err);
    render(fallbackExample.title,`${fallbackExample.text}\n\nThe live demo could not connect right now, so this is a clearly labelled example response.`,"fallback");
  }finally{
    ask.disabled=false;
    ask.textContent="Ask Turtle 🐢";
  }
}

ask?.addEventListener("click",askTurtle);
input?.addEventListener("keydown",event=>{
  if(event.key==="Enter"){
    event.preventDefault();
    askTurtle();
  }
});
