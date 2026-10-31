Feature: The turn token report shows what each turn used and the running total (specs/017)

  `copilot/hooks/turn-tokens/turn-tokens.mjs` runs as the `Stop` hook of Claude Code and Codex. It reads the
  tool's own log, prints one report (turn, tools, subagents, session, limits) and appends it to a history file in
  the tool's own folder (TT-1 … TT-12). "Now" is 2026-10-31T09:20:00Z and times print in UTC in every scenario.

  The fixture holds a Claude Code session `s1` (2 turns, a subagent per turn) and a Codex thread `t1` (2 turns, one
  subagent thread `c1`), plus an unrelated Codex thread `t2`. Every number below was worked out by hand.

  Background:
    Given the base fixture tree of "turn-tokens"

  # ---- the hook contract ------------------------------------------------------------------------------

  Scenario: TT-1 the Claude Code report is one systemMessage JSON object
    When the tool runs with "--hook claude" and this on stdin:
      """
      {"session_id":"s1","transcript_path":"{root}/claude-home/projects/p/s1.jsonl","hook_event_name":"Stop","stop_hook_active":false}
      """
    Then it exits with 0 and prints:
      """
      {"systemMessage":"Turn 2 · 3 calls · peak context 23,502 · new input 10 · cache write 3,500 · cache read 65,000 · output 1,200 · ≈ $0.037\n  tools: Bash ×2, Read\n  subagents: 2 calls · output at least 152 · ≈ $0.005 · tools: Grep\nSession · 4 calls · new input 20 · cache write 23,500 · cache read 65,000 · output 2,200 · ≈ $0.097 at list price\n  subagents: 3 calls · output at least 202 · ≈ $0.006\nLimits · unknown: Claude Code shares them only with its status line (turn-tokens --statusline)"}
      """

  Scenario: TT-1 hook input that is not JSON gives a one-line message, and the turn goes on
    When the tool runs with "--hook codex" and this on stdin:
      """
      not json
      """
    Then it exits with 0 and prints:
      """
      {"systemMessage":"Token report: the hook input is not JSON"}
      """

  Scenario: TT-1 a log that cannot be read gives a one-line message, and the turn goes on
    When the tool runs with "--hook claude" and this on stdin:
      """
      {"session_id":"s1","transcript_path":"{root}/claude-home/projects/p/none.jsonl"}
      """
    Then it exits with 0 and prints:
      """
      {"systemMessage":"Token report: cannot read the log {root}/claude-home/projects/p/none.jsonl"}
      """

  # ---- Claude Code ------------------------------------------------------------------------------------

  Scenario: TT-2 TT-5 TT-7 TT-8 TT-9 a Claude Code turn counts each reply once, its own subagents and its tools
    When the tool runs with "--hook claude --text" and this on stdin:
      """
      {"session_id":"s1","transcript_path":"{root}/claude-home/projects/p/s1.jsonl"}
      """
    Then it exits with 0 and prints:
      """
      Turn 2 · 3 calls · peak context 23,502 · new input 10 · cache write 3,500 · cache read 65,000 · output 1,200 · ≈ $0.037
        tools: Bash ×2, Read
        subagents: 2 calls · output at least 152 · ≈ $0.005 · tools: Grep
      Session · 4 calls · new input 20 · cache write 23,500 · cache read 65,000 · output 2,200 · ≈ $0.097 at list price
        subagents: 3 calls · output at least 202 · ≈ $0.006
      Limits · unknown: Claude Code shares them only with its status line (turn-tokens --statusline)
      """

  Scenario: TT-2 a compaction summary is not a prompt; counted as one, the turn would start after it
    Given in "claude-home/projects/p/s1.jsonl", `"isCompactSummary":true` becomes `"isCompactSummary":false`
    When the tool runs with "--hook claude --text" and this on stdin:
      """
      {"session_id":"s1","transcript_path":"{root}/claude-home/projects/p/s1.jsonl"}
      """
    Then the output has the line "Turn 3 · 2 calls · peak context 23,502 · new input 5 · cache write 1,500 · cache read 45,000 · output 700 · ≈ $0.020"
    And the output has the line "  tools: Read, Bash"

  Scenario: TT-2 a local command (`/compact`) and its output are not turns
    Given in "claude-home/projects/p/s1.jsonl", `{"type":"user","timestamp":"2026-10-31T09:10:00.000Z"` becomes `{"type":"user","timestamp":"2026-10-31T09:09:00.000Z","message":{"role":"user","content":"<command-name>/compact</command-name>"}}\n{"type":"user","timestamp":"2026-10-31T09:09:30.000Z","message":{"role":"user","content":"<local-command-stdout>Compacted</local-command-stdout>"}}\n{"type":"user","timestamp":"2026-10-31T09:10:00.000Z"`
    When the tool runs with "--hook claude --text" and this on stdin:
      """
      {"session_id":"s1","transcript_path":"{root}/claude-home/projects/p/s1.jsonl"}
      """
    Then the output has the line "Turn 2 · 3 calls · peak context 23,502 · new input 10 · cache write 3,500 · cache read 65,000 · output 1,200 · ≈ $0.037"

  Scenario: TT-2 a local command's output printed in the middle of a turn does not start a new turn
    Given in "claude-home/projects/p/s1.jsonl", `{"type":"user","timestamp":"2026-10-31T09:10:20.000Z"` becomes `{"type":"user","timestamp":"2026-10-31T09:10:19.000Z","message":{"role":"user","content":"<local-command-stdout>Total cost: $0.05</local-command-stdout>"}}\n{"type":"user","timestamp":"2026-10-31T09:10:20.000Z"`
    When the tool runs with "--hook claude --text" and this on stdin:
      """
      {"session_id":"s1","transcript_path":"{root}/claude-home/projects/p/s1.jsonl"}
      """
    Then the output has the line "Turn 2 · 3 calls · peak context 23,502 · new input 10 · cache write 3,500 · cache read 65,000 · output 1,200 · ≈ $0.037"

  Scenario: TT-2 a tool result that also carries text is not a prompt
    Given in "claude-home/projects/p/s1.jsonl", `[{"type":"tool_result","tool_use_id":"tu1","content":"a.txt"}]` becomes `[{"type":"tool_result","tool_use_id":"tu1","content":"a.txt"},{"type":"text","text":"note from a hook"}]`
    When the tool runs with "--hook claude --text" and this on stdin:
      """
      {"session_id":"s1","transcript_path":"{root}/claude-home/projects/p/s1.jsonl"}
      """
    Then the output has the line "Turn 2 · 3 calls · peak context 23,502 · new input 10 · cache write 3,500 · cache read 65,000 · output 1,200 · ≈ $0.037"

  Scenario: TT-4 a final reply still missing after the wait is reported, not guessed
    Given in "claude-home/projects/p/s1.jsonl", `"stop_reason":"end_turn","usage":{"input_tokens":2,` becomes `"stop_reason":"tool_use","usage":{"input_tokens":2,`
    When the tool runs with "--hook claude --text --wait-ms 200" and this on stdin:
      """
      {"session_id":"s1","transcript_path":"{root}/claude-home/projects/p/s1.jsonl"}
      """
    Then the output has the line "  note: the final reply was not in the log yet; the session total will include it in the next report"

  Scenario: TT-4 a final reply written while the hook waits is counted
    Given in "claude-home/projects/p/s1.jsonl", `"stop_reason":"end_turn","usage":{"input_tokens":2,` becomes `"stop_reason":"tool_use","usage":{"input_tokens":2,`
    And 500 ms after the tool starts, in "claude-home/projects/p/s1.jsonl", `"stop_reason":"tool_use","usage":{"input_tokens":2,"cache_creation_input_tokens":500,"cache_read_input_tokens":23000,"output_tokens":300` becomes `"stop_reason":"end_turn","usage":{"input_tokens":2,"cache_creation_input_tokens":500,"cache_read_input_tokens":23000,"output_tokens":900`
    When the tool runs with "--hook claude --text --wait-ms 3000" and this on stdin:
      """
      {"session_id":"s1","transcript_path":"{root}/claude-home/projects/p/s1.jsonl"}
      """
    Then the output has the line "Turn 2 · 3 calls · peak context 23,502 · new input 10 · cache write 3,500 · cache read 65,000 · output 1,800 · ≈ $0.043"
    And the output has no line "  note: the final reply was not in the log yet; the session total will include it in the next report"

  Scenario: TT-5 peak context is the largest request of the turn, not the last one
    Given in "claude-home/projects/p/s1.jsonl", `"cache_read_input_tokens":23000,"output_tokens":300` becomes `"cache_read_input_tokens":1000,"output_tokens":300`
    When the tool runs with "--hook claude --text" and this on stdin:
      """
      {"session_id":"s1","transcript_path":"{root}/claude-home/projects/p/s1.jsonl"}
      """
    Then the output has the line "Turn 2 · 3 calls · peak context 23,003 · new input 10 · cache write 3,500 · cache read 43,000 · output 1,200 · ≈ $0.032"

  Scenario: TT-8 a server-side tool call (such as web search) is a tool call too
    Given in "claude-home/projects/p/s1.jsonl", `{"type":"tool_use","id":"tu2"` becomes `{"type":"server_tool_use","id":"tu2"`
    When the tool runs with "--hook claude --text" and this on stdin:
      """
      {"session_id":"s1","transcript_path":"{root}/claude-home/projects/p/s1.jsonl"}
      """
    Then the output has the line "  tools: Bash ×2, Read"

  Scenario: TT-6 a placeholder output makes the sum "at least"; once final, the sum is exact
    Given in "claude-home/projects/p/s1/subagents/agent-a1.jsonl", `"stop_reason":null` becomes `"stop_reason":"tool_use"`
    When the tool runs with "--hook claude --text" and this on stdin:
      """
      {"session_id":"s1","transcript_path":"{root}/claude-home/projects/p/s1.jsonl"}
      """
    Then the output has the line "  subagents: 2 calls · output 152 · ≈ $0.005 · tools: Grep"
    And the output has the line "  subagents: 3 calls · output 202 · ≈ $0.006"

  Scenario Outline: TT-9 Claude Code dollars at list price: <case>
    Given the file "claude-home/projects/p/s9.jsonl" contains:
      """
      {"type":"user","timestamp":"2026-10-31T09:00:00.000Z","message":{"role":"user","content":"go"}}
      {"type":"assistant","timestamp":"2026-10-31T09:00:01.000Z","requestId":"q","message":{"id":"m","model":"<model>","content":[],"stop_reason":"end_turn","usage":<usage>}}
      """
    When the tool runs with "--hook claude --text" and this on stdin:
      """
      {"session_id":"s9","transcript_path":"{root}/claude-home/projects/p/s9.jsonl"}
      """
    Then the first output line ends with "<cost>"

    Examples:
      | case                              | model                      | usage                                                                                                                                                                                                     | cost                           |
      | standard speed                    | claude-opus-5-5            | {"input_tokens":1000,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":1000,"speed":"standard"}                                                                                 | ≈ $0.024                       |
      | fast speed                        | claude-opus-5-5            | {"input_tokens":1000,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":1000,"speed":"fast"}                                                                                     | ≈ $0.048                       |
      | fast speed with the cache         | claude-opus-5-5            | {"input_tokens":0,"cache_creation_input_tokens":1000,"cache_read_input_tokens":10000,"output_tokens":0,"cache_creation":{"ephemeral_5m_input_tokens":1000,"ephemeral_1h_input_tokens":0},"speed":"fast"} | ≈ $0.014                       |
      | 1-hour cache writes               | claude-sonnet-5            | {"input_tokens":0,"cache_creation_input_tokens":10000,"cache_read_input_tokens":0,"output_tokens":0,"cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":10000}}                  | ≈ $0.040                       |
      | 5-minute cache writes             | claude-sonnet-5            | {"input_tokens":0,"cache_creation_input_tokens":10000,"cache_read_input_tokens":0,"output_tokens":0,"cache_creation":{"ephemeral_5m_input_tokens":10000,"ephemeral_1h_input_tokens":0}}                  | ≈ $0.025                       |
      | Haiku 5.5 up to 100,000 tokens    | claude-haiku-5-5           | {"input_tokens":50000,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":2000}                                                                                                   | ≈ $0.006                       |
      | Haiku 5.5 over 100,000 tokens     | claude-haiku-5-5           | {"input_tokens":300000,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":2000}                                                                                                  | ≈ $0.155                       |
      | US-only inference                 | claude-sonnet-5            | {"input_tokens":1000,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":1000,"inference_geo":"us"}                                                                               | ≈ $0.013                       |
      | a model id with a date suffix     | claude-haiku-4-5-20251001  | {"input_tokens":1000,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":1000}                                                                                                    | ≈ $0.006                       |
      | a model with no price row         | claude-future-9            | {"input_tokens":1000,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":1000}                                                                                                    | price unknown: claude-future-9 |

  Scenario: TT-10 TT-12 Claude Code limits come from the status line, with the time they were saved
    Given the tool runs with "--statusline" and this on stdin:
      """
      {"session_id":"s1","context_window":{"context_window_size":200000,"used_percentage":12},"rate_limits":{"five_hour":{"used_percentage":23,"resets_at":1793455200},"seven_day":{"used_percentage":41,"resets_at":1793696400}}}
      """
    When the tool runs with "--hook claude --text" and this on stdin:
      """
      {"session_id":"s1","transcript_path":"{root}/claude-home/projects/p/s1.jsonl"}
      """
    Then the output has the line "Turn 2 · 3 calls · peak context 23,502 of 200,000 (12%) · new input 10 · cache write 3,500 · cache read 65,000 · output 1,200 · ≈ $0.037"
    And the output has the line "Limits · 5-hour 23% used, resets 31 Oct 14:00 · weekly 41% used, resets 3 Nov 09:00 · from the status line at 09:20"

  Scenario: TT-10 without a status-line file for the session, the newest one gives the limits but not the window
    Given the tool runs with "--statusline" and this on stdin:
      """
      {"session_id":"s0","context_window":{"context_window_size":200000,"used_percentage":50},"rate_limits":{"five_hour":{"used_percentage":23,"resets_at":1793455200},"seven_day":{"used_percentage":41,"resets_at":1793696400}}}
      """
    When the tool runs with "--hook claude --text" and this on stdin:
      """
      {"session_id":"s1","transcript_path":"{root}/claude-home/projects/p/s1.jsonl"}
      """
    Then the output has the line "Turn 2 · 3 calls · peak context 23,502 · new input 10 · cache write 3,500 · cache read 65,000 · output 1,200 · ≈ $0.037"
    And the output has the line "Limits · 5-hour 23% used, resets 31 Oct 14:00 · weekly 41% used, resets 3 Nov 09:00 · from the status line at 09:20"

  Scenario: TT-11 every Claude Code report is appended to its history file in the Claude Code folder
    When the tool runs with "--hook claude" and this on stdin:
      """
      {"session_id":"s1","transcript_path":"{root}/claude-home/projects/p/s1.jsonl"}
      """
    Then the file "claude-home/turn-tokens/s1.jsonl" contains exactly:
      """
      {"schema":"turn-tokens/v1","at":"2026-10-31T09:20:00.000Z","tool":"claude","session":"s1","turn":2,"pending":false,"unit":"usd","contextWindow":null,"thisTurn":{"calls":3,"peakContext":23502,"newInput":10,"cacheWrite":3500,"cacheRead":65000,"output":1200,"outputAtLeast":false,"cost":0.03677,"unpriced":[],"tools":{"Bash":2,"Read":1}},"thisTurnSubagents":{"calls":2,"peakContext":3102,"newInput":6,"cacheWrite":3100,"cacheRead":3000,"output":152,"outputAtLeast":true,"cost":0.004941,"unpriced":[],"tools":{"Grep":1}},"sessionTotal":{"calls":4,"peakContext":23502,"newInput":20,"cacheWrite":23500,"cacheRead":65000,"output":2200,"outputAtLeast":false,"cost":0.09679,"unpriced":[],"tools":{"Bash":2,"Read":1}},"sessionSubagents":{"calls":3,"peakContext":3102,"newInput":7,"cacheWrite":4100,"cacheRead":3000,"output":202,"outputAtLeast":true,"cost":0.006442,"unpriced":[],"tools":{"Glob":1,"Grep":1}},"limits":null}
      """

  Scenario: TT-12 the status line saves what the hook needs and prints the limits and the context use
    When the tool runs with "--statusline" and this on stdin:
      """
      {"session_id":"s1","context_window":{"context_window_size":200000,"used_percentage":12},"rate_limits":{"five_hour":{"used_percentage":23,"resets_at":1793455200},"seven_day":{"used_percentage":41,"resets_at":1793696400}}}
      """
    Then it exits with 0 and prints:
      """
      5h 23% · week 41% · context 12%
      """
    And the file "claude-home/turn-tokens/statusline-s1.json" contains exactly:
      """
      {"schema":"turn-tokens/v1","at":"2026-10-31T09:20:00.000Z","session":"s1","contextWindow":200000,"rateLimits":{"five_hour":{"used_percentage":23,"resets_at":1793455200},"seven_day":{"used_percentage":41,"resets_at":1793696400}}}
      """

  Scenario: TT-12 without plan limits (an API key) the status line shows the context use only
    When the tool runs with "--statusline" and this on stdin:
      """
      {"session_id":"s1","context_window":{"context_window_size":200000,"used_percentage":12}}
      """
    Then it exits with 0 and prints:
      """
      context 12%
      """

  # ---- Codex ------------------------------------------------------------------------------------------

  Scenario: TT-3 TT-5 TT-7 TT-8 TT-9 TT-10 a Codex turn: its records, its tools, its subagent thread, credits and limits
    When the tool runs with "--hook codex --text" and this on stdin:
      """
      {"session_id":"t1","transcript_path":"{root}/codex-home/sessions/2026/10/31/rollout-2026-10-31T09-00-00-t1.jsonl","turn_id":"turn-b","hook_event_name":"Stop"}
      """
    Then it exits with 0 and prints:
      """
      Turn 2 · 3 calls · peak context 26,000 of 258,400 (10%) · new input 11,000 · cache read 60,000 · output 1,000 · ≈ 5.50 credits
        tools: exec ×2, collaboration.spawn_agent
        subagents: 2 calls · output 160 · ≈ 0.01 credits · tools: exec
      Session · 5 calls · new input 14,000 · cache read 78,000 · output 1,160 · ≈ 6.90 credits
        subagents: 2 calls · output 160 · ≈ 0.01 credits
      Limits · 5-hour 15% used, resets 31 Oct 14:00 · weekly 2% used, resets 3 Nov 09:00
      """

  Scenario: TT-3 without a turn_id the last turn is reported
    When the tool runs with "--hook codex --text" and this on stdin:
      """
      {"session_id":"t1","transcript_path":"{root}/codex-home/sessions/2026/10/31/rollout-2026-10-31T09-00-00-t1.jsonl"}
      """
    Then the output has the line "Turn 2 · 3 calls · peak context 26,000 of 258,400 (10%) · new input 11,000 · cache read 60,000 · output 1,000 · ≈ 5.50 credits"

  Scenario: TT-3 the earlier turn can be asked for by its turn_id
    When the tool runs with "--hook codex --text" and this on stdin:
      """
      {"session_id":"t1","transcript_path":"{root}/codex-home/sessions/2026/10/31/rollout-2026-10-31T09-00-00-t1.jsonl","turn_id":"turn-a"}
      """
    Then the output has the line "Turn 1 · 2 calls · peak context 11,000 of 258,400 (4%) · new input 3,000 · cache read 18,000 · output 160 · ≈ 1.40 credits"
    And the output has the line "  tools: exec"
    And the output has no line "  subagents: 2 calls · output 160 · ≈ 0.01 credits · tools: exec"

  Scenario: TT-4 a Codex turn whose final answer has no usage record yet is reported as missing it
    Given the file "codex-home/sessions/2026/10/31/rollout-2026-10-31T10-00-00-t3.jsonl" contains:
      """
      {"timestamp":"2026-10-31T10:00:00.000Z","type":"session_meta","payload":{"id":"t3","session_id":"t3","thread_source":"user"}}
      {"timestamp":"2026-10-31T10:00:01.000Z","type":"turn_context","payload":{"turn_id":"turn-p","model":"gpt-6-astra"}}
      {"timestamp":"2026-10-31T10:00:02.000Z","type":"token_usage_record","payload":{"thread_id":"t3","turn_id":"turn-p","response_id":"r1","usage":{"input_tokens":1000,"cached_input_tokens":0,"output_tokens":40}}}
      {"timestamp":"2026-10-31T10:00:03.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[]}}
      """
    When the tool runs with "--hook codex --text --wait-ms 200" and this on stdin:
      """
      {"session_id":"t3","transcript_path":"{root}/codex-home/sessions/2026/10/31/rollout-2026-10-31T10-00-00-t3.jsonl","turn_id":"turn-p"}
      """
    Then it exits with 0 and prints:
      """
      Turn 1 · 1 call · peak context 1,000 · new input 1,000 · cache read 0 · output 40 · ≈ 0.30 credits
        note: the final reply was not in the log yet; the session total will include it in the next report
      Session · 1 call · new input 1,000 · cache read 0 · output 40 · ≈ 0.30 credits
      Limits · unknown: none in this thread's log yet
      """

  Scenario: TT-9 Codex Fast mode doubles the credits
    Given in "codex-home/sessions/2026/10/31/rollout-2026-10-31T09-00-00-t1.jsonl", `"service_tier":"default"` becomes `"service_tier":"priority"`
    When the tool runs with "--hook codex --text" and this on stdin:
      """
      {"session_id":"t1","transcript_path":"{root}/codex-home/sessions/2026/10/31/rollout-2026-10-31T09-00-00-t1.jsonl","turn_id":"turn-b"}
      """
    Then the first output line ends with "≈ 11.00 credits"

  Scenario: TT-9 a Codex model with no price row is named, not priced
    Given in "codex-home/sessions/2026/10/31/rollout-2026-10-31T09-00-00-t1.jsonl", `"turn_id":"turn-b","model":"gpt-6-astra"` becomes `"turn_id":"turn-b","model":"gpt-5.5"`
    When the tool runs with "--hook codex --text" and this on stdin:
      """
      {"session_id":"t1","transcript_path":"{root}/codex-home/sessions/2026/10/31/rollout-2026-10-31T09-00-00-t1.jsonl","turn_id":"turn-b"}
      """
    Then the first output line ends with "price unknown: gpt-5.5"
    And the output has the line "Session · 5 calls · new input 14,000 · cache read 78,000 · output 1,160 · ≈ 1.40 credits + unpriced: gpt-5.5"

  Scenario: TT-10 a limit window of another length is named by its minutes
    Given in "codex-home/sessions/2026/10/31/rollout-2026-10-31T09-00-00-t1.jsonl", `"used_percent":15.0,"window_minutes":300` becomes `"used_percent":15.0,"window_minutes":60`
    When the tool runs with "--hook codex --text" and this on stdin:
      """
      {"session_id":"t1","transcript_path":"{root}/codex-home/sessions/2026/10/31/rollout-2026-10-31T09-00-00-t1.jsonl","turn_id":"turn-b"}
      """
    Then the output has the line "Limits · 60-minute 15% used, resets 31 Oct 14:00 · weekly 2% used, resets 3 Nov 09:00"

  Scenario: TT-11 every Codex report is appended to its history file in the Codex folder
    When the tool runs with "--hook codex" and this on stdin:
      """
      {"session_id":"t1","transcript_path":"{root}/codex-home/sessions/2026/10/31/rollout-2026-10-31T09-00-00-t1.jsonl","turn_id":"turn-b"}
      """
    Then the file "codex-home/turn-tokens/t1.jsonl" has a line containing "\"tool\":\"codex\",\"session\":\"t1\",\"turn\":2,\"pending\":false,\"unit\":\"credits\",\"contextWindow\":258400"

  # ---- traceability -----------------------------------------------------------------------------------

  Scenario: Every TT rule is named by a scenario and is a row in the schema
    Then every rule code the tool prints is named by a scenario in this feature
    And every rule code the tool prints is a rule row in its schemas
