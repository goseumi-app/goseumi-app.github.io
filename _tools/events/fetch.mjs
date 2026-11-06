#!/usr/bin/env node
/* 고슴이 — «이번 주말 어디 갈까» 행사 목록 만들기
   공공 자료 세 곳에서 아이와 갈 만한 행사(공연·전시·체험·축제)를 모아 assets/events.json 하나로 만든다.
   앱은 이 파일 하나만 받아서 폰 안에서 아이 나이·지역으로 거른다 — 아이 정보도 지역 선택도 밖으로 나가지 않는다.

   자료(열쇠가 있는 곳만 쓴다 — 없는 곳은 건너뛰고 요약에 적는다):
     SEOUL_KEY        서울 열린데이터광장 «서울시 문화행사 정보» (culturalEventInfo) — 매일 갱신, 이용대상 글이 있어 나이를 읽을 수 있다
     DATA_GO_KR_KEY   공공데이터포털 «전국공연행사정보 표준데이터»(입장연령 있음) + «전국문화축제 표준데이터»
     KOPIS_KEY        공연예술통합전산망 KOPIS — 아동 공연(kidstate=Y)만, 상세에서 관람연령·가격·예매처

   쓰는 법:  node _tools/events/fetch.mjs --out assets/events.json [--days 60] [--cap 1500]
   환경변수: 위 열쇠 셋 중 있는 것. 셋 다 없으면 파일을 건드리지 않고 0으로 끝난다(열쇠를 넣기 전까지 매주 실패 메일이 가지 않게).
   열쇠가 하나라도 있는데 그 자료를 하나도 못 받으면 1로 끝난다(옛 파일은 그대로 둔다).

   원칙: 지어내지 않는다 — 제목·장소·날짜·연령·요금·링크는 자료에 있는 그대로, 없으면 null. 링크는 http(s)만.
         아이 앱이므로 만 7세(84개월) 이상만 되는 행사는 넣지 않는다. 술·성인 행사는 뺀다. */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), (arr[i + 1] && !arr[i + 1].startsWith('--')) ? arr[i + 1] : '1'] : []).filter(x => x.length));
const OUT = args.out || 'assets/events.json';
const DAYS = Number(args.days || 60);
const CAP = Number(args.cap || 1500);
/* 깃허브 Secrets에 붙여넣을 때 앞뒤 빈칸·줄바꿈이 딸려 들어가도 열쇠가 깨지지 않게 다듬는다 */
const KEYS = { seoul: (process.env.SEOUL_KEY || '').trim(), data: (process.env.DATA_GO_KR_KEY || '').trim(), kopis: (process.env.KOPIS_KEY || '').trim() };

