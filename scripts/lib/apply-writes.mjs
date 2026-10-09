// Applies adopt.mjs's planned writes all or nothing. Every new content is first
// written to a staging folder inside the target (so each move is a rename on the same
// filesystem), then moved into place; an existing file is moved aside first. On any
// error every move is undone in reverse order and created folders are removed again.
//
//   writes   [{ path, action: create | modify | delete | propose, after }]
// Returns { ok: true } or { ok: false, failedPath, error, restoreFailures: [{ path, backup }] }.
// restoreFailures is empty when the target is exactly as before; otherwise the staging
// folder is kept, because it holds the originals (backup) that could not be moved back.
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function applyWrites(target, writes) {
  let staging;
  try {
    staging = mkdtempSync(join(target, '.std-adopt-'));
    mkdirSync(join(staging, 'backup'));
    writes.forEach((w, i) => {
      if (w.action !== 'delete') writeFileSync(join(staging, String(i)), w.after);
    });
  } catch (error) {
    if (staging) rmSync(staging, { recursive: true, force: true });
    return { ok: false, failedPath: staging || target, error, restoreFailures: [] };
  }

  const journal = [];
  let failedPath = null;
  try {
    writes.forEach((w, i) => {
      failedPath = w.path;
      const dest = join(target, w.path);
      const entry = { path: w.path, dest, backup: null, placed: false, createdDir: null };
      journal.push(entry);
      if (existsSync(dest)) {
        const backup = join(staging, 'backup', String(i));
        renameSync(dest, backup);
        entry.backup = backup;
      }
      if (w.action === 'delete') return;
      entry.createdDir = mkdirSync(dirname(dest), { recursive: true }) || null;
      renameSync(join(staging, String(i)), dest);
      entry.placed = true;
    });
  } catch (error) {
    const restoreFailures = [];
    for (const e of [...journal].reverse()) {
      try {
        if (e.placed) rmSync(e.dest, { force: true });
        if (e.backup) renameSync(e.backup, e.dest);
      } catch {
        restoreFailures.push({ path: e.path, backup: e.backup });
      }
      if (e.createdDir) removeEmptyDirs(dirname(e.dest), e.createdDir);
    }
    if (!restoreFailures.length) rmSync(staging, { recursive: true, force: true });
    return { ok: false, failedPath, error, restoreFailures };
  }
  rmSync(staging, { recursive: true, force: true });
  return { ok: true };
}

// Removes `dir` and its parents up to and including `top`, while they are empty.
function removeEmptyDirs(dir, top) {
  for (let d = dir; d.length >= top.length; d = dirname(d)) {
    try {
      rmdirSync(d);
    } catch {
      return;
    }
    if (d === top) return;
  }
}
