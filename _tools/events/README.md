# 행사 목록 만들기 — «이번 주말 어디 갈까»

앱 홈의 «🎪 이번 주말 어디 갈까» 카드와 행사 화면이 읽는 `assets/events.json`을 만드는 도구입니다.
공공 기관이 공개한 행사 자료를 모아 **파일 하나**로 두고, 앱은 그 파일만 받아 **폰 안에서** 아이 개월·지역으로 거릅니다.
아이 정보도 지역 선택도 밖으로 나가지 않습니다.

## 자료 (열쇠가 있는 곳만 씁니다)

| 환경변수 | 자료 | 어디서 받나 | 비고 |
|---|---|---|---|
| `SEOUL_KEY` | 서울시 문화행사 정보 (`culturalEventInfo`) | data.seoul.go.kr → 로그인 → 인증키 신청 (즉시) | 매일 갱신, «이용대상» 글로 나이를 읽음 |
| `DATA_GO_KR_KEY` | 전국공연행사정보 표준데이터(입장연령 있음) · 전국문화축제 표준데이터 | data.go.kr → 로그인 → 두 자료 «활용신청» (자동승인) → 마이페이지의 일반 인증키 | 분기 갱신(매월 초 취합) — 느리지만 전국 |
| `KOPIS_KEY` | 공연예술통합전산망 KOPIS — 아동 공연(`kidstate=Y`) | kopis.or.kr → 회원가입 → 오픈API 신청 → 담당자 승인(며칠) | 상세에서 관람연령·가격·예매처 |

열쇠는 저장소 **Settings → Secrets and variables → Actions → New repository secret**에 위 이름 그대로 넣습니다.
공공데이터포털 열쇠는 «일반 인증키(Decoding)» 값을 넣어도 되고 Encoding 값을 넣어도 됩니다(둘 다 알아서 처리).

## 돌아가는 때

`.github/workflows/events.yml` — **월·목 06:00(KST)** 자동, 또는 Actions 탭에서 «Run workflow».
바뀐 것이 있으면 봇이 `assets/events.json`을 커밋하고 홈페이지(Pages) 재배포를 요청합니다.
열쇠가 하나도 없으면 아무것도 하지 않고 성공으로 끝납니다(실패 메일이 가지 않게). 열쇠가 있는데 자료를 하나도 못 받으면 실패로 끝나고 옛 파일은 그대로 둡니다.

## 거르는 규칙 (fetch.mjs)

- 기간: 어제 ~ 60일 뒤. 그 밖은 뺍니다.
- 아이 앱이므로 **만 7세(84개월) 이상 전용**은 뺍니다. 술·성인·세미나·채용 같은 행사도 뺍니다(`NO_WORDS`).
- 연령은 주최 표기를 개월로 읽습니다(`parseAge`, 자가 점검 44건: `EV_SELFTEST=1 node _tools/events/fetch.mjs`). 못 읽으면 비워 두고 앱이 «연령 표기 없음»으로 보여 줍니다.
- 요금은 «무료/유료/표기 없음»만 가립니다(«10,000원»의 0원에 속지 않음).
- 제목·장소·날짜·링크는 자료 그대로. 링크는 http(s)만. HTML 태그는 벗깁니다.
- 같은 행사가 여러 자료에 있으면 KOPIS → 서울시 → 공공데이터포털 순으로 하나만 남깁니다.

## 흐름만 점검하기 (열쇠 없이)

```
EV_MOCK=1 SEOUL_KEY=x DATA_GO_KR_KEY=y KOPIS_KEY=z node _tools/events/fetch.mjs --out /tmp/events.json
```
지어낸 응답(제목에 «예시»)으로 전 과정을 돌려 파일 꼴을 확인합니다. 실제 자료가 아니니 저장소에 올리지 않습니다.

## 파일 꼴

```json
{"updated":"2026-11-03","window":["2026-11-02","2027-01-02"],"sources":{"seoul":{"ok":true,"n":120}},"count":1,
 "events":[{"src":"seoul","id":"seoul:abc","title":"…","place":"…","sido":"서울","gu":"강서구","start":"2026-11-08","end":"2026-11-09",
   "ageMin":12,"ageMax":null,"ageText":"만 12개월 이상","free":true,"fee":null,"url":"https://…","img":null,"kind":"체험"}]}
```
`check.mjs`(앱 자동 점검)가 이 파일의 꼴·링크·연령·지난 행사 여부를 검사합니다.
