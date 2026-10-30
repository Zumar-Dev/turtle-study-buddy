const SUPABASE_URL="https://wgcqueqcmrnziibsyglw.supabase.co";
const SUPABASE_KEY="sb_publishable_lVkaK0LSVBgl26sehh-wbg_ItSk4vlD";
const SESSION_KEY="tsb_supabase_session_v1";

function safeJson(raw,fallback=null){try{return JSON.parse(raw)}catch{return fallback}}
function loadLocal(key,fallback=null){try{const v=localStorage.getItem(key);return v==null?fallback:safeJson(v,fallback)}catch{return fallback}}
function saveLocal(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
function delLocal(key){try{localStorage.removeItem(key)}catch{}}
function errMessage(data,status){return data?.msg||data?.message||data?.error_description||data?.error||`Request failed (${status})`}
function authHeaders(extra={}){return {apikey:SUPABASE_KEY,"content-type":"application/json",...extra}}
function restHeaders(token,extra={}){return {apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,"content-type":"application/json",...extra}}
function cleanEmail(v){return String(v||"").trim().toLowerCase().slice(0,254)}
function nowSeconds(){return Math.floor(Date.now()/1000)}
function normalizeSession(data){
  if(!data?.access_token||!data?.refresh_token)return null;
  const expiresAt=Number(data.expires_at)||nowSeconds()+Number(data.expires_in||3600);
  return {access_token:data.access_token,refresh_token:data.refresh_token,expires_at:expiresAt,token_type:data.token_type||"bearer",user:data.user||null};
}
export function getSession(){return loadLocal(SESSION_KEY,null)}
export function isSignedIn(){return !!getSession()?.access_token}
export function currentUser(){return getSession()?.user||null}
export function currentEmail(){return currentUser()?.email||""}
export function acceptRedirectSession(values){
  const data=values instanceof URLSearchParams?Object.fromEntries(values.entries()):values||{};
  const session=normalizeSession(data);
  if(!session)return null;
  if(!session.user){try{let part=session.access_token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");while(part.length%4)part+="=";const payload=JSON.parse(atob(part));session.user={id:payload.sub,email:payload.email||""}}catch{}}
  persistSession(session);return session;
}
function persistSession(session){
  if(!session){delLocal(SESSION_KEY);return}
  try{localStorage.setItem(SESSION_KEY,JSON.stringify(session))}
  catch{throw new Error("Your browser could not save the sign-in session. Allow site storage and request a new link.")}
}

export async function sendEmailOtp(email){
  const value=cleanEmail(email);
  if(!/^\S+@\S+\.\S+$/.test(value))throw new Error("Enter a valid email address.");
  const res=await fetch(`${SUPABASE_URL}/auth/v1/otp?redirect_to=${encodeURIComponent(`${location.origin}/auth-callback.html`)}`,{method:"POST",headers:authHeaders(),body:JSON.stringify({email:value,create_user:true})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(errMessage(data,res.status));
  return {email:value};
}

export async function verifyEmailOtp(email,token){
  const value=cleanEmail(email),code=String(token||"").replace(/\s+/g,"").trim();
  if(!code)throw new Error("Enter the verification code from your email.");
  const res=await fetch(`${SUPABASE_URL}/auth/v1/verify`,{method:"POST",headers:authHeaders(),body:JSON.stringify({email:value,token:code,type:"email"})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(errMessage(data,res.status));
  const session=normalizeSession(data);
  if(!session)throw new Error("Email verified, but no login session was returned. Try signing in again.");
  persistSession(session);
  return session;
}

export async function refreshSession(){
  const existing=getSession();
  if(!existing?.refresh_token)return null;
  const res=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:"POST",headers:authHeaders(),body:JSON.stringify({refresh_token:existing.refresh_token})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok){persistSession(null);throw new Error(errMessage(data,res.status))}
  const session=normalizeSession(data);persistSession(session);return session;
}

export async function ensureSession(){
  let session=getSession();
  if(!session)return null;
  if(Number(session.expires_at||0)>nowSeconds()+90)return session;
  try{return await refreshSession()}catch{return null}
}

export async function validateSession(){
  const session=await ensureSession();if(!session)return null;
  const res=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`}});
  if(!res.ok){persistSession(null);return null}
  const user=await res.json();session.user=user;persistSession(session);return session;
}

export async function signOut(){
  const session=getSession();
  if(session?.access_token){try{await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`}})}catch{}}
  persistSession(null);
}

async function authedFetch(path,{method="GET",body,headers={}}={}){
  const session=await ensureSession();
  if(!session)throw new Error("Sign in with email to sync this data across devices.");
  const res=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{method,headers:restHeaders(session.access_token,headers),body:body==null?undefined:JSON.stringify(body)});
  const text=await res.text();const data=text?safeJson(text,text):null;
  if(!res.ok)throw new Error(errMessage(typeof data==="object"?data:null,res.status));
  return data;
}

