Feature: The efficiency auditor finds token waste in the agents' session logs (proposals/efficiency-auditor.md)

  `copilot/efficiency-audit/efficiency-audit.mjs` reads the logs Claude Code, Codex and GitHub Copilot write, and the
  turn token history, and reports the patterns that waste tokens per session and per week (EA-1 … EA-10, AU-1 … AU-10).
  "Now" is 2026-11-05T12:00:00Z, so the default week is the one of Monday 2026-11-02, and times print in UTC.

  The fixture holds, every number worked out by hand:
  - Claude Code session `c1` in /work/p (10 turns, Claude Opus 5.5 at $4 input, $5 cache write, $0.20 cache read and
    $20 output per million tokens), and a scripted session `s2` in /tmp/run1;
  - Codex thread `x1` in /work/x (2 turns, `gpt-6.1-sol` at 50 / 2.5 / 250 credits per million), its turn token history,
    a subagent thread `k1` and a `codex exec` run `e1`;
  - Copilot session `g1` in /work/g (3 turns, one sub-agent call, one line that is not JSON);
  - a weekly history with one earlier week, and a `repo/TRACKER.md` with items T-1 to T-3.

  Background:
    Given the base fixture tree of "efficiency-audit"

  # ---- the session report -----------------------------------------------------------------------------------------

  Scenario: AU-3 EA-1 EA-2 EA-3 EA-4 EA-5 EA-6a EA-6b EA-7 EA-9 EA-10 AU-6 a Claude Code session shows every detector that fired, its cost and its fix
    # EA-1: in turn 1, a.md, b.md and c.md are read one per request; d.md's name was in c.md's output, so it is a
    #   dependent read and ends the run. Extra requests 62,010 + 63,010 = 125,020 tokens; $0.01824 + $0.01844.
    #   In turn 2, three single reads in a row again: 67,010 + 107,010 = 174,020 tokens; $0.02024 + $0.40744.
    # EA-2: AGENTS.md of the working folder, in the first request; the next request costs $0.01804.
    # EA-3: the graph guide with no code-review-graph tool; the pattern file is fine (pattern:bugfix).
    # EA-5: five files read in full again in turn 3; a.md after its edit and big.md's ranged read are not counted.
    # EA-6a: 120 minutes after the last request, 66,000 tokens written ($0.33204). EA-6b: 80,000 tokens 5 s later.
    # EA-7: turn 2 peaks at 251,010; turn 3 at 253,030 and compacts. EA-9: turn 4, 10 requests, "In src/a.ts.".
    # AU-6: of 10 turns, turn 2 costs most ($0.82076) and turn 4 has most requests.
    When the tool runs with "session c1"
    Then it exits with 0 and prints:
      """
      Claude Code session c1 · started 2026-11-03 · 10 turns · 29 requests · ≈ $1.52 at list price
        EA-1  one file per request: 2 findings · ≈ $0.464
              turn 1: 3 requests in a row each read one file: 2 extra, 125,020 context tokens re-sent · a.md, b.md, c.md
              turn 2: 3 requests in a row each read one file: 2 extra, 174,020 context tokens re-sent · answer-patterns.md, code-review-graph.md, big.md
              fix: plan the reads and request them together (core line IW-13); if this agent keeps doing it, test a stronger wording
        EA-2  instruction file read at session start: 1 finding · ≈ $0.018
              turn 1: read /work/p/AGENTS.md with Read; the agent loads it by itself
              fix: remove the pointer: the agent loads this file by itself (instruction-loading D2)
        EA-3  reference read with its trigger false: 1 finding · ≈ $0.407
              turn 2: read /home/v/.copilot/references/code-review-graph.md: no code-review-graph tool in the session
              fix: key the trigger to something visible in the message or session (IW-7 → IW-12)
        EA-4  very large tool output: 1 finding
              turn 2: Read returned 45,000 characters · /work/p/big.md
              fix: read a range, search first, split the doc, or filter the output
        EA-5  same file read in full again: 5 findings
              turn 3: /work/p/a.md read in full again (5 characters)
              turn 3: /work/p/b.md read in full again (4 characters)
              turn 3: /work/p/c.md read in full again (5 characters)
              … 2 more
              fix: keep the facts from the first read; read only the range needed
        EA-6a cache rebuilt after a pause: 1 finding · ≈ $0.332
              turn 2: after a 120-minute pause, 66,000 tokens written to the cache again
              fix: before a break, finish or compact; start a new session for a new task
        EA-6b cache rebuilt without a pause: 1 finding · ≈ $0.407
              turn 2: 80,000 tokens written to the cache again 0 minutes after the previous request
              fix: pick the model, effort and MCP servers at session start
        EA-7  large context or compaction: 2 findings
              turn 2: peak context 251,010 of 1,000,000 (25%)
              turn 3: peak context 253,030 of 1,000,000 (25%) · compaction from 253,030 to 20,000
              fix: clear or compact at task boundaries; one session per task
        EA-9  many requests for a short answer (experimental): 1 finding
              turn 4: 10 requests, no file edited, final answer 12 characters
              fix: answer from what is known, or ask one focused question
        EA-10 large unscoped search: 1 finding
              turn 4: unscoped search returned 25,000 characters · rg TODO
              fix: scope the search to a folder, glob or file type; ignore generated folders
        outliers (above the 90th percentile of Claude Code turns): turn 2 (cost ≈ $0.821); turn 4 (10 requests)
      """

  Scenario: AU-1 EA-1 EA-2 EA-6a EA-8 a Codex thread: an exec with two reads is a batch, and the subagent thread is not a session
    # EA-1: n1, n2, n3 one per request (e1 reads two files at once): 42,000 + 43,000 = 85,000 tokens;
    #   (1,000 × 50 + 41,000 × 2.5 + 100 × 250) / 1M = 0.1775 credits, and 0.18 for the next.
    # EA-6a: 20 minutes later, 10,000 of 60,000 cached: 50,000 × 50 + 10,000 × 2.5 + 100 × 250 per million = 2.55 credits.
    # EA-8: from the turn token history, subagents 4.25 credits against 1.5.
    When the tool runs with "session x1"
    Then it exits with 0 and prints:
      """
      Codex session x1 · started 2026-11-04 · 2 turns · 6 requests · 5.3 credits
        EA-1  one file per request: 1 finding · 0.4 credits
              turn 1: 3 requests in a row each read one file: 2 extra, 85,000 context tokens re-sent · n1.md, n2.md, n3.md
              fix: plan the reads and request them together (core line IW-13); if this agent keeps doing it, test a stronger wording
        EA-2  instruction file read at session start: 1 finding · 0.2 credits
              turn 1: read /work/x/AGENTS.md with exec; the agent loads it by itself
              fix: remove the pointer: the agent loads this file by itself (instruction-loading D2)
        EA-6a cache rebuilt after a pause: 1 finding · 2.6 credits
              turn 2: after a 20-minute pause, 50,000 tokens written to the cache again
              fix: before a break, finish or compact; start a new session for a new task
        EA-8  subagents cost more than the main agent: 1 finding · 4.3 credits
              turn 1: subagents 4.3 credits against the main agent's 1.5 credits
              fix: check the delegation was needed; use a cheaper subagent model
      """

  Scenario: AU-1 EA-3 EA-6a EA-6b a Copilot session: exact credits, cacheExpiresAt, no sub-agent calls, a skipped line
    # 30 + 2 + 32 + 2 + 26 = 92 AI credits; the 40-credit sub-agent call is not counted.
    # Turn 2 comes after the previous call's cacheExpiresAt (EA-6a); turn 3, 7 minutes later, before it (EA-6b).
    # The read of global-variables.md is fine in turn 2: its message has {{AGENT_HOME}}.
    When the tool runs with "session g1"
    Then it exits with 0 and prints:
      """
      Copilot session g1 · started 2026-11-05 · 3 turns · 5 requests · 92.0 AI credits
        EA-3  reference read with its trigger false: 1 finding · 2.0 AI credits
              turn 1: read /home/v/.copilot/global-variables.md: no {{VAR}} in the message or a file read before
              fix: key the trigger to something visible in the message or session (IW-7 → IW-12)
        EA-6a cache rebuilt after a pause: 1 finding · 32.0 AI credits
              turn 2: after a 6-minute pause, 62,000 tokens written to the cache again
              fix: before a break, finish or compact; start a new session for a new task
        EA-6b cache rebuilt without a pause: 1 finding · 26.0 AI credits
              turn 3: 50,000 tokens written to the cache again 7 minutes after the previous request
              fix: pick the model, effort and MCP servers at session start
        skipped: 1 unreadable line, 0 unreadable files
      """

  Scenario: AU-2 a session whose working folder is in /tmp is marked scripted
    When the tool runs with "session s2"
    Then the output has the line "Claude Code session s2 (scripted) · started 2026-11-04 · 1 turn · 1 request · ≈ $0.350 at list price"

  Scenario: AU-3 an id that matches no session exits 2
    When the tool runs with "session zz"
    Then it exits with 2 and prints:
      """
      efficiency-audit: no session matches "zz"
      """

  Scenario: AU-3 a session can be named by its log path
    When the tool runs with "session {root}/copilot-home/session-state/g1/events.jsonl"
    Then the output has the line "Copilot session g1 · started 2026-11-05 · 3 turns · 5 requests · 92.0 AI credits"

  # ---- the weekly report, history and tracker ---------------------------------------------------------------------

  Scenario: AU-4 AU-2 AU-6 AU-7 the week report: per tool and detector, scripted runs apart, a flag, records and tracker commands
    # Claude Code's EA-5: 5 findings in 10 turns = 50 per 100 turns, above 2 × the earlier week's 10: flagged.
    # EA-2 always gets a record (a regression). At most 3 tracker commands.
    When the tool runs with "week"
    Then it exits with 0 and prints:
      """
      Efficiency audit · week of 2026-11-02 (Monday) to 2026-11-08
      Claude Code · 1 session · 10 turns · 29 requests · ≈ $1.52 at list price
        EA-1  one file per request: 2 findings · 20 per 100 turns · ≈ $0.464
        EA-2  instruction file read at session start: 1 finding · 10 per 100 turns · ≈ $0.018
        EA-3  reference read with its trigger false: 1 finding · 10 per 100 turns · ≈ $0.407
        EA-4  very large tool output: 1 finding · 10 per 100 turns
        EA-5  same file read in full again: 5 findings · 50 per 100 turns · median of the last 1 week 10 · flagged
        EA-6a cache rebuilt after a pause: 1 finding · 10 per 100 turns · ≈ $0.332
        EA-6b cache rebuilt without a pause: 1 finding · 10 per 100 turns · ≈ $0.407
        EA-7  large context or compaction: 2 findings · 20 per 100 turns
        EA-9  many requests for a short answer (experimental): 1 finding · 10 per 100 turns
        EA-10 large unscoped search: 1 finding · 10 per 100 turns
        top: EA-1 session c1 turn 2: 3 requests in a row each read one file: 2 extra, 174,020 context tokens re-sent · answer-patterns.md, code-review-graph.md, big.md · ≈ $0.428
        top: EA-3 session c1 turn 2: read /home/v/.copilot/references/code-review-graph.md: no code-review-graph tool in the session · ≈ $0.407
        top: EA-6b session c1 turn 2: 80,000 tokens written to the cache again 0 minutes after the previous request · ≈ $0.407
        outliers: session c1 turn 2 (cost ≈ $0.821); session c1 turn 4 (10 requests)
        scripted: 1 session, 1 turn (not counted)
      Codex · 1 session · 2 turns · 6 requests · 5.3 credits
        EA-1  one file per request: 1 finding · 50 per 100 turns · 0.4 credits
        EA-2  instruction file read at session start: 1 finding · 50 per 100 turns · 0.2 credits
        EA-6a cache rebuilt after a pause: 1 finding · 50 per 100 turns · 2.6 credits
        EA-8  subagents cost more than the main agent: 1 finding · 50 per 100 turns · 4.3 credits
        top: EA-8 session x1 turn 1: subagents 4.3 credits against the main agent's 1.5 credits · 4.3 credits
        top: EA-6a session x1 turn 2: after a 20-minute pause, 50,000 tokens written to the cache again · 2.6 credits
        top: EA-1 session x1 turn 1: 3 requests in a row each read one file: 2 extra, 85,000 context tokens re-sent · n1.md, n2.md, n3.md · 0.4 credits
        scripted: 1 session, 1 turn (not counted)
      Copilot · 1 session · 3 turns · 5 requests · 92.0 AI credits
        EA-3  reference read with its trigger false: 1 finding · 33.33 per 100 turns · 2.0 AI credits
        EA-6a cache rebuilt after a pause: 1 finding · 33.33 per 100 turns · 32.0 AI credits
        EA-6b cache rebuilt without a pause: 1 finding · 33.33 per 100 turns · 26.0 AI credits
        top: EA-6a session g1 turn 2: after a 6-minute pause, 62,000 tokens written to the cache again · 32.0 AI credits
        top: EA-6b session g1 turn 3: 50,000 tokens written to the cache again 7 minutes after the previous request · 26.0 AI credits
        top: EA-3 session g1 turn 1: read /home/v/.copilot/global-variables.md: no {{VAR}} in the message or a file read before · 2.0 AI credits
      Suggested records (write them, then run review-docs):
        copilot/knowledge/ai-agents/instruction-wording-findings.md: week of 2026-11-02, Claude Code: EA-2 instruction file read at session start, 1 finding in 10 turns (10 per 100 turns), ≈ $0.018; source: efficiency-audit.mjs week --week 2026-11-02
        copilot/knowledge/ai-agents/agent-token-accounting.md: week of 2026-11-02, Claude Code: EA-5 same file read in full again, 5 findings in 10 turns (50 per 100 turns, median of the last 1 week 10); source: efficiency-audit.mjs week --week 2026-11-02
        copilot/knowledge/ai-agents/instruction-wording-findings.md: week of 2026-11-02, Codex: EA-2 instruction file read at session start, 1 finding in 2 turns (50 per 100 turns), 0.2 credits; source: efficiency-audit.mjs week --week 2026-11-02
      Tracker (run with --tracker <repo folder> to add):
        node copilot/tracker/tracker.mjs --add "Efficiency audit 2026-11-02: Claude Code EA-2 instruction file read at session start" --next "Run efficiency-audit.mjs week --week 2026-11-02, read the top findings, then remove the pointer: the agent loads this file by itself (instruction-loading D2)"
        node copilot/tracker/tracker.mjs --add "Efficiency audit 2026-11-02: Claude Code EA-5 same file read in full again" --next "Run efficiency-audit.mjs week --week 2026-11-02, read the top findings, then keep the facts from the first read; read only the range needed"
        node copilot/tracker/tracker.mjs --add "Efficiency audit 2026-11-02: Codex EA-2 instruction file read at session start" --next "Run efficiency-audit.mjs week --week 2026-11-02, read the top findings, then remove the pointer: the agent loads this file by itself (instruction-loading D2)"
      skipped: 1 unreadable line, 0 unreadable files
      """

  Scenario: AU-5 the week's history: one line per tool and detector, zeros included, no text
    When the tool runs with "week"
    Then the file "copilot-home/efficiency-audit/history.jsonl" has the line "{\"schema\":\"efficiency-audit/v1\",\"week\":\"2026-11-02\",\"tool\":\"claude\",\"detector\":\"EA-5\",\"turns\":10,\"findings\":5,\"rate\":50,\"cost\":0,\"unit\":\"usd\",\"baseline\":10,\"baselineWeeks\":1,\"flagged\":true}"
    And the file "copilot-home/efficiency-audit/history.jsonl" has the line "{\"schema\":\"efficiency-audit/v1\",\"week\":\"2026-11-02\",\"tool\":\"copilot\",\"detector\":\"EA-1\",\"turns\":3,\"findings\":0,\"rate\":0,\"cost\":0,\"unit\":\"ai-credits\",\"baseline\":null,\"baselineWeeks\":0,\"flagged\":false}"
    And the file "copilot-home/efficiency-audit/history.jsonl" has the line "{\"schema\":\"efficiency-audit/v1\",\"week\":\"2026-10-26\",\"tool\":\"claude\",\"detector\":\"EA-5\",\"turns\":20,\"findings\":2,\"rate\":10,\"cost\":0,\"unit\":\"usd\",\"baseline\":null,\"baselineWeeks\":0,\"flagged\":false}"
    And the file "copilot-home/efficiency-audit/history.jsonl" has no line containing "/work/"
    And the file "copilot-home/efficiency-audit/history.jsonl" has no line containing "Review the docs"

  Scenario: AU-5 running a week again replaces that week's lines
    Given the file "copilot-home/efficiency-audit/history.jsonl" contains:
      """
      {"schema":"efficiency-audit/v1","week":"2026-11-02","tool":"claude","detector":"EA-1","turns":1,"findings":99,"rate":9900,"cost":0,"unit":"usd","baseline":null,"baselineWeeks":0,"flagged":false}
      """
    When the tool runs with "week"
    Then the file "copilot-home/efficiency-audit/history.jsonl" has no line containing "\"findings\":99"

  Scenario: AU-4 AU-5 a week with no sessions says so and writes no history
    When the tool runs with "week --week 2026-10-20"
    Then it exits with 0 and prints:
      """
      Efficiency audit · week of 2026-10-19 (Monday) to 2026-10-25
      no sessions this week
      skipped: 1 unreadable line, 0 unreadable files
      """
    And the file "copilot-home/efficiency-audit/history.jsonl" has no line containing "2026-10-19"

  Scenario: AU-7 --tracker adds the items to the named repo, and a second run skips them
    Given the tool runs with "week --tracker {root}/repo"
    Then the file "repo/TRACKER.md" has the line "### T-4 Efficiency audit 2026-11-02: Claude Code EA-2 instruction file read at session start"
    And the file "repo/TRACKER.md" has the line "### T-6 Efficiency audit 2026-11-02: Codex EA-2 instruction file read at session start"
    When the tool runs with "week --tracker {root}/repo"
    Then the output has the line "  already tracked: Efficiency audit 2026-11-02: Claude Code EA-5 same file read in full again"

  # ---- output forms, privacy, triggers ----------------------------------------------------------------------------

  Scenario: AU-9 --json gives the session report as one object
    When the tool runs with "session g1 --json"
    Then it exits with 0
    And the output has the line "  \"schema\": \"efficiency-audit/v1\","
    And the output has the line "  \"kind\": \"session\","
    And the output has the line "      \"evidence\": \"after a 6-minute pause, 62,000 tokens written to the cache again\""

  Scenario: AU-9 --json gives the week report as one object
    When the tool runs with "week --json"
    Then it exits with 0
    And the output has the line "  \"kind\": \"week\","
    And the output has the line "  \"week\": \"2026-11-02\","

  Scenario: AU-8 the tool imports no network module and prints no message text
    Given the repo's "copilot/efficiency-audit" folder is copied to "src"
    Then the file "src/efficiency-audit.mjs" has no line containing "node:http"
    And the file "src/efficiency-audit.mjs" has no line containing "node:net"
    And the file "src/efficiency-audit.mjs" has no line containing "fetch("
    When the tool runs with "session c1"
    Then the output has no line "Review the docs"
    And the output has no line "        turn 1: Review the docs"

  Scenario: AU-10 every trigger in triggers.json is named in the core instructions
    When the tool runs with "check-triggers"
    Then it exits with 0 and prints:
      """
      PASS: 4 triggers named in core.instructions.md
      """

  Scenario: AU-10 a trigger whose text left the core fails the check
    Given the repo's "copilot/efficiency-audit" folder is copied to "copilot/efficiency-audit"
    And the repo's "copilot/instructions" folder is copied to "copilot/instructions"
    And the repo's "copilot/hooks/turn-tokens" folder is copied to "copilot/hooks/turn-tokens"
    And in "copilot/efficiency-audit/triggers.json", `"core": "~/.copilot/global-variables.md"` becomes `"core": "~/.copilot/vars.md"`
    When the tool runs with "check-triggers"
    Then it exits with 1 and prints:
      """
        fail  AU-10  triggers.json: "~/.copilot/vars.md" is not in core.instructions.md
      FAIL (1)
      """

  # ---- traceability -------------------------------------------------------------------------------------------------

  Scenario: Every EA and AU rule is named by a scenario and is a row in the schema
    Then every rule code the tool prints is named by a scenario in this feature
    And every rule code the tool prints is a rule row in its schemas
