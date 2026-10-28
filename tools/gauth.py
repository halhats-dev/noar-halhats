"""Google API access as the halhats Google account.

The token's location is configuration, not code: set NOAR_GOOGLE_TOKEN in the environment, or put
`NOAR_GOOGLE_TOKEN=<path>` in the git-ignored `.env` at the repo root (see .env.example).
"""
import os
import pathlib
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

ENV_FILE = pathlib.Path(__file__).resolve().parent.parent / '.env'


def token_path():
    path = os.environ.get('NOAR_GOOGLE_TOKEN')
    if not path and ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            key, sep, value = line.partition('=')
            if sep and key.strip() == 'NOAR_GOOGLE_TOKEN':
                path = value.strip().strip('"\'')
    if not path:
        raise SystemExit('NOAR_GOOGLE_TOKEN is not set (environment or .env) – see README, "Accounts and secrets".')
    return os.path.expanduser(path)


def creds():
    c = Credentials.from_authorized_user_file(token_path())
    if not c.valid:
        c.refresh(Request())
    return c


def sheets():
    return build('sheets', 'v4', credentials=creds())


def calendar():
    return build('calendar', 'v3', credentials=creds())
