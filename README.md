# 🦔 고슴이 — 놀이와 이유식 육아기록

기록에서 나온 놀이 · 이유식 월력표 · 관찰 기록. 한 아기의 관찰 기록에서 나온 육아 앱. 놀이 개수와 기록 일수는 기록이 쌓이는 대로 늘어납니다.

## 이 저장소로 할 수 있는 것

1. **APK 빌드 (지인 테스트용)** — Actions 탭 → 「앱 빌드」 → Run workflow → 몇 분 뒤 Artifacts에서 APK 다운로드
2. **웹 버전 배포** — Settings → Pages → Branch: main, 폴더 /(root) 저장 → `https://<계정>.github.io/<저장소>/www/` 에서 바로 사용
3. **스토어용 AAB** — Settings → Secrets → Actions에 `KEYSTORE_B64`, `KEYSTORE_PASSWORD` 등록 후 빌드하면 AAB도 함께 생성

## 홈페이지 (저장소 루트)

루트의 `index.html` · `play/` · `moon/` · `sitemap.xml` 등은 **`_tools/site`가 앱 데이터로 만든 결과물**입니다. 손으로 고치지 말고 [`_tools/site/README.md`](_tools/site/README.md)대로 다시 만들어 올립니다.
페이지가 바뀌어 올라가면 「검색엔진에 알리기 (IndexNow)」가 네이버·빙 등에 자동으로 알리고, 「앱 자동 점검」이 앱과 홈페이지를 함께 검사합니다(폴더별로 나눠 올리면 마지막에 한 번).

개인정보처리방침: `privacy.html` (Pages 켜면 `https://<계정>.github.io/<저장소>/privacy.html`)

이 앱은 서버가 없습니다. 모든 기록은 사용자 기기 안에만 저장됩니다.
