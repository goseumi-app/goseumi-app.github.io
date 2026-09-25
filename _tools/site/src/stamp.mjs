/* 페이지의 ?v= 자리표시자를 «파일 내용 해시»로 채우고, 내용이 그대로인 페이지의 sitemap lastmod는 저장소 값을 그대로 둔다.
   순서: build.mjs → subset_font.py → (여기) → og.mjs.  이유는 build.mjs 맨 위 주석에. */
import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
import { OUT, REPO } from './paths.mjs';
const h8=f=>crypto.createHash('sha1').update(fs.readFileSync(path.join(OUT,f))).digest('hex').slice(0,8);
const V={__V_FONT__:h8('fonts/pretendard-site.woff2'),__V_SITEJS__:h8('assets/site.js'),__V_DEMOJS__:h8('assets/demo.js'),__V_PLAYS__:h8('assets/plays.json')};
const htmls=[]; (function walk(d){ for(const n of fs.readdirSync(d)){ const p=path.join(d,n); fs.statSync(p).isDirectory()?walk(p):(n.endsWith('.html')&&htmls.push(p)); } })(OUT);
let stamped=0;
for(const f of htmls){ let s=fs.readFileSync(f,'utf8'), t=s; for(const [k,v] of Object.entries(V)) t=t.split(k).join(v); if(t!==s){ fs.writeFileSync(f,t); stamped++; } }
/* sitemap: 바이트가 저장소 사본과 같은 페이지는 예전 lastmod 유지 (검색엔진에 «바뀜»이라고 거짓말하지 않기) */
const sm=path.join(OUT,'sitemap.xml'); let xml=fs.readFileSync(sm,'utf8');
const old={}; try{ for(const m of fs.readFileSync(path.join(REPO,'sitemap.xml'),'utf8').matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)) old[m[1]]=m[2]; }catch(e){}
let kept=0;
xml=xml.replace(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g,(all,loc,today)=>{
  let rel=loc.replace(/^https?:\/\/[^/]+/,''); if(rel.endsWith('/')) rel+='index.html'; rel=rel.replace(/^\//,'');
  const a=path.join(OUT,rel), b=path.join(REPO,rel);
  /* ?v= 표시만 다른 것은 «내용이 바뀐 것»으로 치지 않는다 (날짜 표시 → 해시 표시로 바꾼 날처럼) */
  const norm=f=>fs.readFileSync(f,'utf8').replace(/\?v=[0-9a-z]+/g,'');
  const same = fs.existsSync(b) && (!fs.existsSync(a) || norm(a)===norm(b));
  if(same && old[loc]){ kept++; return `<loc>${loc}</loc><lastmod>${old[loc]}</lastmod>`; }
  return all;
});
fs.writeFileSync(sm,xml);
console.log(`?v= 도장: ${stamped}쪽 (${Object.entries(V).map(([k,v])=>k.replace(/_/g,'').toLowerCase()+'='+v).join(' · ')}) · sitemap lastmod 유지 ${kept}쪽`);
