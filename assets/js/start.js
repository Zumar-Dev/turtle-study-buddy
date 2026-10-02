
import {Store} from "./site.js";
const form=document.querySelector("#guestForm");
const existing=Store.get("tsb_profile",null);
if(existing){
  document.querySelector("#nickname").value=existing.nickname||"";
  document.querySelector("#age").value=existing.age||"13-15";
  document.querySelector("#subject").value=existing.subject||"Math";
  document.querySelector("#style").value=existing.style||"Step by step";
}
form?.addEventListener("submit",e=>{
  e.preventDefault();
  const profile={
    nickname:document.querySelector("#nickname").value.trim().slice(0,24)||"Guest",
    age:document.querySelector("#age").value,
    subject:document.querySelector("#subject").value,
    style:document.querySelector("#style").value
  };
  Store.set("tsb_profile",profile);
  location.href="dashboard.html";
});
