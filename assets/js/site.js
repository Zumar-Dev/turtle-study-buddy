
const qs=(s,r=document)=>r.querySelector(s);
const qsa=(s,r=document)=>[...r.querySelectorAll(s)];

export const Store={
  get(k,fallback=null){try{const v=localStorage.getItem(k);return v===null?fallback:JSON.parse(v)}catch{return fallback}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}},
  remove(k){try{localStorage.removeItem(k)}catch{}}
};

const DARK_KEY="tsb_dark";
if(Store.get(DARK_KEY,false)) document.body.classList.add("dark");

qsa("[data-theme-toggle]").forEach(btn=>btn.addEventListener("click",()=>{
  document.body.classList.toggle("dark");
  Store.set(DARK_KEY,document.body.classList.contains("dark"));
}));

const menu=qs("[data-mobile-menu]");
const menuBtn=qs("[data-menu-button]");
if(menu && menuBtn){
  menuBtn.addEventListener("click",()=>menu.classList.toggle("open"));
  menu.addEventListener("click",e=>{if(e.target.closest("a"))menu.classList.remove("open")});
}

qsa("[data-start-guest]").forEach(el=>el.addEventListener("click",()=>{
  location.href="start.html";
}));

qsa("[data-open-dashboard]").forEach(el=>el.addEventListener("click",()=>{
  location.href="dashboard.html";
}));

const profile=Store.get("tsb_profile",null);
qsa("[data-profile-name]").forEach(el=>el.textContent=profile?.nickname||"Guest");
qsa("[data-profile-age]").forEach(el=>el.textContent=profile?.age||"10+");

export function escapeText(s){
  return String(s??"").replace(/[<>&"'`]/g,m=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;","`":"&#96;"}[m]));
}
