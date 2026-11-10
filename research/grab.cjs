const fs=require("fs");
function bullets(file){
  const t=fs.readFileSync(file,"utf8").replace(/[ ]{2,}/g," ").replace(/\n{2,}/g,"\n");
  return t;
}
const f=process.argv[2];
const t=bullets(f);
// print sections containing high-value feature words with context
const terms=process.argv.slice(3);
for(const term of terms){
  const i=t.toLowerCase().indexOf(term.toLowerCase());
  if(i>=0){ console.log(`\n--- "${term}" ---`); console.log(t.substring(i, Math.min(i+400, t.length)).replace(/\s+/g," ")); }
}
