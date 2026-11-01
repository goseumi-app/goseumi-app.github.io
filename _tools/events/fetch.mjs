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
  if (y < 2000 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
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
function guOf(addr) {
  const s = strip(addr);
  const m = s.match(/^\S+\s+(\S+?(?:시|군|구))(?=\s|$)/);
  return m ? m[1] : null;
}

/* ───────── 나이 읽기 — 글 → 개월 ───────── */
const ALL_RE = /전\s*체|전\s*연령|누구나|제한\s*없|연령\s*무관|모든\s*연령|가족|영유아\s*동반|유아\s*동반|전\s*관람|all\s*ages/i;
const ADULT_RE = /성인\s*(전용|만|대상)|만\s*19세|19세\s*이상|청소년\s*관람\s*불가|18세\s*이상|20세\s*이상|대학생\s*이상|어르신|노인|시니어|직장인|학부모\s*대상(?!.*(어린이|아이|자녀))/;
function parseAge(raw) {
  const t = strip(raw).replace(/\s+/g, '');
  const out = { min: null, max: null, text: cut(raw, 24) || null };
  if (!t) return out;
  const kid = /어린이|아동|유아|아기|아이|키즈|자녀|영아|kids/i.test(t);
  const set = (min, max) => { out.min = min; out.max = max; return out; };
  if (ADULT_RE.test(t) && !kid) return set(999, null);
  let m;
  if ((m = t.match(/(\d+)(?:개월)?~(\d+)개월/))) return set(+m[1], +m[2]);                       /* 12개월~36개월, 만 0~36개월 */
  if ((m = t.match(/(\d+)개월~만?(\d{1,2})세/))) return set(+m[1], +m[2] * 12 + 11);           /* 24개월~7세 */
  if ((m = t.match(/(\d+)개월~초/))) return set(+m[1], 155);                                     /* 36개월~초등 */
  if ((m = t.match(/(\d+)개월(이상|부터|~$)/))) return set(+m[1], null);                         /* 36개월 이상 */
  if ((m = t.match(/(\d+)개월(이하|까지|미만)/))) return set(0, +m[1]);                          /* 24개월 이하 */
  if ((m = t.match(/만?(\d{1,2})(?:세)?~만?(\d{1,2})세/))) return set(+m[1] * 12, +m[2] * 12 + 11); /* 4~7세, 6세~13세, 만 4세~만 7세 */
  if ((m = t.match(/만?(\d{1,2})세~초/))) return set(+m[1] * 12, 155);                           /* 5세~초등 */
  if ((m = t.match(/만?(\d{1,2})세(이상|부터)/))) return set(+m[1] * 12, null);                  /* 만 3세 이상 */
  if ((m = t.match(/만?(\d{1,2})세(이하|까지|미만)/))) return set(0, +m[1] * 12 + 11);           /* 7세 이하 */
  if ((m = t.match(/초(?:등(?:학교|학생)?(\d)학년|등|(\d))/))) {                                /* 초등, 초4 이상, 초등 3학년 이상, 초등 이하 */
    if (/이하|까지/.test(t) && !/이상/.test(t)) return set(0, 155);
    const g = m[1] || m[2];
    return set(72 + (g ? (+g - 1) * 12 : 0), null);
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

/* ───────── 받아오기 ───────── */
async function getJSON(url, { timeout = 30000, as = 'json' } = {}) {
  if (process.env.EV_MOCK) return mockResponse(url, as);   /* 열쇠 없이 흐름만 점검할 때 — 지어낸 응답(제목에 «예시») */
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'accept': as === 'json' ? 'application/json, */*' : 'application/xml, text/xml, */*' } });
    const body = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status} ${body.slice(0, 160).replace(/\s+/g, ' ')}`);
    if (as === 'text') return body;
    try { return JSON.parse(body); } catch { throw new Error(`JSON 아님: ${body.slice(0, 160).replace(/\s+/g, ' ')}`); }
  } finally { clearTimeout(t); }
}
const sleep = ms => new Promise(r => setTimeout(r, process.env.EV_MOCK ? 0 : ms));
/* ───────── 흐름 점검용 가짜 응답 (EV_MOCK=1) — 실제 자료가 아니다 ───────── */
function mockResponse(url, as) {
  const d = n => addDays(TODAY, n);
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
  if (url.includes('kopis.or.kr/openApi/restful/pblprfr/')) {
    return `<?xml version="1.0"?><dbs><db><mt20id>PF000001</mt20id><prfnm>예시 아기 클래식 음악회</prfnm><prfage>만 24개월 이상</prfage><pcseguidance>전석 20,000원</pcseguidance><relates><relate><relatenm>예시 예매처</relatenm><relateurl>https://example.com/ticket</relateurl></relate></relates></db></dbs>`;
  }
  if (url.includes('kopis.or.kr/openApi/restful/pblprfr')) {
    return `<?xml version="1.0"?><dbs><db><mt20id>PF000001</mt20id><prfnm>예시 아기 클래식 음악회</prfnm><prfpdfrom>${d(9).replace(/-/g, '.')}</prfpdfrom><prfpdto>${d(9).replace(/-/g, '.')}</prfpdto><fcltynm>예시아트센터</fcltynm><poster>https://example.com/p.jpg</poster><area>인천광역시</area><genrenm>서양음악(클래식)</genrenm><prfstate>공연예정</prfstate></db></dbs>`;
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
      if (NO_WORDS.test(title) || NO_WORDS.test(trgt)) continue;
      const age = parseAge(trgt);
      const kidish = age.min !== null && age.min !== 999 ? true : KID_WORDS.test(title) || /어린이|유아|가족|누구나|전체|전연령|아동|아이/.test(trgt) || /교육\/체험|축제/.test(code);
      if (!kidish || age.min === 999) continue;
      const free = r.IS_FREE === '무료' ? true : (r.IS_FREE === '유료' ? false : null);
      out.push({
        src: 'seoul', id: 'seoul:' + hash(title + start_ + strip(r.PLACE)),
        title: cut(title, 70), place: cut(r.PLACE, 40) || null, sido: '서울', gu: strip(r.GUNAME) || null,
        start: start_, end: end_, ageMin: age.min, ageMax: age.max, ageText: age.text,
        free, fee: free === false ? cut(r.USE_FEE, 40) || null : null,
        url: safeUrl(r.ORG_LINK) || safeUrl(r.HMPG_ADDR), img: safeUrl(r.MAIN_IMG),
        kind: kindOf(code + ' ' + title),
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
    if (!inWindow(start, end)) return null;
    const title = strip(r.eventNm), body = strip(r.eventCo);
    if (NO_WORDS.test(title) || NO_WORDS.test(body)) return null;
    const age = parseAge(r.entrcAge);
    const kidish = (age.min !== null && age.min !== 999) ? true : KID_WORDS.test(title) || KID_WORDS.test(body.slice(0, 200));
    if (!kidish || age.min === 999) return null;
    const feeT = strip(r.admfee || r.chrgeInfo);
    const free = isFree(feeT);
    const addr = strip(r.rdnmadr || r.lnmadr);
    return {
      src: 'data_event', id: 'de:' + hash(title + start + strip(r.opar)),
      title: cut(title, 70), place: cut(r.opar, 40) || null, sido: sidoOf(addr, r.insttNm), gu: guOf(addr),
      start, end, ageMin: age.min, ageMax: age.max, ageText: age.text,
      free, fee: free === false ? cut(feeT, 40) : null,
      url: safeUrl(r.homepageUrl) || safeUrl(r.reservInfo), img: null, kind: kindOf(title + ' ' + body.slice(0, 80)),
    };
  }).then(a => out.push(...a));
  /* 2b. 전국문화축제 */
  await pagedDataGo(`https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api`, key, log, '문화축제', (r) => {
    const start = normDate(r.fstvlStartDate), end = normDate(r.fstvlEndDate);
    if (!inWindow(start, end)) return null;
    const title = strip(r.fstvlNm), body = strip(r.fstvlCo);
    if (NO_WORDS.test(title) || NO_WORDS.test(body.slice(0, 200))) return null;
    const addr = strip(r.rdnmadr || r.lnmadr);
    return {
      src: 'data_fest', id: 'df:' + hash(title + start + strip(r.opar)),
      title: cut(title, 70), place: cut(r.opar, 40) || null, sido: sidoOf(addr, r.insttNm), gu: guOf(addr),
      start, end, ageMin: 0, ageMax: null, ageText: '축제 · 연령 제한 표기 없음',
      free: null, fee: null,
      url: safeUrl(r.homepageUrl), img: null, kind: '축제',
    };
  }).then(a => out.push(...a));
  return out;
}
async function pagedDataGo(base, key, log, label, mapRow) {
  const out = []; const ROWS = 1000; let total = null;
  for (let page = 1; page <= 60; page++) {
    const j = await getJSON(`${base}?serviceKey=${dataKeyParam(key)}&pageNo=${page}&numOfRows=${ROWS}&type=json`);
    const hdr = j?.response?.header, body = j?.response?.body;
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
async function fetchKopis(key, log) {
  const out = []; const list = [];
  const sd = FROM.replace(/-/g, ''), ed = TO.replace(/-/g, '');
  for (let p = 1; p <= 20; p++) {
    const xml = await getJSON(`https://www.kopis.or.kr/openApi/restful/pblprfr?service=${encodeURIComponent(key)}&stdate=${sd}&eddate=${ed}&cpage=${p}&rows=100&kidstate=Y`, { as: 'text' });
    if (/<returncode>\s*\d{2,}|<errmsg>/i.test(xml) && !/<db>/.test(xml)) throw new Error('KOPIS: ' + (xml.match(/<errmsg>([\s\S]*?)<\/errmsg>/i)?.[1] || xml.slice(0, 160)));
    const recs = xmlRecords(xml, 'db');
    list.push(...recs);
    log(`KOPIS 목록 ${p}쪽: ${recs.length}`);
    if (recs.length < 100) break;
    await sleep(300);
  }
  const cap = Math.min(list.length, 600); let i = 0;
  async function worker() {
    while (i < cap) {
      const r = list[i++];
      let det = {};
      try {
        const xml = await getJSON(`https://www.kopis.or.kr/openApi/restful/pblprfr/${encodeURIComponent(r.mt20id)}?service=${encodeURIComponent(key)}`, { as: 'text', timeout: 20000 });
        det = xmlRecords(xml, 'db')[0] || {};
        const rel = xmlRecords(xml, 'relate');
        det._url = rel.map(x => safeUrl(x.relateurl)).find(Boolean) || null;
      } catch (e) { log(`KOPIS 상세 실패 ${r.mt20id}: ${e.message}`); }
      const start = normDate(r.prfpdfrom), end = normDate(r.prfpdto);
      if (!inWindow(start, end)) continue;
      const title = strip(r.prfnm);
      if (NO_WORDS.test(title)) continue;
      const age = parseAge(det.prfage);
      if (age.min === 999) continue;
      const feeT = strip(det.pcseguidance);
      const free = isFree(feeT);
      out.push({
        src: 'kopis', id: 'kopis:' + strip(r.mt20id),
        title: cut(title, 70), place: cut(r.fcltynm, 40) || null, sido: sidoOf(r.area, det.area), gu: null,
        start, end, ageMin: age.min, ageMax: age.max, ageText: age.text,
        free, fee: free === false ? cut(feeT, 40) : null,
        url: det._url || null, img: safeUrl(r.poster), kind: kindOf(strip(r.genrenm) + ' ' + title),
      });
      await sleep(120);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
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
function dedupe(events) {
  const prio = { kopis: 0, seoul: 1, data_event: 2, data_fest: 3 };
  events.sort((a, b) => prio[a.src] - prio[b.src]);
  const seen = new Set(); const out = [];
  for (const e of events) {
    const k = (e.title.replace(/\s+/g, '').toLowerCase().slice(0, 24)) + '|' + (e.start || '') + '|' + ((e.place || '').replace(/\s+/g, '').slice(0, 10));
    if (seen.has(k)) continue; seen.add(k); out.push(e);
  }
  return out;
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
  for (const [name, fn, key] of [['seoul', fetchSeoul, KEYS.seoul], ['data', fetchDataGo, KEYS.data], ['kopis', fetchKopis, KEYS.kopis]]) {
    if (!key) { status[name] = { ok: false, n: 0, note: '열쇠 없음 — 건너뜀' }; continue; }
    try { const a = await fn(key, log); status[name] = { ok: true, n: a.length }; all.push(...a); }
    catch (e) { status[name] = { ok: false, n: 0, note: cut(e.message, 200) }; log(`${name} 실패: ${e.message}`); }
  }
  const okCount = Object.values(status).filter(s => s.ok).length;
  if (!okCount) { console.error('받아온 자료가 하나도 없습니다. 옛 파일을 그대로 둡니다.'); summary({ status, failed: true }); return 1; }

  all = all.filter(e => e.title && (e.start || e.end) && e.ageMin !== 999 && !(e.ageMin != null && e.ageMin >= 84));
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
  for (const [k, v] of Object.entries(status)) md += `| ${{ seoul: '서울시 문화행사', data: '공공데이터포털 표준데이터', kopis: 'KOPIS 아동 공연' }[k]} | ${v.ok ? '✅' : '⚠️'} | ${v.n} | ${v.note || ''} |\n`;
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
    ['7세 이하',0,95],['초등',72,null],['초등 이상',72,null],['초4 이상',108,null],['초등 이하',0,155],['5세~초등',60,155],['1세 ~ 10세',12,131],['유아',0,null],
    ['영유아 및 가족',0,null],['가족',0,null],['어린이',0,null],['청소년',999,null],['중학생 이상',999,null],['성인',999,null],['청소년, 성인',999,null],
    ['48개월~초등',48,155],['만 4세~만 7세',48,95],['8세이상',96,null],['미취학 아동',0,83],['영유아 동반 가족',0,null],['4~7세',48,95],
    ['만 36개월 이상 어린이',36,null],['5세 이상 어린이 및 가족',60,null],['초등 3학년 이상',96,null],['6세 이상(2020년생 이전)',72,null],['12세 이상 관람가',144,null],
    ['',null,null],['문의',null,null],['어르신',999,null],['학부모 대상 강연',999,null],['학부모와 아이 함께',0,null]];
  let bad = 0;
  for (const [s, mi, ma] of T) { const r = parseAge(s); if (r.min !== mi || r.max !== ma) { bad++; console.log('✗', JSON.stringify(s), '→', r.min, r.max, '기대', mi, ma); } }
  console.log(bad ? `나이 읽기 실패 ${bad}건` : `나이 읽기 ${T.length}건 모두 통과`);
  process.exit(bad ? 1 : 0);
}
main().then(code => process.exit(code)).catch(e => { console.error(e); process.exit(1); });
