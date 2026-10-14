// Mirrors the movement tab into one public Google Calendar per category (column G).
// Each row carries a permanent ID (hidden column K); each calendar event is tagged with it.
// Hidden column L holds a fingerprint of what was last written, so unchanged rows are skipped.

const SYNC_TAB = 'אירועי תנועה - איחוד חקלאי';
const CALENDARS = {
  "נוער חלחצ - שכבה בוגרת": "94baf3674b2a0c2472bf5d005ff9438abbf1db4e00eb68b74d771455d9c4092a@group.calendar.google.com",
  "נוער חלחצ - שכבה צעירה": "e70af05f4509027dadf52efa8f3e8eec8899e44cdd4a17a9f8fb968291a8f74f@group.calendar.google.com",
  "נוער חלחצ - שכבת י״ב": "d11b81d1d5e818c02fec6968299b50c5a64ec786538e5deb26705885771ff683@group.calendar.google.com",
  "נוער חלחצ - רכזים": "3f30a8fe77e7c35f558664713d6b6165549e07bb96da9e0a4823b520789b76bf@group.calendar.google.com",
  "נוער חלחצ - שנת שירות": "1596f8b752f27001920e5eff64865fac2dc8f321b86ab8e261c2e4e8484a748a@group.calendar.google.com",
  "נוער חלחצ - טקסים וטיולים": "e3d3af0988e7632db8e1f0d9370e15cc6518cf4a340b981d576eb0535d940cec@group.calendar.google.com"
};
const TAG = 'sheetRowId';
const SYNC_FROM = new Date(2026, 0, 1);
const SYNC_TO = new Date(2029, 0, 1);
const COL = { start: 2, end: 3, title: 6, category: 7, fullDay: 8, from: 9, to: 10, id: 11, fp: 12, location: 13, details: 14, contact: 15 };

// Run once from the editor: installs the triggers and does the first full sync.
function setup() {
  const ss = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers()
    .filter(t => ['onSheetChange', 'syncCalendars', 'sortIfQuiet'].indexOf(t.getHandlerFunction()) >= 0)
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onSheetChange').forSpreadsheet(ss).onChange().create();
  ScriptApp.newTrigger('syncCalendars').timeBased().everyHours(4).create();
  syncCalendars();
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('סנכרון יומנים')
    .addItem('סנכרן עכשיו', 'syncCalendars')
    .addItem('מיין עכשיו', 'sortNow')
    .addToUi();
}

// Fires on any change (edits, pasted data, sorted or deleted rows).
// Edits made while a sync is running set a flag so that sync runs once more.
function onSheetChange() {
  PropertiesService.getScriptProperties().setProperty('dirty', '1');
  scheduleSort_();
  syncCalendars();
}

function syncCalendars() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return; // the running sync will pick up the dirty flag
  try {
    const props = PropertiesService.getScriptProperties();
    do {
      props.deleteProperty('dirty');
      syncOnce_();
    } while (props.getProperty('dirty'));
  } finally {
    lock.releaseLock();
  }
}

function syncOnce_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SYNC_TAB);
  const last = sh.getLastRow();
  const rows = last < 2 ? [] : sh.getRange(2, 1, last - 1, COL.contact).getValues();

  // Index every event this script created, by row ID.
  const cals = {};
  const existing = {};
  Object.keys(CALENDARS).forEach(name => {
    const cal = CalendarApp.getCalendarById(CALENDARS[name]);
    cals[name] = cal;
    cal.getEvents(SYNC_FROM, SYNC_TO).forEach(ev => {
      const id = ev.getTag(TAG);
      if (!id) return;
      if (existing[id]) ev.deleteEvent(); // stray duplicate
      else existing[id] = { ev: ev, cal: name };
    });
  });

  const idsAndFps = rows.map(r => {
    let id = r[COL.id - 1], fp = r[COL.fp - 1];
    const spec = eventSpec_(r);
    if (!spec) {                       // incomplete or invalid row: no event
      if (id && existing[id]) { existing[id].ev.deleteEvent(); delete existing[id]; }
      return [id, spec === null ? '' : 'שגיאה: שעת הסיום חייבת להיות אחרי שעת ההתחלה'];
    }
    if (!id) id = Utilities.getUuid();
    const ex = existing[id];
    delete existing[id];
    if (ex && ex.cal === spec.category && fp === spec.fp) return [id, fp];
    if (ex) ex.ev.deleteEvent();
    const cal = cals[spec.category];
    const opts = {};
    if (spec.location) opts.location = spec.location;
    if (spec.description) opts.description = spec.description;
    const ev = spec.allDay
      ? cal.createAllDayEvent(spec.title, spec.start, spec.end, opts)
      : cal.createEvent(spec.title, spec.start, spec.end, opts);
    ev.setTag(TAG, id);
    Utilities.sleep(150); // stay under Calendar's burst limit
    return [id, spec.fp];
  });

  // Rows that no longer exist in the sheet.
  Object.keys(existing).forEach(id => existing[id].ev.deleteEvent());

  if (idsAndFps.length) sh.getRange(2, COL.id, idsAndFps.length, 2).setValues(idsAndFps);
}

// Returns the event to write for a row, null when the row is incomplete,
// or false when the times are invalid.
function eventSpec_(r) {
  const start = r[COL.start - 1], title = String(r[COL.title - 1]).trim();
  const category = r[COL.category - 1];
  if (!(start instanceof Date) || !title || !CALENDARS[category]) return null;
  const endDay = r[COL.end - 1] instanceof Date ? r[COL.end - 1] : start;
  const allDay = r[COL.fullDay - 1] === true;
  const location = String(r[COL.location - 1]).trim();
  const details = String(r[COL.details - 1]).trim();
  const contact = String(r[COL.contact - 1]).trim();
  const description = [details, contact ? 'פרטי איש קשר:\n' + contact : ''].filter(Boolean).join('\n\n');
  let s, e;
  if (allDay) {
    s = day_(start, 0, 0);
    e = day_(endDay, 0, 0);
    e.setDate(e.getDate() + 1);        // all-day end date is exclusive
  } else {
    const from = hm_(r[COL.from - 1]), to = hm_(r[COL.to - 1]);
    if (!from || !to) return null;
    s = day_(start, from[0], from[1]);
    e = day_(start, to[0], to[1]);
    if (e <= s) return false;
  }
  return { title: title, category: category, allDay: allDay, start: s, end: e, location: location, description: description,
           fp: JSON.stringify([category, title, allDay, s.getTime(), e.getTime(), location, description]) };
}

function day_(d, h, m) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m); }

function hm_(v) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v).trim());
  return m ? [Number(m[1]), Number(m[2])] : null;
}
