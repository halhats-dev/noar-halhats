"""One-off: insert the "מתקיים" tick-box column at H in both event tabs and tick it for existing events.

Run right after deploying the scripts that expect it (they pause until H1 reads "מתקיים").
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from gauth import creds  # noqa: E402
from googleapiclient.discovery import build  # noqa: E402

SHEET_ID = '136AtiBNeUGlWOFuN4Z7in6yl_PKfBBfGAI8OrLwuBNs'
TABS = ['אירועי תנועה - איחוד חקלאי', 'אירועי ועדה']
END = 1000
H = 7  # zero-based column index of H
HDR = {'backgroundColor': {'red': 0.2, 'green': 0.2, 'blue': 0.2}, 'horizontalAlignment': 'CENTER',
       'textFormat': {'bold': True, 'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}}}

sh = build('sheets', 'v4', credentials=creds()).spreadsheets()
meta = sh.get(spreadsheetId=SHEET_ID, fields='sheets.properties').execute()
ids = {s['properties']['title']: s['properties']['sheetId'] for s in meta['sheets']}

headers = sh.values().batchGet(spreadsheetId=SHEET_ID, ranges=[f"'{t}'!H1" for t in TABS]).execute()['valueRanges']
if any(v.get('values', [['']])[0][0] == 'מתקיים' for v in headers):
    sys.exit('H1 already reads "מתקיים" – column was added before; nothing to do.')

# 1. insert the column (protections, filters, validation and formatting rules shift with it)
sh.batchUpdate(spreadsheetId=SHEET_ID, body={'requests': [
    {'insertDimension': {'range': {'sheetId': ids[t], 'dimension': 'COLUMNS', 'startIndex': H, 'endIndex': H + 1},
                         'inheritFromBefore': False}} for t in TABS]}).execute()

# 2. header, tick boxes, width, and a struck-through look for events that are not happening
req = []
for t in TABS:
    g = ids[t]
    rng = lambda r0, r1, c0, c1: {'sheetId': g, 'startRowIndex': r0, 'endRowIndex': r1, 'startColumnIndex': c0, 'endColumnIndex': c1}
    req += [
        {'updateCells': {'start': {'sheetId': g, 'rowIndex': 0, 'columnIndex': H},
                         'rows': [{'values': [{'userEnteredValue': {'stringValue': 'מתקיים'}, 'userEnteredFormat': HDR}]}],
                         'fields': 'userEnteredValue,userEnteredFormat'}},
        {'repeatCell': {'range': rng(1, END, H, H + 1),
                        'cell': {'userEnteredFormat': {'horizontalAlignment': 'CENTER'}, 'dataValidation': {'condition': {'type': 'BOOLEAN'}}},
                        'fields': 'userEnteredFormat.horizontalAlignment,dataValidation'}},
        {'updateDimensionProperties': {'range': {'sheetId': g, 'dimension': 'COLUMNS', 'startIndex': H, 'endIndex': H + 1},
                                       'properties': {'pixelSize': 70, 'hiddenByUser': False}, 'fields': 'pixelSize,hiddenByUser'}},
        {'addConditionalFormatRule': {'index': 0, 'rule': {
            'ranges': [rng(1, END, 0, 16)],
            'booleanRule': {'condition': {'type': 'CUSTOM_FORMULA', 'values': [{'userEnteredValue': '=AND($F2<>"",$H2<>TRUE)'}]},
                            'format': {'backgroundColor': {'red': 0.93, 'green': 0.93, 'blue': 0.93},
                                       'textFormat': {'strikethrough': True, 'foregroundColor': {'red': 0.45, 'green': 0.45, 'blue': 0.45}}}}}}},
    ]
sh.batchUpdate(spreadsheetId=SHEET_ID, body={'requests': req}).execute()

# 3. every existing event is happening
for t in TABS:
    titles = sh.values().get(spreadsheetId=SHEET_ID, range=f"'{t}'!F2:F{END}").execute().get('values', [])
    ticks = [[bool(r and r[0].strip())] for r in titles]
    if ticks:
        sh.values().update(spreadsheetId=SHEET_ID, range=f"'{t}'!H2:H{len(ticks) + 1}", valueInputOption='RAW',
                           body={'values': ticks}).execute()
    print(t, '- ticked', sum(x[0] for x in ticks), 'events')
