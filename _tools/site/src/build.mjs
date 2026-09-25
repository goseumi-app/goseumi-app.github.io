/* 고슴이 홈페이지 빌드 — 앱(www/index.html)의 데이터로 랜딩·개월수별 놀이·달빛어린이병원·404·sitemap을 만든다.
   node src/build.mjs [앱 index.html] [출력 폴더]   — 보통은 make.sh가 부른다(기본: 저장소 www/index.html → /tmp/goseumi-site-out)
   원칙: 아이 이름·관찰 원문(D번호 문장)은 싣지 않는다 · 판정 문구 없음 · 파트너스 링크엔 공정위 문구 · 달빛은 «전화로 확인» */
import fs from 'fs'; import path from 'path';
import { SRC, APP_DIR, OUT as OUT_DEFAULT } from './paths.mjs';
const APP=process.argv[2]||path.join(APP_DIR,'index.html'), OUT=process.argv[3]||OUT_DEFAULT;
const BASE='https://goseumi-app.github.io', BUILT=new Date().toISOString().slice(0,10);
/* 캐시 깨기용 ?v= 값은 파일마다 «그 파일 내용의 해시»다 — 글꼴·스크립트가 안 바뀌면 페이지 바이트도 그대로여서
   달빛 17쪽처럼 내용이 그대로인 페이지를 다시 올릴 일이 없다(날짜를 쓰면 매 빌드 전 페이지가 바뀐 것처럼 보였다).
   여기서는 자리표시자만 넣고, 글꼴 부분집합이 만들어진 뒤 stamp.mjs가 실제 값으로 바꾼다. */
const V={font:'__V_FONT__',sitejs:'__V_SITEJS__',demojs:'__V_DEMOJS__',plays:'__V_PLAYS__'};
/* 검색엔진 «내 사이트 맞아요» 확인 값 — src/verify.json에 적어 두면 다시 빌드해도 안 사라진다(환경변수가 있으면 그게 우선).
   메타 태그를 통째로 붙여 넣어도 content 값만 골라 쓴다. 다음(Daum)은 robots.txt 한 줄(#DaumWebMasterTool:…)이다. */
