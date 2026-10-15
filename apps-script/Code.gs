
const TABS = ["אירועי תנועה - איחוד חקלאי", "אירועי ועדה"];
const AUTO_FULL_DAY_TABS = ["אירועי ועדה"];  // tabs where entering dates sets "יום מלא" automatically
const TIMES = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00"];
const BLOCK_HELP = 'אירוע של יום מלא – אין שעות. בטלו את הסימון בעמודה "יום מלא" כדי לבחור שעות.';

// Column positions shared by all scripts (1-based): B date, C end, F title, G calendar,
// H happening, I full day, J:K times, L id, M fingerprint, N location, O details, P contact.
const C_START = 2, C_TITLE = 6, C_HAPPENING = 8, C_FULL = 9, C_FROM = 10, C_ID = 12;

// The scripts address columns by position, so they stop if the layout ever moves.
const EXPECTED_HEADERS = { 8: 'מתקיים', 9: 'יום מלא', 12: 'מזהה' };
function layoutOk_(sh) {
  const h = sh.getRange(1, 1, 1, 16).getValues()[0];
  const ok = Object.keys(EXPECTED_HEADERS).every(c => String(h[c - 1]).trim() === EXPECTED_HEADERS[c]);
  if (!ok) console.warn('Column layout of "' + sh.getName() + '" changed; scripts paused for this tab.');
  return ok;
}

function onEdit(e) {
  const r = e.range, sh = r.getSheet(), name = sh.getName();
  if (TABS.indexOf(name) < 0) return;
  const first = Math.max(r.getRow(), 2), last = r.getLastRow();
  if (last < first) return;
  const c0 = r.getColumn(), c1 = r.getLastColumn();
  const touchesDates = c0 <= 3 && c1 >= 2 && AUTO_FULL_DAY_TABS.indexOf(name) >= 0;
  const touchesFullDay = c0 <= C_FULL && c1 >= C_FULL;
  const touchesNew = (c0 <= C_START && c1 >= C_START) || (c0 <= C_TITLE && c1 >= C_TITLE);
  if (!touchesDates && !touchesFullDay && !touchesNew) return;
  if (!layoutOk_(sh)) return;
  for (let row = first; row <= last; row++) {
    if (touchesNew) markNewEventHappening_(sh, row, r.getNumRows() === 1 && r.getNumColumns() === 1 ? e.oldValue : null);
    if (touchesDates) {
      const [b, c] = sh.getRange(row, 2, 1, 2).getValues()[0];
      if (b instanceof Date) {
        const end = c instanceof Date ? c : b;
        sh.getRange(row, C_FULL).setValue(end - b >= 86400000);
      }
    }
    if (touchesDates || touchesFullDay) syncTimes(sh, row);
  }
}

// A new event starts as "happening". New = a date or title typed into an empty cell, or
// (for pastes) a row that was never synced. An event someone unticked is left unticked.
function markNewEventHappening_(sh, row, oldValue) {
  const cell = sh.getRange(row, C_HAPPENING);
  if (cell.getValue() === true) return;
  const isNew = oldValue === undefined || (oldValue === null && sh.getRange(row, C_ID).getValue() === '');
  if (isNew) cell.setValue(true);
}

function syncTimes(sh, row) {
  const full = sh.getRange(row, C_FULL).getValue() === true;
  const ij = sh.getRange(row, C_FROM, 1, 2);
  if (full) {
    ij.clearContent().setDataValidation(SpreadsheetApp.newDataValidation()
      .requireFormulaSatisfied('=FALSE').setAllowInvalid(false).setHelpText(BLOCK_HELP).build());
  } else {
    ij.setNumberFormat('@').setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(TIMES, true).setAllowInvalid(false).build());
    if (ij.getValues()[0].every(x => x === '')) ij.setValues([['17:00', '20:00']]);
  }
}