export async function dbSelect(table,query=""){
  const q=query?`?${query}`:"";return await authedFetch(`${table}${q}`)||[];
}
export async function dbInsert(table,rows,{returning=true}={}){
  return await authedFetch(table,{method:"POST",body:rows,headers:{Prefer:returning?"return=representation":"return=minimal"}});
}
export async function dbUpsert(table,rows,onConflict){
  const q=onConflict?`?on_conflict=${encodeURIComponent(onConflict)}`:"";
  return await authedFetch(`${table}${q}`,{method:"POST",body:rows,headers:{Prefer:"resolution=merge-duplicates,return=representation"}});
}
export async function dbUpdate(table,patch,filter){
  return await authedFetch(`${table}?${filter}`,{method:"PATCH",body:patch,headers:{Prefer:"return=representation"}});
}
export async function dbDelete(table,filter){
  return await authedFetch(`${table}?${filter}`,{method:"DELETE",headers:{Prefer:"return=minimal"}});
}

function uuid(){return crypto.randomUUID?.()||`${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-4${Math.random().toString(16).slice(2,5)}-8${Math.random().toString(16).slice(2,5)}-${Math.random().toString(16).slice(2,14)}`}
function profileRow(userId,p={}){
  const age=["10-12","13-15","16-17","18+"].includes(p.age)?p.age:null;
  const subjects=["Math","Science","English","Computer Science","History","Geography","Languages","Exam Prep"];
  const styles=["Step by step","Short and direct","Examples first","Visual explanation"];
  return {user_id:userId,nickname:String(p.nickname||"Learner").trim().slice(0,32)||"Learner",age_band:age,main_subject:subjects.includes(p.subject)?p.subject:null,explanation_style:styles.includes(p.style)?p.style:null};
}
export async function saveCloudProfile(p){const s=await ensureSession();if(!s)return null;return dbUpsert("profiles",profileRow(s.user.id,p),"user_id")}
export async function getCloudProfile(){const s=await ensureSession();if(!s)return null;const rows=await dbSelect("profiles","select=user_id,nickname,age_band,main_subject,explanation_style,created_at,updated_at&limit=1");return rows?.[0]||null}

export async function migrateLocalData(){
  const s=await ensureSession();if(!s)return false;const userId=s.user.id,marker=`tsb_cloud_migrated_${userId}`;
  if(loadLocal(marker,false))return true;
  const p=loadLocal("tsb_profile",{})||{};if(Object.keys(p).length)await saveCloudProfile(p);
  const sessions=loadLocal("tsb_chat_sessions",[])||[];
  for(const local of sessions.slice(-30)){
    const threadId=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(local.id||"")?local.id:uuid();
    local.id=threadId;
    await dbUpsert("chat_threads",{id:threadId,user_id:userId,title:String(local.title||"Study chat").slice(0,120),subject:String(local.subject||"General").slice(0,60),created_at:new Date(local.createdAt||Date.now()).toISOString(),updated_at:new Date(local.updatedAt||Date.now()).toISOString()},"id");
    const rows=(local.messages||[]).slice(-100).map(m=>{m.id=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(m.id||"")?m.id:uuid();return{id:m.id,thread_id:threadId,user_id:userId,role:m.role==="assistant"?"assistant":"user",content:String(m.content||"").slice(0,10000),created_at:new Date(m.at||m.created_at||Date.now()).toISOString()}});
    if(rows.length)await dbUpsert("chat_messages",rows,"id");
  }
  saveLocal("tsb_chat_sessions",sessions);
  const focus=loadLocal("tsb_focus_history",[])||[];
  for(const f of focus.slice(-50)){
    f.id=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(f.id||"")?f.id:uuid();
    await dbUpsert("focus_sessions",{id:f.id,user_id:userId,subject:String(f.subject||"General").slice(0,60),goal:String(f.goal||"").slice(0,300),planned_minutes:Number(f.plannedMin||f.planned_minutes||0)||null,seconds_spent:Math.max(0,Number(f.seconds||f.seconds_spent||0)||0),completed:!!f.completed,created_at:new Date(f.at||f.created_at||Date.now()).toISOString()},"id");
  }
  saveLocal("tsb_focus_history",focus);saveLocal(marker,true);return true;
}

export async function hydrateFromCloud(){
  const s=await ensureSession();if(!s)return false;
  const p=await getCloudProfile();if(p){const local=loadLocal("tsb_profile",{})||{};saveLocal("tsb_profile",{...local,nickname:p.nickname||local.nickname||"Learner",age:p.age_band||local.age||"13-15",subject:p.main_subject||local.subject||"Math",style:p.explanation_style||local.style||"Step by step"})}
  const threads=await dbSelect("chat_threads","select=id,title,subject,created_at,updated_at&order=updated_at.desc&limit=30");
  const messages=await dbSelect("chat_messages","select=id,thread_id,role,content,created_at&order=created_at.asc&limit=1000");
  const grouped=new Map();for(const m of messages||[]){if(!grouped.has(m.thread_id))grouped.set(m.thread_id,[]);grouped.get(m.thread_id).push({id:m.id,role:m.role,content:m.content,at:new Date(m.created_at).getTime()})}
  if(threads?.length)saveLocal("tsb_chat_sessions",threads.map(t=>({id:t.id,title:t.title,subject:t.subject,createdAt:new Date(t.created_at).getTime(),updatedAt:new Date(t.updated_at).getTime(),messages:grouped.get(t.id)||[]})));
  const focus=await dbSelect("focus_sessions","select=id,subject,goal,planned_minutes,seconds_spent,completed,created_at&order=created_at.asc&limit=100");
  if(focus?.length)saveLocal("tsb_focus_history",focus.map(f=>({id:f.id,subject:f.subject,goal:f.goal,plannedMin:f.planned_minutes,seconds:f.seconds_spent,completed:f.completed,at:new Date(f.created_at).getTime()})));
  return true;
}

