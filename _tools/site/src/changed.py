# 만든 사이트(OUT)와 저장소(REPO)를 비교해, 올려야 할 파일을 폴더별로 묶어 보여 준다(웹 업로드는 폴더 단위).
import hashlib, os, re
OUT = os.environ.get('OUT', '/tmp/goseumi-site-out')
REPO = os.environ.get('REPO') or os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
SKIP = {'og-jobs.json'}


def md5(p):
    with open(p, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()


groups, same = {}, 0
for dp, dn, fn in os.walk(OUT):
    for f in fn:
        if f in SKIP:
            continue
        a = os.path.join(dp, f)
        rel = os.path.relpath(a, OUT)
        b = os.path.join(REPO, rel)
        if os.path.exists(b) and md5(a) == md5(b):
            same += 1
            continue
        how = '새 파일'
        if os.path.exists(b):
            how = '바뀜'
            if rel.endswith(('.html', '.xml')):
                norm = lambda q: re.sub(rb'\?v=[0-9a-z]+', b'', open(q, 'rb').read())
                if norm(a) == norm(b):
                    how = '바뀜 (캐시 표시 ?v= 만)'
        groups.setdefault(os.path.dirname(rel) or '(루트)', []).append((rel, how))

gone = []   # 저장소에는 있는데 이번 빌드에는 없는 페이지·공유 그림
for d, ext in (('play', '.html'), ('moon', '.html'), ('assets/og', '.jpg')):
    p = os.path.join(REPO, d)
    for f in sorted(os.listdir(p)) if os.path.isdir(p) else []:
        if f.endswith(ext) and not os.path.exists(os.path.join(OUT, d, f)):
            gone.append(f'{d}/{f}')

ORDER = ['assets/og', 'assets/shots', 'assets', 'fonts', 'play', 'moon', '(루트)']
print(f'\n같음 {same}개 · 올릴 것 {sum(len(v) for v in groups.values())}개 (아래 순서대로, 폴더마다 한 번씩)')
for d in sorted(groups, key=lambda x: ORDER.index(x) if x in ORDER else len(ORDER)):
    print(f'\n▶ {d}  →  https://github.com/goseumi-app/goseumi-app.github.io/upload/main/{"" if d == "(루트)" else d}')
    for rel, kind in sorted(groups[d]):
        print(f'   {kind:4} {rel}')
if gone:
    print('\n⚠ 저장소에만 있고 이번 빌드엔 없는 파일(지워야 하는지 확인):', ', '.join(gone))
