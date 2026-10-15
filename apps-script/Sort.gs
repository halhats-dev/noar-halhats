// Keeps both event tabs sorted by date. Sorting waits until the sheet has been quiet
// for SORT_DELAY_MS, so a row someone is still filling in does not jump away mid-typing.

const SORT_TABS = ['אירועי תנועה - איחוד חקלאי', 'אירועי ועדה']; // literal: files may load before Sync.gs
const SORT_DELAY_MS = 3 * 60 * 1000;
const SORT_LAST_COL = 16; // A:P, so hidden IDs and all event details move with their row

// Called on every change: remember when it happened and make sure a sort is pending.
function scheduleSort_() {
  PropertiesService.getScriptProperties().setProperty('lastChange', String(Date.now()));
  const pending = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'sortIfQuiet');
  if (!pending) ScriptApp.newTrigger('sortIfQuiet').timeBased().after(SORT_DELAY_MS).create();
}

function sortIfQuiet() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sortIfQuiet')
    .forEach(t => ScriptApp.deleteTrigger(t));
  const idle = Date.now() - Number(PropertiesService.getScriptProperties().getProperty('lastChange') || 0);
  if (idle < SORT_DELAY_MS) {
    ScriptApp.newTrigger('sortIfQuiet').timeBased().after(SORT_DELAY_MS - idle + 5000).create();
    return;
  }
  sortNow();
}

function sortNow() {
  // Same lock as the calendar sync: it writes row IDs by position, so rows must not move under it.
  const lock = LockService.getScriptLock();
  lock.waitLock(60000);
  try {
    SORT_TABS.forEach(sortTab_);
  } finally {
    lock.releaseLock();
  }
  // A change made while we held the lock may have skipped its sync.
  if (PropertiesService.getScriptProperties().getProperty('dirty')) syncCalendars();
  // Edits have settled: refresh the website's saved snapshot too.
  try { requestSiteRebuild(false); } catch (e) { console.warn('site rebuild request failed: ' + e); }
}

function sortTab_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!layoutOk_(sh)) return;
  const n = sh.getMaxRows() - 1;
  if (n < 2) return;
  sh.getRange(2, 1, n, SORT_LAST_COL).sort([
    { column: 2, ascending: true },  // start date (empty rows sink to the bottom)
    { column: 3, ascending: true },  // end date
    { column: 6, ascending: true },  // event name
  ]);
  // The time rules in I:J depend on each row's full-day box; re-apply them after rows moved.
  const block = SpreadsheetApp.newDataValidation().requireFormulaSatisfied('=FALSE')
    .setAllowInvalid(false).setHelpText(BLOCK_HELP).build();
  const list = SpreadsheetApp.newDataValidation().requireValueInList(TIMES, true)
    .setAllowInvalid(false).build();
  const full = sh.getRange(2, C_FULL, n, 1).getValues();
  sh.getRange(2, C_FROM, n, 2).setDataValidations(full.map(([f]) => f === true ? [block, block] : [list, list]));
}
