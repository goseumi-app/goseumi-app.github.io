/* 고슴이 자동 점검 — 푸시할 때마다 GitHub Actions가 돌린다.
   사람이 눈으로 못 잡는 것만 본다: 데이터 무결성 · 전 화면 렌더 · 글자 대비 · 뒤로가기 · 백업 왕복 · 오프라인.
   실패하면 실행 요약(Summary)에 표로 뜬다. 로컬에서는 `node tests/check.mjs` */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';

/* 저장소 루트에 있어도, tests/ 안에 있어도 www 를 찾는다 */
let ROOT = path.dirname(fileURLToPath(import.meta.url));
if (!fs.existsSync(path.join(ROOT, 'www'))) ROOT = path.resolve(ROOT, '..');
const WWW = path.join(ROOT, 'www');
const MIME = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};

const results = [];
const ok  = (name, detail='') => results.push({pass:true,  name, detail});
const bad = (name, detail='') => results.push({pass:false, name, detail});

/* ─────────────── 1. 브라우저 없이 볼 수 있는 것 ─────────────── */
const html = fs.readFileSync(path.join(WWW,'index.html'),'utf8');
const js   = (html.match(/<script>([\s\S]*)<\/script>/)||[])[1] || '';

if (!js) bad('스크립트 추출'); else ok('스크립트 추출', (js.length/1024|0)+'KB');

const grab = (re, what) => { const m = js.match(re); if(!m){ bad('데이터 파싱: '+what); return null; }
  try { return JSON.parse(m[1]); } catch(e){ bad('데이터 파싱: '+what, e.message); return null; } };
const PLAYS = grab(/const PLAYS = (\[[\s\S]*?\]);\n/, 'PLAYS');
/* DAILY(관찰 원문)는 2026-08-30에 소스에서 제거됨 — 아래에서 «없음»을 검사한다 */
const PARTNER = grab(/const PARTNER_DEFAULT=(\{[\s\S]*?\})\s*;/, 'PARTNER_DEFAULT');

if (PLAYS) {
  const ns = PLAYS.map(p=>p.n);
  const dupN = ns.filter((v,i)=>ns.indexOf(v)!==i);
  const names = PLAYS.map(p=>p.name);
  const dupName = names.filter((v,i)=>names.indexOf(v)!==i);
  const noSrc = PLAYS.filter(p=>(!p.src||!p.src.length)&&!p.ref).map(p=>p.n);   /* 기록(src) 또는 연구 출처(ref) 중 하나는 반드시 */
  const refBad = PLAYS.filter(p=>p.ref&&!/CDC|WHO|소아과학회|질병관리청/.test(p.ref)).map(p=>p.n);
  const noHow = PLAYS.filter(p=>!p.how||!p.name||!p.mat).map(p=>p.n);
  const maxM = Math.max(...PLAYS.map(p=>p.m));
  dupN.length   ? bad('놀이 번호 중복', dupN.join(',')) : ok('놀이 '+PLAYS.length+'개 · 번호 중복 없음');
  dupName.length? bad('놀이 이름 중복', dupName.join(',')) : ok('놀이 이름 중복 없음');
  noSrc.length  ? bad('출처 없는 놀이', noSrc.join(',')) : ok('모든 놀이에 출처 있음 (기록 '+PLAYS.filter(p=>p.src&&p.src.length).length+' · 연구 기반 '+PLAYS.filter(p=>p.ref).length+')');
  refBad.length ? bad('연구 출처가 공식기관이 아님', refBad.join(',')) : null;
  noHow.length  ? bad('필수 항목 빠진 놀이', noHow.join(',')) : ok('놀이 필수 항목(이름·준비물·해보기) 모두 있음');
  /* 목록 루프에 월령 상한이 상수로 박히면 새 월령 놀이가 통째로 숨는다 (v16에서 실제로 일어났다) */
  const hard = js.match(/for\(let m=0;m<=(\d+);m\+\+\)/g);
  hard ? bad('놀이 목록 루프에 월령이 상수로 박힘', hard.join(' ')+' — 최대 월령은 '+maxM)
       : ok('놀이 목록 루프가 데이터에서 월령을 가져옴 (최대 '+maxM+'개월)');
}

{ /* 관찰 원문이 소스에 다시 들어오지 않는지 — 사생활 회귀 방지 */
  const hasDaily = /const DAILY *=/.test(js);
  const recDays = js.match(/const REC_DAYS=(\d+)/);
  if (hasDaily) bad('관찰 원문 유출', 'DAILY가 소스에 다시 들어옴 — 2026-08-30 제거 결정 위반');
  else if (!recDays) bad('REC_DAYS 상수 없음');
  else ok('관찰 원문 없음 (기록 일수 표기만 D'+recDays[1]+')');
}

