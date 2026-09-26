const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const names = ['mobile-390', 'tablet-768', 'laptop-1280', 'desktop', 'desktop-1440', 'desktop-1536', 'desktop-1920'];
const reports = names.map(name => JSON.parse(fs.readFileSync(path.join('.hallmark', `v3-route-${name}-report.json`), 'utf8')));
for (const [index, report] of reports.entries()) {
  assert.equal(report.results.length, 39);
  assert(report.results.every(result => result.viewport === names[index]));
  assert.equal(report.failures.length, 0);
  assert.equal(report.consoleErrors.length, 0);
}
const result = {
  checkedAt: new Date().toISOString(),
  routeCount: 39,
  viewportCount: 7,
  failures: [],
  consoleErrors: [],
  results: reports.flatMap(report => report.results),
  runs: reports.map(report => report.checkedAt),
};
fs.writeFileSync('.hallmark/v3-route-report.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ checks: result.results.length, failures: 0, consoleErrors: 0, runs: result.runs }));
