/* 홈페이지 기능 검증 — 카톡 안내 띠 · 설치 탭 기본값 · 미리 보기 → 앱 이어받기 · QR · 404 · 붙박이 권유 */
import { chromium } from 'playwright';
import { start } from './serve.mjs';
import { chromePath } from './paths.mjs';
const srv=await start(8330);
const b=await chromium.launch({args:['--no-sandbox'],executablePath:chromePath()});
const R=[]; const ok=(n,d='')=>R.push('  ✅ '+n+(d?' — '+d:'')); const bad=(n,d='')=>R.push('  ❌ '+n+(d?' — '+d:''));
const B='http://localhost:8330';
const UA={kakaoA:'Mozilla/5.0 (Linux; Android 14; SM-S918N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0 Mobile Safari/537.36;KAKAOTALK 2410330',
  instaI:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 345.0.0',
  safariI:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeA:'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'};
async function pg(ua,vp={width:390,height:844}){ const ctx=await b.newContext({viewport:vp,userAgent:ua}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); return {ctx,p,errs}; }

// 1) 카톡(안드로이드) — 띠·버튼·탭
{ const {ctx,p,errs}=await pg(UA.kakaoA); await p.goto(B+'/'); await p.waitForTimeout(300);
  const s=await p.evaluate(()=>({on:document.getElementById('inapp').classList.contains('on'),txt:document.getElementById('inapp').innerText,
    tab:document.querySelector('[role=tab][aria-selected=true]').textContent, out:document.querySelector('[data-outside]').textContent}));
  (s.on&&s.txt.includes('카카오톡 안에서 열려 있어요')&&s.txt.includes('크롬으로 열기'))?ok('카톡 안 — 위쪽 안내 띠 «크롬으로 열기»'):bad('카톡 띠',JSON.stringify(s));
  s.tab.includes('카톡')?ok('설치 안내가 «카톡에서 열었어요» 칸으로 열림'):bad('탭 기본값',s.tab);
  s.out.includes('크롬으로 열기')?ok('설치 칸 안 버튼도 «크롬으로 열기»'):bad('설치 칸 버튼',s.out);
  errs.length?bad('JS 오류(카톡)',errs.join('/')):null; await ctx.close(); }
// 2) 인스타(아이폰) — «사파리로 여는 법»
{ const {ctx,p}=await pg(UA.instaI); await p.goto(B+'/play/8.html'); await p.waitForTimeout(300);
  const t=await p.evaluate(()=>document.getElementById('inapp').innerText);
  (t.includes('인스타그램')&&t.includes('사파리로 여는 법'))?ok('인스타(아이폰) 안내 페이지에도 띠 «사파리로 여는 법»'):bad('인스타 띠',t); await ctx.close(); }
// 3) 보통 브라우저 — 띠 없음 · 탭 기본값
for(const [ua,exp] of [[UA.safariI,'아이폰'],[UA.chromeA,'안드로이드']]){
  const {ctx,p}=await pg(ua); await p.goto(B+'/'); await p.waitForTimeout(300);
  const s=await p.evaluate(()=>({on:document.getElementById('inapp').classList.contains('on'),tab:document.querySelector('[role=tab][aria-selected=true]').textContent,
    vis:[...document.querySelectorAll('[role=tabpanel]')].filter(x=>!x.hidden).length}));
  (!s.on&&s.tab===exp&&s.vis===1)?ok(exp+' — 띠 없음 · «'+exp+'» 칸이 먼저'):bad(exp+' 기본값',JSON.stringify(s)); await ctx.close(); }
// 4) 미리 보기 → 앱 이어받기
{ const {ctx,p,errs}=await pg(UA.chromeA); await p.goto(B+'/'); await p.waitForTimeout(200);
  await p.fill('#demo-birth','2026-01-12'); await p.click('#demo-form button[type=submit]'); await p.waitForSelector('.dplay');
  const d=await p.evaluate(()=>({n:document.querySelectorAll('.dplay').length,age:document.querySelector('.demo-age').textContent,doms:[...document.querySelectorAll('.dplay .tag')].map(t=>t.textContent),
    month:document.querySelector('.demo-cta a.btn-sec').getAttribute('href')}));
  (d.n===4&&new Set(d.doms).size===4)?ok('미리 보기 — 네 영역 하나씩',d.age+' · '+d.doms.join('·')):bad('미리 보기',JSON.stringify(d));
  const resp=await p.request.get(B+d.month); resp.ok()?ok('«놀이 전부 보기» → '+d.month+' 열림'):bad('월 페이지 링크',d.month);
  await Promise.all([p.waitForURL('**/www/index.html'),p.click('#demo-go')]); await p.waitForTimeout(500);
  const o=await p.evaluate(()=>({v:typeof view!=='undefined'?view:'?',val:(document.querySelector('#obBirth')||{}).value,note:document.body.innerText.includes('홈페이지에서 넣은 생일')}));
  (o.v==='onboard'&&o.val==='2026-01-12'&&o.note)?ok('«이 생일로 시작하기» → 앱 첫 화면에 생일이 채워짐'):bad('이어받기',JSON.stringify(o));
  errs.length?bad('JS 오류(미리 보기)',errs.join('/')):null; await ctx.close(); }