if (PARTNER) {
  const badUrl = Object.entries(PARTNER).filter(([k,v])=>!/^https:\/\/link\.coupang\.com\//.test(v));
  badUrl.length ? bad('파트너스 링크 형식 이상', badUrl.map(([k])=>k).join(',')) : ok('파트너스 링크 '+Object.keys(PARTNER).length+'개 형식 정상');
}

/* 절대 금지선 — 「앱 방향」 메모에 적힌 것. 코드에 다시 기어들어오는 걸 막는다.
   숫자는 «지금 허용된 등장 횟수». 새로 늘면 실패한다. 왜 허용인지는 옆에 적어둔다. */
const ALLOWED = {
  'K-DST':0, 'KDST':0, 'M-CHAT':0, '발달지연':0, '자폐':0, '심화평가':0,
  '스크리닝':0, '조기발견':0, '정상 범위입니다':0, '또래 수준':0,
  '또래 비교':1,   // 설정 «이 앱이 하지 않는 것» 목록 (부정문)
  '발달 점수':1,   // 같은 문장
  '선별검사':1     // 면책 문구 «소아청소년과에서 발달선별검사를 받으세요» — 병원으로 보내는 말이라 허용
};
const over = Object.entries(ALLOWED)
  .map(([w,n])=>[w, js.split(w).length-1, n])
  .filter(([w,got,exp])=>got!==exp);
over.length ? bad('금지 표현 등장 횟수가 달라짐', over.map(([w,g,e])=>`${w} ${g}회(허용 ${e})`).join(', '))
            : ok('금지 표현 검사 통과 (판정·선별 문구 '+Object.keys(ALLOWED).length+'종)');

const sw = fs.readFileSync(path.join(WWW,'sw.js'),'utf8');
sw.trim().length > 200 ? ok('서비스워커 있음 (오프라인)') : bad('sw.js가 비어 있음 — 오프라인에서 안 열린다');

/* ─────────────── 2. 실제 브라우저에서 ─────────────── */
const srv = http.createServer((q,r)=>{
  let p = decodeURIComponent(q.url.split('?')[0]); if(p==='/') p='/index.html';
  const f = path.join(WWW, p);
  if(!f.startsWith(WWW) || !fs.existsSync(f)){ r.writeHead(404); return r.end(''); }
  r.writeHead(200, {'Content-Type': MIME[path.extname(f)] || 'application/octet-stream'});
  r.end(fs.readFileSync(f));
});
await new Promise(r=>srv.listen(8123,r));
const BASE = 'http://localhost:8123/index.html';
/* CI에서는 playwright가 받은 기본 브라우저를 쓰고, 로컬에서는 PW_CHROME 로 경로를 넘긴다 */
const launchOpts = {args:['--no-sandbox']};
if (process.env.PW_CHROME) launchOpts.executablePath = process.env.PW_CHROME;
const browser = await chromium.launch(launchOpts);
const VIEWS = ['home','plays','food','log','sleep','er','moon','map','vax','backup','summary','settings'];
const CHILD = JSON.stringify({birth:'2025-12-25',due:null,domain:'인지',reason:'play',name:'시우'});

async function fresh(opts={}) {
  const ctx = await browser.newContext({viewport:{width:412,height:900}, colorScheme:'light', ...opts});
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e=>errs.push(e.message));
  await page.goto(BASE);
  await page.evaluate(c=>localStorage.setItem('siwoo.child', c), CHILD);
  await page.reload(); await page.waitForTimeout(500);
  return {ctx, page, errs};
}

