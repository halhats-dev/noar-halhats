"""Builds dist/ (index.html + img/) from template.html and data.json. Run fetch_data.py first."""
import json
import pathlib
import shutil

ROOT = pathlib.Path(__file__).resolve().parent
DIST = ROOT / 'dist'
data = json.loads((ROOT / 'data.json').read_text())
endpoint = json.loads((ROOT.parent / 'apps-script' / 'deployment.json').read_text())['url']

html = ((ROOT / 'template.html').read_text()
        .replace('__DATA__', json.dumps(data, ensure_ascii=False))
        .replace('__ENDPOINT__', endpoint))
shutil.rmtree(DIST, ignore_errors=True)
shutil.copytree(ROOT / 'img', DIST / 'img', ignore=shutil.ignore_patterns('CREDITS.txt'))
(DIST / 'index.html').write_text(html)
print('dist/index.html', len(html), 'bytes,', len(data['movement']), 'events')
