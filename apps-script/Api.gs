// Public read-only endpoint for the parents' events page (deployed as a web app, "anyone").
// Returns only the fields the page shows, from both event tabs; the sheet itself stays private.

const API_TABS = { movement: 'אירועי תנועה - איחוד חקלאי', committee: 'אירועי ועדה' }; // literal: files may load before Sync.gs
const API_PREFIX = 'נוער חלחצ - ';
const API_CACHE_SECONDS = 60;

function doGet() {
  const cache = CacheService.getScriptCache();
  let body = cache.get('events');
  if (!body) {
    try {
      body = JSON.stringify(apiPayload_());
    } catch (err) {
      // the page keeps its saved copy (and says so) when this has no event lists
      return ContentService.createTextOutput(JSON.stringify({ error: String(err.message || err) }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    try { cache.put('events', body, API_CACHE_SECONDS); } catch (e) {} // over the 100KB cache limit: just skip caching
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function apiPayload_() {
  const out = { generatedAt: new Date().toISOString(), calendars: {} };
  Object.keys(CALENDARS).forEach(name => { out.calendars[name.replace(API_PREFIX, '')] = CALENDARS[name]; });
  Object.keys(API_TABS).forEach(key => {
    const sh = SpreadsheetApp.getActive().getSheetByName(API_TABS[key]);
    if (!layoutOk_(sh)) throw new Error('column layout changed');
    const last = sh.getLastRow();
    const rows = last < 2 ? [] : sh.getRange(2, 1, last - 1, COL.contact).getValues();
    out[key] = rows
      .filter(r => r[COL.happening - 1] === true && r[COL.start - 1] instanceof Date && String(r[COL.title - 1]).trim() && r[COL.category - 1])
      .map(r => ({
        start: fmt_(r[COL.start - 1]),
        end: fmt_(r[COL.end - 1] instanceof Date ? r[COL.end - 1] : r[COL.start - 1]),
        title: String(r[COL.title - 1]).trim(),
        cal: String(r[COL.category - 1]).replace(API_PREFIX, ''),
        full: r[COL.fullDay - 1] === true,
        from: String(r[COL.from - 1]),
        to: String(r[COL.to - 1]),
        location: String(r[COL.location - 1]).trim(),
        details: String(r[COL.details - 1]).trim(),
        contact: String(r[COL.contact - 1]).trim(),
      }));
  });
  return out;
}

function fmt_(d) { return Utilities.formatDate(d, 'Asia/Jerusalem', 'dd/MM/yyyy'); }
