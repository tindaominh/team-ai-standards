#!/usr/bin/env node
// Pull-request check: changes to configuration schema, package.json scripts or
// CI workflows must come with a documentation change, unless the PR carries the
// "docs-not-needed" label added by someone other than the PR author.
//
// Environment (set by .github/workflows/docs-check.yml):
//   BASE_SHA, HEAD_SHA, PR_NUMBER, PR_AUTHOR, REPO, HAS_BYPASS_LABEL, GH_TOKEN
// Uses only git and the GitHub CLI that is preinstalled on GitHub runners.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const env = process.env;
const LABEL = 'docs-not-needed';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const summary = (line) => {
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${line}\n`);
  console.log(line);
};

const TRIGGERS = [
  { why: 'environment/config schema', test: (f) => /^config\/(env\.schema\.json|env\.example)$/.test(f) || f.startsWith('src/config/') },
  { why: 'CI workflow', test: (f) => f.startsWith('.github/workflows/') }
];
const DOCS = (f) => f.startsWith('docs/') || f === 'README.md' || f === 'CLAUDE.md';

const changed = git('diff', '--name-only', `${env.BASE_SHA}...${env.HEAD_SHA}`).split('\n').filter(Boolean);

const reasons = [];
for (const t of TRIGGERS) {
  const hits = changed.filter(t.test);
  if (hits.length) reasons.push(`${t.why}: ${hits.join(', ')}`);
}
if (changed.includes('package.json')) {
  const scripts = (sha) => {
    try { return JSON.stringify(JSON.parse(git('show', `${sha}:package.json`)).scripts || {}); } catch { return '{}'; }
  };
  if (scripts(env.BASE_SHA) !== scripts(env.HEAD_SHA)) reasons.push('package.json scripts changed');
}

if (!reasons.length) {
  summary('Docs check: no documentation-relevant changes.');
  process.exit(0);
}
if (changed.some(DOCS)) {
  summary(`Docs check: documentation updated together with: ${reasons.join('; ')}.`);
  process.exit(0);
}

if (env.HAS_BYPASS_LABEL === 'true') {
  // The label counts only if it was added by someone other than the PR author.
  const events = JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp',
    `repos/${env.REPO}/issues/${env.PR_NUMBER}/events`], { encoding: 'utf8' })).flat();
  const last = events.filter((e) => e.event === 'labeled' && e.label && e.label.name === LABEL).pop();
  const by = last && last.actor ? last.actor.login : '';
  if (by && by !== env.PR_AUTHOR) {
    summary(`Docs check: bypassed with "${LABEL}" added by @${by}. Reviewers must confirm no docs change is needed for: ${reasons.join('; ')}.`);
    process.exit(0);
  }
  console.error(`::error::The "${LABEL}" label must be added by a reviewer, not by the PR author.`);
  process.exit(1);
}

console.error(`::error::This PR changes ${reasons.join('; ')} but no documentation (docs/, README.md or CLAUDE.md). Update the docs, or ask a reviewer to add the "${LABEL}" label if no docs change is needed.`);
process.exit(1);
