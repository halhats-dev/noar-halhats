// Asks GitHub to rebuild the parents' page, so its saved snapshot stays fresh even when
// nobody pushes for months (GitHub pauses scheduled runs after 60 days without commits).
// The token is a fine-grained GitHub token limited to this repo (Actions: read and write),
// kept in the script property GITHUB_TOKEN; it never appears in code.

const GITHUB_REPO = 'halhats-dev/noar-halhats';
const GITHUB_WORKFLOW = 'pages.yml';
const REBUILD_MIN_GAP_MS = 10 * 60 * 1000; // at most one rebuild per 10 minutes; a later one waits, never drops

// Run once from the editor, after adding the GITHUB_TOKEN script property:
// installs the weekly rebuild and sends one test request.
function setupGithubRebuild() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'weeklySiteRebuild')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('weeklySiteRebuild').timeBased().everyWeeks(1).onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(5).create();
  const status = requestSiteRebuild(true);
  Logger.log(status === 204 ? 'OK – GitHub accepted the rebuild request (204).' : 'Problem – GitHub answered: ' + status);
}

function deferredSiteRebuild() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'deferredSiteRebuild')
    .forEach(t => ScriptApp.deleteTrigger(t));
  requestSiteRebuild(true);
}

function weeklySiteRebuild() {
  requestSiteRebuild(true);
}

// Called after edits settle (from sortNow). Returns the HTTP status, or a short reason it was skipped.
function requestSiteRebuild(force) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('GITHUB_TOKEN');
  if (!token) return 'no GITHUB_TOKEN';
  const last = JSON.parse(props.getProperty('lastRebuild') || '{}');
  const sinceLast = last.at ? Date.now() - new Date(last.at).getTime() : Infinity;
  if (!force && sinceLast < REBUILD_MIN_GAP_MS) {
    // Too soon after the previous rebuild: run it once the gap is over instead of dropping it.
    const pending = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'deferredSiteRebuild');
    if (!pending) ScriptApp.newTrigger('deferredSiteRebuild').timeBased().after(REBUILD_MIN_GAP_MS - sinceLast + 5000).create();
    return 'deferred';
  }
  const res = UrlFetchApp.fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW}/dispatches`, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ ref: 'main' }),
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      muteHttpExceptions: true,
    });
  const status = res.getResponseCode();
  props.setProperty('lastRebuild', JSON.stringify({ at: new Date().toISOString(), status: status }));
  return status; // 204 = accepted
}
