/* 성능 점수(라이트하우스, 모바일). 따로 설치: npm i --no-save lighthouse@12 chrome-launcher
   node src/lh.mjs /,/play/8.html,/moon/incheon.html */
import { start } from './serve.mjs';
import { chromePath } from './paths.mjs';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
const srv=await start(8321);
const chrome=await chromeLauncher.launch({chromePath:chromePath(),chromeFlags:['--headless=new','--no-sandbox']});
for(const u of (process.argv[2]||'/').split(',')){
const r=await lighthouse('http://localhost:8321'+u,{port:chrome.port,output:'json',logLevel:'error',onlyCategories:['performance','accessibility'],formFactor:'mobile',screenEmulation:{mobile:true,width:390,height:844,deviceScaleFactor:2},throttlingMethod:'simulate'});
const A=r.lhr.audits;
console.log('== '+u+' perf', Math.round(r.lhr.categories.performance.score*100), '| FCP',A['first-contentful-paint'].displayValue,'LCP',A['largest-contentful-paint'].displayValue,'TBT',A['total-blocking-time'].displayValue,'CLS',A['cumulative-layout-shift'].displayValue,'SI',A['speed-index'].displayValue);
const lcpEl=A['largest-contentful-paint-element']; console.log('LCP element:', JSON.stringify(lcpEl.details?.items?.[0]?.items?.[0]?.node?.snippet||lcpEl.details?.items?.[0]?.node?.snippet||'').slice(0,160));
for(const id of ['render-blocking-resources','unused-css-rules','total-byte-weight','uses-responsive-images','offscreen-images','font-display','layout-shift-elements','heading-order','unsized-images'])
  if(A[id]) console.log(id, A[id].score, A[id].displayValue||'', JSON.stringify((A[id].details?.items||[]).slice(0,3).map(i=>i.url||i.node?.snippet||i.source||'').map(x=>String(x).slice(-90))));
}
await chrome.kill(); srv.close();