/* 1-★. 달빛어린이병원 데이터 — 개수·좌표 범위·실시간 문구 금지 */
{
  const mm = js.match(/const MOON=\[([\s\S]*?)\n\];/);
  if (!mm) bad('달빛 데이터', 'MOON 배열이 없다');
  else {
    let rows=[]; try { rows = eval('['+mm[1]+']'); } catch(e){ bad('달빛 데이터', '파싱 실패: '+e.message); }
    const n = rows.length;
    const badCoord = rows.filter(r=>r[4]!=null && !(r[4]>32.9&&r[4]<38.8&&r[5]>124.4&&r[5]<131.1));
    const noTel = rows.filter(r=>!/\d{7,}/.test(String(r[3]).replace(/\D/g,'')));
    const live = /진료중|진료종료/.test(mm[1]);   /* 실시간 배지를 구워 넣으면 거짓말이 된다 */
    if (n < 160) bad('달빛 데이터', '병원 수가 '+n+'개 — 160개 미만이면 목록이 깨진 것');
    else if (badCoord.length) bad('달빛 데이터', '좌표가 한국 밖: '+badCoord.slice(0,3).map(r=>r[0]).join(', '));
    else if (noTel.length) bad('달빛 데이터', '전화번호 형식 이상: '+noTel.slice(0,3).map(r=>r[0]).join(', '));
    else if (live) bad('달빛 데이터', '«진료중/종료» 실시간 문구가 구워져 있음 — 시각에 따라 거짓이 된다');
    else ok('달빛어린이병원 '+n+'곳 — 좌표·전화·문구 정상');
  }
}

/* 2-1. 전 화면 렌더 + 오류 */
{
  const {ctx,page,errs} = await fresh();
  const blank = [];
  for (const v of VIEWS) {
    await page.evaluate(x=>go(x, x==='browse'?'all':undefined), v);
    await page.waitForTimeout(90);
    const n = await page.evaluate(()=>document.querySelector('main').innerText.trim().length);
    if (n < 40) blank.push(v+'('+n+'자)');
  }
  blank.length ? bad('빈 화면', blank.join(', ')) : ok('전 화면 렌더 '+VIEWS.length+'개 정상');
  errs.length ? bad('자바스크립트 오류', errs.slice(0,3).join(' / ')) : ok('자바스크립트 오류 0건');
  await ctx.close();
}

/* 2-2. 글자 대비 — 낮/밤중 모드 전 화면 */
{
  const {ctx,page} = await fresh();
  const fails = [];
  for (const mode of ['off','on']) {
    await page.evaluate(m=>{night.mode=m; save(); applyNight(); render()}, mode);
    for (const v of VIEWS) {
      await page.evaluate(x=>go(x), v); await page.waitForTimeout(420);  /* 탭 전환 애니메이션(0.18s)+페이드(0.3s)가 끝나야 색이 확정된다 */
      const bad_ = await page.evaluate(()=>{
        const lum=c=>{const m=(c.match(/[\d.]+/g)||[0,0,0]).map(Number).slice(0,3)
          .map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});
          return .2126*m[0]+.7152*m[1]+.0722*m[2]};
        const bgOf=el=>{let e=el;while(e){const c=getComputedStyle(e).backgroundColor;
          if(c&&c!=='rgba(0, 0, 0, 0)'&&c!=='transparent')return c;e=e.parentElement}return 'rgb(255,255,255)'};
        const out=[];
        document.querySelectorAll('main *, nav.bottom *, header *').forEach(el=>{
          const txt=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('').trim();
          if(!txt||txt.length<2)return;
          const s=getComputedStyle(el);
          if(s.display==='none'||s.visibility==='hidden'||+s.opacity<0.3)return;
          const r=el.getBoundingClientRect(); if(r.width<4||r.height<4)return;
          const l1=lum(s.color), l2=lum(bgOf(el));
          const c=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
          const big=parseFloat(s.fontSize)>=18.66&&+s.fontWeight>=700||parseFloat(s.fontSize)>=24;
          if(c<(big?3:4.5)) out.push(txt.slice(0,20)+' ('+c.toFixed(2)+', ['+(el.className||el.tagName)+'])');
        });
        return [...new Set(out)];
      });
      bad_.forEach(x=>fails.push(`${mode==='on'?'밤':'낮'}/${v}: ${x}`));
    }
  }
  fails.length ? bad('글자 대비 4.5 미만 '+fails.length+'곳', fails.slice(0,6).join(' · '))
               : ok('글자 대비 — 낮·밤중 모드 '+VIEWS.length+'화면 모두 통과');
  await ctx.close();
}

/* 2-3. 밤중 모드에서 하단 탭이 화면에 붙어 있나 (filter가 fixed를 깨뜨린 적 있다) */
{
  const {ctx,page} = await fresh();
  await page.evaluate(()=>{night.mode='on'; save(); applyNight(); go('map')});
  await page.waitForTimeout(300);
  const r = await page.evaluate(()=>{ window.scrollTo(0,600);
    const b=document.querySelector('nav.bottom').getBoundingClientRect();
    return {inView: b.bottom<=innerHeight+2 && b.top>=0, top:Math.round(b.top), h:innerHeight}; });
  r.inView ? ok('밤중 모드에서도 하단 탭이 화면에 고정')
           : bad('밤중 모드에서 하단 탭이 화면 밖', 'top='+r.top+' / 화면 '+r.h);
  await ctx.close();
}

