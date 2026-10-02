
const $=s=>document.querySelector(s);
const input=$("#classQuestion"),out=$("#classLesson"),title=$("#boardQuestion");
function lessonFor(q){
  const clean=q.trim();
  const simple=clean.match(/(-?\d+(?:\.\d+)?)\s*([+\-×x*÷/])\s*(-?\d+(?:\.\d+)?)/i);
  if(simple){
    const a=Number(simple[1]),op=simple[2],b=Number(simple[3]);
    let ans;
    if(op==="+" )ans=a+b; else if(op==="-")ans=a-b; else if(["×","x","*"].includes(op))ans=a*b; else if(b!==0)ans=a/b;
    if(Number.isFinite(ans))return `<strong>Explain</strong><p>${a} ${op} ${b} asks us to combine the numbers using ${op}.</p><strong>Demonstrate</strong><p>${a} ${op} ${b} = ${ans}</p><strong>Try</strong><p>Can you make a similar problem and solve it?</p>`;
  }
  return `<strong>Explain</strong><p>Break the question into the key idea, what you already know, and what you need to find.</p><strong>Try</strong><p>Say the topic in your own words first. Turtle can then guide the next step in Chat.</p>`;
}
$("#teachBtn")?.addEventListener("click",()=>{
  const q=input.value.trim().slice(0,300)||"What do you want to learn?";
  title.textContent=q;
  out.innerHTML=lessonFor(q);
});
