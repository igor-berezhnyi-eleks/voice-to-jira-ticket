#!/usr/bin/env node
// PreToolUse hook for Edit|Write|MultiEdit|NotebookEdit.
// Blocks edits to files the agent must not change directly. Exit 2 + stderr = blocked, reason shown to Claude.
// Note: this guards Claude's file tools only. A shell command can still write these files;
// CLAUDE.md tells the agent not to work around a block.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
if (!target) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const rel = relative(root, isAbsolute(target) ? target : resolve(root, target)).split(sep).join('/');
if (rel.startsWith('..')) process.exit(0); // outside the project: not this hook's concern
const path = rel.toLowerCase();

function tagExists(tag) {
  const r = spawnSync('git', ['tag', '--list', tag], { cwd: root, encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() === tag;
}

const rules = [
  {
    applies: () => path === 'web/src/contract.ts' || path === 'contract/ticket.schema.json',
    reason:
      'This file is generated. Change the C# records in src/VoiceToTicket.Api/Features/Tickets/Contract/, ' +
      'refresh the snapshot through its test (see the task file), then run `npm run gen:contract` in web/.',
  },
  {
    applies: () => path === 'web/src/jiraContract.ts' || path === 'contract/jira.schema.json',
    reason:
      'This file is generated. Change the C# records in src/VoiceToTicket.Api/Features/Jira/Contract/, ' +
      'refresh the snapshot through its test (JiraSchemaTests, UPDATE_SNAPSHOTS=1), then run `npm run gen:contract` in web/.',
  },
  {
    applies: () => path.startsWith('eval/scenarios/') && tagExists('eval-scenarios-v1'),
    reason:
      'Evaluation scenarios are frozen (tag eval-scenarios-v1). Changing them would invalidate the evaluation. ' +
      'Ask the human; a change needs a new scenario version and a note in the report.',
  },
  {
    applies: () => path === 'docs/development-plan.md' || path === 'docs/progress.md',
    reason: 'This is the earlier plan, kept for reference only. Record progress in docs/status.md instead.',
  },
  {
    applies: () =>
      (/(^|\/)\.env(\.[^/]*)?$/.test(path) && !path.endsWith('.env.example')) || path.endsWith('secrets.json'),
    reason: 'Secret files are never edited by the agent. Ask the human to set the value.',
  },
];

const hit = rules.find((r) => r.applies());
if (!hit) process.exit(0);

console.error(`Blocked edit to ${rel}: ${hit.reason}`);
process.exit(2);
