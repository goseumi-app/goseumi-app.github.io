/* 랜딩용 앱 화면 캡처 — 데모 프로필 «봄이»(온보딩 예시 이름). 실제 아이 기록 아님.
   390×844(아이폰 14) · 2배율 · 낮/어두운 모드 */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { APP_DIR as APP, WORK, chromePath } from './paths.mjs';
const OUT=path.join(WORK,'shots'); fs.mkdirSync(OUT,{recursive:true});   /* 다음 단계: python3 src/shots_webp.py → OUT/assets/shots/*.webp */
const srv=http.createServer((q,r)=>{const u=q.url.split('?')[0];const f=APP+(u==='/'?'/index.html':u);
  const ct=f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.png')?'image/png':'application/octet-stream';
  try{r.setHeader('content-type',ct);r.end(fs.readFileSync(f))}catch(e){r.statusCode=404;r.end()}});
await new Promise(r=>srv.listen(8201,r));
const b=await chromium.launch({args:['--no-sandbox'],executablePath:chromePath()});
const ds=o=>{const d=new Date(Date.now()+o*864e5);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const SLEEPS=[[0,'13:05','14:20',1],[-1,'20:40','06:10',0],[-1,'12:50','14:05',1],[-1,'09:30','10:15',1],[-2,'20:25','05:55',0],[-2,'13:10','14:25',1],
  [-3,'20:35','06:20',0],[-3,'12:40','13:50',1],[-4,'21:00','06:15',0],[-4,'13:00','14:10',1],[-5,'20:15','05:50',0],[-5,'12:30','13:35',1],
  [-6,'20:45','06:30',0],[-6,'13:20','14:40',1],[-7,'20:30','06:00',0]].map(x=>({d:ds(x[0]),s:x[1],e:x[2],n:x[3]}));
const LOGS=[
  {date:ds(-1),input:'매트에 컵 두 개를 엎어 둠',output:'하나를 뒤집어 안을 들여다보고, 다른 컵으로 손을 뻗음',note:'안이 비었는지 확인하는 건가? 내일은 한쪽에만 공을 넣어볼 것',doms:['인지']},
  {date:ds(-3),input:'거울 앞에 앉혀 둠',output:'거울 속 얼굴을 손바닥으로 두드리며 소리 냄',note:'',doms:['사회정서']},
  {date:ds(-6),input:'«맘마» 소리를 따라 해 줌',output:'입을 오물거리다 «마» 비슷한 소리',note:'',doms:['언어']}];
async function shoot(dark){
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,colorScheme:dark?'dark':'light',
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'});
  await ctx.addInitScript(()=>{ Object.defineProperty(navigator,'standalone',{get:()=>true}); });   /* 홈 화면 앱처럼 — 설치 안내 카드 숨김 */
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8201/index.html');
  await p.evaluate(([sl,lg,ds0])=>{ localStorage.clear();
    const S=(k,v)=>localStorage.setItem('siwoo.'+k,JSON.stringify(v));
    S('child',{birth:'2026-01-12',due:null,domain:'인지',reason:'fun',name:'봄이'});
    S('sleeps',sl); S('logs',lg); S('seenNew',(typeof WHATS_NEW!=='undefined'&&WHATS_NEW.v)||'v27'); S('firstUse','2026-06-01'); S('lastBackup',ds0); S('backupSnooze',ds0); S('installNo',1);
    S('night',{mode:'off'});
    S('feed',{tried:{'쌀':{d:'2026-07-15',r:'ok'},'소고기':{d:'2026-07-18',r:'ok'},'단호박':{d:'2026-07-21',r:'ok'},'브로콜리':{d:'2026-07-24',r:'ok'},'애호박':{d:'2026-07-27',r:'ok'},'닭고기':{d:'2026-08-02',r:'ok'},'양배추':{d:'2026-08-05',r:'ok'},'고구마':{d:'2026-08-09',r:'ok'}},watch:null,plan:{},stageOv:null,started:'2026-07-15'});
  },[SLEEPS,LOGS,ds(0)]);
  await p.reload(); await p.waitForTimeout(500);
  await p.evaluate(()=>{ try{ if(curStage().k!=='pre') buildMonth(todayStr()); }catch(e){}
    const d=(o)=>{const t=new Date(Date.now()+o*864e5);return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')};
    const sug=suggestToday();
    playLogs.push({date:d(0),n:sug[0],res:'happy',cond:null});
    const pool=PLAYS.filter(x=>x.m>=6&&x.m<=8).map(x=>x.n);
    [[-1,0,'happy'],[-1,5,null],[-2,9,'meh'],[-3,2,'happy'],[-4,13,null],[-5,7,'happy'],[-6,11,null]].forEach(([o,i,r])=>playLogs.push({date:d(o),n:pool[i%pool.length],res:r,cond:null}));
    save(); render(); });
  await p.waitForTimeout(400);
  const tag=dark?'dark':'light';
  const snap=async(name)=>{ await p.waitForTimeout(350); await p.screenshot({path:path.join(OUT,name+'-'+tag+'.png')}); };
  // 1) 홈
  await p.evaluate(()=>{go('home');window.scrollTo(0,0)}); await snap('home');
  // 2) 달력 (오늘 선택)
  await p.evaluate(()=>goCal()); await p.waitForTimeout(300); await snap('cal');
  await p.evaluate(()=>{const c=document.querySelector('.card[style*="peach2"]'); if(c) window.scrollTo(0, c.getBoundingClientRect().top+scrollY-70)}); await snap('calday');
  // 3) 놀이 카드 (수학의 눈 있는 8개월 놀이)
  await p.evaluate(()=>{const q=PLAYS.find(x=>x.m===8&&x.mathEye&&x.name.includes('천'))||PLAYS.find(x=>x.m===8&&x.mathEye); go('card',q.n)}); await snap('card');
  // 4) 수면 7일
  await p.evaluate(()=>{go('sleep')}); await p.waitForTimeout(300);
  await p.evaluate(()=>{const g=document.querySelector('.g7'); if(g){const c=g.closest('.card'); window.scrollTo(0,c.getBoundingClientRect().top+scrollY-80)}}); await snap('sleep');
  // 5) 달빛
  await p.evaluate(()=>{go('moon')}); await snap('moon');
  // 6) 이유식
  await p.evaluate(()=>{go('food')}); await snap('food');
  // 7) 놀이 목록 (주간 막대)
  await p.evaluate(()=>{go('plays')}); await snap('plays');
  if(errs.length) console.log('JS 오류', errs);
  await ctx.close();
}
await shoot(false); await shoot(true);
console.log('shots:', fs.readdirSync(OUT).join(' '));
await b.close(); srv.close();
