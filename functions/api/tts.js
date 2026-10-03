
const burst=new Map(),daily=new Map();
const BURST_LIMIT=6,BURST_MS=60_000,VISITOR_DAILY=25,AURA_SITE_DAILY=20;
function json(body,status=200,extra={}){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...extra}})}
function clean(v,max){return String(v??"").replace(/\u0000/g,"").replace(/\s+/g," ").trim().slice(0,max)}
function visitor(v){const s=clean(v,90);return /^[A-Za-z0-9._-]{8,90}$/.test(s)?s:"anon"}
function today(){return new Date().toISOString().slice(0,10)}
function burstOK(k){const n=Date.now(),p=burst.get(k);if(!p||n-p.start>BURST_MS){burst.set(k,{start:n,count:1});return true}if(p.count>=BURST_LIMIT)return false;p.count++;return true}
async function count(request,key,limit){try{const c=caches.default,u=new URL(request.url);u.pathname=`/__tsb_tts/${today()}/${encodeURIComponent(key)}`;u.search="";const req=new Request(u,{method:"GET"}),h=await c.match(req),n=Number(await h?.text()||0);if(n>=limit)return false;await c.put(req,new Response(String(n+1),{headers:{"cache-control":"public,max-age=86400"}}));return true}catch{const k=`${today()}:${key}`,n=daily.get(k)||0;if(n>=limit)return false;daily.set(k,n+1);return true}}
function xml(v){return v.replace(/[<>&'"]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[c]))}
async function azure(text,env){
  if(!env.AZURE_SPEECH_KEY||!env.AZURE_SPEECH_REGION)return null;
  const region=clean(env.AZURE_SPEECH_REGION,40).toLowerCase();if(!/^[a-z0-9-]+$/.test(region))return null;
  const ssml=`<speak version="1.0" xml:lang="en-US"><voice name="en-US-AnaNeural"><prosody rate="-8%" pitch="+14%">${xml(text)}</prosody></voice></speak>`;
  const r=await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,{method:"POST",headers:{"Ocp-Apim-Subscription-Key":env.AZURE_SPEECH_KEY,"Content-Type":"application/ssml+xml","X-Microsoft-OutputFormat":"audio-24khz-48kbitrate-mono-mp3","User-Agent":"TurtleStudyBuddy"},body:ssml});
  if(!r.ok){console.warn("Azure TTS",r.status,await r.text().catch(()=>""));return null}
  return new Response(r.body,{status:200,headers:{"content-type":"audio/mpeg","cache-control":"private,max-age=86400","x-tsb-voice-provider":"Azure Ana Neural"}});
}
async function aura(text,env){
  if(!env.AI)return null;
  try{
    const r=await env.AI.run("@cf/deepgram/aura-1",{text,speaker:"luna",encoding:"mp3"},{returnRawResponse:true});
    if(!r?.ok){console.warn("Aura TTS",r?.status);return null}
    return new Response(r.body,{status:200,headers:{"content-type":r.headers.get("content-type")||"audio/mpeg","cache-control":"private,max-age=86400","x-tsb-voice-provider":"Cloudflare Aura · Luna"}});
  }catch(err){console.warn("Aura TTS error",err);return null}
}
export async function onRequestPost(context){
  try{
    const origin=context.request.headers.get("origin"),expected=new URL(context.request.url).origin;if(origin&&origin!==expected)return json({message:"Origin not allowed."},403);
    if(!(context.request.headers.get("content-type")||"").includes("application/json"))return json({message:"JSON required."},415);
    const body=await context.request.json().catch(()=>null),text=clean(body?.text,250);if(!text)return json({message:"Please provide text to speak."},400);
    const ip=context.request.headers.get("cf-connecting-ip")||"unknown",v=visitor(context.request.headers.get("x-tsb-visitor"));
    if(!burstOK(`${ip}:${v}`))return json({message:"Voice is being used quickly. Wait a minute, then try again."},429,{"retry-after":"60"});
    if(!await count(context.request,`visitor:${ip}:${v}`,VISITOR_DAILY))return json({message:"You’ve reached today’s free voice limit on this device. Turtle will use the browser voice instead."},429);
    const a=await azure(text,context.env);if(a)return a;
    if(!await count(context.request,"aura-site",AURA_SITE_DAILY))return json({message:"Today’s free cloud voice allowance has been used. Turtle will use the browser voice instead."},429);
    const c=await aura(text,context.env);if(c)return c;
    return json({message:"Cloud voice is unavailable right now. Turtle will use the browser voice instead.",code:"browser_fallback"},503);
  }catch(err){console.error("tts",err);return json({message:"Cloud voice is unavailable right now. Turtle will use the browser voice instead.",code:"browser_fallback"},503)}
}
export async function onRequest(context){if(context.request.method==="POST")return onRequestPost(context);return json({message:"Method not allowed."},405,{allow:"POST"})}
