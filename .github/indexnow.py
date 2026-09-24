#!/usr/bin/env python3
"""바뀐 홈페이지 주소를 IndexNow 참여 검색엔진(네이버·빙·얀덱스 등)에 알린다.

- 열쇠: 저장소 맨 위 <16진수 32자>.txt (내용 = 열쇠 그대로). 공개돼도 되는 값이다.
- 깃허브 페이지에 새 버전이 실제로 올라온 걸 확인한 뒤 알린다(배포에 1~2분 걸림).
- IndexNow 규약상 한 곳에만 보내면 참여 검색엔진끼리 나눠 갖는다. 네이버에 먼저 보내고,
  네이버가 받지 않으면 api.indexnow.org(빙 운영)로 한 번 더 보낸다.
- 구글은 IndexNow를 받지 않는다 → 서치 콘솔에 사이트맵을 제출해 두면 알아서 온다.
- 알림이 안 돼도 홈페이지에는 아무 영향이 없으므로 경고만 남기고 «성공»으로 끝낸다
  (주간 점검이 가짜 «실패»로 놀라지 않게). 결과는 실행 페이지 맨 위 요약 표에 뜬다.
"""
import json, os, re, subprocess, sys, time, urllib.error, urllib.request
import xml.etree.ElementTree as ET

SITE = os.environ.get('SITE', 'https://goseumi-app.github.io').rstrip('/')
HOST = re.sub(r'^https?://', '', SITE).split('/')[0].split(':')[0]
ENDPOINTS = [e.strip() for e in os.environ.get(
    'ENDPOINTS', 'https://searchadvisor.naver.com/indexnow,https://api.indexnow.org/indexnow').split(',') if e.strip()]
WAIT_MAX = int(os.environ.get('WAIT_MAX', '600'))
POLL = int(os.environ.get('POLL', '20'))
MEANING = {200: '받았어요', 202: '받았어요 (열쇠 확인 중)', 400: '형식이 틀렸대요', 403: '열쇠 파일을 못 찾았대요',
           422: '주소와 열쇠가 안 맞대요', 429: '너무 자주 보냈대요'}


def out(line=''):
    print(line)
    p = os.environ.get('GITHUB_STEP_SUMMARY')
    if p:
        with open(p, 'a', encoding='utf-8') as f:
            f.write(line + '\n')


def warn(msg):
    print('::warning title=IndexNow::' + msg.replace('\n', ' '))
    out('> ⚠️ ' + msg)


def fetch(url, data=None, timeout=30):
    """(상태 코드, 본문). 네트워크 오류면 (오류 설명 글, b'')."""
    headers = {'User-Agent': 'goseumi-indexnow/1 (+' + SITE + ')'}
    if data is None:
        url += ('&' if '?' in url else '?') + 'nocache=' + str(time.time_ns())
        headers['Cache-Control'] = 'no-cache'
    else:
        headers['Content-Type'] = 'application/json; charset=utf-8'
    req = urllib.request.Request(url, data=data, headers=headers, method='GET' if data is None else 'POST')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        try:
            body = e.read() or b''
        except Exception:
            body = b''
        return e.code, body
    except Exception as e:
        return f'{type(e).__name__}: {e}', b''


def path_of(p):
    return '/' + (p[:-len('index.html')] if p.endswith('index.html') else p)


def url_of(p):
    return SITE + path_of(p)


