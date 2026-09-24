/* 로컬 미리보기 서버 — GitHub Pages와 같은 배치(루트=사이트, /www/=앱, 없는 주소=404.html) */
import http from 'http'; import fs from 'fs'; import path from 'path';
import { OUT, APP_DIR as APP, REPO, FONT } from './paths.mjs';
/* 만든 파일(OUT)이 먼저, 없으면 저장소에 이미 있는 파일(사진·아이콘 등). /__tools/pretendard.woff2 = 공유 그림용 원본 글꼴 */
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8',
  '.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.xml':'application/xml','.txt':'text/plain; charset=utf-8'};
export function start(port=8300){
  const srv=http.createServer((q,r)=>{
    let u=decodeURIComponent(q.url.split('?')[0]); if(u.endsWith('/')) u+='index.html';
    if(u==='/__tools/pretendard.woff2'){ r.setHeader('content-type',MIME['.woff2']); r.end(fs.readFileSync(FONT)); return; }
    const cands=u.startsWith('/www/')?[path.join(APP,u.slice(5)),path.join(REPO,u)]:[path.join(OUT,u),path.join(REPO,u)];
    const f=cands.find(p=>{try{return fs.statSync(p).isFile()}catch(e){return false}});
    if(!f){ r.statusCode=404; r.setHeader('content-type',MIME['.html']); r.end(fs.readFileSync(path.join(OUT,'404.html'))); return; }
    r.setHeader('content-type',MIME[path.extname(f)]||'application/octet-stream'); r.end(fs.readFileSync(f));
  });
  return new Promise(res=>srv.listen(port,()=>res(srv)));
}
if(process.argv[1]&&process.argv[1].endsWith('serve.mjs')){ await start(+process.argv[2]||8300); console.log('serving'); }
