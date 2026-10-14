"""Fetches the public events JSON (Apps Script endpoint) into data.json. No credentials needed."""
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
URL = json.loads((ROOT.parent / 'apps-script' / 'deployment.json').read_text())['url']

with urllib.request.urlopen(URL, timeout=60) as r:
    data = json.load(r)
assert isinstance(data.get('movement'), list) and data['movement'], 'endpoint returned no events'
assert data.get('calendars'), 'endpoint returned no calendars'
(ROOT / 'data.json').write_text(json.dumps(data, ensure_ascii=False, indent=1))
print('data.json:', len(data['movement']), 'movement +', len(data.get('committee', [])), 'committee events,', data['generatedAt'])
