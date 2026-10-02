
import {Store} from "./site.js";
const form=document.querySelector("#profileForm");
const p=Store.get("tsb_profile",{nickname:"Guest",age:"13-15",subject:"Math",style:"Step by step"});
const $=s=>document.querySelector(s);
$("#nickname").value=p.nickname||"Guest";
$("#age").value=p.age||"13-15";
$("#subject").value=p.subject||"Math";
$("#style").value=p.style||"Step by step";
$("#profileName").textContent=p.nickname||"Guest";
$("#profileMeta").textContent=`${p.age||"13-15"} · ${p.subject||"Math"}`;
form?.addEventListener("submit",e=>{
  e.preventDefault();
  const next={nickname:$("#nickname").value.trim().slice(0,24)||"Guest",age:$("#age").value,subject:$("#subject").value,style:$("#style").value};
  Store.set("tsb_profile",next);
  $("#profileName").textContent=next.nickname;
  $("#profileMeta").textContent=`${next.age} · ${next.subject}`;
  $("#saved").textContent="Saved on this device.";
  setTimeout(()=>$("#saved").textContent="",2200);
});
$("#resetProfile")?.addEventListener("click",()=>{
  if(confirm("Reset the local guest profile and chat history on this device?")){
    Store.remove("tsb_profile");Store.remove("tsb_chat_sessions");location.href="index.html";
  }
});
