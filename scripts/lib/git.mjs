// Git state checks for adopt.mjs and sync-standard.mjs. Read-only: never runs a git command that writes.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const git = (dir, ...args) => {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
};

// Returns a list of problems (empty when the repository may be modified), each
// with the exact commands that fix it.
export function gitProblems(dir) {
  if (git(dir, 'rev-parse', '--is-inside-work-tree') !== 'true') {
    return [{
      what: 'this directory is not a git repository, so the changes could not be undone with git',
      fix: ['git init', 'git add -A', 'git commit -m "chore: before team AI standard"', 'git switch -c chore/adopt-ai-standard']
    }];
  }
  const problems = [];
  const status = git(dir, 'status', '--porcelain', '--untracked-files=all');
  if (status) {
    problems.push({
      what: `the working tree is not clean (${status.split('\n').length} changed or untracked file(s))`,
      fix: ['git status', 'git add -A && git commit -m "<message>"   # or: git stash push -u']
    });
  }
  const branch = git(dir, 'symbolic-ref', '--quiet', '--short', 'HEAD');
  const remoteHead = git(dir, 'symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD');
  const defaults = new Set(remoteHead ? [remoteHead.replace(/^origin\//, '')] : ['main', 'master', git(dir, 'config', 'init.defaultBranch')].filter(Boolean));
  if (!branch) {
    problems.push({ what: 'HEAD is detached', fix: ['git switch -c chore/adopt-ai-standard'] });
  } else if (defaults.has(branch)) {
    problems.push({ what: `the current branch "${branch}" is the default branch`, fix: ['git switch -c chore/adopt-ai-standard'] });
  }
  return problems;
}

// The standard checkout that adopt.mjs and sync-standard.mjs run from must be a
// released version: a git checkout with a clean working tree whose HEAD carries the
// tag v<version>, and package.json matching templates/.claude/STANDARD_VERSION.
// Returns { state, version, problems: [{ what, fix }] }; problems is empty when it is.
export function standardRelease(root) {
  const read = (p) => {
    try {
      return readFileSync(join(root, p), 'utf8');
    } catch {
      return null;
    }
  };
  const pkgText = read('package.json');
  const version = pkgText ? JSON.parse(pkgText).version : null;
  const stdVersion = (read('templates/.claude/STANDARD_VERSION') || '').trim() || null;
  const tag = `v${version || stdVersion}`;
  const g = (...args) => ['git', '-C', root, ...args].join(' ');
  if (git(root, 'rev-parse', '--is-inside-work-tree') !== 'true') {
    return {
      state: 'not a git checkout',
      version,
      problems: [{
        what: `the standard at ${root} is not a git checkout, so its release cannot be verified`,
        fix: [`git clone --branch ${tag} <standard-repository-url> team-ai-standards`, 'then run the script from that checkout']
      }]
    };
  }
  const problems = [];
  const status = git(root, 'status', '--porcelain', '--untracked-files=all');
  if (status) {
    problems.push({
      what: `the standard checkout has ${status.split('\n').length} changed or untracked file(s)`,
      fix: [g('status'), `${g('stash', 'push', '-u')}   # or commit them on a branch of the standard`]
    });
  }
  if (version !== stdVersion) {
    problems.push({
      what: `package.json (${version}) and templates/.claude/STANDARD_VERSION (${stdVersion}) disagree`,
      fix: [g('fetch', '--tags'), `${g('switch', '--detach', '<latest release tag>')}   # see: ${g('tag', '--list', "'v*'", '--sort=-v:refname')}`]
    });
  }
  const tags = (git(root, 'tag', '--points-at', 'HEAD') || '').split('\n').filter(Boolean);
  if (!tags.includes(tag)) {
    const latest = (git(root, 'tag', '--list', 'v*', '--sort=-v:refname') || '').split('\n').filter(Boolean)[0];
    problems.push({
      what: tags.length
        ? `HEAD is tagged ${tags.join(', ')}, not ${tag} (the version in package.json)`
        : `HEAD is not a release: no tag ${tag} on it`,
      fix: [g('fetch', '--tags'), g('switch', '--detach', latest || '<latest release tag>')]
    });
  }
  return { state: git(root, 'describe', '--tags', '--always', '--dirty') || 'unknown', version, problems };
}
