#!/usr/bin/env node
// Quality checks for the areas that have uncommitted changes.
//
//   node scripts/check.mjs          check changed areas, print results, exit 1 on failure
//   node scripts/check.mjs --all    check every area that exists
//   node scripts/check.mjs --hook   Claude Code Stop hook mode (reads hook JSON on stdin):
//                                   exit 2 + reason on stderr blocks the stop so Claude fixes it.
//
// Areas:
//   dotnet  any change under src/, tests/, or to *.slnx / Directory.Build.props / global.json
//           -> dotnet build, dotnet test (opt-in categories excluded)
//   web     any change under web/ -> the npm scripts build, test, lint that exist in web/package.json
//
// A green result is remembered by a hash of the changed files, so repeated stops without new
// edits do not re-run the checks.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const hookMode = args.has('--hook');
const all = args.has('--all');
const cacheFile = join(root, '.claude', '.cache', 'check-green.json');
const OPT_IN_FILTER = 'Category!=Stt&Category!=Live&Category!=Evaluation';
const TAIL_LINES = 80;

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function changedFiles() {
  const r = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) return [];
  return r.stdout
    .split('\n')
    .filter((line) => line.length > 3)
    .map((line) => line.slice(3).trim())
    .map((p) => (p.includes(' -> ') ? p.split(' -> ')[1] : p))
    .map((p) => p.replace(/^"|"$/g, ''))
    .filter((p) => !p.startsWith('.claude/.cache/')); // our own cache must not change the fingerprint
}

function hasSolution() {
  return readdirSync(root).some((f) => f.endsWith('.slnx') || f.endsWith('.sln'));
}

function isDotnetPath(p) {
  return (
    p.startsWith('src/') ||
    p.startsWith('tests/') ||
    p.endsWith('.slnx') ||
    p.endsWith('.sln') ||
    p === 'Directory.Build.props' ||
    p === 'global.json'
  );
}

function webScripts() {
  const pkg = join(root, 'web', 'package.json');
  if (!existsSync(pkg)) return null;
  const scripts = JSON.parse(readFileSync(pkg, 'utf8')).scripts ?? {};
  return ['build', 'test', 'lint'].filter((s) => s in scripts);
}

function plan(files) {
  const steps = [];
  const dotnet = all ? hasSolution() : hasSolution() && files.some(isDotnetPath);
  const web = all ? webScripts() !== null : webScripts() !== null && files.some((p) => p.startsWith('web/'));

  if (dotnet) {
    steps.push({ name: 'dotnet build', cmd: 'dotnet build --nologo -v quiet', cwd: root });
    steps.push({ name: 'dotnet test', cmd: `dotnet test --no-build --nologo --filter "${OPT_IN_FILTER}"`, cwd: root });
  }
  if (web) {
    const webDir = join(root, 'web');
    if (!existsSync(join(webDir, 'node_modules'))) {
      steps.push({ name: 'web dependencies', missing: 'web/node_modules is missing: run `npm ci` in web/' });
    } else {
      for (const s of webScripts()) {
        steps.push({ name: `npm run ${s}`, cmd: s === 'test' ? 'npm test' : `npm run ${s}`, cwd: webDir });
      }
    }
  }
  return steps;
}

function fingerprint(files) {
  const h = createHash('sha256');
  for (const f of [...files].sort()) {
    h.update(f);
    const full = join(root, f);
    if (existsSync(full) && statSync(full).isFile()) h.update(readFileSync(full));
  }
  return h.digest('hex');
}

function lastGreen() {
  try {
    return JSON.parse(readFileSync(cacheFile, 'utf8')).hash;
  } catch {
    return null;
  }
}

function rememberGreen(hash) {
  mkdirSync(dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, JSON.stringify({ hash, at: new Date().toISOString() }));
}

function tail(text, n) {
  const lines = text.trimEnd().split(/\r?\n/);
  return lines.slice(-n).join('\n');
}

function runSteps(steps) {
  for (const step of steps) {
    if (step.missing) return { ok: false, step, output: step.missing };
    const started = Date.now();
    const r = spawnSync(step.cmd, { cwd: step.cwd, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    if (!hookMode) console.log(`${r.status === 0 ? 'PASS' : 'FAIL'}  ${step.name}  (${seconds}s)`);
    if (r.status !== 0) return { ok: false, step, output };
  }
  return { ok: true };
}

const hookInput = hookMode ? JSON.parse(readStdin() || '{}') : {};
const files = changedFiles();
const steps = plan(files);

if (steps.length === 0) {
  if (!hookMode) console.log('Nothing to check (no changes in dotnet or web areas, or projects do not exist yet).');
  process.exit(0);
}

const hash = fingerprint(files);
if (hookMode && !all && hash === lastGreen()) process.exit(0);

const result = runSteps(steps);
if (result.ok) {
  rememberGreen(hash);
  if (!hookMode) console.log('All checks passed.');
  process.exit(0);
}

const report = `Quality gate failed at "${result.step.name}"${result.step.cmd ? ` (${result.step.cmd})` : ''}.\nLast ${TAIL_LINES} lines:\n${tail(result.output, TAIL_LINES)}`;

if (!hookMode) {
  console.error(report);
  process.exit(1);
}

if (hookInput.stop_hook_active) {
  // Claude was already told once in this stop sequence; do not loop. Tell the human instead.
  console.log(JSON.stringify({ systemMessage: `Quality gate still failing: ${result.step.name}. Run \`node scripts/check.mjs\` to see the output.` }));
  process.exit(0);
}

console.error(`${report}\n\nFix the failure before finishing, or if it cannot be fixed in this task, say so explicitly in your reply and the task log.`);
process.exit(2);
