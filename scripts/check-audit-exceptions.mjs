#!/usr/bin/env node
// Runs `npm audit --json` and compares the advisories with audit-exceptions.json.
// Fails if an advisory is not listed, or if an accepted exception is past its
// review date. Needs network access (npm registry); runs in CI.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const today = process.env.AUDIT_TODAY || new Date().toISOString().slice(0, 10);
const { exceptions } = JSON.parse(readFileSync(new URL('../audit-exceptions.json', import.meta.url), 'utf8'));
const accepted = new Map(exceptions.map((e) => [e.advisory, e]));

let report;
try {
  report = execFileSync('npm', ['audit', '--json'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (err) {
  report = err.stdout; // npm audit exits non-zero when it finds advisories
}
const audit = JSON.parse(report);
if (audit.error) {
  console.error(`npm audit failed: ${audit.error.summary || JSON.stringify(audit.error)}`);
  process.exit(1);
}

const found = new Set();
for (const v of Object.values(audit.vulnerabilities || {})) {
  for (const via of v.via || []) {
    if (typeof via === 'object' && via.url) found.add(via.url.split('/').pop());
  }
}

const problems = [];
for (const id of found) {
  const e = accepted.get(id);
  if (!e) problems.push(`not accepted: ${id}`);
  else if (e.reviewBy < today) problems.push(`review overdue since ${e.reviewBy}: ${id} (${e.package})`);
  else console.log(`accepted until ${e.reviewBy}: ${id} (${e.package}, ${e.severity})`);
}
for (const id of accepted.keys()) {
  if (!found.has(id)) console.log(`no longer reported, remove from audit-exceptions.json: ${id}`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error('Fix the dependency, or record a reviewed exception in audit-exceptions.json.');
  process.exit(1);
}
console.log(`PASS: ${found.size} advisory(ies), all accepted and within review date.`);
