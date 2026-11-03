Feature: The agentic-sdlc workflow is an enforced graph (specs/019)

  `copilot/frameworks/agentic-sdlc/tools/workflow-graph` checks the workflow graph (`workflow.graph.yaml`, its
  generated JSON and the generated tables in `conventions.md`), keeps each run's ledger, and answers the guard and
  approval hooks of Claude Code, Copilot CLI and Codex (WG-1 … WG-30 in `schemas/workflow-graph.schema.md`).
  Every scenario works on a copy of the real graph in `framework/` and a project folder in `project/`.
  "Now" is 2026-11-03T09:00:00Z.

  Background:
    Given the base fixture tree of "workflow-graph"
    And the real workflow graph is copied to "framework"

  # ---- the graph (US1) ----------------------------------------------------------------------------------

  Scenario: WG-1 WG-2 WG-3 WG-4 WG-5 WG-6 WG-7 WG-8 WG-9 WG-10 WG-11 WG-12 WG-13 WG-14 the real graph passes every graph rule
    When the tool runs with "check-graph"
    Then it passes with no warnings

  Scenario: WG-1 a graph without its start node is rejected
    Given in "framework/workflow.graph.yaml", `start: P0` becomes ``
    When the tool runs with "check-graph"
    Then it exits with 1
    And the output has the line "  WG-1  workflow.graph.yaml: missing \"start\""

  Scenario: WG-2 a node of an unknown kind is rejected
    Given in "framework/workflow.graph.yaml", `G3: { kind: gate }` becomes `G3: { kind: gateway }`
    When the tool runs with "check-graph"
    Then it exits with 1
    And the output has the line "  WG-2  workflow.graph.yaml: node \"G3\": kind \"gateway\" is not phase, gate, step or end"

  Scenario: WG-3 an edge to a node that does not exist is rejected
    Given in "framework/workflow.graph.yaml", `{ from: P1, to: G0, on: done }` becomes `{ from: P1, to: G9, on: done }`
    When the tool runs with "check-graph"
    Then it exits with 1
    And the output has the line "  WG-3  workflow.graph.yaml: edge P1 → G9: \"G9\" is not a node"

  Scenario: WG-4 a node no walk from the start reaches is rejected
    Given in "framework/workflow.graph.yaml", `  done: { kind: end }` becomes `  done: { kind: end }\n  orphan: { kind: end }`
    When the tool runs with "check-graph"
    Then it exits with 1
    And the output has the line "  WG-4  workflow.graph.yaml: node \"orphan\" cannot be reached from P0"

  Scenario: WG-5 a node that never reaches an end is rejected
    Given in "framework/workflow.graph.yaml", `  done: { kind: end }` becomes `  done: { kind: end }\n  stuck: { kind: phase, owner: [] }`
    And in "framework/workflow.graph.yaml", `  - { from: P0, to: escalate, on: otherwise }` becomes `  - { from: P0, to: escalate, on: otherwise }\n  - { from: P0, to: stuck, on: stuck }`
    When the tool runs with "check-graph"
    Then it exits with 1
    And the output has the line "  WG-5  workflow.graph.yaml: node \"stuck\" never reaches an end node"

  Scenario: WG-6 a branching node without an otherwise edge is rejected
    Given in "framework/workflow.graph.yaml", `  - { from: G2, to: escalate, on: otherwise }` becomes ``
    When the tool runs with "check-graph"
    Then it exits with 1
    And the output has the line "  WG-6  workflow.graph.yaml: node \"G2\" branches but has no \"otherwise\" edge"

  Scenario: WG-7 a gate that cannot be sent back is rejected
    Given in "framework/workflow.graph.yaml", `{ from: G2, to: P3, on: changes-requested }` becomes `{ from: G2, to: P3, on: sent-back }`
    When the tool runs with "check-graph"
    Then it exits with 1
    And the output has the line "  WG-7  workflow.graph.yaml: gate \"G2\" has no \"changes-requested\" edge"

  Scenario: WG-7 two approved edges of one gate may not serve the same path
    Given in "framework/workflow.graph.yaml", `paths: [multi-service, new-feature] }` becomes `paths: [multi-service, new-project] }`
    When the tool runs with "check-graph"
    Then it exits with 1
    And the output has the line "  WG-7  workflow.graph.yaml: gate \"G0\": approved edges overlap on path \"new-project\""

  Scenario: WG-8 an owner that is not a role is rejected
    Given in "framework/workflow.graph.yaml", `owner: [product-spec]` becomes `owner: [product-x]`
    When the tool runs with "check-graph"
    Then it exits with 1
    And the output has the line "  WG-8  workflow.graph.yaml: node \"P3\": owner \"product-x\" is not a role in conventions.md §1"

  Scenario: WG-9 a phase whose gate is not a gate node is rejected
    Given in "framework/workflow.graph.yaml", `gate: G2` becomes `gate: G9`
    When the tool runs with "check-graph"
    Then it exits with 1
    And the output has the line "  WG-9  workflow.graph.yaml: phase \"P3\": gate \"G9\" is not a gate node"

  Scenario: WG-10 an edge budget that is not defined is rejected
    Given in "framework/workflow.graph.yaml", `on: fail, budget: re-execute-after-check }` becomes `on: fail, budget: re-run }`
    When the tool runs with "check-graph"
    Then it exits with 1
    And the output has the line "  WG-10  workflow.graph.yaml: edge P6.checks → P6.execute: budget \"re-run\" is not in budgets"

  Scenario: WG-10 a budget that is not a whole number is rejected
    Given in "framework/workflow.graph.yaml", `{ default: 2, loop: "Re-execute after failed script check"` becomes `{ default: 2.5, loop: "Re-execute after failed script check"`
    When the tool runs with "check-graph"
    Then it exits with 1
    And the output has the line "  WG-10  workflow.graph.yaml: budget \"re-execute-after-check\": default 2.5 is not a whole number ≥ 0"

  Scenario: WG-11 a loop that passes no gate needs a budget
    Given in "framework/workflow.graph.yaml", `on: fail, budget: re-execute-after-check }` becomes `on: fail }`
    When the tool runs with "check-graph"
    Then it exits with 1
    And the output has the line "  WG-11  workflow.graph.yaml: edge P6.checks → P6.execute closes a loop with no gate and has no budget"

  Scenario: WG-12 a path whose phases do not follow each other is rejected
    Given in "framework/workflow.graph.yaml", `run: [P1, P3, P4, P5, P6, P7] }` becomes `run: [P1, P4, P3, P5, P6, P7] }`
    When the tool runs with "check-graph"
    Then it exits with 1
    And the output has the line "  WG-12  workflow.graph.yaml: path \"new-feature\": P4 does not follow P1"

  Scenario: WG-13 a JSON file that differs from the YAML is out of date
    Given in "framework/workflow.graph.json", `"version": "2.0.0"` becomes `"version": "1.9.0"`
    When the tool runs with "check-graph"
    Then it exits with 1 and prints:
      """
        WG-13  workflow.graph.json: out of date; run compile-graph
      FAIL (1)
      """

  Scenario: WG-14 a generated conventions table edited by hand is out of date
    Given in "framework/conventions.md", `| P3 Specify | Every feature` becomes `| P3 Specify | Some features`
    When the tool runs with "check-graph"
    Then it exits with 1 and prints:
      """
        WG-14  conventions.md: the generated block "phases" is out of date; run compile-graph
      FAIL (1)
      """

  Scenario: WG-13 WG-14 compile-graph regenerates the JSON and the tables from the YAML
    Given in "framework/workflow.graph.yaml", `{ default: 2, loop: "Re-execute after failed script check"` becomes `{ default: 3, loop: "Re-execute after failed script check"`
    When the tool runs with "compile-graph"
    And the tool runs with "check-graph"
    Then it passes with no warnings
    And the file "framework/conventions.md" has the line "| Re-execute after failed script check | 3 | Escalate with failing output |"

  # ---- the run ledger (US2) ----------------------------------------------------------------------------
  # "run … has reached …" drives the tool itself through the happy path of a new-feature run (tool.mjs):
  # record P0 new-feature (feature specs/023-cart, tasks T001 and T002), P1 done, approve G0, P3 done, approve G2,
  # P4 done, approve G3, P5 done, approve G4, then each task through execute, checks and review.

  Scenario: WG-23 status says where a run stands and how to approve its open gate
    Given run "R-001" has reached "G2 open"
    When the tool runs with "status R-001 --project {root}/project"
    Then it exits with 0 and prints:
      """
      Run R-001 · path new-feature · feature specs/023-cart
      Last: P3 done at 2026-11-03T09:00:00.000Z
      Open gate: G2; reply "approve G2 R-001" to approve, or "changes G2 R-001" to send it back
      Next allowed: G2
      """

  Scenario: WG-23 status in P6 shows each task's next step and the retries it has left
    Given run "R-001" has reached "P6 open"
    And in run "R-001", task "T001" fails its checks 1 time
    When the tool runs with "status R-001 --project {root}/project"
    Then it exits with 0 and prints:
      """
      Run R-001 · path new-feature · feature specs/023-cart
      Last: P6.checks fail (T001) at 2026-11-03T09:00:00.000Z
      Next allowed: P6
      Tasks:
        T001 · attempt 1 · next P6.execute · re-execute-after-check 2 left
      """

  Scenario: WG-23 status without a run id lists every open run
    Given run "R-001" has reached "G2 open"
    And run "R-002" has reached "G0 open"
    When the tool runs with "status --project {root}/project"
    Then it exits with 0 and prints:
      """
      Run R-001 · path new-feature · feature specs/023-cart
      Last: P3 done at 2026-11-03T09:00:00.000Z
      Open gate: G2; reply "approve G2 R-001" to approve, or "changes G2 R-001" to send it back
      Next allowed: G2

      Run R-002 · path new-feature · feature specs/023-cart
      Last: P1 done at 2026-11-03T09:00:00.000Z
      Open gate: G0; reply "approve G0 R-002" to approve, or "changes G0 R-002" to send it back
      Next allowed: G0
      """

  Scenario: WG-17 a run starts with P0 and a path
    When the tool runs with "record R-001 --node P1 --result done --project {root}/project"
    Then it exits with 1 and prints:
      """
        WG-17  R-001: a run starts with P0 and a path as its result (got P1 done)
      FAIL (1)
      """

  Scenario: WG-17 record refuses a move the graph does not allow
    Given the tool runs with "record R-001 --node P0 --result new-feature --feature specs/023-cart --project {root}/project"
    When the tool runs with "record R-001 --node P3 --result done --project {root}/project"
    Then it exits with 1 and prints:
      """
        WG-17  R-001: P3 cannot follow P0 new-feature; open now: P1
      FAIL (1)
      """

  Scenario: WG-18 a loop cannot run past its budget
    Given run "R-001" has reached "P6 open"
    And in run "R-001", task "T001" fails its checks 3 times
    When the tool runs with "record R-001 --node P6.execute --result done --task T001 --project {root}/project"
    Then it exits with 1 and prints:
      """
        WG-18  R-001: T001: P6.execute again would exceed the "re-execute-after-check" budget
      FAIL (1)
      """

  Scenario: WG-19 record cannot write a gate result
    Given run "R-001" has reached "G0 open"
    When the tool runs with "record R-001 --node G0 --result approved --project {root}/project"
    Then it exits with 1 and prints:
      """
        WG-19  R-001: gate results are recorded only from the human's own message (the approval hook)
      FAIL (1)
      """

  Scenario: WG-20 P6 is done only when every task passed review
    Given run "R-001" has reached "P6 open"
    And in run "R-001", task "T001" passes
    When the tool runs with "record R-001 --node P6 --result done --project {root}/project"
    Then it exits with 1 and prints:
      """
        WG-20  R-001: P6 done before every task passed review: T002
      FAIL (1)
      """

  Scenario: WG-21 evidence names relative paths only
    Given the tool runs with "record R-001 --node P0 --result new-feature --feature specs/023-cart --project {root}/project"
    When the tool runs with "record R-001 --node P1 --result done --evidence /etc/passwd --project {root}/project"
    Then it exits with 1 and prints:
      """
        WG-21  R-001: evidence "/etc/passwd" is not a single-line relative path of at most 300 characters
      FAIL (1)
      """

  Scenario: WG-15 WG-16 WG-17 WG-18 WG-19 WG-20 WG-21 a run that followed the graph passes check-run
    Given run "R-001" has reached "G5 open"
    When the tool runs with "check-run R-001 --project {root}/project"
    Then it passes with no warnings

  Scenario: WG-15 a ledger line that is not JSON is reported
    Given run "R-001" has reached "G0 open"
    And 1 lines are appended to "project/.specify/runs/R-001.jsonl"
    When the tool runs with "check-run R-001 --project {root}/project"
    Then it exits with 1 and prints:
      """
        WG-15  R-001 line 3: is not JSON
      FAIL (1)
      """

  Scenario: WG-16 an edited ledger line breaks the hash chain
    Given run "R-001" has reached "G0 open"
    And in "project/.specify/runs/R-001.jsonl", `"result":"done"` becomes `"result":"blocked"`
    When the tool runs with "check-run R-001 --project {root}/project"
    Then it exits with 1 and prints:
      """
        WG-16  R-001 line 2: the hash chain is broken here (the line or the one before was changed)
      FAIL (1)
      """

  Scenario: WG-22 with the guard off a launch goes through and check-run warns about it
    Given run "R-001" has reached "G2 open"
    And the guard is switched off
    And the tool runs with "hook guard --agent claude-code" and this on stdin:
      """
      {"hook_event_name":"PreToolUse","tool_name":"Agent","cwd":"{root}/project","tool_input":{"subagent_type":"sdlc-architecture","description":"P4 plan","prompt":"mode: decide\nrole: architecture\nphase: P4\nrun: R-001"}}
      """
    When the tool runs with "check-run R-001 --project {root}/project"
    Then it exits with 0 and prints:
      """
        WG-22  R-001 line 5: the guard was off for this launch
      PASS (1 warning(s))
      """

  # ---- the guard and approval hooks (US3) -------------------------------------------------------------
  # Payload shapes are the ones recorded from Claude Code 2.1.129 and Copilot CLI 1.0.105 on 2026-11-03; the
  # Codex shape is from its hooks documentation (contracts/hooks.md).

  Scenario: WG-24 WG-29 Claude Code is refused a launch past an open gate, in its own deny format
    Given run "R-001" has reached "G2 open"
    When the tool runs with "hook guard --agent claude-code" and this on stdin:
      """
      {"hook_event_name":"PreToolUse","tool_name":"Agent","cwd":"{root}/project","tool_input":{"subagent_type":"sdlc-architecture","description":"P4 plan","prompt":"schema: launch-prompt/v1\nmode: decide\nrole: architecture\nphase: P4\nrun: R-001"}}
      """
    Then it exits with 0 and prints:
      """
      {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"G2 is not approved in run R-001: reply \"approve G2 R-001\" to approve"}}
      """

  Scenario: WG-24 WG-29 Copilot CLI is refused the same launch, in its own deny format
    Given run "R-001" has reached "G2 open"
    When the tool runs with "hook guard --agent copilot-cli" and this on stdin:
      """
      {"sessionId":"c1","timestamp":1,"cwd":"{root}/project","toolName":"task","toolArgs":{"name":"p4","prompt":"mode: decide\nrole: architecture\nphase: P4\nrun: R-001","agent_type":"sdlc-architecture","description":"P4 plan","mode":"sync"}}
      """
    Then it exits with 0 and prints:
      """
      {"permissionDecision":"deny","permissionDecisionReason":"G2 is not approved in run R-001: reply \"approve G2 R-001\" to approve"}
      """

  Scenario: WG-24 WG-29 Codex is refused the same launch, in its own deny format
    Given run "R-001" has reached "G2 open"
    When the tool runs with "hook guard --agent codex" and this on stdin:
      """
      {"hook_event_name":"PreToolUse","session_id":"x1","turn_id":"t1","cwd":"{root}/project","tool_name":"spawn_agent","tool_use_id":"u1","tool_input":{"message":"mode: decide\nrole: architecture\nphase: P4\nrun: R-001"}}
      """
    Then it exits with 0 and prints:
      """
      {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"G2 is not approved in run R-001: reply \"approve G2 R-001\" to approve"}}
      """

  Scenario: WG-24 WG-29 Codex's own spawn (collaboration namespace, encrypted message) is read from its task_name
    # Codex 0.164 names the tool collaborationspawn_agent in hooks and sends the message encrypted
    # (codex-rs/core/src/tools/registry.rs, function_hook_tool_name); task_name stays plaintext.
    Given run "R-001" has reached "G2 open"
    When the tool runs with "hook guard --agent codex" and this on stdin:
      """
      {"hook_event_name":"PreToolUse","session_id":"x1","turn_id":"t1","cwd":"{root}/project","tool_name":"collaborationspawn_agent","tool_use_id":"u1","tool_input":{"task_name":"r001_p4_architecture","message":"gAAAAABq6YpSwSBdvHiHcxGpQECwiujDG1xwuLG8O24YnVOjJb53wE_orQTAQRab4H4T1dXsx_wAUtLDJ6rJQa9JXCa7koPN1yPGcHkmYAINaul"}}
      """
    Then it exits with 0 and prints:
      """
      {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"G2 is not approved in run R-001: reply \"approve G2 R-001\" to approve"}}
      """

  Scenario: WG-24 a Codex P6 spawn names its task and mode in the task_name
    Given run "R-001" has reached "P6 open"
    And the tool runs with "record R-001 --node P6.execute --result done --task T001 --project {root}/project"
    When the tool runs with "hook guard --agent codex" and this on stdin:
      """
      {"hook_event_name":"PreToolUse","cwd":"{root}/project","tool_name":"collaborationspawn_agent","tool_input":{"task_name":"r001_p6_engineering_t001_review","message":"gAAAAABq"}}
      """
    Then it exits with 0 and prints:
      """
      {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"task T001: P6.review is not next; next: P6.checks"}}
      """

  Scenario: WG-25 a Codex spawn whose task_name follows no run convention is left alone
    When the tool runs with "hook guard --agent codex" and this on stdin:
      """
      {"hook_event_name":"PreToolUse","cwd":"{root}/project","tool_name":"collaborationspawn_agent","tool_input":{"task_name":"explore_cart_code","message":"gAAAAABq"}}
      """
    Then it exits with 0 and prints nothing

  Scenario: WG-24 the launch goes through once the human approved the gate
    Given run "R-001" has reached "P4 open"
    When the tool runs with "hook guard --agent claude-code" and this on stdin:
      """
      {"hook_event_name":"PreToolUse","tool_name":"Agent","cwd":"{root}/project","tool_input":{"subagent_type":"sdlc-architecture","description":"P4 plan","prompt":"mode: decide\nrole: architecture\nphase: P4\nrun: R-001"}}
      """
    Then it exits with 0 and prints nothing

  Scenario: WG-24 a P6 review launch waits for the task's checks
    Given run "R-001" has reached "P6 open"
    And the tool runs with "record R-001 --node P6.execute --result done --task T001 --project {root}/project"
    When the tool runs with "hook guard --agent claude-code" and this on stdin:
      """
      {"hook_event_name":"PreToolUse","tool_name":"Agent","cwd":"{root}/project","tool_input":{"subagent_type":"sdlc-engineering","description":"review T001","prompt":"mode: review\nrole: engineering\nphase: P6\nrun: R-001\ntask: \"- [ ] T001 [Eng] [llm] Add the cart model\""}}
      """
    Then it exits with 0 and prints:
      """
      {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"task T001: P6.review is not next; next: P6.checks"}}
      """

  Scenario: WG-24 a task that used its retries is refused another execute launch
    Given run "R-001" has reached "P6 open"
    And in run "R-001", task "T001" fails its checks 3 times
    When the tool runs with "hook guard --agent copilot-cli" and this on stdin:
      """
      {"sessionId":"c1","cwd":"{root}/project","toolName":"task","toolArgs":{"prompt":"mode: execute\nrole: engineering\nphase: P6\nrun: R-001\ntask: \"- [ ] T001 [Eng] [llm] Add the cart model\""}}
      """
    Then it exits with 0 and prints:
      """
      {"permissionDecision":"deny","permissionDecisionReason":"task T001 has used its 2 \"re-execute-after-check\" retries; escalate to the human"}
      """

  Scenario: WG-25 a launch that names no run is left alone
    When the tool runs with "hook guard --agent claude-code" and this on stdin:
      """
      {"hook_event_name":"PreToolUse","tool_name":"Agent","cwd":"{root}/project","tool_input":{"subagent_type":"Explore","description":"look","prompt":"Find the cart code"}}
      """
    Then it exits with 0 and prints nothing

  Scenario: WG-25 other tools are left alone
    When the tool runs with "hook guard --agent copilot-cli" and this on stdin:
      """
      {"sessionId":"c1","cwd":"{root}/project","toolName":"bash","toolArgs":{"command":"ls"}}
      """
    Then it exits with 0 and prints:
      """
      {}
      """

  Scenario: WG-26 unreadable hook input is refused
    When the tool runs with "hook guard --agent claude-code" and this on stdin:
      """
      not json
      """
    Then it exits with 0 and prints:
      """
      {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"unreadable hook input: hook input is not JSON"}}
      """

  Scenario: WG-26 a launch for a run with no ledger is refused
    When the tool runs with "hook guard --agent claude-code" and this on stdin:
      """
      {"hook_event_name":"PreToolUse","tool_name":"Agent","cwd":"{root}/project","tool_input":{"prompt":"mode: decide\nrole: product-spec\nphase: P3\nrun: R-009"}}
      """
    Then it exits with 0 and prints:
      """
      {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"run R-009 has no P0 line yet; record P0 first"}}
      """

  Scenario: WG-26 a launch prompt that names a run but no phase is refused
    When the tool runs with "hook guard --agent claude-code" and this on stdin:
      """
      {"hook_event_name":"PreToolUse","tool_name":"Agent","cwd":"{root}/project","tool_input":{"prompt":"mode: decide\nrun: R-001"}}
      """
    Then it exits with 0 and prints:
      """
      {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"the launch prompt names run R-001 but no phase P0…P7"}}
      """

  Scenario: WG-27 an agent may not write a ledger with its edit tools
    When the tool runs with "hook guard --agent claude-code" and this on stdin:
      """
      {"hook_event_name":"PreToolUse","tool_name":"Write","cwd":"{root}/project","tool_input":{"file_path":"{root}/project/.specify/runs/R-001.jsonl","content":"{}"}}
      """
    Then it exits with 0 and prints:
      """
      {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"{root}/project/.specify/runs/R-001.jsonl is a run ledger; it is written only by the workflow-graph tool (record, approval hook)"}}
      """

  Scenario: WG-27 Codex may not patch a ledger
    When the tool runs with "hook guard --agent codex" and this on stdin:
      """
      {"hook_event_name":"PreToolUse","cwd":"{root}/project","tool_name":"apply_patch","tool_input":{"command":"*** Begin Patch\n*** Update File: .specify/runs/R-001.jsonl\n@@\n-x\n+y\n*** End Patch"}}
      """
    Then it exits with 0 and prints:
      """
      {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":".specify/runs/R-001.jsonl is a run ledger; it is written only by the workflow-graph tool (record, approval hook)"}}
      """

  Scenario: WG-28 the human's own approval is recorded with their words
    Given run "R-001" has reached "G2 open"
    When the tool runs with "hook approve --agent claude-code" and this on stdin:
      """
      {"session_id":"s1","transcript_path":"{root}/claude/session.jsonl","cwd":"{root}/project","hook_event_name":"UserPromptSubmit","prompt":"approve G2 R-001 looks right"}
      """
    Then it exits with 0 and prints nothing
    And the file "project/.specify/runs/R-001.jsonl" has a line containing "\"node\":\"G2\",\"result\":\"approved\",\"actor\":\"human\",\"quote\":\"approve G2 R-001 looks right\",\"source\":\"claude-code:UserPromptSubmit\",\"session\":\"s1\""

  Scenario: WG-28 a Copilot approval records the session log it can be checked against
    Given run "R-001" has reached "G2 open"
    When the tool runs with "hook approve --agent copilot-cli" and this on stdin:
      """
      {"sessionId":"c1","timestamp":1,"cwd":"{root}/project","prompt":"changes G2 R-001: the cart total is wrong"}
      """
    Then it exits with 0 and prints:
      """
      {}
      """
    And the file "project/.specify/runs/R-001.jsonl" has a line containing "\"result\":\"changes-requested\",\"actor\":\"human\",\"quote\":\"changes G2 R-001: the cart total is wrong\",\"source\":\"copilot-cli:userPromptSubmitted\",\"session\":\"c1\",\"log\":\"{root}/copilot-home/session-state/c1/events.jsonl\""

  Scenario: WG-28 a message without an approval, or for a gate that is not open, writes nothing
    Given run "R-001" has reached "G2 open"
    And the tool runs with "hook approve --agent claude-code" and this on stdin:
      """
      {"session_id":"s1","cwd":"{root}/project","prompt":"looks good to me"}
      """
    When the tool runs with "hook approve --agent claude-code" and this on stdin:
      """
      {"session_id":"s1","cwd":"{root}/project","prompt":"approve G3 R-001"}
      """
    Then it exits with 0 and prints nothing
    And the file "project/.specify/runs/R-001.jsonl" has no line containing "\"actor\":\"human\",\"quote\":\"looks good"
    And the file "project/.specify/runs/R-001.jsonl" has no line containing "\"node\":\"G3\""

  Scenario: WG-30 every approval is found in the session where it was typed
    Given run "R-001" has reached "G5 open"
    When the tool runs with "verify-approvals R-001 --project {root}/project"
    Then it passes with no warnings

  Scenario: WG-30 an approval whose words are not in its session log is reported
    Given run "R-001" has reached "G5 open"
    And in "claude/session.jsonl", `approve G2 R-001` becomes `approve G9 R-001`
    When the tool runs with "verify-approvals R-001 --project {root}/project"
    Then it exits with 1 and prints:
      """
        WG-30  R-001 line 5: the quote of G2 is not a message typed in session s1
      FAIL (1)
      """

  # ---- traceability ---------------------------------------------------------------------------------------

  Scenario: every WG rule is named by a scenario and is a rule row
    When the tool runs with "check-graph"
    Then every rule code the tool prints is named by a scenario in this feature
    And every rule code the tool prints is a rule row in its schemas
