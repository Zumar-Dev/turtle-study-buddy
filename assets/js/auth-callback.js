import {Store} from "./site.js";
import {acceptRedirectSession,migrateLocalData,hydrateFromCloud} from "./supabase.js";
const $=s=>document.querySelector(s);
async function run(){
  const hash=new URLSearchParams(location.hash.replace(/^#/,"")),query=new URLSearchParams(location.search),error=hash.get("error_description")||query.get("error_description")||hash.get("error")||query.get("error");
  if(error){$("#callbackTitle").textContent="Email verification did not finish.";$("#callbackStatus").textContent="";$("#callbackError").textContent=error;$("#backToLogin").classList.remove("hidden");return}
  const session=acceptRedirectSession(hash.get("access_token")?hash:query);
  if(!session){$("#callbackTitle").textContent="This sign-in link is incomplete or expired.";$("#callbackStatus").textContent="Request a new verification email and try again.";$("#backToLogin").classList.remove("hidden");return}
  try{$("#callbackStatus").textContent="Email verified. Syncing your learning…";await migrateLocalData();await hydrateFromCloud();const p=Store.get("tsb_profile",{})||{};location.replace((!p.nickname||p.nickname==="Learner")?"profile.html?welcome=1":"dashboard.html")}catch(err){$("#callbackTitle").textContent="You are signed in.";$("#callbackStatus").textContent="Your account is verified, but sync is temporarily unavailable. You can continue to your dashboard.";$("#callbackError").textContent=err.message;$("#backToLogin").textContent="Continue to dashboard";$("#backToLogin").href="dashboard.html";$("#backToLogin").classList.remove("hidden")}
}
run();
