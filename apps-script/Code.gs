
const TABS = ["אירועי תנועה - איחוד חקלאי", "אירועי ועדה"];
const AUTO_FULL_DAY_TABS = ["אירועי ועדה"];  // tabs where entering dates sets "יום מלא" automatically
const TIMES = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00"];
const BLOCK_HELP = 'אירוע של יום מלא – אין שעות. בטלו את הסימון בעמודה "יום מלא" כדי לבחור שעות.';

function onEdit(e) {
  const r = e.range, sh = r.getSheet(), name = sh.getName();
  if (TABS.indexOf(name) < 0) return;
  const first = Math.max(r.getRow(), 2), last = r.getLastRow();
  if (last < first) return;
  const c0 = r.getColumn(), c1 = r.getLastColumn();
  const touchesDates = c0 <= 3 && c1 >= 2 && AUTO_FULL_DAY_TABS.indexOf(name) >= 0;
  const touchesFullDay = c0 <= 8 && c1 >= 8;
  if (!touchesDates && !touchesFullDay) return;
  for (let row = first; row <= last; row++) {
    if (touchesDates) {
      const [b, c] = sh.getRange(row, 2, 1, 2).getValues()[0];
      if (b instanceof Date) {
        const end = c instanceof Date ? c : b;
        sh.getRange(row, 8).setValue(end - b >= 86400000);
      }
    }
    syncTimes(sh, row);
  }
}

function syncTimes(sh, row) {
  const full = sh.getRange(row, 8).getValue() === true;
  const ij = sh.getRange(row, 9, 1, 2);
  if (full) {
    ij.clearContent().setDataValidation(SpreadsheetApp.newDataValidation()
      .requireFormulaSatisfied('=FALSE').setAllowInvalid(false).setHelpText(BLOCK_HELP).build());
  } else {
    ij.setNumberFormat('@').setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(TIMES, true).setAllowInvalid(false).build());
    if (ij.getValues()[0].every(x => x === '')) ij.setValues([['17:00', '20:00']]);
  }
}
