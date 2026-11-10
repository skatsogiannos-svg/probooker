const fs = require("fs");
function strip(html){
  return html.replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g," ")
    .replace(/&#x27;/g,"'").replace(/&#x2F;/g,"/").replace(/&#x2B;/g,"+")
    .replace(/[ \t]+/g," ").replace(/\n{2,}/g,"\n").trim();
}
const f = process.argv[2];
const html = fs.readFileSync(f,"utf8");
const text = strip(html);
fs.writeFileSync(f.replace(".html",".txt"), text);
const desc=(html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i)||[])[1]||"";
console.log("FILE:", f.split(/[\\/]/).pop(), "| text:", text.length, "| DESC:", desc.slice(0,160));