/* 2-4. 폰 뒤로가기 */
{
  const ctx = await browser.newContext({viewport:{width:412,height:900}});
  await ctx.addInitScript(()=>{ window.__exit=0; window.__h=[];
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'android',
      Plugins:{App:{addListener:(n,f)=>{if(n==='backButton')window.__h.push(f);return{remove(){}}},exitApp:()=>{window.__exit++}}}}; });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.evaluate(c=>localStorage.setItem('siwoo.child', c), CHILD);
  await page.reload(); await page.waitForTimeout(500);
  const press = async()=>{ await page.evaluate(()=>window.__h.forEach(f=>f({canGoBack:true}))); await page.waitForTimeout(180); };
  const bound = await page.evaluate(()=>hwBack.bound);
  await page.evaluate(()=>{go('plays'); }); await page.waitForTimeout(120);
  await page.evaluate(()=>{go('card',12);}); await page.waitForTimeout(120);
  await press(); const v1 = await page.evaluate(()=>view);
  await press(); const v2 = await page.evaluate(()=>view);
  await press(); const e1 = await page.evaluate(()=>window.__exit);   /* 홈에서 1회 → 경고만 */
  await press(); const e2 = await page.evaluate(()=>window.__exit);   /* 곧바로 한 번 더 → 종료 */
  (bound && v1==='plays' && v2==='home' && e1===0 && e2===1)
    ? ok('폰 뒤로가기 — 이전 화면 → 홈 → 한 번 더 물어본 뒤 종료')
    : bad('폰 뒤로가기 동작 이상', `연결=${bound} 1회=${v1} 2회=${v2} 홈1회종료=${e1} 홈2회종료=${e2}`);
  await ctx.close();
}

/* 2-5. 백업 왕복 + 합치기 멱등 */
{
  const {ctx,page} = await fresh();
  page.on('dialog', d=>d.accept());
  await page.evaluate(()=>{
    logs=[{date:'2026-08-20',input:'가',output:'나',note:'',doms:['인지']}];
    vax={rec:{bcg_0:1},flu:[]}; playLogs=[]; sleeps=[]; growth=[]; appts=[]; miles={}; save();
  });
  const backup = await page.evaluate(()=>backupJSON());
  await page.evaluate(()=>{ logs=[]; vax={rec:{},flu:[]}; save(); });
  await page.evaluate(()=>{go('backup'); bkTab='in'; render()}); await page.waitForTimeout(150);
  await page.evaluate(t=>{ document.querySelector('#bkIn').value=t; bkRestore() }, backup);
  await page.waitForTimeout(300);
  const restored = await page.evaluate(()=>({l:logs.length, v:Object.keys(vax.rec).length}));
  (restored.l===1 && restored.v===1) ? ok('백업 → 지움 → 되살리기 왕복 정상')
    : bad('백업 되살리기 실패', JSON.stringify(restored));
  /* 같은 백업을 두 번 합쳐도 안 늘어나야 한다 */
  for (let i=0;i<2;i++){
    await page.evaluate(()=>{go('backup'); bkTab='in'; render()}); await page.waitForTimeout(120);
    await page.evaluate(t=>{ document.querySelector('#bkIn').value=t; bkMerge() }, backup);
    await page.waitForTimeout(250);
  }
  const after = await page.evaluate(()=>logs.length);
  after===1 ? ok('합치기 — 같은 백업을 두 번 넣어도 안 늘어남') : bad('합치기에서 기록이 중복됨', after+'건');
  await ctx.close();
}

/* 2-5b. 놀이 데이터보다 큰 아이 — «지금 월령 놀이»라고 거짓말하지 않아야 한다 */
{
  const ctx = await browser.newContext({viewport:{width:412,height:900}, colorScheme:'light'});
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.evaluate(()=>localStorage.setItem('siwoo.child',
    JSON.stringify({birth:'2024-01-15',due:null,domain:'인지',reason:'play',name:'아이'})));
  await page.reload(); await page.waitForTimeout(500);
  const r = await page.evaluate(()=>{ go('plays');
    const t=document.querySelector('main').innerText;
    return {m:monthAge(), max:MAX_PLAY_M, 거짓제목:t.includes('지금 월령('+monthAge()+'개월) 놀이'),
      안내있음:/놀이는 아직/.test(t), 카드:document.querySelectorAll('#playResults .card').length};
  });
  (r.m>r.max && !r.거짓제목 && r.안내있음 && r.카드>0)
    ? ok('놀이보다 큰 아이('+r.m+'개월)에게 «지금 월령 놀이»라고 하지 않고 한계를 밝힘')
    : bad('큰 아이에게 월령을 속임', JSON.stringify(r));
  await ctx.close();
}

