const fs=require("fs"),path=require("path");
const dir="research/external";
const files=fs.readdirSync(dir).filter(f=>f.endsWith(".txt"));
const keywords=["class","group","package","membership","whatsapp","sms","reminder","waitlist",
"deposit","prepay","no-show","noshow","intake","form","question","waiver","recurring","subscription",
"paypal","stripe","zoom","google meet","outlook","ical","api","webhook","zapier","calendar sync",
"pos","inventory","gift","loyalty","review","staff","team","multi","location","resource","room",
"split payment","payment plan","invoice","tip","cash","wallet","mobile app","widget","embed",
"round robin","collective","routing","availability","buffer","timezone","lead time","cancellation policy",
"automation","workflow","ai","klaviyo","segmentation","marketing","follow up","reactivat","birthday"];
const counts={};
for(const f of files){
  const t=fs.readFileSync(path.join(dir,f),"utf8").toLowerCase();
  const name=f.replace(".txt","");
  for(const k of keywords){ if(t.includes(k)){ (counts[k]=counts[k]||new Set()).add(name);} }
}
const rows=Object.entries(counts).map(([k,s])=>[k,s.size,[...s].join(",")]).sort((a,b)=>b[1]-a[1]);
console.log("KEYWORD".padEnd(20),"#APPS","WHERE");
for(const [k,n,w] of rows){ console.log(k.padEnd(20),String(n).padEnd(5),w); }
