# 홈페이지 생성기 (`_tools/site`)

앱(`www/index.html`)에 든 놀이·달빛어린이병원 데이터로 홈페이지를 만든다.
밑줄(`_`)로 시작하는 폴더라 GitHub Pages에는 올라가지 않는다 — 저장소에만 있는 도구다.

## 이것이 만드는 파일 — 손으로 고치지 말 것

저장소 루트의 `index.html` · `404.html` · `sitemap.xml` · `robots.txt` · `<IndexNow 열쇠>.txt` ·
`play/*.html` · `moon/*.html` · `assets/plays.json` · `assets/site.js` · `assets/demo.js` · `assets/og/*.jpg` ·
`fonts/pretendard-site.woff2` (+ `--shots`일 때 `assets/shots/*.webp`).
고칠 일이 있으면 `src/`를 고치고 다시 만든다. (`privacy.html`, `assets/icon-72.png`, `www/`는 이 도구 밖)

## 언제 다시 만드나

- 앱의 놀이(PLAYS)·달빛(MOON)·파트너스 링크가 바뀌었을 때 — 안 하면 「앱 자동 점검」 3-3·3-4가 실패로 알려 준다
- 홈페이지 문구·디자인을 바꿀 때 (`src/build.mjs`, `src/site.css`)
- 검색엔진 소유 확인값을 넣을 때 (`src/verify.json`)
- 앱 화면이 크게 바뀌어 랜딩의 폰 사진도 새로 찍어야 할 때 → `--shots`

## 만드는 법

```bash
git clone https://github.com/goseumi-app/goseumi-app.github.io
cd goseumi-app.github.io/_tools/site
bash make.sh            # 또는 bash make.sh --shots   (웹 업로드는 실행 권한을 안 남겨서 bash로 부른다)
node src/sitetest.mjs                      # 기능 검사 15가지 (카톡 안내 띠·미리 보기→앱 이어받기·404 등)
node src/review.mjs /,/play/8.html         # 눈검증 사진 (모바일·PC × 낮·어둠) → /tmp/goseumi-site-work/review
```

- 결과는 `/tmp/goseumi-site-out`에만 생기고 저장소는 건드리지 않는다. 끝에 **올릴 파일 목록이 폴더별로** 나온다.
- 처음 한 번 `npm install`(playwright·pretendard)과 `pip install fonttools brotli pillow`를 알아서 한다.
- 성능 점수: `npm i --no-save lighthouse@12 chrome-launcher && node src/lh.mjs /,/play/8.html`
- 캐시 깨기용 `?v=`는 파일마다 **그 파일 내용의 해시**(8자)다. 글꼴·스크립트·plays.json이 안 바뀌면 페이지 바이트도 그대로여서, 내용이 그대로인 페이지는 sitemap `lastmod`도 저장소 값을 유지한다(`src/stamp.mjs`). 그래서 다른 날 다시 만들어도 바뀐 페이지만 «바뀜»으로 나온다 — `?v=`만 다른 것은 «바뀜 (캐시 표시 ?v= 만)»으로 따로 표시된다.

## 올리는 법 (웹 업로드)

1. 목록의 폴더마다 `https://github.com/goseumi-app/goseumi-app.github.io/upload/main/<폴더>`에서 파일을 올려 커밋한다(없는 폴더도 만들어진다).
2. **순서: `assets/og` → `assets/shots` → `assets` → `fonts` → `play` → `moon` → 루트 → 마지막에 `www`(앱).**
3. 「앱 자동 점검」은 푸시 뒤 **5분 기다렸다가** 돈다. 그 사이 다음 폴더가 올라오면 앞 실행은 취소(회색)되고 마지막 것만 검사한다 — 폴더 사이가 5분을 넘지 않게 이어서 올리면 중간 상태로 «실패» 메일이 가지 않는다.
4. 다 올리고 `git fetch` → 올린 파일의 md5가 `/tmp/goseumi-site-out`과 같은지 대조.
5. 페이지가 바뀌면 「검색엔진에 알리기 (IndexNow)」가 저절로 돌아 네이버·빙 등에 알린다(결과는 그 실행의 요약 표).

## 지켜야 할 선

- **아이 이름·관찰 원문 금지.** 앱 놀이의 주의 문구에 D번호·«기록 속 아기»·«이 집 기록» 같은 원문이 있으면 `build.mjs`가 멈춘다 → `src/warn_web.json`에 홈페이지용 문구를 적는다. 점검 3-1도 다시 확인한다.
- 판정 문구(«괜찮습니다·정상 범위·또래 수준» 등)·실시간 진료 배지 금지 — 점검 3-2.
- 달빛 페이지는 «가기 전에 꼭 전화로 확인» + 응급의료포털(E-Gen) 링크 — 점검 3-3.
- 쿠팡 파트너스 링크가 있는 쪽엔 공정위 문구 — 점검 3-5.
- 점검이 못 보는 것: 가짜 후기·사용자 수·별점, 효능 주장(«두뇌 발달» 등), 경쟁 앱 비교, 다른 사이트의 그림·글·코드 가져오기 — 넣지 않는다.

## 파일

| 파일 | 하는 일 |
|---|---|
| `make.sh` | 전체 빌드 (페이지 → 글꼴 → 캐시 표시 → 공유 그림 → 올릴 목록) |
| `src/build.mjs` | 모든 페이지·sitemap·robots·plays.json·IndexNow 열쇠 파일 |
| `src/site.css` · `site.js` · `demo.js` | 디자인(페이지 안에 인라인) · 카톡 안내 띠·설치 탭 · «생일 넣고 미리 보기» |
| `src/icons.json` · `qr.svg` · `wordmark.svg` | 아이콘 · 설치 QR · 글자 로고 |
| `src/warn_web.json` | 앱 주의 문구 중 원문이 섞인 30개의 홈페이지판 |
| `src/verify.json` | 네이버·구글·빙 소유 확인 메타(첫 페이지에만), 다음은 robots.txt 한 줄 |
| `src/indexnow.key` | IndexNow 열쇠(공개돼도 되는 값) → 루트 `<열쇠>.txt` |
| `src/og.mjs` | 페이지마다 공유 미리보기 그림 1200×630 (원본 Pretendard로) |
| `src/subset_font.py` | 사이트에 쓰인 글자만 담은 글꼴 한 파일 |
| `src/stamp.mjs` | 글꼴 부분집합 뒤에 `?v=` 자리표시자를 내용 해시로 채우고, 내용이 그대로인 페이지의 sitemap `lastmod`를 저장소 값으로 되돌린다 |
| `src/shots.mjs` · `shots_webp.py` | 데모 프로필 «봄이»로 앱 화면 캡처 → WebP 3크기 (실제 아이 기록 아님) |
| `src/serve.mjs` · `paths.mjs` | GitHub Pages와 같은 배치의 로컬 서버 · 경로 설정(환경변수로 바꿀 수 있음) |
| `src/sitetest.mjs` · `review.mjs` · `lh.mjs` · `changed.py` | 기능 검사 · 눈검증 사진 · 성능 · 올릴 파일 목록 |