export async function syncThread(thread){
  const s=await ensureSession();if(!s||!thread)return false;const userId=s.user.id;
  thread.id=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(thread.id||"")?thread.id:uuid();
  await dbUpsert("chat_threads",{id:thread.id,user_id:userId,title:String(thread.title||"Study chat").slice(0,120),subject:String(thread.subject||"General").slice(0,60),created_at:new Date(thread.createdAt||Date.now()).toISOString(),updated_at:new Date(thread.updatedAt||Date.now()).toISOString()},"id");
  const rows=(thread.messages||[]).slice(-100).map(m=>{m.id=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(m.id||"")?m.id:uuid();return{id:m.id,thread_id:thread.id,user_id:userId,role:m.role==="assistant"?"assistant":"user",content:String(m.content||"").slice(0,10000),created_at:new Date(m.at||Date.now()).toISOString()}});
  if(rows.length)await dbUpsert("chat_messages",rows,"id");return true;
}

export async function deleteCloudThread(threadId){const s=await ensureSession();if(!s)return false;await dbDelete("chat_threads",`id=eq.${encodeURIComponent(threadId)}`);return true}
export async function saveClassroomSession(row){const s=await ensureSession();if(!s)return false;return dbInsert("classroom_sessions",{id:uuid(),user_id:s.user.id,question:String(row.question||"").slice(0,1200),subject:String(row.subject||"General").slice(0,60),lesson:row.lesson||{},created_at:new Date().toISOString()})}
export async function saveFocusSession(row){const s=await ensureSession();if(!s)return false;row.id=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(row.id||"")?row.id:uuid();return dbUpsert("focus_sessions",{id:row.id,user_id:s.user.id,subject:String(row.subject||"General").slice(0,60),goal:String(row.goal||"").slice(0,300),planned_minutes:Number(row.plannedMin||0)||null,seconds_spent:Math.max(0,Number(row.seconds||0)||0),completed:!!row.completed,created_at:new Date(row.at||Date.now()).toISOString()},"id")}

export {SUPABASE_URL};

// This site intentionally uses Supabase's browser-only implicit email flow.
const AUTH_KEYS=["access_token","refresh_token","expires_in","expires_at","token_type","type","error","error_code","error_description","token_hash","code"];
export function authPayload(href=location.href){
  const url=new URL(href),params=new URLSearchParams(url.search);
  for(const [k,v] of new URLSearchParams(url.hash.slice(1)))if(AUTH_KEYS.includes(k))params.set(k,v);
  return params;
}
export function hasAuthPayload(href=location.href){const p=authPayload(href);return AUTH_KEYS.filter(k=>!["type","expires_in","expires_at","token_type"].includes(k)).some(k=>p.has(k))}
export function clearAuthUrl(){
  const url=new URL(location.href);
  for(const k of AUTH_KEYS)url.searchParams.delete(k);
  if(url.hash.includes("=")){const h=new URLSearchParams(url.hash.slice(1));for(const k of AUTH_KEYS)h.delete(k);url.hash=h.toString()}
  history.replaceState(null,"",url.pathname+url.search+url.hash);
}
export async function completeEmailLink(href=location.href){
  const p=authPayload(href);clearAuthUrl();
  if(p.has("error")||p.has("error_code")||p.has("error_description"))throw new Error("This sign-in link is invalid, expired, or already used. Request a new link and open the newest email.");
  let session;
  if(p.get("token_hash")){
    const type=p.get("type")||"email";
    if(!["email","magiclink","signup"].includes(type))throw new Error("This link is not an email sign-in link. Request a new one.");
    const res=await fetch(`${SUPABASE_URL}/auth/v1/verify`,{method:"POST",headers:authHeaders(),body:JSON.stringify({token_hash:p.get("token_hash"),type})});
    if(!res.ok)throw new Error("This sign-in link is invalid, expired, or already used. Request a new link.");
    session=normalizeSession(await res.json());
  }else if(p.get("code")){
    throw new Error("This link belongs to a different sign-in flow. Return to sign in and request a fresh link from this website.");
  }else session=normalizeSession(Object.fromEntries(p));
  if(!session)throw new Error("This sign-in link is incomplete. Request a new link from the sign-in page.");
  const res=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${session.access_token}`}});
  if(!res.ok)throw new Error("This sign-in session could not be verified. Request a new link.");
  session.user=await res.json();
  if(!session.user?.id)throw new Error("No verified user was returned. Please request a new link.");
  persistSession(session);return session;
}