/* ───────── 날짜 ───────── */
const KST = 9 * 60 * 60 * 1000;
function kstToday() { const d = new Date(Date.now() + KST); return d.toISOString().slice(0, 10); }
function addDays(ds, n) { const d = new Date(ds + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const TODAY = kstToday();
const FROM = addDays(TODAY, -1);           /* 어제 끝난 건 빼고, 오늘 진행 중인 건 넣는다 */
const TO = addDays(TODAY, DAYS);
function normDate(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{4})[.\-\/]?\s*(\d{1,2})[.\-\/]?\s*(\d{1,2})/);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 2000 || y > +TODAY.slice(0, 4) + 10 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;   /* «2626-08-08» 같은 오타는 날짜 없음으로 */
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function inWindow(start, end) {
  const s = start || end, e = end || start;
  if (!s || !e) return false;
  return e >= FROM && s <= TO;
}

/* ───────── 글 다듬기 ───────── */
const strip = s => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, m => ({ '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }[m])).replace(/\s+/g, ' ').trim();
const cut = (s, n) => { s = strip(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
/* 요금 글 → 무료(true)/유료(false)/모름(null). «10,000원»의 0원에 속지 않게 */
function isFree(feeT) {
  feeT = strip(feeT);
  if (!feeT) return null;
  if (/\d{1,3}(,\d{3})+원|[1-9]\d*,?\d*원|[1-9]\d*천원|[1-9]\d*만원/.test(feeT)) return /무료/.test(feeT) && !/유료/.test(feeT) ? null : false;
  if (/무료|없음|^0원$/.test(feeT)) return true;
  return false;
}
function safeUrl(u) {
  u = strip(u);
  if (!u) return null;
  if (/^www\./i.test(u)) u = 'https://' + u;
  if (!/^https?:\/\/[^\s"'<>]+$/i.test(u)) return null;
  return u.length > 400 ? null : u;
}

/* ───────── 시·도 ───────── */
const SIDO = [
  [/^(서울)/, '서울'], [/^(부산)/, '부산'], [/^(대구)/, '대구'], [/^(인천)/, '인천'], [/^(광주광역시|광주시(?!.*경기)|광주(?!.*경기))/, '광주'],
  [/^(대전)/, '대전'], [/^(울산)/, '울산'], [/^(세종)/, '세종'], [/^(경기)/, '경기'], [/^(강원)/, '강원'],
  [/^(충청북도|충북)/, '충북'], [/^(충청남도|충남)/, '충남'], [/^(전라북도|전북)/, '전북'], [/^(전라남도|전남)/, '전남'],
  [/^(경상북도|경북)/, '경북'], [/^(경상남도|경남)/, '경남'], [/^(제주)/, '제주'],
];
function sidoOf(...cands) {
  for (const c of cands) {
    const s = strip(c);
    if (!s) continue;
    for (const [re, name] of SIDO) if (re.test(s)) return name;
  }
  return null;
}
/* 법정동 시도 코드 → 시도 (관광공사 자료에 주소가 비어 있을 때) */
const LDONG = { '11': '서울', '26': '부산', '27': '대구', '28': '인천', '29': '광주', '30': '대전', '31': '울산', '36': '세종', '41': '경기', '42': '강원', '51': '강원', '43': '충북', '44': '충남', '45': '전북', '52': '전북', '46': '전남', '47': '경북', '48': '경남', '50': '제주' };
/* 전남·충남 주소에는 «구»가 바로 오지 않는다 — «전남 동구»는 광주, «충남 유성구»는 대전 (2026-11: 광주 금남로·양림동 축제가 «전남»으로 들어왔다) */
function fixSido(sido, gu) {
  if (gu && /구$/.test(gu)) { if (sido === '전남') return '광주'; if (sido === '충남') return '대전'; }
  return sido;
}
function guOf(addr) {
  const s = strip(addr);
  const m = s.match(/^\S+\s+(\S+?(?:시|군|구))(?=\s|$)/);
  return m ? m[1] : null;
}

/* ───────── 나이 읽기 — 글 → 개월 ───────── */
const ALL_RE = /전\s*체|전\s*연\s*[령링]|누구나|^누구$|제한\s*없|연령\s*무관|모든\s*연령|가족|영유아\s*동반|유아\s*동반|전\s*관람|all\s*ages/i;
const ADULT_RE = /성인\s*(전용|만|대상)|만\s*19세|19세\s*이상|청소년\s*관람\s*불가|18세\s*이상|20세\s*이상|대학생\s*이상|어르신|노인|시니어|직장인|학부모\s*대상(?!.*(어린이|아이|자녀))/;
function parseAge(raw) {
  const t = strip(raw).replace(/\s+/g, '');
  const out = { min: null, max: null, text: cut(raw, 24) || null };
  if (!t) return out;
  const kid = /어린이|아동|유아|아기|아이|키즈|자녀|영아|kids|가족|부모와/i.test(t);
  const set = (min, max) => { out.min = min; out.max = max; return out; };
  let m;
  /* 부모만 듣는 강연·모임(자녀를 둔 학부모, 양육자 대상) — 아이를 데려가는 나들이가 아니다. «함께·동반»이면 가족 행사로 본다 */
  if (/자녀를둔|양육하시는|양육하는|학부모대상|학부모및|학부모\d|부모교육/.test(t) && !/함께|동반|가족과|아이와/.test(t)) return set(999, null);
  if (/양육자|보호자/.test(t) && !/어린이|유아|영아|아기|아동|초등|해봄이|자녀와|아이와/.test(t) && !/함께|동반|가족/.test(t)) return set(999, null);   /* «어린이 및 양육자»는 가족 행사 */
  /* «전 연령 (만 12세 이하 성인 동반)», «미취학 아동은 보호자 동반» — 나이 제한이 아니라 동반 조건 (관광공사 자료에 흔함) */
  if (/(이하|미만|미취학|어린이|아동|유아)[^,.]{0,12}(보호자|성인|부모|어른)(동반|과함께|와함께)/.test(t)) return set(0, null);
  if (ADULT_RE.test(t) && !kid) return set(999, null);
  /* «청소년 이상 누구나»·«성인 누구나»·«누구나(성인 40명)»·«청년» — «누구나»보다 먼저 본다(2026-11 첫 자료에서 0개월로 잘못 읽었음) */
  if (!kid && /청소년이상|중학생이상|중학생부터|고등학생이상|고교생이상|성인누구나|성인\d|^성인|청년/.test(t)) return set(999, null);
  /* «미취학 아동 입장 불가»·«8세 미만 입장 불가» — 아래 «미만» 규칙(0~N)보다 먼저: 뜻이 정반대다 */
  if (/미취학[^,.]{0,6}(입장|관람)?(불가|제한|금지)/.test(t)) return set(84, null);
  if ((m = t.match(/(\d{1,2})세미만(입장|관람)?(불가|제한|금지)/))) return set(+m[1] * 12, null);
  if ((m = t.match(/(\d+)개월미만(입장|관람)?(불가|제한|금지)/))) return set(+m[1], null);
  if ((m = t.match(/(\d+)(?:개월)?~(\d+)개월/))) return set(+m[1], +m[2]);                       /* 12개월~36개월, 만 0~36개월 */
  if ((m = t.match(/(\d+)개월~만?(\d{1,2})세/))) return set(+m[1], +m[2] * 12 + 11);           /* 24개월~7세 */
  if ((m = t.match(/(\d+)개월~초/))) return set(+m[1], 155);                                     /* 36개월~초등 */
  if ((m = t.match(/(\d+)개월(이상|부터|~$)/))) return set(+m[1], null);                         /* 36개월 이상 */
  if ((m = t.match(/(\d+)개월(이하|까지|미만)/))) return set(0, +m[1]);                          /* 24개월 이하 */
  if ((m = t.match(/만?(\d{1,2})(?:세)?~만?(\d{1,2})세/))) return set(+m[1] * 12, +m[2] * 12 + 11); /* 4~7세, 6세~13세, 만 4세~만 7세 */
  if ((m = t.match(/만?(\d{1,2})세~초/))) return set(+m[1] * 12, 155);                           /* 5세~초등 */
  if ((m = t.match(/만?(\d{1,2})세[^0-9~]{0,8}?(이상|부터)/))) return set(+m[1] * 12, null);     /* 만 3세 이상, 누구나(만 13세(중학생)이상) */
  if ((m = t.match(/만?(\d{1,2})세(이하|까지|미만)/))) return set(0, +m[1] * 12 + 11);           /* 7세 이하 */
  if (/초[·.,]?중/.test(t)) return set(72, null);                                             /* 초·중·고 학생 */
  if ((m = t.match(/초(?:등(?:학교|학생)?)?(\d)[-~](\d)학년/))) return set(72 + (+m[1] - 1) * 12, 72 + +m[2] * 12 - 1);   /* 초등 1-3학년, 초등학교 5~6학년 */
  if ((m = t.match(/초(?:등(?:학교|학생)?(\d)학년|등|(\d))/))) {                                /* 초등, 초4 이상, 초등 3학년 이상, 초등 이하 */
    if (/이하|까지/.test(t) && !/이상/.test(t)) return set(0, 155);
    if (/유아|영아|아기|미취학|유치원|어린이집/.test(t) && !/이상|부터/.test(t)) return set(0, 155);   /* 유아 및 초등학생 */
    const g = m[1] || m[2], lo = 72 + (g ? (+g - 1) * 12 : 0);
    if (/이상|부터|누구나/.test(t)) return set(lo, null);                                      /* «초등학생 이상» — 어린아이를 막는 표기 */
    return set(lo, g ? lo + 11 : 155);                                                         /* «초등학생»·«초등 1학년» — 그 나이 아이 대상 */
  }
  if (/미취학/.test(t)) return set(0, 83);
  if (/영아|아기|베이비|baby|돌전|돌이전/i.test(t)) return set(0, 36);
  if (/영유아|유아/.test(t)) return set(0, null);
  if (ALL_RE.test(t)) return set(0, null);
  if (/중등|중학|고등|청소년|성인|대학/.test(t) && !kid) return set(999, null);
  if (kid) return set(0, null);
  return out;   /* 모르면 비워 둔다 — 앱이 «연령 표기 없음»으로 보여 준다 */
}

/* ───────── 아이와 갈 만한가 ───────── */
const KID_WORDS = /어린이|아동|유아|영유아|아기|키즈|kids|가족|패밀리|동화|그림책|인형극|마술|체험|놀이|축제|과학관|박물관|미술관|도서관|숲|공원|동물|공룡|로봇|레고|블록|모래|물놀이|썰매|눈|농장|수확|고구마|감|딸기|사과|캠프|자연|생태|곤충|텃밭|만들기|공작|클래식\s*for\s*kids|오케스트라|뮤지컬|발레|국악|사물놀이|퍼레이드|불꽃|빛|등불|크리스마스|산타|핼러윈|할로윈/i;
const NO_WORDS = /맥주|와인|막걸리|소주|주류|전통주|칵테일|위스키|성인\s*전용|19금|클럽|나이트|채용|취업|박람회\s*\(산업|부동산|세미나|학술|포럼|컨퍼런스|콘퍼런스|심포지엄|경진대회|공모전|입찰|설명회|강연\s*\(성인|재테크|주식|코인|웨딩|결혼|상조|장례|요가\s*클래스|헬스|피트니스|마라톤\s*참가\s*신청|드라이빙|카지노|경마|경륜|로또/i;

/* 아이를 데리고 가는 나들이가 아닌 것 — 2026-11 첫 서울 자료에서 북토크·강연·창업·아카데미·단체 교육·온라인 전시가 «누구나»로 섞여 들어왔다 */
const STRONG_KID = /어린이|유아|영아|영유아|아기|베이비|키즈|kids|가족|패밀리|그림책|동화|인형극|동요|아이와|엄마|아빠|부모와|어린이집|유치원|꼬마|베베|핑크퐁|뽀로로|타요|로보카\s*폴리|콩순이|티니핑|브레드\s*이발소|슈퍼윙스|미니특공대|헬로\s*카봇|띠띠뽀|번개맨|코코몽|구름빵/i;
const HARD_NO_TITLE = /시니어|어르신|중장년|직장인|창업|양성\s*과정|강사\s*(모집|양성)|할인\s*안내|단체\s*관람|학급\s*단체|단체\s*교육|온라인|찾아가는|교육생\s*모집|수강생\s*모집|일반교육\s*모집|졸업\s*(전시|작품)|아카데미|시민대학|정규\s*강좌|독서\s*토론|북\s*토크|작가\s*힙톡|초대석|미식\s*투어|운영\s*안내|휴관|그랜드\s*세일|판매전|뷰티|러닝|마라톤|런트립|허그런/i;
const SOFT_NO_TITLE = /학부모|양육자|강연|특강|인문학|토크\s*콘서트|작가와의\s*(만남|대화)|창작\s*(클래스|트레이닝)|원데이\s*클래스|영화제|상영회|영화관/i;
function notForKids(title, trgt) {
  if (HARD_NO_TITLE.test(title)) return true;
  if (SOFT_NO_TITLE.test(title) && !STRONG_KID.test(title)) return true;
  const tg = strip(trgt || '').replace(/\s+/g, '');
  if (/단체/.test(tg)) return true;                                     /* 학급·어린이집 단체 전용 — 가족끼리 갈 수 없다 */
  if (/(^|[^내])외국인/.test(tg)) return true;                           /* 외국인 대상 (내외국인 누구나는 남김) */
  if (/경력|창작자|극작가/.test(tg)) return true;                         /* 전문가 대상 */
  if (/회원$|회원만/.test(tg) && !STRONG_KID.test(tg)) return true;      /* 회원 전용 강좌 */
  return false;
}
/* 앱 정렬용 — 아이 나이를 콕 집은 행사(3) > 이름에 아이·가족이 들어간 행사(2) > 누구나(1) > 모름(0)
   «초등학생 이상»은 아이 대상이 아니라 어린아이를 막는 표기다 — 2026-11 첫 자료에서 재즈·고음악 공연이 3점을 받았다 */
function kidScore(title, age) {
  const known = age.min != null && age.min !== 999;
  if (known && age.max != null && age.max <= 155) return 3;   /* 6~9세, 36개월 미만, 초등 1~3학년 */
  if (known && age.min > 0 && age.min <= 48) return 3;        /* 24개월·36개월·만 3~4세 이상 — 어린이 공연에서 흔한 표기 */
  if (STRONG_KID.test(title)) return 2;
  if (known && age.min < 72) return 1;                        /* 누구나, 만 5세 이상 */
  return 0;
}
/* 이름만 봐서는 무슨 행사인지 모르는 것 — «2026년 11월 공연 (1회)», «○○아트홀 기획공연», «11월 문화프로그램 안내» */
function genericTitle(title) {
  let t = strip(title).replace(/^\[[^\]]*\]/, ' ').trim();        /* 앞머리 [기관 이름]만 뗀다 — 뒤쪽 [별난 극장 놀이터]가 진짜 이름일 때가 많다 */
  if (!t) t = strip(title).replace(/[[\]]/g, ' ');
  t = t.replace(/\(\s*\d+\s*회차?\s*\)/g, ' ').replace(/(19|20)\d{2}\s*년?|\d{1,2}\s*월/g, ' ').replace(/\s+/g, ' ').trim();
  return !t || /^(\S+\s*)?(기획\s*공연|정기\s*공연|공연|행사|문화\s*행사|프로그램|문화\s*프로그램)(\s*안내)?$/.test(t);
}
/* 날짜를 몰라 1월 1일~12월 31일로 채워 둔 것 (2026-11: 당진 축제 두 건) */
function placeholderRange(start, end) {
  return !!(start && end && start.slice(0, 4) === end.slice(0, 4) && start.slice(5) === '01-01' && end.slice(5) === '12-31');
}

/* ───────── 받아오기 ───────── */
/* 누가 묻는지 밝히는 이름표 — 다시 물을 때만 단다(첫 시도는 11/2에 통했던 그대로) */
const UA = 'goseumi-events/1.0 (+https://goseumi-app.github.io)';
async function getJSON(url, { timeout = 30000, as = 'json', ua = null } = {}) {
  if (process.env.EV_MOCK) return mockResponse(url, as);   /* 열쇠 없이 흐름만 점검할 때 — 지어낸 응답(제목에 «예시») */
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'accept': as === 'json' ? 'application/json, */*' : 'application/xml, text/xml, */*', ...(ua ? { 'user-agent': ua } : {}) } });
    const body = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status} ${body.slice(0, 160).replace(/\s+/g, ' ')}`);
    if (as === 'text') return body;
    try { return JSON.parse(body); } catch { throw new Error(`JSON 아님: ${body.slice(0, 160).replace(/\s+/g, ' ')}`); }
  } finally { clearTimeout(t); }
}
const sleep = ms => new Promise(r => setTimeout(r, process.env.EV_MOCK ? 0 : ms));
/* 막혔을 때 쉬었다가 다시 — 2026-11-05 목 06:00 KOPIS가 첫 물음부터 «HTTP 400 Request Blocked»(방화벽)를 돌려줬다.
   15초·45초 쉬고 두 번 더 묻고, 다시 물을 때는 이름표(UA)를 단다. 어느 시도에서 됐는지 기록에 남긴다. */
async function getRetry(url, opts, log, label, waits = [15000, 45000]) {
  for (let i = 0; ; i++) {
    try { const body = await getJSON(url, i ? { ...opts, ua: UA } : opts); if (i) log(`${label}: ${i + 1}번째 시도에 받음(이름표 달고)`); return { body, ua: i ? UA : null }; }
    catch (e) {
      if (i >= waits.length) throw e;
      log(`${label}: ${i + 1}번째 실패(${cut(e.message, 90)}) — ${waits[i] / 1000}초 뒤 다시`);
      await sleep(waits[i]);
    }
  }
}
/* ───────── 흐름 점검용 가짜 응답 (EV_MOCK=1) — 실제 자료가 아니다 ───────── */
function mockResponse(url, as) {
  const d = n => addDays(TODAY, n);
  /* EV_MOCK_BLOCK=kopis 처럼 주면 그곳만 방화벽에 막힌 것처럼(2026-11-05에 실제로 받은 답과 같은 꼴) */
  const BLOCK_AT = { kopis: 'kopis.or.kr', seoul: 'openapi.seoul.go.kr', tour: '/KorService2/', data: 'tn_pubr_public_' };
  if ((process.env.EV_MOCK_BLOCK || '').split(',').some(b => BLOCK_AT[b] && url.includes(BLOCK_AT[b]))) throw new Error('HTTP 400 400 Bad Request Request Blocked <br>');
  if (url.includes('openapi.seoul.go.kr')) {
    const row = (TITLE, USE_TRGT, s, e, extra = {}) => ({ CODENAME: '교육/체험', GUNAME: '강서구', TITLE, DATE: `${s}~${e}`, PLACE: '예시 어린이도서관', ORG_NAME: '예시', USE_TRGT, USE_FEE: '', IS_FREE: '무료', ORG_LINK: 'https://example.com/seoul', MAIN_IMG: '', STRTDATE: s + ' 00:00:00.0', END_DATE: e + ' 00:00:00.0', ...extra });
    return { culturalEventInfo: { list_total_count: 4, RESULT: { CODE: 'INFO-000', MESSAGE: '정상' }, row: [
      row('예시 영유아 그림책 놀이', '만 12개월 이상 영유아와 가족', d(5), d(6)),
      row('예시 성인 재즈 콘서트', '성인', d(5), d(5), { CODENAME: '콘서트' }),
      row('예시 지난 행사', '누구나', d(-30), d(-10)),
      row('예시 초등 과학교실', '초등 3학년 이상', d(8), d(8)),
    ] } };
  }
  if (url.includes('tn_pubr_public_pblprfr_event_info_api')) {
    return { response: { header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' }, body: { totalCount: 2, pageNo: 1, numOfRows: 1000, items: [
      { eventNm: '예시 가족 인형극 <달빛>', opar: '예시아트홀', eventCo: '어린이와 가족을 위한 인형극', eventStartDate: d(3), eventEndDate: d(4), admfee: '전석 10,000원', entrcAge: '36개월 이상', homepageUrl: 'https://example.com/puppet', rdnmadr: '인천광역시 서구 예시로 1' },
      { eventNm: '예시 경영 세미나', opar: '예시센터', eventCo: '세미나', eventStartDate: d(3), eventEndDate: d(3), admfee: '', entrcAge: '성인', homepageUrl: '', rdnmadr: '서울특별시 중구 예시로 2' },
    ] } } };
  }
  if (url.includes('tn_pubr_public_cltur_fstvl_api')) {
    return { response: { header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' }, body: { totalCount: 2, pageNo: 1, numOfRows: 1000, items: [
      { fstvlNm: '예시 국화꽃 축제', opar: '예시공원', fstvlCo: '국화 전시와 체험', fstvlStartDate: d(1), fstvlEndDate: d(12), homepageUrl: 'https://example.com/fest', rdnmadr: '경기도 부천시 예시로 3' },
      { fstvlNm: '예시 맥주 축제', opar: '예시광장', fstvlCo: '맥주', fstvlStartDate: d(1), fstvlEndDate: d(2), homepageUrl: 'https://example.com/beer', rdnmadr: '서울특별시 송파구 예시로 4' },
    ] } } };
  }
  if (url.includes('/KorService2/searchFestival2')) {
    const ymd = n => d(n).replace(/-/g, '');
    return { response: { header: { resultCode: '0000', resultMsg: 'OK' }, body: { numOfRows: 500, pageNo: 1, totalCount: 4, items: { item: [
      { title: '예시 가족 김장 축제', addr1: '', lDongRegnCd: '28', contentid: '900004', contenttypeid: '15', eventstartdate: ymd(6), eventenddate: ymd(7), firstimage: '' },
      { title: '예시 어린이 빛 축제', addr1: '인천광역시 연수구 예시로 5', contentid: '900001', contenttypeid: '15', eventstartdate: ymd(2), eventenddate: ymd(20), firstimage: 'http://tong.visitkorea.or.kr/cms/resource/example.jpg' },
      { title: '예시 와인 페스티벌', addr1: '경기도 가평군 예시로 6', contentid: '900002', contenttypeid: '15', eventstartdate: ymd(3), eventenddate: ymd(4), firstimage: '' },
      { title: '예시 지난 축제', addr1: '경기도 수원시 팔달구 예시로 7', contentid: '900003', contenttypeid: '15', eventstartdate: ymd(-40), eventenddate: ymd(-30), firstimage: '' },
    ] } } } };
  }
  if (url.includes('/KorService2/detailIntro2')) {
    const id = (url.match(/contentId=(\d+)/) || [])[1];
    const item = id === '900001'
      ? { contentid: id, agelimit: '전연령', usetimefestival: '무료', eventplace: '예시 공원', program: '빛 터널, 어린이 만들기 체험', eventhomepage: '<a href="https://example.com/light" target="_blank" title="새창">https://example.com/light</a>' }
      : { contentid: id, agelimit: '', usetimefestival: '', eventhomepage: '' };
    return { response: { header: { resultCode: '0000', resultMsg: 'OK' }, body: { numOfRows: 10, pageNo: 1, totalCount: 1, items: { item: [item] } } } };
  }
  if (url.includes('/KorService2/detailCommon2')) {
    const id = (url.match(/contentId=(\d+)/) || [])[1];
    return { response: { header: { resultCode: '0000', resultMsg: 'OK' }, body: { numOfRows: 10, pageNo: 1, totalCount: 1, items: { item: [{ contentid: id, homepage: id === '900004' ? '<a href="http://example.com/kimjang" target="_blank">홈페이지 바로가기</a>' : '' }] } } } };
  }
  if (url.includes('kopis.or.kr/openApi/restful/prfplc/')) {
    return `<?xml version="1.0"?><dbs><db><mt10id>FC000002</mt10id><fcltynm>예시 빛고을극장</fcltynm><adres>광주광역시 북구 예시로 9</adres></db></dbs>`;
  }
  if (url.includes('kopis.or.kr/openApi/restful/pblprfr/')) {
    const id = (url.match(/pblprfr\/(PF\d+)/) || [])[1];
    return id === 'PF000002'
      ? `<?xml version="1.0"?><dbs><db><mt20id>PF000002</mt20id><mt10id>FC000002</mt10id><prfnm>예시 가족 인형극 빛고을</prfnm><prfage>만 3세 이상</prfage><pcseguidance>전석 15,000원</pcseguidance><area>전남광주통합특별시</area></db></dbs>`
      : `<?xml version="1.0"?><dbs><db><mt20id>PF000001</mt20id><prfnm>예시 아기 클래식 음악회</prfnm><prfage>만 24개월 이상</prfage><pcseguidance>전석 20,000원</pcseguidance><relates><relate><relatenm>예시 예매처</relatenm><relateurl>https://example.com/ticket</relateurl></relate></relates></db></dbs>`;
  }
  if (url.includes('kopis.or.kr/openApi/restful/pblprfr')) {
    const dd = n => d(n).replace(/-/g, '.');
    return `<?xml version="1.0"?><dbs><db><mt20id>PF000001</mt20id><prfnm>예시 아기 클래식 음악회</prfnm><prfpdfrom>${dd(9)}</prfpdfrom><prfpdto>${dd(9)}</prfpdto><fcltynm>예시아트센터</fcltynm><poster>https://example.com/p.jpg</poster><area>인천광역시</area><genrenm>서양음악(클래식)</genrenm><prfstate>공연예정</prfstate></db><db><mt20id>PF000002</mt20id><prfnm>예시 가족 인형극 빛고을</prfnm><prfpdfrom>${dd(10)}</prfpdfrom><prfpdto>${dd(11)}</prfpdto><fcltynm>예시 빛고을극장</fcltynm><poster></poster><area>전남광주통합특별시</area><genrenm>연극</genrenm><prfstate>공연예정</prfstate></db></dbs>`;
  }
  throw new Error('가짜 응답 없음: ' + url);
}

function dataKeyParam(k) { return /%[0-9A-Fa-f]{2}/.test(k) ? k : encodeURIComponent(k); }  /* data.go.kr 열쇠는 인코딩/디코딩 두 꼴 — 어느 쪽을 넣어도 되게 */

/* ── 1) 서울시 문화행사 정보 ── */
async function fetchSeoul(key, log) {
  const out = []; let total = null; const PAGE = 1000;
  for (let start = 1; start <= 10000; start += PAGE) {
    const end = start + PAGE - 1;
    const j = await getJSON(`http://openapi.seoul.go.kr:8088/${encodeURIComponent(key)}/json/culturalEventInfo/${start}/${end}/`);
    const box = j.culturalEventInfo;
    if (!box) { const r = j.RESULT || {}; throw new Error(`응답 형식 다름: ${r.CODE || ''} ${r.MESSAGE || JSON.stringify(j).slice(0, 120)}`); }
    if (box.RESULT && box.RESULT.CODE && box.RESULT.CODE !== 'INFO-000') throw new Error(`${box.RESULT.CODE} ${box.RESULT.MESSAGE}`);
    total = total ?? Number(box.list_total_count || 0);
    for (const r of box.row || []) {
      const start_ = normDate(r.STRTDATE), end_ = normDate(r.END_DATE);
      if (!inWindow(start_, end_)) continue;
      const trgt = strip(r.USE_TRGT), title = strip(r.TITLE), code = strip(r.CODENAME);
      if (NO_WORDS.test(title) || NO_WORDS.test(trgt) || notForKids(title, trgt)) continue;
      const age = parseAge(trgt);
      if (age.min === 999) continue;
      const kid = kidScore(title, age);
      const kidish = kid >= 1 || KID_WORDS.test(title) || /교육\/체험|축제/.test(code);
      if (!kidish) continue;
      const free = r.IS_FREE === '무료' ? true : (r.IS_FREE === '유료' ? false : null);
      out.push({
        src: 'seoul', id: 'seoul:' + hash(title + start_ + strip(r.PLACE)),
        title: cut(title, 70), place: cut(r.PLACE, 40) || null, sido: '서울', gu: strip(r.GUNAME) || null,
        start: start_, end: end_, ageMin: age.min, ageMax: age.max, ageText: age.text,
        free, fee: free === false ? cut(r.USE_FEE, 40) || null : null,
        url: safeUrl(r.ORG_LINK) || safeUrl(r.HMPG_ADDR), img: safeUrl(r.MAIN_IMG),
        kind: kindOf(code + ' ' + title), kid,
      });
    }
    log(`서울 ${start}~${end}: 전체 ${total}, 모음 ${out.length}`);
    if (end >= total) break;
    await sleep(300);
  }
  return out;
}

/* ── 2) 공공데이터포털 표준데이터 ── */
async function fetchDataGo(key, log) {
  const out = [];
  /* 2a. 전국공연행사정보 */
  await pagedDataGo(`https://api.data.go.kr/openapi/tn_pubr_public_pblprfr_event_info_api`, key, log, '공연행사', (r) => {
    const start = normDate(r.eventStartDate), end = normDate(r.eventEndDate);
    if (!inWindow(start, end) || placeholderRange(start, end)) return null;
    const title = strip(r.eventNm), body = strip(r.eventCo);
    if (NO_WORDS.test(title) || NO_WORDS.test(body) || notForKids(title, r.entrcAge)) return null;
    const age = parseAge(r.entrcAge);
    if (age.min === 999) return null;
    const kid = kidScore(title, age);
    /* 전국 공연 자료에는 «전체관람가» 어른 공연이 많다 — 나이를 콕 집었거나, 이름·소개에 아이와 갈 만한 낱말이 있을 때만 */
    const kidish = kid >= 2 || (kid === 1 && KID_WORDS.test(title + ' ' + body.slice(0, 200))) || (kid === 0 && STRONG_KID.test(body.slice(0, 200)));
    if (!kidish) return null;
    const feeT = strip(r.admfee || r.chrgeInfo);
    const free = isFree(feeT);
    const addr = strip(r.rdnmadr || r.lnmadr), gu = guOf(addr);
    return {
      src: 'data_event', id: 'de:' + hash(title + start + strip(r.opar)),
      title: cut(title, 70), place: cut(r.opar, 40) || null, sido: fixSido(sidoOf(addr, r.insttNm), gu), gu,
      start, end, ageMin: age.min, ageMax: age.max, ageText: age.text,
      free, fee: free === false ? cut(feeT, 40) : null,
      url: safeUrl(r.homepageUrl) || safeUrl(r.reservInfo), img: null, kind: kindOf(title + ' ' + body.slice(0, 80)), kid,
    };
  }).then(a => out.push(...a));
  /* 2b. 전국문화축제 */
  await pagedDataGo(`https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api`, key, log, '문화축제', (r) => {
    const start = normDate(r.fstvlStartDate), end = normDate(r.fstvlEndDate);
    if (!inWindow(start, end) || placeholderRange(start, end)) return null;
    const title = strip(r.fstvlNm), body = strip(r.fstvlCo);
    if (NO_WORDS.test(title) || NO_WORDS.test(body.slice(0, 200)) || notForKids(title, '')) return null;
    const addr = strip(r.rdnmadr || r.lnmadr), gu = guOf(addr);
    return {
      src: 'data_fest', id: 'df:' + hash(title + start + strip(r.opar)),
      title: cut(title, 70), place: cut(r.opar, 40) || null, sido: fixSido(sidoOf(addr, r.insttNm), gu), gu,
      start, end, ageMin: 0, ageMax: null, ageText: '축제 · 연령 제한 표기 없음',
      free: null, fee: null,
      url: safeUrl(r.homepageUrl), img: null, kind: '축제', kid: STRONG_KID.test(title + ' ' + body.slice(0, 120)) ? 2 : 1,
    };
  }).then(a => out.push(...a));
  return out;
}
async function pagedDataGo(base, key, log, label, mapRow) {
  const out = []; const ROWS = 1000; let total = null;
  for (let page = 1; page <= 60; page++) {
    const j = await getJSON(`${base}?serviceKey=${dataKeyParam(key)}&pageNo=${page}&numOfRows=${ROWS}&type=json`);
    const root = j?.response || j;                       /* 표준데이터 API는 {response:{header,body}} 대신 {header,body}로 줄 때가 있다(2026-11 확인) */
    const hdr = root?.header, body = root?.body;
    if (!hdr) throw new Error(`${label}: 응답 형식 다름 ${JSON.stringify(j).slice(0, 160)}`);
    if (hdr.resultCode && hdr.resultCode !== '00') throw new Error(`${label}: ${hdr.resultCode} ${hdr.resultMsg}`);
    total = total ?? Number(body?.totalCount || 0);
    const items = Array.isArray(body?.items) ? body.items : (body?.items?.item ? [].concat(body.items.item) : []);
    let kept = 0;
    for (const r of items) { const e = mapRow(r); if (e) { out.push(e); kept++; } }
    log(`${label} ${page}쪽: 받음 ${items.length}, 창 안 ${kept}, 누적 ${out.length} / 전체 ${total}`);
    if (page * ROWS >= total || !items.length) break;
    await sleep(300);
  }
  return out;
}

/* ── 4) 한국관광공사 국문 관광정보(KorService2) — 행사정보 목록 + 소개정보(관람 연령·요금·홈페이지) ──
   공공데이터포털 열쇠(DATA_GO_KR_KEY)를 같이 쓴다. 개발계정은 기능마다 하루 1,000회 — 소개정보는 한 번에 TOUR_DETAIL_CAP건까지만. */
const TOUR = 'https://apis.data.go.kr/B551011/KorService2';
const TOUR_DETAIL_CAP = 450, TOUR_COMMON_CAP = 300;
async function tourGet(op, params, key) {
  const qs = Object.entries({ MobileOS: 'ETC', MobileApp: 'goseumi', _type: 'json', ...params }).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  const j = await getJSON(`${TOUR}/${op}?serviceKey=${dataKeyParam(key)}&${qs}`);
  const root = j?.response || j; const hdr = root?.header, body = root?.body;
  if (!hdr) throw new Error(`관광공사 ${op}: 응답 형식 다름 ${JSON.stringify(j).slice(0, 160)}`);
  if (hdr.resultCode != null && !/^0+$/.test(String(hdr.resultCode))) throw new Error(`관광공사 ${op}: ${hdr.resultCode} ${hdr.resultMsg}`);
  const it = body?.items?.item; const items = Array.isArray(it) ? it : (it ? [it] : []);
  return { total: Number(body?.totalCount || 0), items };
}
/* 홈페이지 칸은 <a href="…">…</a> 꼴로 올 때가 많다 — 첫 주소만 */
function firstUrl(raw) {
  const m = String(raw || '').match(/(?:https?:\/\/|www\.)[^\s"'<>]+/i);
  return m ? safeUrl(m[0].replace(/[),.]+$/, '')) : null;
}
async function fetchTour(key, log) {
  const list = []; const ROWS = 500;
  const since = addDays(FROM, -90).replace(/-/g, '');            /* 석 달 전부터 — 이미 시작해 진행 중인 축제도 받게(뒤에서 기간으로 다시 거름) */
  for (let page = 1; page <= 20; page++) {
    const { total, items } = await tourGet('searchFestival2', { eventStartDate: since, numOfRows: ROWS, pageNo: page, arrange: 'A' }, key);
    list.push(...items);
    log(`관광공사 행사 ${page}쪽: 받음 ${items.length}, 누적 ${list.length} / 전체 ${total}`);
    if (page * ROWS >= total || !items.length) break;
    await sleep(300);
  }
  const cand = [];
  for (const r of list) {
    const start = normDate(r.eventstartdate), end = normDate(r.eventenddate);
    if (!inWindow(start, end) || placeholderRange(start, end)) continue;
    const title = strip(r.title);
    if (!title || NO_WORDS.test(title) || notForKids(title, '')) continue;
    cand.push({ r, title, start, end });
  }
  const out = []; let i = 0, asked = 0, failed = 0, commonAsked = 0, commonFailed = 0;
  async function worker() {
    while (i < cand.length) {
      const { r, title, start, end } = cand[i++];
      let d = {};
      if (asked < TOUR_DETAIL_CAP) {
        asked++;
        try { d = (await tourGet('detailIntro2', { contentId: r.contentid, contentTypeId: r.contenttypeid || 15 }, key)).items[0] || {}; }
        catch (e) { failed++; if (failed <= 3) log(`관광공사 소개정보 실패 ${r.contentid}: ${e.message}`); }
        await sleep(100);
      }
      const ageRaw = strip(d.agelimit), prog = strip(d.program);
      if (NO_WORDS.test(prog.slice(0, 200))) continue;
      let age = ageRaw ? parseAge(ageRaw) : { min: 0, max: null, text: '축제·행사 · 연령 제한 표기 없음' };
      if (age.min === 999) continue;
      const kid = Math.max(kidScore(title, age), STRONG_KID.test(title + ' ' + prog.slice(0, 120)) ? 2 : 0);
      if (kid === 0 && !KID_WORDS.test(title)) continue;
      const feeT = strip(d.usetimefestival), free = isFree(feeT);
      let url = firstUrl(d.eventhomepage);
      if (!url && commonAsked < TOUR_COMMON_CAP) {                 /* 소개정보에 홈페이지가 없으면 공통정보의 홈페이지 */
        commonAsked++;
        try { url = firstUrl(((await tourGet('detailCommon2', { contentId: r.contentid }, key)).items[0] || {}).homepage); }
        catch (e) { commonFailed++; if (commonFailed <= 3) log(`관광공사 공통정보 실패 ${r.contentid}: ${e.message}`); }
        await sleep(100);
      }
      const addr = strip(r.addr1), gu = guOf(addr), k = kindOf(title + ' ' + prog.slice(0, 60));
      out.push({
        src: 'tour', id: 'tour:' + strip(r.contentid),
        title: cut(title, 70), place: cut(strip(d.eventplace) || addr, 40) || null, sido: fixSido(sidoOf(addr, d.eventplace) || LDONG[String(r.lDongRegnCd || '').slice(0, 2)] || null, gu), gu,
        start, end, ageMin: age.min, ageMax: age.max, ageText: age.text,
        free, fee: free === false ? cut(feeT, 40) || null : null,
        url, img: safeUrl(r.firstimage), kind: k === '기타' ? '축제' : k, kid,
      });
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  log(`관광공사: 기간 안 ${cand.length}건, 소개정보 ${asked}번(실패 ${failed}), 공통정보 ${commonAsked}번(실패 ${commonFailed}), 남김 ${out.length}, 링크 ${out.filter(e => e.url).length}`);
  const notes = [];
  if (failed) notes.push(`소개정보(연령·요금) ${asked}건 중 ${failed}건 못 받음 — 그 행사는 연령 표기 없음으로`);
  if (commonFailed) notes.push(`공통정보(홈페이지) ${commonAsked}건 중 ${commonFailed}건 못 받음`);
  notes.push(`링크 ${out.filter(e => e.url).length}/${out.length}`);
  out.note = notes.join(' · ');
  return out;
}

/* ── 3) KOPIS 아동 공연 ── */
function xmlRecords(xml, tag) {
  const recs = []; const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'); let m;
  while ((m = re.exec(xml))) {
    const o = {}; const fr = /<([a-zA-Z0-9_]+)>([\s\S]*?)<\/\1>/g; let f;
    while ((f = fr.exec(m[1]))) o[f[1]] = strip(f[2].replace(/^<!\[CDATA\[|\]\]>$/g, ''));
    recs.push(o);
  }
  return recs;
}
/* KOPIS 오류 응답 — <returncode>가 00이 아니거나 <errmsg>가 있으면 (오류도 <db> 안에 담겨 올 수 있다) */
function kopisErr(xml) {
  const code = String(xml).match(/<returncode>\s*(\d+)\s*<\/returncode>/i)?.[1], msg = String(xml).match(/<errmsg>([\s\S]*?)<\/errmsg>/i)?.[1];
  return (code && !/^0+$/.test(code)) || msg ? `KOPIS ${code || ''} ${strip(msg || String(xml).slice(0, 160))}`.replace(/\s+/g, ' ').trim() : null;
}
async function fetchKopis(key, log) {
  const out = []; const list = [];
  const sd = FROM.replace(/-/g, ''), ed = TO.replace(/-/g, '');
  let ua = null;   /* 다시 물어서 됐으면 그 뒤로는 계속 이름표를 단다 */
  for (let p = 1; p <= 20; p++) {
    const got = await getRetry(`https://www.kopis.or.kr/openApi/restful/pblprfr?service=${encodeURIComponent(key)}&stdate=${sd}&eddate=${ed}&cpage=${p}&rows=100&kidstate=Y`, { as: 'text', ua }, log, `KOPIS 목록 ${p}쪽`);
    const xml = got.body; ua = ua || got.ua;
    const err = kopisErr(xml); if (err) throw new Error(err);     /* 열쇠 오류도 <db> 안에 담겨 올 수 있다 */
    const recs = xmlRecords(xml, 'db').filter(r => r.mt20id);
    list.push(...recs);
    log(`KOPIS 목록 ${p}쪽: ${recs.length}`);
    if (recs.length < 100) break;
    await sleep(300);
  }
  /* 기간·이름으로 먼저 거르고 남은 것만 상세를 묻는다(1초 10회 제한) */
  const cand = list.map(r => ({ r, start: normDate(r.prfpdfrom), end: normDate(r.prfpdto), title: strip(r.prfnm) }))
    .filter(c => inWindow(c.start, c.end) && c.title && !NO_WORDS.test(c.title) && !notForKids(c.title, ''));
  const cap = Math.min(cand.length, 600); let i = 0; const place = new Map();
  /* 광주·전남 통합(«전남광주통합특별시»)으로 시도만 와서는 광주인지 전남인지 모른다 — 공연장 주소로 가린다 */
  async function venueAddr(id) {
    if (!id) return null;
    if (!place.has(id)) {
      let a = null;
      try { a = strip(xmlRecords(await getJSON(`https://www.kopis.or.kr/openApi/restful/prfplc/${encodeURIComponent(id)}?service=${encodeURIComponent(key)}`, { as: 'text', timeout: 20000, ua }), 'db')[0]?.adres) || null; }
      catch (e) { log(`KOPIS 공연장 실패 ${id}: ${e.message}`); }
      place.set(id, a); await sleep(300);
    }
    return place.get(id);
  }
  let detFail = 0;
  async function worker() {
    while (i < cap) {
      const { r, start, end, title } = cand[i++];
      let det = {};
      try {
        const xml = await getJSON(`https://www.kopis.or.kr/openApi/restful/pblprfr/${encodeURIComponent(r.mt20id)}?service=${encodeURIComponent(key)}`, { as: 'text', timeout: 20000, ua });
        det = xmlRecords(xml, 'db')[0] || {};
        const rel = xmlRecords(xml, 'relate');
        det._url = rel.map(x => safeUrl(x.relateurl)).find(Boolean) || null;
      } catch (e) { detFail++; if (detFail <= 5) log(`KOPIS 상세 실패 ${r.mt20id}: ${e.message}`); }
      await sleep(300);
      const age = parseAge(det.prfage);
      if (age.min === 999) continue;
      const feeT = strip(det.pcseguidance);
      const free = isFree(feeT);
      let sido = sidoOf(r.area, det.area), gu = null;
      if (sido === '전남' && /광주/.test(strip(r.area) + strip(det.area))) {
        const addr = await venueAddr(det.mt10id);
        if (addr) { gu = guOf(addr); sido = fixSido(sidoOf(addr) || sido, gu); }
      }
      out.push({
        src: 'kopis', id: 'kopis:' + strip(r.mt20id),
        title: cut(title, 70), place: cut(r.fcltynm, 40) || null, sido, gu,
        start, end, ageMin: age.min, ageMax: age.max, ageText: age.text,
        free, fee: free === false ? cut(feeT, 40) : null,
        url: det._url || null, img: safeUrl(r.poster), kind: kindOf(strip(r.genrenm) + ' ' + title), kid: Math.max(2, kidScore(title, age)),
      });
    }
  }
  await Promise.all([worker(), worker()]);   /* KOPIS 안내: 1초에 10회를 넘기면 서비스가 멈춘다 — 둘이서 0.3초씩 쉬어 초당 7회 아래 */
  log(`KOPIS: 목록 ${list.length}, 기간·이름 통과 ${cand.length}, 상세 ${cap}(실패 ${detFail}), 남김 ${out.length}`);
  /* 상세가 절반 넘게 막혔으면 연령·링크 없는 반쪽 목록이 된다 — 실패로 보고 지난 자료를 이어 쓰게 한다 */
  if (cap >= 20 && detFail > cap / 2) throw new Error(`KOPIS 상세 ${detFail}/${cap}건 실패 — 중간에 막힌 듯`);
  return out;
}

/* ───────── 분류·중복·해시 ───────── */
function kindOf(t) {
  if (/축제|페스티벌|festival/i.test(t)) return '축제';
  if (/전시|미술|갤러리|박물관/.test(t)) return '전시';
  if (/체험|교육|만들기|공작|클래스|워크숍|워크샵|탐방|숲|농장|과학관/.test(t)) return '체험';
  if (/뮤지컬|연극|인형극|콘서트|음악회|공연|무용|발레|국악|오페라|클래식|마술|서커스/.test(t)) return '공연';
  return '기타';
}
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
/* 같은 행사 묶기 — 해마다 붙는 «2026»·«제25회», «(1회)» 따위를 떼고 이름·시도가 같으면서 날짜가 겹치거나 바로 이어지면 하나로.
   2026-11 첫 전국 자료: «구미라면축제»와 «2026 구미라면축제», «청송사과축제» 두 건, 이틀 연달아 올린 같은 발레 공연 */
function normTitle(t) {
  return String(t || '').toLowerCase()
    .replace(/^\s*\[[^\]]*\]\s*/, '')                        /* 앞머리 [기관] — 서울 자료와 관광공사 자료가 같은 행사를 다르게 부름 */
    .replace(/\(\s*\d+\s*회차?\s*\)/g, '')
    .replace(/(19|20)\d{2}\s*년?/g, '')
    .replace(/제?\s*\d+\s*회(?!차)/g, '')
    .replace(/[^0-9a-z가-힣]/g, '');
}
function dedupe(events) {
  const prio = { kopis: 0, seoul: 1, tour: 2, data_event: 3, data_fest: 4 };   /* 관광공사는 홈페이지·사진이 있어 표준데이터보다 먼저 */
  events.sort((a, b) => (prio[a.src] - prio[b.src]) || (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const groups = new Map(); const out = [];
  for (const e of events) {
    const nt = normTitle(e.title);
    const k = (nt.length >= 2 ? nt : e.title.replace(/\s+/g, '')) + '|' + (e.sido || '');
    const g = groups.get(k) || [];
    const hit = g.find(x => (!x.gu || !e.gu || x.gu === e.gu) && x.start <= addDays(e.end, 1) && e.start <= addDays(x.end, 1));
    if (hit) {
      if (e.start < hit.start) hit.start = e.start;
      if (e.end > hit.end) hit.end = e.end;
      if (!hit.url && e.url) hit.url = e.url;
      if (!hit.gu && e.gu) hit.gu = e.gu;
      if (hit.ageMin == null && e.ageMin != null) { hit.ageMin = e.ageMin; hit.ageMax = e.ageMax; hit.ageText = e.ageText; }
      hit.kid = Math.max(hit.kid || 0, e.kid || 0);
      continue;
    }
    g.push(e); groups.set(k, g); out.push(e);
  }
  return out;
}

/* ───────── 한 곳이 실패하면 지난번에 제대로 받은 것을 이어 쓴다 ─────────
   2026-11-05 목 06:00: KOPIS가 «HTTP 400 Request Blocked»로 막혀 목록이 921건 → 320건(경기 194 → 19)으로 줄었다.
   한 곳이 막혀도 목록이 반토막 나지 않게, 그 출처를 마지막으로 «제대로» 받은 판(지금 파일 → 깃 기록 순)을 찾아
   아직 안 끝난 것만 가져온다. 이어 쓴 판은 다시 이어 쓰지 않는다(늘 원래 받은 날 기준). 21일이 넘은 자료는 쓰지 않는다.
   이어 쓴 자료도 앱 아래 출처 문구(KOPIS 이용 조건)는 그대로 보여야 하므로 ok:true로 두고 carried(받은 날)·note로 표시한다. */
const CARRY_DAYS = 21;
const SRC_OF = { seoul: ['seoul'], data: ['data_event', 'data_fest'], tour: ['tour'], kopis: ['kopis'] };
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
function prevReaders() {
  if (process.env.EV_PREV) return process.env.EV_PREV.split(',').filter(Boolean).map(f => () => fs.readFileSync(f, 'utf8'));   /* 시험용 */
  const out = [() => fs.readFileSync(OUT, 'utf8')];
  try {
    const sh = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    const root = sh('rev-parse', '--show-toplevel').trim();
    const rel = path.relative(root, path.resolve(OUT)).split(path.sep).join('/');
    for (const sha of sh('-C', root, 'log', '-n', '60', '--format=%H', '--', rel).split('\n').filter(Boolean)) out.push(() => sh('-C', root, 'show', `${sha}:${rel}`));
  } catch { /* 깃이 없으면 지금 파일만 */ }
  return out;
}
function carryOver(name, log) {
  for (const read of prevReaders()) {
    let d; try { d = JSON.parse(read()); } catch { continue; }
    const s = d && d.sources && d.sources[name];
    if (!s || !s.ok || s.carried || !d.updated || !Array.isArray(d.events)) continue;
    const age = daysBetween(d.updated, TODAY);
    if (!(age >= 0)) continue;
    if (age > CARRY_DAYS) { log(`${name}: 마지막으로 제대로 받은 날(${d.updated})이 ${age}일 전이라 이어 쓰지 않음`); return null; }
    return { from: d.updated, items: d.events.filter(e => SRC_OF[name].includes(e.src) && inWindow(e.start, e.end)) };
  }
  return null;
}

/* ───────── 본문 ───────── */
async function main() {
  const have = Object.entries(KEYS).filter(([, v]) => v).map(([k]) => k);
  const logs = []; const log = s => { logs.push(s); console.log(s); };
  if (!have.length) {
    console.log('열쇠가 하나도 없어 아무것도 하지 않습니다 (SEOUL_KEY / DATA_GO_KR_KEY / KOPIS_KEY). 파일은 그대로 둡니다.');
    summary({ skipped: true }); return 0;
  }
  const status = {}; let all = [];
  for (const [name, fn, key] of [['seoul', fetchSeoul, KEYS.seoul], ['data', fetchDataGo, KEYS.data], ['tour', fetchTour, KEYS.data], ['kopis', fetchKopis, KEYS.kopis]]) {
    if (!key) { status[name] = { ok: false, n: 0, note: '열쇠 없음 — 건너뜀' }; continue; }
    try { const a = await fn(key, log); status[name] = { ok: true, n: a.length, ...(a.note ? { note: a.note } : {}) }; all.push(...a); }
    catch (e) {
      log(`${name} 실패: ${e.message}`);
      const c = carryOver(name, log);
      if (c && c.items.length) {
        status[name] = { ok: true, n: c.items.length, carried: c.from, note: `오늘 받기 실패(${cut(e.message, 70)}) — ${c.from}에 받은 것 중 안 끝난 ${c.items.length}건 이어 씀` };
        all.push(...c.items); log(`${name}: ${c.from}에 받은 ${c.items.length}건을 이어 씀`);
      } else status[name] = { ok: false, n: 0, note: cut(e.message, 200) };
    }
  }
  const okCount = Object.values(status).filter(s => s.ok && !s.carried).length;   /* 새로 받은 곳이 하나도 없으면 옛 파일을 그대로 둔다 */
  if (!okCount) { console.error('받아온 자료가 하나도 없습니다. 옛 파일을 그대로 둡니다.'); summary({ status, failed: true }); return 1; }

  all = all.filter(e => e.title && !genericTitle(e.title) && (e.start || e.end) && e.ageMin !== 999 && !(e.ageMin != null && e.ageMin >= 84));
  all.forEach(e => { if (!e.start) e.start = e.end; if (!e.end) e.end = e.start; if (e.ageMin != null && e.ageMax != null && e.ageMax < e.ageMin) e.ageMax = null; });
  all = dedupe(all);
  all.sort((a, b) => (a.start > b.start ? 1 : a.start < b.start ? -1 : (a.sido || '') < (b.sido || '') ? -1 : 1));
  if (all.length > CAP) all = all.slice(0, CAP);

  const bySido = {}; all.forEach(e => { const k = e.sido || '미상'; bySido[k] = (bySido[k] || 0) + 1; });
  const data = { updated: TODAY, window: [FROM, TO], sources: status, count: all.length, bySido, events: all };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 0) + '\n');
  log(`저장: ${OUT} — ${all.length}건 (${(fs.statSync(OUT).size / 1024).toFixed(0)}KB)`);
  summary({ status, data });
  return 0;
}
function summary({ status = {}, data, skipped, failed }) {
  const f = process.env.GITHUB_STEP_SUMMARY; if (!f) return;
  let md = '## 행사 목록 만들기\n\n';
  if (skipped) { md += '열쇠가 없어 건너뜀 (SEOUL_KEY / DATA_GO_KR_KEY / KOPIS_KEY 중 하나라도 저장소 Secrets에 넣으면 돕니다).\n'; fs.appendFileSync(f, md); return; }
  md += '| 자료 | 결과 | 건수 | 메모 |\n|---|---|---|---|\n';
  for (const [k, v] of Object.entries(status)) md += `| ${{ seoul: '서울시 문화행사', data: '공공데이터포털 표준데이터', tour: '한국관광공사 축제·행사', kopis: 'KOPIS 아동 공연' }[k]} | ${v.ok ? (v.carried ? '♻️ 지난 자료' : '✅') : '⚠️'} | ${v.n} | ${v.note || ''} |\n`;
  if (failed) { md += '\n**받아온 자료가 없어 옛 파일을 그대로 두었습니다.**\n'; fs.appendFileSync(f, md); return; }
  md += `\n**${data.count}건** · 기간 ${data.window[0]} ~ ${data.window[1]}\n\n지역별: ` + Object.entries(data.bySido).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') + '\n\n';
  const ages = { 표기: data.events.filter(e => e.ageMin != null).length, 미표기: data.events.filter(e => e.ageMin == null).length };
  md += `연령 표기 있음 ${ages.표기} · 없음 ${ages.미표기} · 무료 표기 ${data.events.filter(e => e.free === true).length}\n\n`;
  md += '처음 10건:\n\n| 날짜 | 지역 | 제목 | 연령 | 출처 |\n|---|---|---|---|---|\n';
  for (const e of data.events.slice(0, 10)) md += `| ${e.start}${e.end !== e.start ? '~' + e.end : ''} | ${e.sido || '-'} ${e.gu || ''} | ${e.title} | ${e.ageText || '-'} | ${e.src} |\n`;
  fs.appendFileSync(f, md);
}

if (process.env.EV_SELFTEST) {
  const T = [['전체관람가',0,null],['전연령',0,null],['누구나',0,null],['만 24개월 이상',24,null],['24개월~7세',24,95],['36개월 이상',36,null],
    ['12개월 미만',0,12],['12개월~36개월',12,36],['만 0~36개월',0,36],['만 3세 이상',36,null],['5세 이상',60,null],['6세~7세',72,95],['6세 ~ 13세',72,167],
    ['7세 이하',0,95],['초등',72,155],['초등 이상',72,null],['초4 이상',108,null],['초등 이하',0,155],['5세~초등',60,155],['1세 ~ 10세',12,131],['유아',0,null],
    ['영유아 및 가족',0,null],['가족',0,null],['어린이',0,null],['청소년',999,null],['중학생 이상',999,null],['성인',999,null],['청소년, 성인',999,null],
    ['48개월~초등',48,155],['만 4세~만 7세',48,95],['8세이상',96,null],['미취학 아동',0,83],['영유아 동반 가족',0,null],['4~7세',48,95],
    ['만 36개월 이상 어린이',36,null],['5세 이상 어린이 및 가족',60,null],['초등 3학년 이상',96,null],['6세 이상(2020년생 이전)',72,null],['12세 이상 관람가',144,null],
    ['',null,null],['문의',null,null],['어르신',999,null],['학부모 대상 강연',999,null],['학부모와 아이 함께',0,null],
    /* 2026-11-02 첫 서울 자료에서 틀렸던 것 */
    ['청소년 이상 누구나',999,null],['성인 누구나',999,null],['성인 누구나 20명 내외',999,null],['누구나 (성인 40명)',999,null],['청년 누구나',999,null],
    ['누구나 (만 13세(중학생)이상)',156,null],['초·중·고 학생 누구나',72,null],['유아, 아동·청소년, 성인 누구나',0,null],['성인, 어린이, 청소년',0,null],
    ['서울시민 누구나 / 가족·청소년·성인',0,null],['유아 및 초등 자녀를 둔 학부모 25명',999,null],['아이를 양육하시는 성인 누구나',999,null],
    ['학부모 및 지역주민 20명',999,null],['8개월~16개월 영아 관람객 신청자',8,16],['유아·어린이 동반 30가족',0,null],
    ['미취학아동 입장불가',84,null],['8세 미만 입장 불가',96,null],['48개월 미만 입장불가',48,null],['36개월 미만 영아, 보호자',0,36],
    ['6~7세 어린이 및 양육자 10팀',72,95],['초등1-6학년 해봄이와 양육자',72,143],['양육자 누구나',999,null],
    /* 2026-11-02 두 번째 손질 — «초등학생 이상»은 아이 대상이 아니다, 학년 범위, 원자료 오타 */
    ['초등학생 이상 관람가능',72,null],['초등학생',72,155],['초등학생 동반 가족',72,155],['초등학교 5~6학년',120,143],['초등생 (초등 4~6학년)',108,143],
    ['해봄이로 등록한 초등학교 1-3학년 12명',72,107],['초등 1학년',72,83],['유아 및 초등학생',0,155],['전 연링 (프로그램 별 상이)',0,null],['누구',0,null],
    /* 관광공사 자료 */ ['전 연령 (만 12세 이하 성인 동반)',0,null],['미취학 아동은 보호자 동반',0,null],['초등학생 이하 보호자 동반 필수',0,null]];
  let bad = 0;
  for (const [s, mi, ma] of T) { const r = parseAge(s); if (r.min !== mi || r.max !== ma) { bad++; console.log('✗', JSON.stringify(s), '→', r.min, r.max, '기대', mi, ma); } }
  /* 아이 맞춤 점수 · 뭉뚱그린 이름 · 날짜 채움 · 시도 바로잡기 · 같은 행사 묶기 */
  const K = [['[서초문화재단] 2026 서리풀 재즈페스타', '초등학생 이상 관람가능', 0], ['[서울상상나라] 사랑하는 사이', '36개월 미만 영아, 보호자', 3],
    ['아이와 함께 듣는 겨울의 클래식 동화', '4세이상 (2022년생 포함 이전 출생자)', 3], ['예술, 마음으로 전하는 가장 특별한 선물', '5세 이상 누구나', 1],
    ['[소마미술관] 기념에서 풍경으로', '누구', 1], ['베베핀 뮤지컬 두근두근 새친구', '', 2], ['유니버설발레단', '', 0], ['[종로문화재단] 2026 종로 가족공연축제', '누구나', 2],
    ['[마포구립서강도서관] 11월/어린이메이킹', '초등1-6학년 해봄이와 양육자', 3]];
  for (const [title, a, want] of K) { const got = kidScore(title, parseAge(a)); if (got !== want) { bad++; console.log('✗ 점수', title, '→', got, '기대', want); } }
  const G = [['2026년 11월 공연 (1회)', true], ['강서아트리움 기획공연', true], ['[마포구립서강도서관] 11월 문화프로그램 안내', true], ['유니버설발레단', false],
    ['[동작문화재단] 2026 본동어울마당 아트홀 하반기 정기 기획공연 [본동 세레나데]', false], ['2026 토요키즈클래식 11월', false], ['[아기 돼지 삼형제]', false],
    ['[꿈의숲아트센터] 통합예술교육 프로그램 [별난 극장 놀이터]', false], ['[개봉도서관] 2026년 특성화 프로그램 [신문으로 배우는 초등 경제교육]', false]];
  for (const [title, want] of G) if (genericTitle(title) !== want) { bad++; console.log('✗ 이름', title, '→', !want); }
  if (!placeholderRange('2026-01-01', '2026-12-31') || placeholderRange('2026-01-02', '2026-12-31') || placeholderRange('2026-01-01', '2027-12-31')) { bad++; console.log('✗ 날짜 채움'); }
  if (normDate('2626-08-08') !== null || normDate('2029-12-30') !== '2029-12-30') { bad++; console.log('✗ 날짜 오타'); }
  if (firstUrl('<a href="https://example.com/a?b=1" target="_blank">바로가기</a>') !== 'https://example.com/a?b=1' || firstUrl('www.example.com/x') !== 'https://www.example.com/x' || firstUrl('홈페이지 없음') !== null) { bad++; console.log('✗ 홈페이지 주소 뽑기'); }
  if (!kopisErr('<dbs><db><returncode>02</returncode><errmsg>SERVICE KEY IS NOT REGISTERED ERROR.</errmsg></db></dbs>') || kopisErr('<dbs><db><mt20id>PF1</mt20id><prfnm>예시</prfnm></db></dbs>') !== null) { bad++; console.log('✗ KOPIS 오류 읽기'); }
  if (fixSido('전남', '동구') !== '광주' || fixSido('전남', '순천시') !== '전남' || fixSido('충남', '유성구') !== '대전' || fixSido('경북', '남구') !== '경북') { bad++; console.log('✗ 시도'); }
  const ev = (src, title, sido, gu, start, end) => ({ src, title, sido, gu, start, end, url: null, ageMin: 0, ageMax: null, kid: 1 });
  const D = dedupe([ev('data_fest', '구미라면축제', '경북', '구미시', '2026-11-06', '2026-11-08'), ev('data_fest', '2026 구미라면축제', '경북', '구미시', '2026-11-06', '2026-11-08'),
    ev('data_fest', '2026년 제25회 팔공산 단풍축제', '대구', '동구', '2026-10-30', '2026-11-01'), ev('data_fest', '팔공산 단풍축제', '대구', '동구', '2026-10-30', '2026-11-01'),
    ev('data_event', '유니버설발레단', '경기', '평택시', '2026-11-20', '2026-11-20'), ev('data_event', '유니버설발레단', '경기', '평택시', '2026-11-21', '2026-11-21'),
    ev('seoul', '[A도서관] 그림책 원화전', '서울', '마포구', '2026-11-01', '2026-11-30'), ev('seoul', '[A도서관] 그림책 원화전', '서울', '은평구', '2026-11-01', '2026-11-30'),
    ev('seoul', '2026 신년 해맞이', '서울', '마포구', '2026-01-01', '2026-01-01'), ev('seoul', '2027 신년 해맞이', '서울', '마포구', '2027-01-01', '2027-01-01'),
    ev('seoul', '[노원문화재단] 2026 노원달빛산책', '서울', '노원구', '2026-10-16', '2026-11-08'), ev('tour', '노원달빛산책', '서울', '노원구', '2026-10-16', '2026-11-08')]);
  const ballet = D.find(e => e.title === '유니버설발레단');
  if (D.length !== 8 || !ballet || ballet.start !== '2026-11-20' || ballet.end !== '2026-11-21') { bad++; console.log('✗ 묶기', D.length, D.map(e => e.title + ' ' + e.start + '~' + e.end).join(' / ')); }
  /* 지난 자료 이어 쓰기 — 지금 파일(실패 판) → 이어 쓴 판(건너뛰어야 함) → 3일 전 제대로 받은 판 */
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'ev-carry-'));
  const put = (n, o) => { const f = path.join(tmp, n); fs.writeFileSync(f, JSON.stringify(o)); return f; };
  const kp = (id, s, e) => ({ src: 'kopis', id: 'kopis:' + id, title: '예시 공연 ' + id, sido: '경기', start: addDays(TODAY, s), end: addDays(TODAY, e), ageMin: 36, ageMax: null, kid: 3 });
  const f1 = put('1.json', { updated: TODAY, sources: { kopis: { ok: false, n: 0 } }, events: [] });
  const f2 = put('2.json', { updated: addDays(TODAY, -1), sources: { kopis: { ok: true, n: 1, carried: addDays(TODAY, -4) } }, events: [kp('X', 0, 9)] });
  const f3 = put('3.json', { updated: addDays(TODAY, -3), sources: { kopis: { ok: true, n: 3 }, data: { ok: true, n: 1 } }, events: [kp('A', -3, 5), kp('B', -9, -5), kp('C', 2, 40), { ...kp('D', 1, 2), src: 'data_fest' }] });
  const f4 = put('4.json', { updated: addDays(TODAY, -30), sources: { kopis: { ok: true, n: 1 } }, events: [kp('Z', -30, 30)] });
  const quiet = () => {};
  process.env.EV_PREV = [f1, f2, f3].join(',');
  const c1 = carryOver('kopis', quiet), c2 = carryOver('data', quiet), c3 = carryOver('tour', quiet);
  process.env.EV_PREV = [f1, f4].join(',');
  const c4 = carryOver('kopis', quiet);
  delete process.env.EV_PREV; fs.rmSync(tmp, { recursive: true, force: true });
  if (!c1 || c1.from !== addDays(TODAY, -3) || c1.items.map(e => e.id).join() !== 'kopis:A,kopis:C') { bad++; console.log('✗ 이어 쓰기', JSON.stringify(c1)); }
  if (!c2 || c2.items.length !== 1 || c2.items[0].src !== 'data_fest' || c3 !== null) { bad++; console.log('✗ 이어 쓰기(출처 짝)', JSON.stringify(c2), JSON.stringify(c3)); }
  if (c4 !== null) { bad++; console.log('✗ 이어 쓰기(21일 넘음)', JSON.stringify(c4)); }
  const total = T.length + K.length + G.length + 6 + 1 + 3;
  console.log(bad ? `자가 점검 실패 ${bad}건` : `자가 점검 ${total}건 모두 통과 (나이 읽기 ${T.length})`);
  process.exit(bad ? 1 : 0);
}
main().then(code => process.exit(code)).catch(e => { console.error(e); process.exit(1); });
