/* 사이트 눈검증 캡처 — 모바일(390)·PC(1440) × 낮·어두운 모드 */
import { chromium } from 'playwright';
import { start } from './serve.mjs';
import fs from 'fs'; import path from 'path';
import { WORK, chromePath } from './paths.mjs';
const srv=await start(8300);
const b=await chromium.launch({args:['--no-sandbox'],executablePath:chromePath()});
const OUTD=path.join(WORK,'review'); fs.mkdirSync(OUTD,{recursive:true});
const targets=(process.argv[2]||'/').split(',');
const errs=[];
for(const t of targets){
  for(const [w,h,tag] of [[390,844,'m'],[1440,900,'d']]){
    for(const scheme of ['light','dark']){
      const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,colorScheme:scheme});
      const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(t+' '+e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(t+' console: '+m.text()); });
      await p.goto('http://localhost:8300'+t,{waitUntil:'networkidle'});
      await p.evaluate(async()=>{ for(let y=0;y<document.body.scrollHeight;y+=500){ window.scrollTo(0,y); await new Promise(r=>setTimeout(r,60)); } window.scrollTo(0,0);
      document.querySelectorAll('.reveal').forEach(e=>e.classList.add('in')); document.querySelectorAll('img[loading=lazy]').forEach(i=>i.loading='eager'); });
      await p.waitForLoadState('networkidle');
      await p.evaluate(async()=>{ await Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r}))); });
      await p.waitForTimeout(500);
      const name=(t==='/'?'home':t.replace(/\//g,'_').replace(/\.html$/,''))+'-'+tag+'-'+scheme;
      await p.screenshot({path:`${OUTD}/${name}.png`,fullPage:true});
      await ctx.close();
    }
  }
}
console.log('사진:', OUTD); console.log(errs.length?'ERRORS:\n'+[...new Set(errs)].join('\n'):'no JS errors');
await b.close(); srv.close();
