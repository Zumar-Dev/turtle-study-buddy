
import {Store} from "./site.js";
const $=s=>document.querySelector(s);
const form=$("#guestForm"),photo=$("#profilePhoto");
function cropPhoto(file){return new Promise((resolve,reject)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{const c=document.createElement("canvas");c.width=c.height=160;const x=c.getContext("2d"),d=Math.min(img.width,img.height),sx=(img.width-d)/2,sy=(img.height-d)/2;x.drawImage(img,sx,sy,d,d,0,0,160,160);URL.revokeObjectURL(u);resolve(c.toDataURL("image/jpeg",.82))};img.onerror=reject;img.src=u})}
form?.addEventListener("submit",async e=>{e.preventDefault();const old=Store.get("tsb_profile",{})||{};let p={nickname:$("#nickname").value.trim().slice(0,24)||"Learner",age:$("#age").value,subject:$("#subject").value,style:$("#style").value,photo:old.photo||""};if(photo?.files?.[0])p.photo=await cropPhoto(photo.files[0]);Store.set("tsb_profile",p);location.href="dashboard.html"});