// 4b) 20개월 — 구간(18~23개월) 놀이와 구간 페이지
{ const {ctx,p}=await pg(UA.chromeA); await p.goto(B+'/'); await p.waitForTimeout(200);
  const dd=new Date(); dd.setMonth(dd.getMonth()-20); dd.setDate(dd.getDate()-3); const b20=dd.toISOString().slice(0,10);
  await p.fill('#demo-birth',b20); await p.click('#demo-form button[type=submit]'); await p.waitForSelector('.dplay');
  const r=await p.evaluate(()=>({n:document.querySelectorAll('.dplay').length, href:document.querySelector('.demo-cta a.btn-sec').getAttribute('href'), txt:document.querySelector('.demo-cta a.btn-sec').textContent}));
  (r.n===4&&r.href==='/play/18.html'&&r.txt.includes('18~23개월'))?ok('20개월 미리 보기 — 네 영역 · «생후 18~23개월 놀이 전부 보기»'):bad('20개월 미리 보기',JSON.stringify(r));
  await p.goto(B+'/play/18.html'); const q=await p.evaluate(()=>({h1:document.querySelector('h1').textContent, n:document.querySelectorAll('article.play').length, lead:document.querySelector('.lead').textContent}));
  (q.h1.includes('18~23개월')&&q.n===12&&q.lead.includes('20개월'))?ok('구간 페이지 /play/18.html — «'+q.h1+'»'):bad('구간 페이지',JSON.stringify(q)); await ctx.close(); }
// 5) 미래 날짜·9개월 이상
{ const {ctx,p}=await pg(UA.chromeA); await p.goto(B+'/');
  await p.evaluate(()=>{const i=document.querySelector('#demo-birth'); i.removeAttribute('max'); i.value='2099-01-01'; document.querySelector('#demo-form').requestSubmit();}); await p.waitForTimeout(200);
  const f=await p.evaluate(()=>document.getElementById('demo-out').innerText); f.includes('아직 오지 않은 날짜')?ok('미래 날짜 안내'):bad('미래 날짜',f);
  await p.fill('#demo-birth','2021-01-01'); await p.click('#demo-form button[type=submit]'); await p.waitForSelector('.dplay');
  const g=await p.evaluate(()=>document.getElementById('demo-out').innerText); g.includes('까지') && g.includes('있어요')?ok('놀이보다 큰 아이 — 한계를 밝힘'):bad('큰 아이 안내',g.slice(0,80)); await ctx.close(); }
// 6) PC — QR 보임, 붙박이 권유 안 보임 / 모바일 — 스크롤하면 붙박이 권유
{ const {ctx,p}=await pg(undefined,{width:1440,height:900}); await p.goto(B+'/'); await p.waitForTimeout(300);
  const q=await p.evaluate(()=>{const x=document.querySelector('.qrbox');return getComputedStyle(x).display!=='none'&&x.getBoundingClientRect().width>100});
  q?ok('PC에서 «휴대폰 카메라로 비춰 보세요» QR'):bad('QR 안 보임'); await ctx.close(); }
{ const {ctx,p}=await pg(UA.chromeA); await p.goto(B+'/'); await p.waitForTimeout(200);
  const before=await p.evaluate(()=>document.getElementById('sticky-cta').classList.contains('on'));
  await p.evaluate(()=>window.scrollTo(0,2600)); await p.waitForTimeout(400);
  const after=await p.evaluate(()=>document.getElementById('sticky-cta').classList.contains('on'));
  (!before&&after)?ok('모바일 붙박이 «무료로 시작하기» — 첫 화면 단추가 가려지면 나타남'):bad('붙박이',before+'→'+after); await ctx.close(); }
// 7) 404
{ const {ctx,p}=await pg(UA.chromeA); const r=await p.goto(B+'/없는/주소'); const t=await p.evaluate(()=>document.body.innerText);
  (r.status()===404&&t.includes('이 페이지는 없어요'))?ok('없는 주소 → 404 안내'):bad('404',r.status()); await ctx.close(); }
