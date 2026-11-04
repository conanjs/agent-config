// How the workflow-graph tool runs in a scenario (specs/019). It runs the TypeScript entry with Node's type
// stripping, against copies of the real graph files in the scenario folder. "Now" is pinned to 2026-11-03T09:00:00Z.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Given } from '@cucumber/cucumber';
import { registerTool, repo } from '../support/tools.mjs';

const framework = 'copilot/frameworks/agentic-sdlc';
const schema = `${framework}/schemas/workflow-graph.schema.md`;

registerTool('workflow-graph', {
  fixture: 'tests/workflow-graph/fixtures/base',
  run: (world, extra) => ({
    file: process.execPath,
    args: [path.join(repo, framework, 'tools/workflow-graph/src/main.ts'), ...extra],
    env: {
      TZ: 'UTC',
      WORKFLOW_GRAPH_NOW: '2026-11-03T09:00:00.000Z',
      WORKFLOW_GRAPH_FRAMEWORK: world.at('framework'),
      COPILOT_HOME: world.at('copilot-home'),
      AGENTIC_SDLC_GUARD: world.guardOff ? 'off' : '',
      // The runner's agents are scripted when the scenario wrote replies.json (FakeHeadlessLauncher, specs/020).
      WORKFLOW_GRAPH_FAKE_REPLIES: fs.existsSync(world.at('replies.json')) ? world.at('replies.json') : '',
    },
  }),
  // No controlling terminal: `run approve` must find none, even when the tests run from a person's terminal.
  detached: true,
  header: /^workflow-graph /,
  quietPass: 'PASS (0 warning(s))',
  codes: () => [...fs.readFileSync(path.join(repo, schema), 'utf8').matchAll(/^\| (WG-\d+) \|/gm)].map((m) => m[1]),
  rules: `${framework}/schemas`,
});

// The graph source, its compiled JSON and conventions.md, copied so a scenario can break them without touching the repo.
Given('the real workflow graph is copied to {string}', function (to) {
  fs.mkdirSync(this.at(to), { recursive: true });
  for (const f of ['workflow.graph.yaml', 'workflow.graph.json', 'conventions.md']) {
    fs.copyFileSync(path.join(repo, framework, f), this.at(`${to}/${f}`));
  }
});

// The tool's interface catalog without its code (specs/021), so a scenario can plant a fault in a copy.
Given('the tool\'s interface catalog is copied to {string}', function (to) {
  const tool = path.join(repo, framework, 'tools/workflow-graph');
  fs.mkdirSync(this.at(to), { recursive: true });
  for (const f of ['INTERFACES.md', 'catalog-info.yaml', 'package.json', 'interfaces']) {
    fs.cpSync(path.join(tool, f), this.at(`${to}/${f}`), { recursive: true });
  }
});

Given('the guard is switched off', function () {
  this.guardOff = true;
});

// The happy path of a new-feature run, driven through the tool itself (record and the approval hook), so every
// ledger a scenario starts from is written and hash-chained by the code under test. Approvals are typed in a
// Claude Code session whose transcript is claude/session.jsonl. Milestones name the state reached after a step.
const toolFile = path.join(repo, framework, 'tools/workflow-graph/src/main.ts');
const happyPath = [
  ['record', '--node P0 --result new-feature --feature specs/023-cart'],
  ['record', '--node P1 --result done', 'G0 open'],
  ['approve', 'G0'],
  ['record', '--node P3 --result done', 'G2 open'],
  ['approve', 'G2', 'P4 open'],
  ['record', '--node P4 --result done'],
  ['approve', 'G3'],
  ['record', '--node P5 --result done'],
  ['approve', 'G4', 'P6 open'],
  ['task', 'T001'],
  ['task', 'T002', 'all tasks passed'],
  ['record', '--node P6 --result done'],
  ['record', '--node P7 --result done', 'G5 open'],
];

function tool(world, args, input) {
  const env = { ...process.env, TZ: 'UTC', WORKFLOW_GRAPH_NOW: '2026-11-03T09:00:00.000Z', WORKFLOW_GRAPH_FRAMEWORK: world.at('framework'), COPILOT_HOME: world.at('copilot-home'), AGENTIC_SDLC_GUARD: '' };
  return execFileSync(process.execPath, [toolFile, ...args], { encoding: 'utf8', env, input: input ?? '' });
}

/** Records one step of a run in the scenario's project. */
function record(world, run, flags) {
  tool(world, ['record', run, ...flags.split(' '), '--project', world.at('project')]);
}

/** Types an approval in the Claude Code session: the transcript gets the message, then the approval hook runs. */
function approve(world, run, gate, word = 'approve') {
  const prompt = `${word} ${gate} ${run}`;
  const transcript = world.at('claude/session.jsonl');
  fs.mkdirSync(path.dirname(transcript), { recursive: true });
  fs.appendFileSync(transcript, `${JSON.stringify({ type: 'user', message: { role: 'user', content: prompt } })}\n`);
  tool(world, ['hook', 'approve', '--agent', 'claude-code'], JSON.stringify({ session_id: 's1', transcript_path: transcript, cwd: world.at('project'), hook_event_name: 'UserPromptSubmit', prompt }));
}

Given('run {string} has reached {string}', function (run, milestone) {
  for (const [kind, arg, reached] of happyPath) {
    if (kind === 'record') record(this, run, arg);
    else if (kind === 'approve') approve(this, run, arg);
    else for (const [node, result] of [['P6.execute', 'done'], ['P6.checks', 'pass'], ['P6.review', 'pass']]) record(this, run, `--node ${node} --result ${result} --task ${arg}`);
    if (reached === milestone) return;
  }
  throw new Error(`no milestone "${milestone}"`);
});

Given('in run {string}, task {string} fails its checks {int} time(s)', function (run, task, n) {
  for (let i = 0; i < n; i += 1) {
    record(this, run, `--node P6.execute --result done --task ${task}`);
    record(this, run, `--node P6.checks --result fail --task ${task}`);
  }
});

Given('in run {string}, task {string} passes', function (run, task) {
  for (const [node, result] of [['P6.execute', 'done'], ['P6.checks', 'pass'], ['P6.review', 'pass']]) record(this, run, `--node ${node} --result ${result} --task ${task}`);
});

Given('{string} is typed for run {string}', function (word, run) {
  const [verb, gate] = word.split(' ');
  approve(this, run, gate, verb);
});
