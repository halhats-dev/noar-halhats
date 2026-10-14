"""Google API access as the halhats Google account (token minted by ~/.config/gcloud/noar-halhats/authorize.py)."""
import os
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

TOKEN = os.path.expanduser('~/.config/gcloud/noar-halhats/token.json')


def creds():
    c = Credentials.from_authorized_user_file(TOKEN)
    if not c.valid:
        c.refresh(Request())
    return c


def sheets():
    return build('sheets', 'v4', credentials=creds())


def calendar():
    return build('calendar', 'v3', credentials=creds())