/* 2-6. 진료실용 인쇄 — 폰이 다크 모드여도 «흰 종이·검은 글씨»여야 한다 */
{
  const ctx = await browser.newContext({viewport:{width:900,height:1200}, colorScheme:'dark'});
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.evaluate(c=>{ localStorage.setItem('siwoo.child', c);
    localStorage.setItem('siwoo.logs', JSON.stringify([{date:'2026-08-27',input:'가',output:'나',note:'',doms:['인지']}])); }, CHILD);
  await page.reload(); await page.waitForTimeout(500);
  await page.evaluate(()=>{ window.print=()=>{}; night.mode='on'; save(); applyNight(); go('summary') });
  await page.waitForTimeout(250);
  await page.evaluate(()=>{ const t=document.querySelector('#smWorry'); if(t)t.value=''; printSummary() });
  await page.waitForTimeout(300);
  await page.emulateMedia({media:'print', colorScheme:'dark'});
  const r = await page.evaluate(()=>{
    const lum=c=>{const m=(c.match(/[\d.]+/g)||[0,0,0]).map(Number).slice(0,3)
      .map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});
      return .2126*m[0]+.7152*m[1]+.0722*m[2]};
    const a=document.querySelector('#printArea');
    const cs=getComputedStyle(a), body=getComputedStyle(document.body);
    const texts=[...a.querySelectorAll('h1,h2,td,th,p,li')].slice(0,40).map(e=>getComputedStyle(e).color);
    const worst=Math.max(...texts.map(lum));
    return {종이:body.backgroundColor, 인쇄영역:cs.backgroundColor, 종이밝기:lum(body.backgroundColor),
      가장밝은글자:worst, 글자수:a.innerText.length, 표수:a.querySelectorAll('table').length};
  });
  await page.emulateMedia({media:'screen'});
  const paperWhite = r.종이밝기 > 0.85;
  const inkDark = r.가장밝은글자 < 0.3;
  (paperWhite && inkDark && r.표수>=2 && r.글자수>300)
    ? ok('진료실용 인쇄 — 다크 모드에서도 흰 종이·검은 글씨 (표 '+r.표수+'개)')
    : bad('인쇄물이 읽을 수 없는 상태', `종이=${r.종이} 가장밝은글자밝기=${r.가장밝은글자.toFixed(2)} 표=${r.표수}`);
  await ctx.close();
}

/* 2-7. 오프라인 */
{
  const ctx = await browser.newContext({viewport:{width:412,height:900}});
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.evaluate(c=>localStorage.setItem('siwoo.child', c), CHILD);
  await page.evaluate(()=>navigator.serviceWorker.register('sw.js'));
  await page.waitForTimeout(1800);
  await ctx.setOffline(true);
  let offOk = false;
  try {
    await page.goto(BASE, {waitUntil:'load', timeout:15000});
    await page.waitForTimeout(900);
    offOk = await page.evaluate(()=> typeof PLAYS!=='undefined' && PLAYS.length>0
      && document.querySelector('main').innerText.trim().length>50);
  } catch(e) { offOk = false; }
  offOk ? ok('비행기 모드에서도 앱이 열림') : bad('오프라인에서 앱이 안 열림');
  await ctx.setOffline(false); await ctx.close();
}

await browser.close(); srv.close();

/* ─────────────── 결과 ─────────────── */
const failed = results.filter(r=>!r.pass);
const lines = results.map(r=>`| ${r.pass?'✅':'❌'} | ${r.name} | ${r.detail||''} |`);
const summary = [
  `## 고슴이 자동 점검 — ${results.length - failed.length}/${results.length} 통과`, '',
  '| | 항목 | 내용 |', '|---|---|---|', ...lines, '',
  failed.length ? `> ❌ **${failed.length}건 실패.** 위 표의 ❌ 줄을 보세요.`
                : '> ✅ 전부 통과. 데이터·화면·대비·뒤로가기·백업·오프라인 모두 정상입니다.'
].join('\n');

console.log(summary.replace(/\|/g,' ').replace(/^ *---.*$/gm,''));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
process.exit(failed.length ? 1 : 0);
