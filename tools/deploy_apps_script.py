"""Pushes apps-script/*.gs + appsscript.json to the sheet-bound project and (re)deploys the public web app.

With --code-only, only pushes the code (the web app keeps serving its current version).

Runs as the halhats Google account (tools/gauth.py). The web app URL is stable across redeploys; it is kept
in apps-script/deployment.json.
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from gauth import creds  # noqa: E402
from googleapiclient.discovery import build  # noqa: E402

SCRIPT_ID = '1ReU5sVFybt6DqZvjrdtGbcI0qca4WUo6Cu7mFiGL0RnyB5PhMMPkD3wk'
SRC = pathlib.Path(__file__).resolve().parent.parent / 'apps-script'
STATE = SRC / 'deployment.json'

api = build('script', 'v1', credentials=creds()).projects()
files = [{'name': 'appsscript', 'type': 'JSON', 'source': (SRC / 'appsscript.json').read_text()}]
# Load order matters in Apps Script: top-level constants must be defined before files that use them.
ORDER = ['Code', 'Sync', 'Sort', 'Api', 'Rebuild']
gs = {f.stem: f for f in SRC.glob('*.gs')}
assert set(gs) == set(ORDER), f'update ORDER: {sorted(gs)}'
files += [{'name': n, 'type': 'SERVER_JS', 'source': gs[n].read_text()} for n in ORDER]
api.updateContent(scriptId=SCRIPT_ID, body={'files': files}).execute()
print('pushed:', [f['name'] for f in files])

if '--code-only' in sys.argv:
    sys.exit(0)  # triggers run the pushed code; the public web app keeps its deployed version

version = api.versions().create(scriptId=SCRIPT_ID, body={'description': 'web app'}).execute()['versionNumber']
config = {'versionNumber': version, 'manifestFileName': 'appsscript', 'description': 'parents page endpoint'}
state = json.loads(STATE.read_text()) if STATE.exists() else {}
if state.get('deploymentId'):
    dep = api.deployments().update(scriptId=SCRIPT_ID, deploymentId=state['deploymentId'],
                                   body={'deploymentConfig': {**config, 'scriptId': SCRIPT_ID}}).execute()
else:
    dep = api.deployments().create(scriptId=SCRIPT_ID, body=config).execute()
url = next(e['webApp']['url'] for e in dep.get('entryPoints', []) if e.get('entryPointType') == 'WEB_APP')
STATE.write_text(json.dumps({'deploymentId': dep['deploymentId'], 'url': url}, indent=1) + '\n')
print('version', version, '->', url)