// 8) FAQ·탭 키보드
{ const {ctx,p}=await pg(UA.chromeA); await p.goto(B+'/'); await p.focus('#t-and'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(100);
  const t=await p.evaluate(()=>document.activeElement.id+'/'+document.querySelector('[role=tab][aria-selected=true]').id); t==='t-inapp/t-inapp'?ok('설치 탭 — 화살표 키로 이동'):bad('탭 키보드',t); await ctx.close(); }
// 9) 놀이 쪽 «장난감 예시» — 파트너스 링크·공정위 문구·연령/KC 안내 · 장난감이 있는 쪽엔 광고 안내 · 좁은 폭 넘침·글자 대비
{ const {ctx,p}=await pg(UA.chromeA,{width:360,height:800}); await p.goto(B+'/play/9.html'); await p.waitForTimeout(300);
  const r=await p.evaluate(()=>{ const a=document.querySelector('#p93'); const l=[...a.querySelectorAll('.toys a.buy')];
    return {href:l.map(x=>x.getAttribute('href')), rel:l.map(x=>x.rel), note:(a.querySelector('.toy-note')||{}).textContent||'', ad:(document.querySelector('.ad-note')||{}).textContent||'', over:document.documentElement.scrollWidth-innerWidth, order:[...a.querySelectorAll('dt')].map(d=>d.textContent).join('>')}; });
  (r.href.length===1&&r.href[0]==='https://link.coupang.com/a/huO1YjzgiW'&&/sponsored/.test(r.rel[0])&&r.note.includes('사용 연령')&&r.note.includes('KC 인증')&&r.ad.includes('쿠팡 파트너스 활동의 일환')&&r.over<=0&&r.order==='준비물>장난감 예시>이렇게 해요>어려워하면>한 단계 더')
    ?ok('/play/9.html #93 — 장난감 예시 1개(파트너스 링크·sponsored)·연령/KC 안내·위쪽 공정위 문구·360px 넘침 없음'):bad('#93 장난감 예시',JSON.stringify(r)); await ctx.close(); }
{ const {ctx,p}=await pg(UA.chromeA); const want={0:1,1:2,2:1,4:1,5:1,6:3,7:2,8:2,9:1,12:2,15:1,24:1,30:2}; const got={}; const noAd=[];
  for(const m of [0,1,2,3,4,5,6,7,8,9,12,15,18,24,30]){ await p.goto(B+'/play/'+m+'.html'); const x=await p.evaluate(()=>({t:document.querySelectorAll('.toys').length, ad:!!document.querySelector('.ad-note')})); if(x.t) got[m]=x.t; if(x.t&&!x.ad) noAd.push(m); }
  const diff=Object.keys({...want,...got}).filter(k=>want[k]!==got[k]);
  (!diff.length&&!noAd.length)?ok('장난감 예시가 있는 쪽 13곳(20놀이)에 모두 광고 안내 문구',JSON.stringify(got)):bad('장난감 예시 쪽 분포',JSON.stringify({diff,noAd,got})); await ctx.close(); }
{ const {ctx,p}=await pg(UA.chromeA); await p.goto(B+'/play/15.html');
  const n=await p.evaluate(()=>[...document.querySelectorAll('#p117 .toys a.buy')].map(a=>a.textContent.trim()));
  (n.length===2&&n[0].includes('모양 끼우기 큐브')&&n[1].includes('여섯 면 놀이 큐브'))?ok('/play/15.html #117 — 장난감 2개',n.join(' | ')):bad('#117 장난감',JSON.stringify(n)); await ctx.close(); }
for(const scheme of ['light','dark']){ const ctx=await b.newContext({viewport:{width:390,height:844},colorScheme:scheme}); const p=await ctx.newPage(); await p.goto(B+'/play/15.html');
  const low=await p.evaluate(()=>{ const parse=c=>{const m=c.match(/rgba?\(([^)]+)\)/); if(!m) return [255,255,255,1]; const v=m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return [v[0],v[1],v[2],v[3]??1]};
    const over=(f,b)=>[f[0]*f[3]+b[0]*(1-f[3]),f[1]*f[3]+b[1]*(1-f[3]),f[2]*f[3]+b[2]*(1-f[3]),1];
    const lum=a=>{const m=a.slice(0,3).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*m[0]+.7152*m[1]+.0722*m[2]};
    const bgOf=el=>{const ch=[];let e=el;while(e){ch.push(e);e=e.parentElement} let bg=[255,255,255,1]; for(const x of ch.reverse()){const c=parse(getComputedStyle(x).backgroundColor); if(c[3]>0) bg=over(c,bg);} return bg};
    const out=[]; document.querySelectorAll('#p117 .toys, #p117 .toys *, #p117 .toy-note').forEach(el=>{ const t=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('').trim(); if(t.length<2) return;
      const s=getComputedStyle(el); const bg=bgOf(el); let fg=parse(s.color); if(fg[3]<1) fg=over(fg,bg); const c=(Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05); if(c<4.5) out.push(t.slice(0,12)+'('+c.toFixed(2)+')'); }); return out; });
  low.length?bad('장난감 예시 글자 대비('+scheme+')',low.join(' ')):ok('장난감 예시 글자 대비 4.5:1 이상 — '+(scheme==='dark'?'어둠':'낮')+' 모드'); await ctx.close(); }
console.log(R.join('\n')); console.log(R.some(x=>x.includes('❌'))?'FAIL':'PASS');
await b.close(); srv.close();
