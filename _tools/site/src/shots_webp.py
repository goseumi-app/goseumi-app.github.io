# 앱 화면 사진(PNG, 390×844 @2배) → 랜딩용 WebP 세 크기(780·560·390). 품질 80·method 6 = 배포본과 같은 설정.
# 앞 단계: node src/shots.mjs (데모 프로필 «봄이» — 실제 아이 기록 아님)
# homeplays = home 사진의 y 800~1688(아래쪽 «오늘 해볼 놀이»), sleepgraph = sleep 사진의 y 120~860(«최근 7일» 그래프)
import os
from PIL import Image
WORK = os.environ.get('WORK', '/tmp/goseumi-site-work')
OUT = os.environ.get('OUT', '/tmp/goseumi-site-out')
src = os.path.join(WORK, 'shots')
dst = os.path.join(OUT, 'assets', 'shots')
os.makedirs(dst, exist_ok=True)
FULL = ['home', 'cal', 'calday']                               # 화면 그대로 쓰는 것
CROP = {'homeplays': ('home', 800, 888), 'sleepgraph': ('sleep', 120, 740)}   # 이름: (원본, 위에서부터 y, 높이) — 2배율 픽셀


def save(im, name):
    w, h = im.size
    for tw, suf in ((780, ''), (560, '-560'), (390, '-390')):
        r = im if tw == w else im.resize((tw, round(h * tw / w)), Image.LANCZOS)
        r.save(os.path.join(dst, f'{name}{suf}.webp'), 'WEBP', quality=80, method=6)


n = 0
for tag in ('light', 'dark'):
    for name in FULL:
        save(Image.open(os.path.join(src, f'{name}-{tag}.png')).convert('RGB'), f'{name}-{tag}')
        n += 1
    for name, (base, y, h) in CROP.items():
        im = Image.open(os.path.join(src, f'{base}-{tag}.png')).convert('RGB')
        save(im.crop((0, y, im.width, y + h)), f'{name}-{tag}')
        n += 1
print('webp:', n, '장 × 3크기 →', dst)
