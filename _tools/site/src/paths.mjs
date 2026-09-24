/* 경로 한곳에서 — 저장소 어디에 받아 놓든(깃 클론 위치 무관) 같은 명령으로 돌게 한다.
   환경변수로 바꿀 수 있다: REPO(저장소 루트) · OUT(만든 사이트) · APP_DIR(앱 폴더, 기본 www) · WORK(사진·검토용 임시) · PW_CHROME(크롬 실행 파일) · PRETENDARD_WOFF2(원본 글꼴) */
import path from 'path'; import fs from 'fs';
export const SRC = path.dirname(new URL(import.meta.url).pathname);
export const TOOLS = path.resolve(SRC, '..');
export const REPO = process.env.REPO || path.resolve(TOOLS, '../..');
export const OUT = process.env.OUT || '/tmp/goseumi-site-out';
export const APP_DIR = process.env.APP_DIR || path.join(REPO, 'www');
export const WORK = process.env.WORK || '/tmp/goseumi-site-work';
export const FONT = process.env.PRETENDARD_WOFF2 || path.join(TOOLS, 'node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2');
/* 플레이라이트가 기대하는 크롬 판이 없을 때를 대비해, 설치된 크롬을 직접 찾아 준다 */
export function chromePath() {
  if (process.env.PW_CHROME) return process.env.PW_CHROME;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    for (const d of fs.readdirSync(base).filter(n => /^chromium-\d+$/.test(n)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1])) {
      const p = path.join(base, d, 'chrome-linux', 'chrome'); if (fs.existsSync(p)) return p;
    }
  } catch (e) {}
  return undefined;   /* 플레이라이트 기본값 */
}
