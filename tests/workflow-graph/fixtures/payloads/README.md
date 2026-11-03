# Recorded hook payloads (specs/019)

The shared adapter contract suite (`HookDialect.contract.test.ts`) reads one subagent-launch payload per agent.

| File | Origin |
|---|---|
| `claude-code/launch.json` | Recorded from Claude Code 2.1.129 (`claude -p`, a `PreToolUse` hook on `Agent`) on 2026-11-03; paths replaced with `/Users/example/…` |
| `copilot-cli/launch.json` | The fields recorded from Copilot CLI 1.0.105 (`copilot -p`, a `preToolUse` hook on `task`) on 2026-11-03, re-typed from the run's printout; timestamp and cwd made up |
| `codex/launch.json` | Written from the Codex hooks documentation (`PreToolUse`, `spawn_agent`); not recorded yet: the prompt field name is unverified |
