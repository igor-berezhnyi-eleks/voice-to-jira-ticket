#!/usr/bin/env node
// SessionStart hook: adds the "Current" section of docs/status.md, the branch and the
// number of uncommitted files to Claude's context, so every session starts oriented.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const statusFile = join(root, 'docs', 'status.md');

function git(...args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
}

const lines = ['Project status (from docs/status.md, added by the SessionStart hook):'];

if (existsSync(statusFile)) {
  const text = readFileSync(statusFile, 'utf8');
  const match = text.match(/## Current\s*\n([\s\S]*?)(\n## |\s*$)/);
  lines.push(match ? match[1].trim() : '(no "## Current" section found)');
  const openGates = [...text.matchAll(/^\|\s*([^|]+?)\s*\|\s*(T[\d.]+)\s*\|\s*open\s*\|/gm)].map((m) => `${m[1]} (after ${m[2]})`);
  if (openGates.length) lines.push(`Open gates: ${openGates.join('; ')}`);
} else {
  lines.push('docs/status.md not found.');
}

const branch = git('branch', '--show-current');
const dirty = git('status', '--porcelain').split('\n').filter(Boolean).length;
lines.push(`Branch: ${branch || 'unknown'}; uncommitted files: ${dirty}`);

console.log(lines.join('\n'));