const VF=fs.existsSync(path.join(SRC,'verify.json'))?JSON.parse(fs.readFileSync(path.join(SRC,'verify.json'),'utf8')):{};
const pickV=(k,v)=>{ v=String(v||'').trim(); const m=v.match(/content=["']([^"']+)["']/); if(m) v=m[1].trim(); if(!v) return '';
  if(k==='daum'){ if(!/^#DaumWebMasterTool:\s?\S+$/.test(v)) throw new Error('verify.json daum — «#DaumWebMasterTool:…» 한 줄 그대로 적어 주세요'); return v; }
  if(!/^[\w\-=.+\/]{8,120}$/.test(v)) throw new Error(`verify.json ${k} — 확인 값 형식이 이상해요: ${v.slice(0,40)}`); return v; };
const VERIFY=Object.fromEntries(['naver','google','bing','daum'].map(k=>[k,pickV(k,process.env[k.toUpperCase()+'_VERIFY']||VF[k])]));
/* IndexNow 열쇠 — 빙·네이버 등에 «이 주소 바뀌었어요» 알릴 때 쓴다. 공개돼도 되는 값(사이트 맨 위 <열쇠>.txt 로 올라감) */
const INDEXNOW_KEY=fs.readFileSync(path.join(SRC,'indexnow.key'),'utf8').trim();
if(!/^[0-9a-f]{32}$/.test(INDEXNOW_KEY)) throw new Error('src/indexnow.key는 16진수 32자여야 해요');

/* ── 앱에서 데이터 꺼내기 (check.mjs와 같은 방식) ── */
const html=fs.readFileSync(APP,'utf8'), js=html.match(/<script>([\s\S]*)<\/script>/)[1];
const PLAYS=JSON.parse(js.match(/const PLAYS = (\[[\s\S]*?\]);\n/)[1]);
const PARTNER=JSON.parse(js.match(/const PARTNER_DEFAULT=(\{[\s\S]*?\})\s*;/)[1]);
const MOON=eval('['+js.match(/const MOON=\[([\s\S]*?)\n\];/)[1]+']');
const MOON_BASE=js.match(/const MOON_BASE="([^"]+)"/)[1];
const REC_DAYS=+js.match(/const REC_DAYS=(\d+)/)[1];
/* 9개월부터는 «구간» 놀이(m=구간 시작, to=구간 끝). 페이지는 구간마다 하나(/play/18.html = 18~23개월) */
const endOf=p=>p.to==null?p.m:p.to;
const MAX_M=Math.max(...PLAYS.map(endOf));
const REC_MAX_M=Math.max(...PLAYS.filter(p=>p.srcRaw).map(p=>p.m));      /* 실제 관찰 기록에서 나온 놀이가 있는 가장 큰 월령 */
const MAX_TXT=(MAX_M+1)%12===0?`${MAX_M}개월(만 ${(MAX_M+1)/12}세 전)`:`${MAX_M}개월`;
const DOMS=['인지','신체','사회정서','언어'];
const DOM_LABEL={'인지':'인지','신체':'신체·운동','사회정서':'사회성·정서','언어':'언어·의사소통'};
const DOM_DESC={'인지':'보고, 비교하고, 예측하고, 원인을 찾는 것','신체':'쥐고, 기고, 걷고, 뛰는 것','사회정서':'사람과 마음을 주고받고, 안정을 찾는 것','언어':'소리와 말을 주고받고, 리듬을 느끼는 것'};
const ICONS=JSON.parse(fs.readFileSync(path.join(SRC,'icons.json'),'utf8'));
const WORDMARK=fs.readFileSync(path.join(SRC,'wordmark.svg'),'utf8');
const QR=fs.readFileSync(path.join(SRC,'qr.svg'),'utf8');
/* 공용 스타일은 페이지마다 안에 넣는다 — 검색으로 들어온 첫 화면이 파일 하나 더 기다리지 않게 */
const CSS=fs.readFileSync(path.join(SRC,'site.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\s*\n\s*/g,'').replace(/\s*([{};,>])\s*/g,'$1').replace(/;}/g,'}');
const nRec=PLAYS.filter(p=>p.src&&p.src.length).length, nRef=PLAYS.filter(p=>p.ref).length;
const [my,mm]=MOON_BASE.split('-'); const MOON_WHEN=`${my}년 ${+mm}월`;

/* ── 작은 도구 ── */
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const rich=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/«/g,'«').replace(/»/g,'»');
const ico=(n,cls='ico')=>ICONS[n]?`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`:'';
const bandEnd=m=>Math.max(m,...PLAYS.filter(p=>p.m===m).map(endOf));
const mRange=m=>bandEnd(m)>m?`${m}~${bandEnd(m)}개월`:`${m}개월`;
const mName=m=>m===0?'신생아':`생후 ${mRange(m)}`;
const mShort=m=>m===0?'신생아':mRange(m);
function mascot(mood='happy',cls='mascot'){
  const eyes=mood==='happy'?'<path d="M46 56 q4 -5 8 0" stroke="#4A392E" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M66 56 q4 -5 8 0" stroke="#4A392E" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
    :'<circle cx="50" cy="55" r="3.2" fill="#4A392E"/><circle cx="70" cy="55" r="3.2" fill="#4A392E"/>';
  const mouth=mood==='oh'?'<ellipse cx="60" cy="66" rx="4" ry="5" fill="#8A5A44"/>':'<path d="M54 65 q6 6 12 0" stroke="#8A5A44" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
  return `<svg class="${cls}" viewBox="0 0 120 110" aria-hidden="true"><path d="M60 6 L70 22 L84 12 L88 30 L106 26 L100 44 L118 48 L104 60 L114 74 L96 74 L98 90 L82 82 L60 96 L38 82 L22 90 L24 74 L6 74 L16 60 L2 48 L20 44 L14 26 L32 30 L36 12 L50 22 Z" fill="#8A6248"/><ellipse cx="60" cy="62" rx="34" ry="30" fill="#FFF1DE"/><circle cx="42" cy="63" r="6" fill="#FBC7BC" opacity=".85"/><circle cx="78" cy="63" r="6" fill="#FBC7BC" opacity=".85"/>${eyes}${mouth}<ellipse cx="60" cy="47" rx="5" ry="4" fill="#8A6248"/></svg>`;
}
/* 주의 문구 — 관찰 원문(D번호·기록 속 아기·이 집 기록)이 든 것은 src/warn_web.json의 홈페이지용 문구로 바꾼다.
   원문의 자리는 책 원고다. 새 놀이에 원문이 들어오면 조용히 넘기지 않고 빌드를 멈춘다 */
const WARN_WEB=JSON.parse(fs.readFileSync(path.join(SRC,'warn_web.json'),'utf8'));
const OBS=/D\d{1,3}(?!\d)|기록 속 아기|이 집 기록|기록에는|기록에도|선생님/;
function webWarn(p){
  if(WARN_WEB[p.n]) return WARN_WEB[p.n];
  if(p.warn&&OBS.test(p.warn)) throw new Error(`놀이 #${p.n} «${p.name}» 주의 문구에 관찰 원문이 있어요 — src/warn_web.json에 홈페이지용 문구를 적어 주세요`);
  return p.warn||'';
}
for(const p of PLAYS){ for(const f of ['name','mat','how','down','up','label']) if(p[f]&&OBS.test(p[f])) throw new Error(`놀이 #${p.n} ${f}에 관찰 원문 표식`);
  if(p.mathEye&&OBS.test(JSON.stringify(p.mathEye))) throw new Error(`놀이 #${p.n} 수학의 눈에 관찰 원문 표식`); }
/* 준비물 → 쇼핑 키워드 규칙은 앱의 SHOP-KEYWORD 구간을 그대로 가져다 쓴다 — 앱과 홈페이지의 «찾아보기» 버튼이 어긋나지 않게.
   (옛 판 앱에는 그 구간이 없으니 그때는 예전 규칙으로) */
const SHOP_SRC=(js.match(/\/\* SHOP-KEYWORD-BEGIN[^*]*\*\/([\s\S]*?)\/\* SHOP-KEYWORD-END \*\//)||[])[1];
const matKeyword=SHOP_SRC? new Function(SHOP_SRC+'\nreturn matKeyword;')()
  : function(mat){ const m=(mat||'').split(/[,(·]/)[0].trim(); if(!m||m==='없음'||m.startsWith('아무')||m.startsWith('부모')) return null; return m.replace(/^아기\s*/,'아기 '); };
const buyLink=mat=>{ const k=matKeyword(mat); return k&&PARTNER[k]?{k,url:PARTNER[k]}:null; };
const AD_NOTE='이 게시물은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';
const cdcLabel=l=>l?esc(l).replace(/^\[CDC (\d+)개월\]/,'CDC $1개월 이정표 —').replace(/^\[WHO ([^\]]+)\]/,'WHO $1 —'):'';

/* ── 공용 머리·머리띠·발 ── */
/* 소유 확인 메타는 첫 페이지에만 (네이버·구글·빙 모두 첫 페이지를 본다) */
function verifyMeta(){ return [['naver','naver-site-verification'],['google','google-site-verification'],['bing','msvalidate.01']]
  .filter(([k])=>VERIFY[k]).map(([k,n])=>`<meta name="${n}" content="${esc(VERIFY[k])}">\n`).join(''); }
function head({title,desc,url,og,ogAlt,ld=[],extra=''}){
  return `<!DOCTYPE html>
<html lang="ko" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
${url===BASE+'/'?verifyMeta():''}<meta name="theme-color" content="#FBF3E7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1B1510" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website">
<meta property="og:site_name" content="고슴이">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="${esc(title.replace(/ \| 고슴이$/,''))}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${BASE}/assets/og/${og}.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(ogAlt||title)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/www/icon-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="/www/apple-touch-icon.png">
<link rel="preload" href="/fonts/pretendard-site.woff2?v=${V.font}" as="font" type="font/woff2" crossorigin>
<style>@font-face{font-family:"Pretendard Variable";font-weight:45 920;font-style:normal;font-display:optional;src:url(/fonts/pretendard-site.woff2?v=${V.font}) format("woff2-variations"),url(/fonts/pretendard-site.woff2?v=${V.font}) format("woff2")}${CSS}</style>
${ld.map(o=>`<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n')}
${extra}</head>`;
}
const brand=`<a class="brand" href="/" aria-label="고슴이 홈으로"><img src="/assets/icon-72.png" alt="" width="36" height="36">${WORDMARK}</a>`;
function top(){
  return `<body>
<a class="skip" href="#main">본문으로 건너뛰기</a>
<div class="inapp" id="inapp" role="region" aria-label="브라우저 안내"><div class="wrap"><p><b data-name>앱</b> 안에서 열려 있어요. 여기서는 홈 화면에 추가가 안 되고, 기록도 이 앱 안에만 남아요.</p><button class="btn btn-sm" type="button">크롬으로 열기</button></div></div>
<header class="site"><div class="wrap hbar">${brand}<nav class="hnav" aria-label="주요 메뉴"><a class="lk" href="/play/">개월수별 놀이</a><a class="lk" href="/moon/">달빛어린이병원</a><a class="btn btn-pri btn-sm" href="/www/index.html">앱 열기</a></nav></div></header>`;
}
function foot(){
  return `<footer class="site"><div class="wrap"><div class="cols">
<div>${brand}<p class="fine" style="margin-top:12px">하루 5분, 오늘 아기와 뭐 하고 놀지 골라주는 무료 기록장이에요. 서버가 없어서 기록은 폰 안에만 남아요.</p></div>
<div><h2 class="fh">둘러보기</h2><ul><li><a href="/www/index.html">앱 열기</a></li><li><a href="/play/">개월수별 아기 놀이</a></li><li><a href="/moon/">지역별 달빛어린이병원</a></li><li><a href="/#install">홈 화면에 추가하기</a></li></ul></div>
<div><h2 class="fh">함께하기</h2><ul><li><a href="https://open.kakao.com/o/gXlOOhLi" target="_blank" rel="noopener">사용자 방 (카카오 오픈채팅)</a></li><li><a href="https://www.threads.net/@goseumi.app" target="_blank" rel="noopener">쓰레드 @goseumi.app</a></li><li><a href="/privacy.html">개인정보 처리방침</a></li></ul></div>
</div>
<p class="fine">고슴이는 의료 조언이 아니에요. 아이 건강에 관한 판단과 진료는 소아청소년과 의사 선생님과 하세요. 놀이의 시기 표시는 미국 CDC 발달 이정표와 WHO 연구를 옮긴 것이며, CDC·HHS의 보증을 받지 않았어요.</p>
</div></footer>
<script src="/assets/site.js?v=${V.sitejs}" defer></script>`;
}
const crumbs=items=>`<nav class="crumbs wrap" aria-label="현재 위치"><ol>${items.map(([n,u])=>u?`<li><a href="${u}">${esc(n)}</a></li>`:`<li aria-current="page">${esc(n)}</li>`).join('')}</ol></nav>`;
const ldCrumbs=items=>({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":items.map(([n,u],i)=>({"@type":"ListItem","position":i+1,"name":n,"item":BASE+(u||'')}))});
const appCta=(title,sub,btn='고슴이 열기')=>`<aside class="app-cta">${mascot('happy')}<div><h2>${title}</h2><p>${sub}</p></div><a class="btn btn-pri btn-lg" href="/www/index.html">${btn} ${ico('arrow-right')}</a></aside>`;
function write(rel,content){ const f=path.join(OUT,rel); fs.mkdirSync(path.dirname(f),{recursive:true}); fs.writeFileSync(f,content); }
const pages=[]; const ogJobs=[];
const shot=(n,alt,cls='',pri=false)=>`<div class="phone ${cls}"><picture><source media="(prefers-color-scheme: dark)" srcset="/assets/shots/${n}-dark-390.webp 390w, /assets/shots/${n}-dark-560.webp 560w, /assets/shots/${n}-dark.webp 780w" sizes="(max-width:420px) 64vw, 290px"><img src="/assets/shots/${n}-light.webp" srcset="/assets/shots/${n}-light-390.webp 390w, /assets/shots/${n}-light-560.webp 560w, /assets/shots/${n}-light.webp 780w" sizes="(max-width:420px) 64vw, 290px" width="390" height="844" alt="${esc(alt)}"${pri===true?' fetchpriority="high"':pri==='eager'?'':' loading="lazy"'} decoding="async"></picture></div>`;

/* ════════ 개월수별 놀이 ════════ */
const byM={}; PLAYS.forEach(p=>{(byM[p.m]=byM[p.m]||[]).push(p)});
const months=Object.keys(byM).map(Number).sort((a,b)=>a-b);
function playArticle(p){
  const buy=buyLink(p.mat), w=webWarn(p), me=p.mathEye;
  return `<article class="play" id="p${p.n}">
<div class="meta-line" style="margin:0"><span class="tag t-${p.dom}">${DOM_LABEL[p.dom]}</span>${p.dom2?`<span class="tag t-${p.dom2}">${DOM_LABEL[p.dom2]}</span>`:''}<span class="tag t-src">${p.ref?'연구 기반':'실제 기록에서'}</span></div>
<h3>${esc(p.name)}</h3>
${p.label?`<p class="cdc">${cdcLabel(p.label)}</p>`:''}
<dl>
<div><dt>준비물</dt><dd>${esc(p.mat)}${buy?` <a class="buy" href="${buy.url}" target="_blank" rel="sponsored noopener">${ico('external-link')}쿠팡에서 보기<span class="sr-only"> (광고 링크)</span></a>`:''}</dd></div>
<div><dt>이렇게 해요</dt><dd>${rich(p.how)}</dd></div>
${p.down?`<div><dt>어려워하면</dt><dd>${rich(p.down)}</dd></div>`:''}
${p.up?`<div><dt>한 단계 더</dt><dd>${rich(p.up)}</dd></div>`:''}
</dl>
${w?`<p class="warn">${rich(w)}</p>`:''}
${me?`<div class="matheye"><div class="k">${ico('sparkles')}수학의 눈 · ${esc(me.seed)}</div><p>${rich(me.now)}</p>${me.later?`<p>${rich(me.later)}</p>`:''}${me.watch?`<p><b>볼 것</b> — ${rich(me.watch)}</p>`:''}</div>`:''}
${p.ref?`<p class="small" style="margin:12px 0 0">출처: ${esc(p.ref)}</p>`:''}
</article>`;
}
for(const m of months){
  const L=byM[m], n=L.length, url=`${BASE}/play/${m}.html`;
  const e=bandEnd(m), band=e>m, kid=m>=12?'아이':'아기';
  const h1=m===0?`신생아(생후 0개월) 아기 놀이 ${n}가지`:`생후 ${mRange(m)} 아기 놀이 ${n}가지`;
  const title=`${m===0?`신생아 놀이 ${n}가지 (생후 0개월)`:`생후 ${mRange(m)} 아기 놀이 ${n}가지`} — 집에서 5분 발달 놀이 | 고슴이`;
  const each=band?Array.from({length:e-m+1},(_,i)=>`${m+i}개월`).join('·'):'';
  const pRec=L.filter(p=>p.src&&p.src.length).length, pRef=L.filter(p=>p.ref).length;
  const names=L.slice(0,3).map(p=>p.name).join(', ');
  const desc=`${mName(m)} 아기와 집에서 해볼 발달 놀이 ${n}가지 — ${names} 등. 준비물·방법·쉽게/어렵게 하는 법까지 한 번에. 시기는 미국 CDC·WHO 이정표 기준.`;
  const hasAd=L.some(p=>buyLink(p.mat));
  const doms=DOMS.map(d=>[d,L.filter(p=>p.dom===d)]).filter(([,x])=>x.length);
  const mi=months.indexOf(m), prev=mi>0?months[mi-1]:null, next=mi<months.length-1?months[mi+1]:null;
  const ld=[ldCrumbs([['고슴이','/'],['개월수별 놀이','/play/'],[mName(m),`/play/${m}.html`]]),
    {"@context":"https://schema.org","@type":"ItemList","name":h1,"numberOfItems":n,"itemListElement":L.map((p,i)=>({"@type":"ListItem","position":i+1,"name":p.name,"url":`${url}#p${p.n}`}))}];
  const body=`${head({title,desc,url,og:`play-${m}`,ogAlt:h1,ld})}
${top()}
${crumbs([['고슴이','/'],['개월수별 놀이','/play/'],[mName(m),null]])}
<main id="main" class="wrap" style="max-width:860px">
<div class="page-head"><h1>${h1}</h1>
<p class="lead">${band?`${each} ${kid}와 집에서 해볼 만한 놀이예요.`:`${mName(m)} 무렵 집에서 해볼 만한 놀이예요.`} 영역별로 골고루 모았지만 다 할 필요는 없어요 — <b>오늘 끌리는 하나면 충분해요.</b></p>
<div class="jump">${doms.map(([d,x])=>`<a class="chip" href="#d-${d}">${DOM_LABEL[d]} <b>${x.length}</b></a>`).join('')}</div>
${hasAd?`<p class="ad-note">${AD_NOTE}</p>`:''}
</div>
${doms.map(([d,x])=>`<section class="dom-sec" id="d-${d}" aria-labelledby="h-${d}"><h2 id="h-${d}"><span class="tag t-${d}">${DOM_LABEL[d]}</span> ${DOM_DESC[d]}</h2><div class="plays">${x.map(playArticle).join('\n')}</div></section>`).join('\n')}
${appCta('이 중 오늘 할 하나만 골라 드려요','생일을 넣으면 매일 영역별로 하나씩. 해본 건 ✓ 한 번이면 기록돼요.','생일 넣고 시작하기')}
<nav class="pn" aria-label="다른 개월수">${prev!==null?`<a class="prev" href="/play/${prev}.html"><small>← 이전</small>${mName(prev)} 놀이</a>`:'<span></span>'}${next!==null?`<a class="next" href="/play/${next}.html"><small>다음 →</small>${mName(next)} 놀이</a>`:`<a class="next" href="/play/"><small>모두 보기 →</small>개월수별 놀이</a>`}</nav>
<p class="src-line">시기 표시는 미국 CDC 발달 이정표(Learn the Signs. Act Early.)와 WHO 운동발달 연구를 옮긴 것이에요 — 발달 검사가 아니며 검사를 대체하지 않아요. 걱정되면 소아청소년과에서 상담하세요. 이 페이지의 놀이 방법은 ${pRec?`한 아기의 ${REC_DAYS}일 관찰 기록(${pRec}가지)${pRef?'과 ':''}`:''}${pRef?`CDC 공식 이정표·활동 팁(${pRef}가지)`:''}에서 왔어요. 이 페이지는 CDC·HHS의 보증을 받지 않았어요.</p>
</main>
${foot()}
</body></html>`;
  write(`play/${m}.html`,body); pages.push({url,rel:`play/${m}.html`}); ogJobs.push({name:`play-${m}`,kind:'play',big:mShort(m),title:'아기 놀이',count:`${n}가지`,sub:'집에서 5분 · CDC·WHO 이정표 기준'});
}
{ /* 놀이 모음 첫 화면 */
  const url=`${BASE}/play/`, title=`개월수별 아기 놀이 — 신생아부터 ${MAX_M}개월까지 ${PLAYS.length}가지 | 고슴이`;
  const desc=`신생아부터 생후 ${MAX_TXT}까지, 집에 있는 물건으로 5분이면 되는 아기 발달 놀이 ${PLAYS.length}가지를 개월수별로 모았어요. 시기는 미국 CDC·WHO 이정표 기준.`;
  const ld=[ldCrumbs([['고슴이','/'],['개월수별 놀이','/play/']]),{"@context":"https://schema.org","@type":"ItemList","itemListElement":months.map((m,i)=>({"@type":"ListItem","position":i+1,"name":`${mName(m)} 아기 놀이`,"url":`${BASE}/play/${m}.html`}))}];
  const body=`${head({title,desc,url,og:'play',ogAlt:'개월수별 아기 놀이',ld})}
${top()}
${crumbs([['고슴이','/'],['개월수별 놀이',null]])}
<main id="main" class="wrap" style="max-width:960px">
<div class="page-head"><h1>개월수별 아기 놀이</h1>
<p class="lead">신생아부터 생후 ${MAX_TXT}까지 <b>${PLAYS.length}가지</b>. 집에 있는 물건으로 5분이면 되는 놀이만 모았어요. 시기는 미국 CDC·WHO 발달 이정표예요. 생후 ${REC_MAX_M}개월까지는 한 아기의 실제 관찰 기록에서, 그 뒤는 CDC 공식 이정표·활동 팁에서 왔어요.</p></div>
<div class="month-grid">${months.map(m=>`<a href="/play/${m}.html"><b>${mShort(m)}</b><span>놀이 ${byM[m].length}가지 · ${DOMS.filter(d=>byM[m].some(p=>p.dom===d)).map(d=>DOM_LABEL[d].split('·')[0]).join('·')}</span></a>`).join('')}</div>
<section class="dom-sec"><h2>놀이는 네 영역으로 나눠요</h2>
<div class="nots" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">${DOMS.map(d=>`<div class="not"><h3><span class="tag t-${d}">${DOM_LABEL[d]}</span></h3><p>${DOM_DESC[d]}. 모음 ${PLAYS.filter(p=>p.dom===d).length}가지.</p></div>`).join('')}</div>
<p class="small" style="margin-top:14px">영역은 «부족한 곳»을 찾으려는 게 아니라, 골고루 놀아 주려고 나눈 거예요. 아이마다 영역별 속도가 다른 건 흔한 일이에요.</p></section>
${appCta('매일 하나씩, 알아서 골라 드려요','생일만 넣으면 오늘의 놀이 네 가지. 설치도 가입도 없어요.','지금 시작하기')}
<p class="src-line">시기 표시는 미국 CDC 발달 이정표와 WHO 운동발달 연구를 옮긴 것이에요 — 발달 검사가 아니며 검사를 대체하지 않아요. 이 페이지는 CDC·HHS의 보증을 받지 않았어요.</p>
</main>
${foot()}
</body></html>`;
  write('play/index.html',body); pages.push({url,rel:'play/index.html'}); ogJobs.push({name:'play',kind:'play',big:`${PLAYS.length}가지`,title:'개월수별 아기 놀이',count:`0~${MAX_M}개월`,sub:'집에서 5분 · CDC·WHO 이정표 기준'});
}

/* ════════ 달빛어린이병원 ════════ */
const SLUG={'서울':'seoul','부산':'busan','대구':'daegu','인천':'incheon','광주·전남':'gwangju-jeonnam','대전':'daejeon','울산':'ulsan','세종':'sejong','경기':'gyeonggi','강원':'gangwon','충북':'chungbuk','충남':'chungnam','전북':'jeonbuk','경북':'gyeongbuk','경남':'gyeongnam','제주':'jeju'};
const FULL={'서울':'서울','부산':'부산','대구':'대구','인천':'인천','광주·전남':'광주·전남','대전':'대전','울산':'울산','세종':'세종','경기':'경기도','강원':'강원','충북':'충북','충남':'충남','전북':'전북','경북':'경북','경남':'경남','제주':'제주'};
const regions=Object.keys(SLUG).filter(r=>MOON.some(x=>x[1]===r));
const unknown=[...new Set(MOON.map(x=>x[1]))].filter(r=>!SLUG[r]); if(unknown.length) throw new Error('모르는 시도: '+unknown);
function areaOf(r){ const t=r[2].split(' ')[0]; if(/(시|군|구)$/.test(t)) return r[1]==='광주·전남'&&/구$/.test(t)?'광주 '+t:t; return FULL[r[1]]==='세종'?'세종시':FULL[r[1]]; }
function addrOf(r){ const a=r[2]; if(r[1]==='광주·전남') return (/^\S+구\s/.test(a)?'광주 ':'전남 ')+a; if(r[1]==='세종') return '세종 '+a; return r[1]+' '+a; }
const MOON_NOTE=`<div class="note warn"><b>가기 전에 꼭 전화로 확인하세요.</b> 진료 시간은 병원마다, 요일마다 달라요 — 명절·연휴에는 더 그래요. 문을 열었는지는 <a href="https://www.e-gen.or.kr/moonlight/main.do" target="_blank" rel="noopener">응급의료포털 달빛어린이병원</a>에서 볼 수 있어요.<br><b>숨쉬기 힘들어하거나, 축 처지거나, 경련을 하면</b> 망설이지 말고 119에 전화하세요.</div>`;
function hospItem(r){
  const tel=String(r[3]).replace(/[^\d]/g,''), q=encodeURIComponent(r[0]+' '+areaOf(r).replace(/^광주 /,''));
  return `<li class="hosp"><h3>${esc(r[0])}</h3><p class="addr">${esc(addrOf(r))}</p><p class="tel">${esc(r[3])}</p><div class="acts"><a class="btn btn-pri btn-sm" href="tel:${tel}">${ico('phone')}전화하기</a><a class="btn btn-sec btn-sm" href="https://map.naver.com/p/search/${q}" target="_blank" rel="noopener">${ico('map-pin')}지도</a></div></li>`;
}
for(const reg of regions){
  const L=MOON.filter(x=>x[1]===reg).sort((a,b)=>areaOf(a).localeCompare(areaOf(b),'ko')||a[0].localeCompare(b[0],'ko'));
  const n=L.length, slug=SLUG[reg], url=`${BASE}/moon/${slug}.html`, nm=FULL[reg];
  const areas=[...new Set(L.map(areaOf))];
  const title=`${nm} 달빛어린이병원 ${n}곳 — 밤·주말·휴일 소아 진료 목록 | 고슴이`;
  const desc=`${nm}의 달빛어린이병원 ${n}곳 주소와 전화번호${areas.length>1?`(${areas.slice(0,5).join('·')}${areas.length>5?' 등':''})`:''}. 밤이나 주말·공휴일에 아이가 아플 때. ${MOON_WHEN} 보건복지부 지정 목록 기준 — 가기 전 전화로 진료 시간을 꼭 확인하세요.`;
  const ld=[ldCrumbs([['고슴이','/'],['달빛어린이병원','/moon/'],[nm,`/moon/${slug}.html`]]),
    {"@context":"https://schema.org","@type":"ItemList","name":`${nm} 달빛어린이병원`,"numberOfItems":n,"itemListElement":L.map((r,i)=>({"@type":"ListItem","position":i+1,"item":{"@type":"MedicalClinic","name":r[0],"telephone":r[3],"address":{"@type":"PostalAddress","streetAddress":addrOf(r),"addressCountry":"KR"}}}))}];
  const grouped=areas.length>1;
  const body=`${head({title,desc,url,og:`moon-${slug}`,ogAlt:`${nm} 달빛어린이병원 ${n}곳`,ld})}
${top()}
${crumbs([['고슴이','/'],['달빛어린이병원','/moon/'],[nm,null]])}
<main id="main" class="wrap" style="max-width:960px">
<div class="page-head"><h1>${nm} 달빛어린이병원 ${n}곳</h1>
<p class="lead">밤이나 주말·공휴일에 아이를 진료하도록 보건복지부가 지정한 ${nm}의 병·의원이에요. ${MOON_WHEN} 응급의료포털 공개 목록을 옮겼어요.</p>
${grouped?`<div class="jump">${areas.map(a=>`<a class="chip" href="#a-${encodeURIComponent(a)}">${esc(a)} <b>${L.filter(r=>areaOf(r)===a).length}</b></a>`).join('')}</div>`:''}
</div>
${MOON_NOTE}
${grouped?areas.map(a=>`<section class="area" id="a-${encodeURIComponent(a)}"><h2>${esc(a)}</h2><ul class="hosps">${L.filter(r=>areaOf(r)===a).map(hospItem).join('')}</ul></section>`).join('\n'):`<ul class="hosps">${L.map(hospItem).join('')}</ul>`}
${appCta('지금 내 위치에서 가까운 순으로','고슴이 앱은 전국 '+MOON.length+'곳을 가까운 순으로 보여 줘요. 위치는 폰 안에서만 계산하고, 인터넷이 없어도 목록이 열려요.','가까운 병원 보기')}
<section class="dom-sec"><h2>다른 지역</h2><div class="chips" style="margin-top:12px">${regions.filter(x=>x!==reg).map(x=>`<a class="chip" href="/moon/${SLUG[x]}.html">${FULL[x]} <b>${MOON.filter(r=>r[1]===x).length}</b></a>`).join('')}</div></section>
<p class="src-line">출처: 보건복지부·중앙응급의료센터 응급의료포털(E-Gen) 달빛어린이병원 목록, ${MOON_WHEN} 기준. 지정 현황은 바뀔 수 있어요. 이 목록은 «지금 진료 중»을 알려 주지 않아요 — 실시간 여부는 병원에 전화하거나 응급의료포털에서 확인하세요.</p>
</main>
${foot()}
</body></html>`;
  write(`moon/${slug}.html`,body); pages.push({url,rel:`moon/${slug}.html`}); ogJobs.push({name:`moon-${slug}`,kind:'moon',big:nm,title:'달빛어린이병원',count:`${n}곳`,sub:`밤·주말·휴일 소아 진료 · ${MOON_WHEN} 기준`});
}
{ const url=`${BASE}/moon/`, title=`전국 달빛어린이병원 ${MOON.length}곳 — 지역별 야간·휴일 소아 진료 목록 | 고슴이`;
  const desc=`밤이나 주말·공휴일에 아이가 아플 때 갈 수 있는 전국 달빛어린이병원 ${MOON.length}곳을 지역별로 모았어요. 주소·전화번호·지도. ${MOON_WHEN} 보건복지부 지정 목록 기준.`;
  const ld=[ldCrumbs([['고슴이','/'],['달빛어린이병원','/moon/']]),{"@context":"https://schema.org","@type":"ItemList","itemListElement":regions.map((r,i)=>({"@type":"ListItem","position":i+1,"name":`${FULL[r]} 달빛어린이병원`,"url":`${BASE}/moon/${SLUG[r]}.html`}))}];
  const body=`${head({title,desc,url,og:'moon',ogAlt:'전국 달빛어린이병원',ld})}
${top()}
${crumbs([['고슴이','/'],['달빛어린이병원',null]])}
<main id="main" class="wrap" style="max-width:960px">
<div class="page-head"><h1>전국 달빛어린이병원 ${MOON.length}곳</h1>
<p class="lead">달빛어린이병원은 밤이나 주말·공휴일에 아이를 진료하도록 보건복지부가 지정한 병·의원이에요. 응급실보다 가볍게, 동네 소아과가 문을 닫은 시간에 갈 수 있는 곳이에요. 지역을 골라 주세요.</p></div>
<div class="region-grid">${regions.map(r=>`<a href="/moon/${SLUG[r]}.html">${FULL[r]}<span>${MOON.filter(x=>x[1]===r).length}곳</span></a>`).join('')}</div>
${MOON_NOTE}
${appCta('밤에 급할 때는 가까운 순으로','고슴이 앱에 전국 '+MOON.length+'곳이 들어 있어요. 내 위치에서 가까운 순으로, 바로 전화·지도. 인터넷이 없어도 열려요.','가까운 병원 보기')}
<p class="src-line">출처: 보건복지부·중앙응급의료센터 응급의료포털(E-Gen) 달빛어린이병원 목록, ${MOON_WHEN} 기준. 지정 현황은 바뀔 수 있어요.</p>
</main>
${foot()}
</body></html>`;
  write('moon/index.html',body); pages.push({url,rel:'moon/index.html'}); ogJobs.push({name:'moon',kind:'moon',big:'전국',title:'달빛어린이병원',count:`${MOON.length}곳`,sub:`지역별 목록 · ${MOON_WHEN} 기준`});
}

/* ════════ 랜딩 ════════ */
{
  const url=`${BASE}/`;
  const title='고슴이 — 오늘 아기랑 뭐 하고 놀지, 개월수별 발달 놀이 추천 (무료)';
  const desc=`생일만 넣으면 개월수에 맞는 아기 발달 놀이를 영역별로 하나씩 골라 줘요. 잠·이유식·하루 기록·달빛어린이병원 ${MOON.length}곳까지. 설치·가입 없이 무료, 기록은 폰 안에만.`;
  const FAQ=[
    ['정말 무료인가요?','네. 가입도 결제도 없어요. 놀이 준비물 옆 «찾아보기» 링크 가운데 일부는 쿠팡 파트너스 링크라, 그 링크로 사면 운영에 보태는 수수료가 생길 수 있어요. 그 화면에는 늘 안내 문구가 붙어요.'],
    ['기록은 어디에 저장되나요?','지금 쓰는 폰의 브라우저 안에만요. 서버가 없어서 만든 사람도 볼 수 없어요. 폰을 바꿀 때는 앱의 «기록 옮기기»로 복사해서 새 폰에 붙여 넣으면 돼요.'],
    ['아이폰에서도 되나요?','네. 사파리에서 열고 공유 단추 → «홈 화면에 추가»를 누르면 앱처럼 아이콘으로 열려요. 안드로이드는 크롬에서 «앱 설치»가 떠요.'],
    ['발달 검사를 해 주나요?','아니요. 고슴이는 빠르다·느리다를 판정하지 않아요. 놀이의 시기 표시는 미국 CDC 이정표와 WHO 연구를 옮긴 것이고, 걱정되는 게 있으면 소아청소년과에서 상담하시길 권해요. 대신 걱정되는 장면을 모아 진료실에 들고 갈 A4 요약을 만들어 드려요.'],
    ['달빛어린이병원 정보는 실시간인가요?',`아니요. ${MOON_WHEN} 보건복지부 지정 목록이라, 진료 여부는 가기 전에 꼭 전화로 확인해 주세요. 지금 문을 열었는지는 응급의료포털(E-Gen)에서 볼 수 있어요.`],
    ['몇 개월까지 쓸 수 있나요?',`잠·이유식·예방접종·하루 기록은 개월수와 상관없이 쓸 수 있어요. 놀이는 신생아부터 생후 ${MAX_TXT}까지 있어요 — 생후 ${REC_MAX_M}개월까지는 한 아기의 실제 관찰 기록에서, 그 뒤는 미국 CDC 공식 이정표·활동 팁에서 왔어요.`],
    ['카톡에서 열었더니 홈 화면 추가가 안 돼요','카톡·인스타 같은 앱 안의 브라우저는 홈 화면 추가를 막아 둬요. 거기서 적은 기록도 그 앱 안에만 남고요. 화면 위쪽 안내 띠의 «크롬으로 열기»(아이폰은 «사파리로 여는 법»)를 눌러 주세요.'],
  ];
  const ld=[
    {"@context":"https://schema.org","@type":"WebSite","name":"고슴이","url":url,"inLanguage":"ko-KR"},
    {"@context":"https://schema.org","@type":"WebApplication","name":"고슴이","url":`${BASE}/www/index.html`,"applicationCategory":"LifestyleApplication","operatingSystem":"Android, iOS (웹 브라우저)","inLanguage":"ko-KR","isAccessibleForFree":true,"offers":{"@type":"Offer","price":"0","priceCurrency":"KRW"},"description":desc},
    {"@context":"https://schema.org","@type":"FAQPage","mainEntity":FAQ.map(([q,a])=>({"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}}))}
  ];
  const ex=`<link rel="preload" as="image" href="/assets/shots/home-light-390.webp" media="(max-width:420px) and (prefers-color-scheme: light)">\n`;
  const digest=`🦔 봄이 — 9월 23일 (생후 8개월 11일)

🌙 잠 — 합쳐서 12시간 40분 (낮잠 2회)
🍚 이유식 (토핑) 1끼: 쌀 · 소고기 · 단호박
🧸 놀이 — 천 아래 숨기기, 통에 넣기
✏️ 이날 본 것 · 컵을 뒤집어 안을 들여다봄

<span class="dim">— 고슴이로 보냄 · goseumi-app.github.io</span>`;
  const BENTO=[
    ['b-4','puzzle','bg-peach','영역별로 하나씩, 오늘의 놀이','인지·신체·사회성·언어에서 하나씩 골라 줘요. 다 할 필요 없어요 — 끌리는 하나면 충분해요. 해본 건 ✓ 한 번이면 기록돼요.','homeplays'],
    ['b-2','moon','bg-lav','한 번 눌러 잠 기록','재울 때 한 번, 깨면 한 번. 최근 7일이 그래프로 보여요.','sleepgraph'],
    ['b-2','utensils','bg-butter','이유식 월력표','먹어 본 재료로 한 달 식단을 짜고, 새 재료는 3일씩 지켜봐요.','food'],
    ['b-2','hospital','bg-pink',`달빛어린이병원 ${MOON.length}곳`,'밤·주말에 아이를 보는 병원을 가까운 순으로. 전화·지도 바로.','moon'],
    ['b-2','sparkles','bg-sky','수학의 눈','수학교사 아빠가 놀이마다 붙인 한 줄 — 지금 아기가 무엇을 익히고 있는지.','card'],
    ['b-2','syringe','bg-mint','예방접종 체크','질병관리청 표준 일정대로. «놓쳤다»는 빨간 표시는 없어요.',''],
    ['b-2','printer','bg-peach','진료실용 A4 요약','걱정되는 장면을 모아 한 장으로. 의사 선생님께 보여 드리기 좋게.',''],
    ['b-2','wifi-off','bg-sky','비행기 모드에서도','한 번 열어 두면 지하 주차장에서도, 병원 대기실에서도 열려요.',''],
  ];
  const body=`${head({title,desc,url,og:'home',ogAlt:'고슴이 — 오늘 아기랑 뭐 하고 놀지',ld,extra:ex})}
${top()}
<main id="main">
<section class="hero"><div class="wrap">
<div class="hero-copy">
<span class="eyebrow">${ico('sparkles')}무료 · 설치 없이 · 가입 없이</span>
<h1 class="h-display">오늘 아기랑<br>뭐 하고 놀지,<br>생일만 넣으면 골라 줘요</h1>
<p class="lead">개월수에 맞는 발달 놀이를 영역별로 하나씩. 잠·이유식·하루 기록까지 한곳에. 기록은 <b>폰 안에만</b> 남아요.</p>
<div class="hero-cta" id="hero-cta"><a class="btn btn-pri btn-lg" href="/www/index.html">지금 바로 시작하기 ${ico('arrow-right')}</a><a class="btn btn-sec btn-lg" href="#demo">우리 아기 놀이 미리 보기</a></div>
<p class="hero-note">${ico('lock')}회원가입·설치 파일 없이 브라우저에서 바로 열려요</p>
<div class="stats" role="list">
<div class="stat" role="listitem"><b>${PLAYS.length}가지</b><span>개월수별 놀이</span></div>
<div class="stat" role="listitem"><b>CDC·WHO</b><span>이정표 시기 기준</span></div>
<div class="stat" role="listitem"><b>${MOON.length}곳</b><span>달빛어린이병원</span></div>
<div class="stat" role="listitem"><b>오프라인</b><span>비행기 모드 OK</span></div>
</div>
</div>
<div class="phones">${shot('calday','',"back",'eager')}${shot('home','고슴이 앱 첫 화면 — 오늘의 잠·이유식·접종 요약과 영역별 오늘 놀이','front',true)}
<div class="float-bubble reveal">${mascot('happy','')}<span>오늘 놀이 4가지 골랐어요!</span></div></div>
</div></section>

<section class="sec alt" id="demo" aria-labelledby="demo-h"><div class="wrap">
<div class="sec-head reveal"><span class="eyebrow">${ico('baby')}미리 보기</span><h2 class="h-sec" id="demo-h">생일만 넣어 보세요</h2>
<p class="lead">오늘 해볼 놀이 네 가지가 바로 나와요. 넣은 날짜는 이 폰 밖으로 나가지 않아요.</p></div>
<div class="demo">
<form class="demo-form card reveal" id="demo-form" data-src="/assets/plays.json?v=${V.plays}" data-app="/www/index.html" data-month="/play/">
<label for="demo-birth">아기 생년월일</label>
<input type="date" id="demo-birth" name="birth" required min="2018-01-01">
<button class="btn btn-pri btn-lg" type="submit">오늘 놀이 보기</button>
<p class="small">${ico('lock')}<span>서버가 없어요. 계산은 이 화면 안에서만 해요.</span></p>
</form>
<div class="demo-out" id="demo-out" tabindex="-1" aria-live="polite"><div class="demo-empty"><p>${mascot('happy','')}</p><p>생일을 넣으면 여기에<br><b>오늘의 놀이 네 가지</b>가 나와요.</p></div></div>
</div></div></section>

<section class="sec" aria-labelledby="day-h"><div class="wrap feature">
<div class="feature-media reveal">${shot('cal','달력 화면 — 날짜마다 잠·놀이·이유식·기록이 색점으로 표시','',false)}</div>
<div class="reveal"><span class="eyebrow">${ico('calendar-days')}달력 · 하루 요약</span>
<h2 class="h-sec" id="day-h">어제 하루도, 지난주도<br>달력 한 칸에</h2>
<p class="lead">잠·이유식·놀이·기록이 날짜마다 색점으로 모여요. 누르면 그날 하루가 한 장으로 정리되고, 버튼 한 번이면 카톡으로 보내져요.</p>
<ul class="checks"><li>${ico('check')}조부모님·배우자에게 «오늘 하루 요약 보내기»</li><li>${ico('check')}어제 것도, 지난주 것도 날짜만 누르면</li><li>${ico('check')}오늘을 누르면 오늘 해볼 놀이·이유식이 함께</li></ul>
<div class="chat" aria-label="하루 요약 예시"><p class="who">카톡으로 보낸 모습 <span class="sample">예시</span></p><div class="bubble">${digest}</div><div class="reply">어머 컵을 뒤집었어? 😊</div></div>
</div></div></section>

<section class="sec alt" aria-labelledby="feat-h"><div class="wrap">
<div class="sec-head center reveal"><span class="eyebrow">${ico('list-checks')}한 앱에 다</span><h2 class="h-sec" id="feat-h">새벽 세 시에도 한 손으로</h2>
<p class="lead">아기를 안고도 누를 수 있게 만들었어요. 밤중 모드는 눈부시지 않게 어둡고 붉은 화면이에요.</p></div>
<div class="bento">${BENTO.map(([span,ic,bg,h,p,s])=>`<div class="bcell ${span} reveal"><div class="bi ${bg}">${ico(ic,'ico ico-lg')}</div><h3>${h}</h3><p>${p}</p>${['homeplays','sleepgraph'].includes(s)?`<div class="shot"><picture><source media="(prefers-color-scheme: dark)" srcset="/assets/shots/${s}-dark-390.webp 390w, /assets/shots/${s}-dark-560.webp 560w, /assets/shots/${s}-dark.webp 780w" sizes="(min-width:980px) 480px, 100vw"><img src="/assets/shots/${s}-light.webp" srcset="/assets/shots/${s}-light-390.webp 390w, /assets/shots/${s}-light-560.webp 560w, /assets/shots/${s}-light.webp 780w" sizes="(min-width:980px) 480px, 100vw" alt="" width="780" height="${s==='homeplays'?888:740}" loading="lazy" decoding="async"></picture></div>`:''}</div>`).join('')}</div>
</div></section>

<section class="sec" aria-labelledby="not-h"><div class="wrap">
<div class="sec-head center reveal"><span class="eyebrow">${ico('shield-check')}약속</span><h2 class="h-sec" id="not-h">고슴이가 하지 않는 것</h2></div>
<div class="nots">
<div class="not reveal"><h3>${ico('ban')}점수를 매기지 않아요</h3><p>빠르다·느리다를 판정하지 않아요. 걱정되면 기록을 모아 소아과에 들고 가시게 돕는 게 고슴이의 일이에요.</p></div>
<div class="not reveal"><h3>${ico('heart')}다른 아기와 견주지 않아요</h3><p>이정표는 채점표가 아니라 눈금이에요. 그래프에도 «권장선»을 긋지 않아요.</p></div>
<div class="not reveal"><h3>${ico('lock')}기록을 가져가지 않아요</h3><p>서버도 가입도 없어요. 만든 사람도 볼 수 없어요. 백업은 복사 한 번이면 돼요.</p></div>
</div></div></section>

<section class="sec alt" aria-labelledby="story-h"><div class="wrap story">
<div class="reveal">${mascot('happy','mascot-big')}</div>
<div class="reveal"><span class="eyebrow">${ico('book-open')}만든 이야기</span>
<h2 class="h-sec" id="story-h" style="margin-top:14px">아기 아빠가,<br>매일 쓰려고 만들었어요</h2>
<p class="quote" style="margin-top:16px">«지금 개월수에 맞는 놀이를<br>딱 하나만 골라 줬으면.»</p>
<p class="lead">오늘 뭐 하고 놀아 줄지 막막했던 날에 시작했어요. 놀이 방법은 한 아기의 ${REC_DAYS}일 관찰 기록에서 나왔고(생후 0~${REC_MAX_M}개월), 기록이 비어 있던 자리와 그 뒤 생후 ${MAX_TXT}까지는 미국 CDC 공식 발달 이정표·활동 팁으로 채웠어요. 기록이 쌓이는 만큼 놀이도 자라요.</p>
<div class="pills"><span class="chip">관찰 기록에서 <b>${nRec}가지</b></span><span class="chip">CDC 이정표·팁 <b>${nRef}가지</b></span><span class="chip">출처 없는 놀이 <b>0</b></span></div>
</div></div></section>

<section class="sec" aria-labelledby="hub-h"><div class="wrap">
<div class="sec-head reveal"><span class="eyebrow">${ico('search')}앱 없이 둘러보기</span><h2 class="h-sec" id="hub-h">검색하다 들르셨나요?</h2>
<p class="lead">개월수별 놀이와 지역별 달빛어린이병원은 앱을 열지 않아도 볼 수 있어요.</p></div>
<div class="hub-grid">
<div class="hub reveal"><h3>${ico('puzzle')}개월수별 아기 놀이</h3><p>신생아부터 생후 ${MAX_TXT}까지 ${PLAYS.length}가지 — 준비물과 방법까지.</p><div class="chips">${months.map(m=>`<a class="chip" href="/play/${m}.html">${mShort(m)}</a>`).join('')}<a class="chip" href="/play/"><b>전체</b></a></div></div>
<div class="hub reveal"><h3>${ico('hospital')}지역별 달빛어린이병원</h3><p>밤·주말·공휴일 소아 진료 ${MOON.length}곳 — 주소·전화·지도.</p><div class="chips">${regions.map(r=>`<a class="chip" href="/moon/${SLUG[r]}.html">${FULL[r]} <b>${MOON.filter(x=>x[1]===r).length}</b></a>`).join('')}</div></div>
</div></div></section>

<section class="sec alt" id="install" aria-labelledby="inst-h"><div class="wrap">
<div class="sec-head reveal"><span class="eyebrow">${ico('smartphone')}홈 화면에 추가</span><h2 class="h-sec" id="inst-h">홈 화면에 두면<br>앱처럼 열려요</h2>
<p class="lead">아이콘 한 번에 열리고, 인터넷이 없어도 열려요. 설치 파일도 가입도 없어요.</p></div>
<div class="install"><div>
<div class="tabs" role="tablist" aria-label="기기 고르기"><button role="tab" id="t-ios" aria-controls="tp-ios" aria-selected="true">아이폰</button><button role="tab" id="t-and" aria-controls="tp-and" aria-selected="false">안드로이드</button><button role="tab" id="t-inapp" aria-controls="tp-inapp" aria-selected="false">카톡에서 열었어요</button></div>
<div class="tabpanel" role="tabpanel" id="tp-ios" aria-labelledby="t-ios"><ol class="steps"><li><span><b>사파리</b>로 <a href="/www/index.html">고슴이</a>를 열어요</span></li><li><span>아래쪽 <b>공유 단추</b> <span class="key">${ico('share-2')}</span> 를 눌러요</span></li><li><span>목록에서 <b>«홈 화면에 추가»</b> → «추가»</span></li></ol></div>
<div class="tabpanel" role="tabpanel" id="tp-and" aria-labelledby="t-and" hidden><ol class="steps"><li><span><b>크롬</b>으로 <a href="/www/index.html">고슴이</a>를 열어요</span></li><li><span>앱 안에 뜨는 <b>«앱으로 설치하기»</b>를 누르거나, 오른쪽 위 <span class="key">⋮</span> 메뉴를 열어요</span></li><li><span><b>«홈 화면에 추가»</b> 또는 <b>«앱 설치»</b>를 눌러요</span></li></ol></div>
<div class="tabpanel" role="tabpanel" id="tp-inapp" aria-labelledby="t-inapp" hidden><ol class="steps"><li><span>카톡·인스타·네이버 앱 <b>안의 브라우저</b>에서는 홈 화면 추가가 막혀 있어요. 기록도 그 앱 안에만 남아요.</span></li><li><span>아래 단추로 크롬(아이폰은 사파리)으로 옮겨 연 다음, 왼쪽 칸의 방법대로 추가하세요.</span></li></ol><p style="margin-top:14px"><button class="btn btn-pri" type="button" data-outside>크롬으로 열기</button></p></div>
</div>
<aside class="qrbox reveal" aria-label="휴대폰으로 열기">${QR}<b>휴대폰 카메라로 비춰 보세요</b><p class="small" style="margin:6px 0 0">컴퓨터로 보고 계시면, 폰에서 바로 열려요.</p></aside>
</div></div></section>

<section class="sec" aria-labelledby="faq-h"><div class="narrow">
<div class="sec-head center reveal"><h2 class="h-sec" id="faq-h">자주 묻는 것</h2></div>
<div class="faq">${FAQ.map(([q,a])=>`<details><summary>${esc(q)}</summary><div class="a"><p>${esc(a)}</p></div></details>`).join('')}</div>
</div></section>

<section class="wrap" aria-labelledby="end-h"><div class="cta-band reveal" id="end-cta">${mascot('happy','')}<h2 id="end-h">오늘 놀이 하나,<br>지금 골라 볼까요?</h2><p>설치도 가입도 없이, 브라우저에서 바로.</p><a class="btn btn-pri btn-lg" href="/www/index.html">고슴이 열기 ${ico('arrow-right')}</a></div></section>
</main>
<div class="sticky-cta" id="sticky-cta"><a class="btn btn-pri btn-lg" href="/www/index.html">무료로 시작하기 ${ico('arrow-right')}</a></div>
${foot()}
<script src="/assets/demo.js?v=${V.demojs}" defer></script>
</body></html>`;
  write('index.html',body); pages.unshift({url,rel:'index.html',prio:'1.0'});
  ogJobs.unshift({name:'home',kind:'home'});
}

/* ════════ 404 ════════ */
write('404.html',`${head({title:'찾는 페이지가 없어요 | 고슴이',desc:'주소가 바뀌었거나 없는 페이지예요.',url:`${BASE}/404.html`,og:'home',extra:'<meta name="robots" content="noindex">\n'})}
${top()}
<main id="main" class="wrap nf"><div>${mascot('oh','mascot')}<h1 style="font-size:28px">앗, 이 페이지는 없어요</h1><p class="lead">주소가 바뀌었거나 없는 페이지예요.</p>
<div class="hero-cta" style="justify-content:center"><a class="btn btn-pri" href="/www/index.html">고슴이 열기</a><a class="btn btn-sec" href="/play/">개월수별 놀이</a><a class="btn btn-sec" href="/moon/">달빛어린이병원</a></div></div></main>
${foot()}
</body></html>`);

/* ════════ 곁다리 파일 ════════ */
pages.push({url:`${BASE}/privacy.html`,rel:'privacy.html',prio:'0.3'});
write('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p=>`<url><loc>${p.url}</loc><lastmod>${BUILT}</lastmod><priority>${p.prio||(p.rel.includes('index.html')?'0.8':'0.7')}</priority></url>`).join('\n')}
</urlset>
`);
write('robots.txt',`User-agent: *
Allow: /

Sitemap: ${BASE}/sitemap.xml
${VERIFY.daum?VERIFY.daum+'\n':''}`);
write(`${INDEXNOW_KEY}.txt`,INDEXNOW_KEY);   /* 내용은 열쇠 그대로 — 줄바꿈도 붙이지 않는다 */
write('assets/plays.json',JSON.stringify({maxM:MAX_M,plays:PLAYS.map(p=>Object.assign({n:p.n,name:p.name,m:p.m},p.to==null?{}:{to:p.to},{dom:p.dom,how:p.how,mat:p.mat}))}));
for(const f of ['site.js','demo.js']) fs.copyFileSync(path.join(SRC,f),path.join(OUT,'assets',f));
write('og-jobs.json',JSON.stringify(ogJobs,null,1));
console.log(`built ${pages.length} pages (+404) · plays ${PLAYS.length} (0~${MAX_M}개월) · moon ${MOON.length} in ${regions.length} regions · og jobs ${ogJobs.length}`);
