import {completeEmailLink,migrateLocalData,hydrateFromCloud} from "./supabase.js";
const $=s=>document.querySelector(s);
async function run(){
  try{
    await completeEmailLink();
    $("#callbackStatus").textContent="You are signed in. Syncing your learning…";
    try{await migrateLocalData();await hydrateFromCloud()}
    catch{
      $("#callbackTitle").textContent="You are signed in.";
      $("#callbackStatus").textContent="Cloud sync is temporarily unavailable. You can continue to your dashboard.";
      $("#backToLogin").textContent="Continue to dashboard";
      $("#backToLogin").href="dashboard.html";
      $("#backToLogin").classList.remove("hidden");return;
    }
    let profile={};try{profile=JSON.parse(localStorage.getItem("tsb_profile"))||{}}catch{}
    location.replace(!profile.nickname||profile.nickname==="Learner"?"profile.html?welcome=1":"dashboard.html");
  }catch(err){
    $("#callbackTitle").textContent="Sign-in did not finish.";
    $("#callbackStatus").textContent="";
    $("#callbackError").textContent=err instanceof TypeError?"Could not reach the sign-in service. Check your connection and request a fresh link.":err.message;
    $("#backToLogin").classList.remove("hidden");
  }
}
void run();
