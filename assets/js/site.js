
export const Store={
  get(key,fallback=null){try{const v=localStorage.getItem(key);return v==null?fallback:JSON.parse(v)}catch{return fallback}},
  set(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}},
  del(key){try{localStorage.removeItem(key)}catch{}}
};
export function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
export function profile(){return Store.get("tsb_profile",{})||{}}
export function visitorId(){
  let id=Store.get("tsb_visitor_id","");
  if(!id){id=crypto.randomUUID?.()||`v-${Date.now()}-${Math.random().toString(36).slice(2)}`;Store.set("tsb_visitor_id",id)}
  return id;
}
export function dayGroup(ts){
  const a=new Date(ts),today=new Date(),y=new Date();y.setDate(today.getDate()-1);
  if(a.toDateString()===today.toDateString())return"Today";
  if(a.toDateString()===y.toDateString())return"Yesterday";
  return"Previous";
}
export function formatDuration(sec){const m=Math.floor(sec/60),s=sec%60;return`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`}
export function initShell(){
  const p=profile();
  document.querySelectorAll("[data-profile-name]").forEach(el=>el.textContent=p.nickname||"Learner");
  document.querySelectorAll("[data-profile-avatar]").forEach(el=>{if(p.photo)el.src=p.photo});
}
initShell();