def main():
    keys = sorted(f[:-4] for f in os.listdir('.') if re.fullmatch(r'[0-9a-f]{32}\.txt', f))
    if len(keys) != 1:
        warn(f'저장소 맨 위에 열쇠 파일(16진수 32자.txt)이 {len(keys)}개예요 — 1개여야 해요.')
        return
    key = keys[0]
    with open(key + '.txt', encoding='utf-8') as f:
        if f.read() != key:
            warn('열쇠 파일 내용이 파일 이름과 달라요(줄바꿈도 없어야 해요).')
            return

    with open('sitemap.xml', 'rb') as f:
        sitemap = f.read()
    ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    listed = [re.sub(r'^https?://[^/]+', '', e.text.strip()) or '/'     # 사이트맵 주소의 경로 부분
              for e in ET.fromstring(sitemap).findall('s:url/s:loc', ns)]

    before = os.environ.get('BEFORE', '').strip()
    send_all = os.environ.get('ALL', '') == 'true' or not re.fullmatch(r'[0-9a-f]{40}', before) or set(before) == {'0'}
    changed = []
    if not send_all:
        r = subprocess.run(['git', 'diff', '--name-only', '--no-renames', before, 'HEAD'],
                           capture_output=True, text=True)
        if r.returncode != 0:          # 이전 커밋을 못 찾으면(강제 푸시 등) 전부 알린다
            send_all = True
        else:
            changed = [p for p in r.stdout.split('\n') if p]

    if send_all:
        urls, why = [SITE + x for x in listed], '사이트맵의 모든 주소'
    else:
        urls = sorted({url_of(p) for p in changed
                       if p.endswith('.html') and not p.startswith('www/') and p != '404.html'
                       and (path_of(p) in listed or not os.path.exists(p))})   # 사이트맵의 페이지 + 지워진 페이지
        why = '이번에 바뀐 페이지'
    if not urls:
        out('알릴 페이지가 없어요 (검색에 나가는 페이지는 바뀌지 않았어요).')
        return

    # 새 버전이 실제로 올라왔는지: 열쇠 파일 + (바뀐 페이지 하나, 없으면 사이트맵)이 저장소와 같아질 때까지 기다린다
    probe = next((p for p in changed if p.endswith('.html') and path_of(p) in listed and os.path.exists(p)),
                 'sitemap.xml')
    with open(probe, 'rb') as f:
        local = f.read()
    t0 = time.time()
    while True:
        s1, b1 = fetch(f'{SITE}/{key}.txt')
        s2, b2 = fetch(url_of(probe))
        if s1 == 200 and b1.decode('utf-8', 'replace').strip() == key and s2 == 200 and b2 == local:
            out(f'새 버전이 홈페이지에 올라온 걸 확인했어요 ({int(time.time() - t0)}초 기다림).')
            break
        if time.time() - t0 >= WAIT_MAX:
            warn(f'{WAIT_MAX // 60}분을 기다려도 새 버전이 안 보여요 (열쇠 파일 {s1}, {probe} {s2}) — '
                 '그래도 알립니다. 검색엔진은 나중에 다시 와서 봅니다.')
            break
        time.sleep(POLL)

    body = json.dumps({'host': HOST, 'key': key, 'keyLocation': f'{SITE}/{key}.txt', 'urlList': urls}).encode()
    out('')
    out(f'### {why} {len(urls)}개를 검색엔진에 알렸어요')
    out('')
    out('| 보낸 곳 | 응답 | 뜻 |')
    out('|---|---|---|')
    ok = False
    for ep in ENDPOINTS:
        code, resp = fetch(ep, data=body)
        out(f'| {ep} | {code} | {MEANING.get(code, "예상 밖 응답")} |')
        if resp:
            print('   응답 본문:', resp[:300].decode('utf-8', 'replace'))
        if code in (200, 202):
            ok = True
            break
        time.sleep(3)
    out('')
    out('<details><summary>알린 주소</summary>\n\n' + '\n'.join(f'- {u}' for u in urls) + '\n\n</details>')
    if not ok:
        warn('어느 검색엔진도 받지 않았어요. 홈페이지에는 영향이 없어요 — 위 표의 응답을 보고 나중에 다시 실행하면 돼요.')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:  # 알림은 곁다리 — 어떤 문제든 경고로만 남긴다
        warn(f'알림 도중 예상 못 한 문제가 생겼어요: {type(e).__name__}: {e}')
    sys.exit(0)
