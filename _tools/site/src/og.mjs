/* 카톡·쓰레드 공유 미리보기 이미지(1200×630) — 페이지마다 한 장. 사이트와 같은 글꼴·색으로 그린다 */
import { chromium } from 'playwright';
import { start } from './serve.mjs';
import fs from 'fs'; import path from 'path';
import { OUT, SRC, chromePath } from './paths.mjs';
const jobs=JSON.parse(fs.readFileSync(path.join(OUT,'og-jobs.json'),'utf8'));
const WORDMARK=fs.readFileSync(path.join(SRC,'wordmark.svg'),'utf8');
const srv=await start(8310);
const b=await chromium.launch({args:['--no-sandbox'],executablePath:chromePath()});
const ctx=await b.newContext({viewport:{width:1200,height:630},deviceScaleFactor:1});
const p=await ctx.newPage();
fs.mkdirSync(path.join(OUT,'assets/og'),{recursive:true});
const MASCOT=`<svg viewBox="0 0 120 110"><path d="M60 6 L70 22 L84 12 L88 30 L106 26 L100 44 L118 48 L104 60 L114 74 L96 74 L98 90 L82 82 L60 96 L38 82 L22 90 L24 74 L6 74 L16 60 L2 48 L20 44 L14 26 L32 30 L36 12 L50 22 Z" fill="#8A6248"/><ellipse cx="60" cy="62" rx="34" ry="30" fill="#FFF1DE"/><circle cx="42" cy="63" r="6" fill="#FBC7BC" opacity=".85"/><circle cx="78" cy="63" r="6" fill="#FBC7BC" opacity=".85"/><path d="M46 56 q4 -5 8 0" stroke="#4A392E" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M66 56 q4 -5 8 0" stroke="#4A392E" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M54 65 q6 6 12 0" stroke="#8A5A44" stroke-width="2.6" fill="none" stroke-linecap="round"/><ellipse cx="60" cy="47" rx="5" ry="4" fill="#8A6248"/></svg>`;
const css=`*{box-sizing:border-box;margin:0}body{width:1200px;height:630px;overflow:hidden;font-family:"Pretendard Variable",Pretendard,sans-serif;word-break:keep-all;letter-spacing:-.03em}
.b{position:absolute;left:64px;top:52px;display:flex;align-items:center;gap:12px}.b img{width:56px;height:56px;border-radius:16px}.b svg{height:38px;width:auto;color:currentColor}
.url{position:absolute;left:64px;bottom:48px;font-size:26px;font-weight:700;opacity:.75;letter-spacing:-.01em}
.chip{display:inline-block;padding:10px 20px;border-radius:999px;font-size:26px;font-weight:750;margin:0 10px 10px 0}`;
function html(j){
  if(j.kind==='home') return `<style>${css}body{background:#FBF3E7;color:#33261D}
.blob{position:absolute;right:-120px;top:-160px;width:720px;height:720px;border-radius:50%;background:radial-gradient(closest-side,#FFD3B4,transparent)}
.blob2{position:absolute;left:-160px;bottom:-260px;width:620px;height:620px;border-radius:50%;background:radial-gradient(closest-side,#CDEBD8,transparent)}
h1{position:absolute;left:64px;top:150px;font-size:74px;font-weight:850;line-height:1.16}
p.s{position:absolute;left:66px;top:352px;font-size:34px;font-weight:650;color:#66503F}
.ey{position:absolute;left:64px;top:438px;display:flex;gap:10px}.ey span{background:#fff;border-radius:999px;padding:10px 18px;font-size:24px;font-weight:750;color:#A93A17;box-shadow:0 2px 0 #EDDCC4}
.ph{position:absolute;right:92px;top:58px;width:300px;height:650px;border-radius:48px;padding:11px;background:linear-gradient(150deg,#3a2d24,#140e0a);transform:rotate(5deg);box-shadow:0 40px 70px -28px rgba(80,40,15,.55)}
.ph img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:38px}
</style><div class="blob"></div><div class="blob2"></div><div class="b"><img src="/www/icon-192.png">${WORDMARK}</div>
<h1>오늘 아기랑<br>뭐 하고 놀지,</h1><p class="s">생일만 넣으면 개월수별 놀이를 골라 줘요</p>
<div class="ey"><span>무료</span><span>설치·가입 없이</span><span>기록은 폰 안에만</span></div>
<div class="ph"><img src="/assets/shots/home-light.webp"></div><div class="url">goseumi-app.github.io</div>`;
  if(j.kind==='play') return `<style>${css}body{background:#FBF3E7;color:#33261D}
.blob{position:absolute;right:-140px;top:-120px;width:720px;height:720px;border-radius:50%;background:radial-gradient(closest-side,#FFE0C7,transparent)}
.big{position:absolute;left:60px;top:140px;font-size:${j.big.length>4?120:150}px;font-weight:880;color:#C7461F;line-height:1}
h1{position:absolute;left:64px;top:${j.big.length>4?290:318}px;font-size:66px;font-weight:840}
h1 em{font-style:normal;color:#C7461F}
p.s{position:absolute;left:66px;top:${j.big.length>4?384:410}px;font-size:30px;font-weight:650;color:#66503F}
.m{position:absolute;right:88px;top:120px;width:340px}
.chips{position:absolute;right:60px;bottom:52px;width:520px;text-align:right}
.c1{background:#DCEBF7;color:#1F4A6E}.c2{background:#D5EFDF;color:#1F5A38}.c3{background:#FCE0DC;color:#7A2E26}.c4{background:#FFEFC4;color:#6B4A06}
</style><div class="blob"></div><div class="b"><img src="/www/icon-192.png">${WORDMARK}</div>
<div class="big">${j.big}</div><h1>${j.title} <em>${j.count}</em></h1><p class="s">${j.sub}</p>
<div class="m">${MASCOT}</div><div class="chips"><span class="chip c1">인지</span><span class="chip c2">신체</span><span class="chip c3">사회성</span><span class="chip c4">언어</span></div>
<div class="url">goseumi-app.github.io</div>`;
  /* moon — 밤 색 */
  return `<style>${css}body{background:#211913;color:#F7ECDF}
.sky{position:absolute;inset:0;background:radial-gradient(900px 600px at 85% 20%,#3A2B20,transparent)}
.glow{position:absolute;right:100px;top:70px;width:340px;height:340px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,214,140,.28),transparent)}
.moon{position:absolute;right:130px;top:100px;width:280px;height:280px;border-radius:50%;background:#FFE3A8;
  -webkit-mask:radial-gradient(circle at 28% 34%,transparent 0 50%,#000 51%);mask:radial-gradient(circle at 28% 34%,transparent 0 50%,#000 51%)}
.st{position:absolute;width:6px;height:6px;border-radius:50%;background:#F7ECDF;opacity:.7}
.big{position:absolute;left:60px;top:150px;font-size:${j.big.length>4?110:132}px;font-weight:880;color:#FFB98F;line-height:1}
h1{position:absolute;left:64px;top:306px;font-size:66px;font-weight:840}
h1 em{font-style:normal;color:#FFB98F}
p.s{position:absolute;left:66px;top:398px;font-size:30px;font-weight:650;color:#D8C3AE}
.b svg{color:#F7ECDF}.url{color:#F7ECDF}
.tel{position:absolute;right:64px;bottom:50px;background:#E86F47;color:#211913;border-radius:18px;padding:14px 26px;font-size:28px;font-weight:800}
</style><div class="sky"></div><div class="glow"></div><div class="moon"></div>
<div class="st" style="left:720px;top:120px"></div><div class="st" style="left:640px;top:260px"></div><div class="st" style="left:1060px;top:420px"></div><div class="st" style="left:820px;top:470px"></div>
<div class="b"><img src="/www/icon-192.png">${WORDMARK}</div>
<div class="big">${j.big}</div><h1>${j.title} <em>${j.count}</em></h1><p class="s">${j.sub}</p>
<div class="tel">가기 전 전화로 확인</div><div class="url">goseumi-app.github.io</div>`;
}
for(const j of jobs){
  await p.goto('http://localhost:8310/404.html');   /* 같은 주소 아래에서 그려야 글꼴·그림을 불러온다 */
  await p.setContent(`<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><base href="http://localhost:8310/"><style>@font-face{font-family:"Pretendard Variable";font-weight:45 920;font-style:normal;font-display:block;src:url(/__tools/pretendard.woff2) format("woff2-variations")}</style></head><body>${html(j)}</body></html>`,{waitUntil:'networkidle'});
  await p.evaluate(()=>document.fonts.ready);
  await p.waitForTimeout(150);
  await p.screenshot({path:path.join(OUT,'assets/og',j.name+'.jpg'),type:'jpeg',quality:88});
}
fs.unlinkSync(path.join(OUT,'og-jobs.json'));
console.log('og images:', jobs.length);
await b.close(); srv.close();
