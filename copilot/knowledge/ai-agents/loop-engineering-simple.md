# What Is Loop Engineering? (Simple Guide)

**In simple words:** Loop Engineering means an AI does a job again and again. It stops only when the job is correct.

## Why this matters to you

You use AI tools like Claude Code at work. These tools do not work in one step. They work in a loop. This guide helps you understand that loop.

## The idea, explained simply

Think about cooking soup.

1. You taste the soup.
2. The soup needs more salt.
3. You add salt.
4. You taste the soup again.
5. The soup is good now. You stop.

This is a loop. You do an action. You check the result. If it is not good, you try again. You stop only when it is good.

An AI agent works the same way.

## The 3 steps of a loop

1. **Action** — The AI does something. Example: it writes code.
2. **Check** — The AI looks at the result. Example: it runs a test.
3. **Decide** — Is the result correct?
   - **No** → Go back to step 1. Try again.
   - **Yes** → Stop. The job is done.

## A real example from work

This is what Claude Code does when it fixes a bug:

1. Claude writes new code.
2. Claude runs a test.
3. The test fails.
4. Claude reads the error message.
5. Claude changes the code.
6. Claude runs the test again.
7. The test passes now.
8. Claude stops. The job is done.

## Other tools that work this way

Many AI coding tools use this same loop:
- **Claude Code**
- **Codex** (by OpenAI)
- **GitHub Copilot Chat**

They all do the same 3 steps: Action → Check → Decide.

## Components — the two parts you build

A real loop has two parts. Each part does a different job.

### Part 1: Policy (rules for the AI to follow)

A policy is a text file. It tells the AI what steps to do. It also tells the AI when to stop and ask a person for help.

Example: a simple policy file for building a feature.

File: `.claude/skills/feature-implementation/SKILL.md`
```
1. Understand the task.
2. Plan the change.
3. Make the change.
4. Run the checks.
5. Checks fail 3 times in a row? Stop. Ask a person.
```

A policy is only rules on a page. The AI can still forget them, or skip a step under pressure. That is why we need Part 2.

### Part 2: Mechanical check (a hook)

A "hook" is a small program. It runs by itself. It checks the AI's work.

Example: after Claude changes code, a hook can run a test. The hook does this every time. No person needs to click "run test."

**In one line: the policy tells the AI what to do. The hook makes sure it is true.**

### When to use a hook

Use a hook when:
- The check is easy for a computer. Example: "Do the tests pass?"
- You want the check to run every time. No person should forget it.
- Bad AI code could cause a real problem (a broken app, wrong data).

Do not use a hook when:
- You are watching the AI work right now. You can check it yourself.
- The task is small. You will look at the result anyway.
- The check needs a person's judgment. Example: "Does this look nice?" A hook cannot judge that.

### A simple example

This hook is real. It is used in this company's projects. It runs after Claude changes a file. It checks the code.

File: `.claude/settings.json`
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "yarn type-check && yarn lint"
          }
        ]
      }
    ]
  }
}
```

What this does, step by step:
1. Claude changes a file.
2. The hook runs right after.
3. The hook runs two checks: `type-check` and `lint`.
4. If a check fails, Claude sees the error. Claude must fix it.
5. Claude cannot say "it is done" until the checks pass.

## Words to know

- **Loop** — doing the same steps again and again.
- **Stop condition** — the rule that tells the AI "you are done now." Example: "all tests pass."
- **Check / Verify** — looking at the result to see if it is correct.
- **Agent** — the AI that works on its own, in steps, without a person doing every step.
- **Policy** — a text file with rules the AI should follow, including when to stop and ask a person.
- **Hook** — a small program that runs by itself and checks the AI's work.

## Want to know more?

This guide is short and simple on purpose. For the full, detailed version, ask for:
- `{{AGENT_HOME}}/knowledge/ai-agents/loop-engineering.md` — the full explanation.
- `{{AGENT_HOME}}/knowledge/ai-agents/loop-engineering-playbook.md` — how to build one yourself.

## References

**Local artifacts:**
- `{{AGENT_HOME}}/knowledge/ai-agents/loop-engineering.md` — full technical version this guide simplifies.
- `{{AGENT_HOME}}/knowledge/documentation/doc-template-base.md` — the template this document follows (structure, English level, writing rules).

**External authoritative sources:**
- Same sources as the full version — see `loop-engineering.md`'s References section.

## Related

- `{{AGENT_HOME}}/knowledge/ai-agents/loop-engineering.md` — full version, for readers who want more detail.
- `{{AGENT_HOME}}/knowledge/ai-agents/loop-engineering-playbook.md` — how to actually build a loop for a task.
