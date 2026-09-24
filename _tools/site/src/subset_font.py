# 사이트에 실제로 쓰인 글자만 담은 Pretendard 한 파일 (fonts/pretendard-site.woff2).
# 92조각 동적 서브셋은 글자마다 조각을 고르는 계산이 비싸서(라이트하우스 «스타일·배치» 2초+) 한 파일로 바꾼다.
# 필요: pip install fonttools brotli  ·  원본 글꼴은 npm의 pretendard 패키지(make.sh가 설치)
import glob, io, os, re, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('OUT', '/tmp/goseumi-site-out')
SRC = os.environ.get('PRETENDARD_WOFF2') or os.path.join(
    HERE, '..', 'node_modules', 'pretendard', 'dist', 'web', 'variable', 'woff2', 'PretendardVariable.woff2')
if not os.path.exists(SRC):
    sys.exit('원본 글꼴이 없어요: ' + SRC + '\n→ _tools/site 에서 npm install')
chars = set()
for f in glob.glob(OUT + '/**/*.html', recursive=True) + glob.glob(OUT + '/assets/*.json') + glob.glob(OUT + '/assets/*.js'):
    t = io.open(f, encoding='utf-8').read()
    t = re.sub(r'<svg[\s\S]*?</svg>', '', t)
    chars |= set(t)
chars |= set(chr(c) for c in range(0x20, 0x7F))                 # 영문·숫자·기호 전부
chars |= set('·…—–«»「」『』→←↑↓✓×‘’“”%')
txt = ''.join(sorted(c for c in chars if ord(c) >= 0x20))
os.makedirs(OUT + '/fonts', exist_ok=True)
dst = OUT + '/fonts/pretendard-site.woff2'
with tempfile.NamedTemporaryFile('w', encoding='utf-8', suffix='.txt', delete=False) as tf:
    tf.write(txt)
try:
    subprocess.run([sys.executable, '-m', 'fontTools.subset', SRC, '--text-file=' + tf.name, '--flavor=woff2',
                    '--layout-features=kern,liga,calt,ccmp,locl,mark,mkmk,tnum', '--output-file=' + dst,
                    '--no-hinting', '--desubroutinize'], check=True)
finally:
    os.unlink(tf.name)
hangul = sum(1 for c in txt if 0xAC00 <= ord(c) <= 0xD7A3)
print('subset:', len(txt), 'chars (한글', hangul, ') ->', os.path.getsize(dst) // 1024, 'KB')
