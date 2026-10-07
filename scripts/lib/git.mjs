// Git state checks for adopt.mjs. Read-only: never runs a git command that writes.
import { spawnSync } from 'node:child_process';

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
