# Requirements for copilot/frameworks/agentic-sdlc/tools/validate-project.mjs, as executable scenarios (specs/007).
# Each scenario title starts with the check code the validator prints. These codes are not yet rule ids in the
# store-D schemas (specs/007-project-validator-tests/research.md, finding F-1).
#
# Change policy (constitution principle IV): a changed check edits its scenario in the same commit as the validator;
# a new check adds scenarios and every existing one keeps passing. Output text is compared exactly.
#
# Characterization tests: first written to pin what the validator did on 2026-10-29. The fixture is a tiny project
# (architecture doc, integration doc, constitution, one spec with research, tasks and blueprint), a small framework
# and a procedures folder with one stack procedure.

Feature: Project validator
  The validator checks a project's store-D files (docs/, .specify/, specs/) against the framework, and with --task
  that a task's changed files stay inside its procedure's allowed paths. It exits 1 when a check fails.

  Background:
    Given the base fixture tree of "validate-project"

  Scenario: The base fixture tree passes with no warnings
    When the tool runs
    Then it passes with no warnings

  Scenario: LINT a component without any of the lint config files fails
    Given the file "project/src/demo.lint.json" is removed
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        LINT  component app (stack demo): none of demo.lint.json, .demolintrc found; stacks/demo/idioms.md lint-baseline requires one
      """

  Scenario: LINT a lint config without a required entry fails
    Given in "project/src/demo.lint.json", `no-deep-imports` becomes `other-rule`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        LINT  component app (stack demo): demo.lint.json lacks ""no-deep-imports"" (stacks/demo/idioms.md lint-baseline)
      """

  Scenario: LINT a conditional requirement applies when its file has the key
    Given the file "project/src/demo.toml" contains:
      """
      { "modules": [] }
      """
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        LINT  component app (stack demo): demo.lint.json lacks ""module-boundaries"" (stacks/demo/idioms.md lint-baseline, because demo.toml has "modules")
      """

  Scenario: TREE a cited tree node that no tree defines fails
    Given in "project/specs/001-demo/research.md", `TS-Q1 (YES)` becomes `TS-Q9 (YES)`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TREE  specs/001-demo/research.md: tree node TS-Q9 is not defined in framework trees
      """

  Scenario: RULE a cited rule id that no rule table defines warns
    Given in "project/docs/architecture.md", `Follows DEM-1.` becomes `Follows DEM-9.`
    When the tool runs
    Then it exits with 0 and prints:
      """
      PASS (1 warning(s))
        RULE  docs/architecture.md: cited rule id DEM-9 was not found in foundations/stacks/paradigms
      """

  Scenario: ARCH a missing architecture doc fails
    Given the file "project/docs/architecture.md" is removed
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (4)
        ARCH  docs/architecture.md is missing; run the Agentic SDLC bootstrap procedure to create repo architecture state
        INT  docs/integrations/payments.md: service payments has no row in docs/architecture.md §6
        TASK  specs/001-demo/tasks.md:4: refs path docs/architecture.md does not exist
        TASK  specs/001-demo/tasks.md:3: task with a procedure needs a path in (…) inside a component of architecture §3
      """

  Scenario: ARCH an architecture doc without front-matter fails
    Given in "project/docs/architecture.md", `---\nschema: repo-architecture/v2\nlast-updated: 2026-10-01\nupdated-by: architecture\n---\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md: missing front-matter
      """

  Scenario: ARCH a schema other than repo-architecture/v2 fails
    Given in "project/docs/architecture.md", `schema: repo-architecture/v2` becomes `schema: repo-architecture/v1`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md: schema must be repo-architecture/v2 (got repo-architecture/v1)
      """

  Scenario: ARCH a missing last-updated fails
    Given in "project/docs/architecture.md", `last-updated: 2026-10-01\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md: last-updated missing
      """

  Scenario: ARCH a missing updated-by fails
    Given in "project/docs/architecture.md", `updated-by: architecture\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md: updated-by missing
      """

  Scenario: ARCH a missing section fails
    Given in "project/docs/architecture.md", `## 9. Verification status\nChecked.\n\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md: section "## 9. Verification status" missing
      """

  Scenario: ARCH sections out of order fail
    Given in "project/docs/architecture.md", `## 9. Verification status\nChecked.\n\n## 10. Known gaps / out of scope\nNone.` becomes `## 10. Known gaps / out of scope\nNone.\n\n## 9. Verification status\nChecked.`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md: sections are out of order
      """

  Scenario: ARCH a Components section without a yaml block fails
    Given in "project/docs/architecture.md", ````yaml\ncomponents:` becomes ````text\ncomponents:`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        ARCH  docs/architecture.md §3: missing fenced yaml block
        TASK  specs/001-demo/tasks.md:3: task with a procedure needs a path in (…) inside a component of architecture §3
      """

  Scenario: ARCH an empty components list fails
    Given in "project/docs/architecture.md", `  - { name: app, path: src/, kind: service, stack: demo, framework: web, paradigm: demo-paradigm@1, decisions: [DR-001] }` becomes `  []`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (3)
        ARCH  docs/architecture.md §3: components list is empty or unparsable
        ARCH  docs/architecture.md §3: source directory src/modules/ is not covered by a component path
        TASK  specs/001-demo/tasks.md:3: task with a procedure needs a path in (…) inside a component of architecture §3
      """

  Scenario: ARCH a component without a kind fails
    Given in "project/docs/architecture.md", `kind: service, stack: demo` becomes `stack: demo`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md §3 component app: missing kind
      """

  Scenario: ARCH a duplicate component name fails
    Given in "project/docs/architecture.md", `  - { name: app, path: src/, kind: service, stack: demo, framework: web, paradigm: demo-paradigm@1, decisions: [DR-001] }` becomes `  - { name: app, path: src/, kind: service, stack: demo, framework: web, paradigm: demo-paradigm@1, decisions: [DR-001] }\n  - { name: app, path: src/modules/, kind: library, stack: demo, decisions: [DR-001] }`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        ARCH  docs/architecture.md §3 component app: duplicate component name
        LINT  component app (stack demo): none of demo.lint.json, .demolintrc found; stacks/demo/idioms.md lint-baseline requires one
      """

  Scenario: ARCH a duplicate component path fails
    Given in "project/docs/architecture.md", `  - { name: app, path: src/, kind: service, stack: demo, framework: web, paradigm: demo-paradigm@1, decisions: [DR-001] }` becomes `  - { name: app, path: src/, kind: service, stack: demo, framework: web, paradigm: demo-paradigm@1, decisions: [DR-001] }\n  - { name: lib, path: src/, kind: library, stack: demo, decisions: [DR-001] }`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md §3 component lib: duplicate component path src/
      """

  Scenario: ARCH an invalid component kind fails
    Given in "project/docs/architecture.md", `kind: service` becomes `kind: app`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md §3 component app: invalid kind app
      """

  Scenario: ARCH a component path that does not exist fails
    Given in "project/docs/architecture.md", `path: src/, kind` becomes `path: app/, kind`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (4)
        ARCH  docs/architecture.md §3 component app: path app/ does not exist
        LINT  component app (stack demo): none of demo.lint.json, .demolintrc found; stacks/demo/idioms.md lint-baseline requires one
        ARCH  docs/architecture.md §3: source directory src/modules/ is not covered by a component path
        TASK  specs/001-demo/tasks.md:3: task with a procedure needs a path in (…) inside a component of architecture §3
      """

  Scenario: ARCH a code component without a stack fails
    Given in "project/docs/architecture.md", `  - { name: app, path: src/, kind: service, stack: demo, framework: web, paradigm: demo-paradigm@1, decisions: [DR-001] }` becomes `  - { name: app, path: src/, kind: service }`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md §3 component app: code component missing stack
      """

  Scenario: ARCH a stack the framework does not define fails
    Given in "project/docs/architecture.md", `stack: demo, framework` becomes `stack: other, framework`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (3)
        ARCH  docs/architecture.md §3 component app: stack other is not defined under framework stacks/
        ARCH  docs/architecture.md §3 component app: paradigm demo-paradigm@1 does not support stack other
        TASK  specs/001-demo/tasks.md:4: procedure demo/add-entity is for stack demo, but the task path's component app is other
      """

  Scenario: ARCH a framework the stack does not list fails
    Given in "project/docs/architecture.md", `framework: web` becomes `framework: api`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md §3 component app: framework api is not listed by stack demo
      """

  Scenario: ARCH a paradigm that is not id@version fails
    Given in "project/docs/architecture.md", `paradigm: demo-paradigm@1,` becomes `paradigm: demo-paradigm,`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md §3 component app: paradigm demo-paradigm is not defined as id@version
      """

  Scenario: ARCH a paradigm that does not support the stack fails
    Given in "framework/paradigms/demo-paradigm.md", `supports: [demo]` becomes `supports: [other]`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md §3 component app: paradigm demo-paradigm@1 does not support stack demo
      """

  Scenario: ARCH a component with a stack but no decisions fails
    Given in "project/docs/architecture.md", `, decisions: [DR-001] }` becomes ` }`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md §3 component app: decisions are required when stack or paradigm is set
      """

  Scenario: ARCH a component decision that does not exist fails
    Given in "project/docs/architecture.md", `decisions: [DR-001]` becomes `decisions: [DR-001, DR-002]`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        ARCH  docs/architecture.md §3 component app: decision DR-002 not found in specs/*/research.md
        ARCH  decision DR-002 referenced by architecture does not exist
      """

  Scenario: ARCH a source folder no component covers fails
    Given in "project/docs/architecture.md", `  - { name: app, path: src/, kind: service, stack: demo, framework: web, paradigm: demo-paradigm@1, decisions: [DR-001] }` becomes `  - { name: app, path: src/modules/, kind: service, stack: demo, framework: web, paradigm: demo-paradigm@1, decisions: [DR-001] }`
    And the folder "project/src/tools" exists
    And the file "project/src/modules/demo.lint.json" contains:
      """
      { "rules": ["no-deep-imports"] }
      """
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md §3: source directory src/tools/ is not covered by a component path
      """

  Scenario: ARCH a Layers section without a yaml block fails
    Given in "project/docs/architecture.md", ````yaml\nmodules:` becomes ````text\nmodules:`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md §4: missing fenced yaml block
      """

  Scenario: ARCH an empty layers list fails
    Given in "project/docs/architecture.md", `layers:\n  - { name: domain, path: domain/, may-depend-on: [] }\n  - { name: application, path: application/, may-depend-on: [domain] }` becomes `layers:\n  []`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md §4: layers list is empty or unparsable
      """

  Scenario: ARCH a module without public fails
    Given in "project/docs/architecture.md", `, public: index.ts }` becomes ` }`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md §4 module orders: missing public
      """

  Scenario: ARCH a module path that does not exist fails
    Given in "project/docs/architecture.md", `path: src/modules/orders/,` becomes `path: src/modules/billing/,`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (3)
        ARCH  docs/architecture.md §4 module orders: path src/modules/billing/ does not exist
        ARCH  docs/architecture.md §4 layer domain: path src/modules/billing/domain/ does not exist (every module has every layer; an empty one keeps a .gitkeep)
        ARCH  docs/architecture.md §4 layer application: path src/modules/billing/application/ does not exist (every module has every layer; an empty one keeps a .gitkeep)
      """

  Scenario: ARCH a module dependency that is not a module fails
    Given in "project/docs/architecture.md", `{ name: orders, path: src/modules/orders/, may-depend-on: []` becomes `{ name: orders, path: src/modules/orders/, may-depend-on: [billing]`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md §4 module orders: may-depend-on target billing is not a module
      """

  Scenario: ARCH a layer without may-depend-on fails
    Given in "project/docs/architecture.md", `{ name: domain, path: domain/, may-depend-on: [] }` becomes `{ name: domain, path: domain/ }`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md §4 layer domain: missing may-depend-on
      """

  Scenario: ARCH a layer path that does not exist fails without modules
    Given in "project/docs/architecture.md", `modules:\n  - { name: orders, path: src/modules/orders/, may-depend-on: [], public: index.ts }\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        ARCH  docs/architecture.md §4 layer domain: path domain/ does not exist
        ARCH  docs/architecture.md §4 layer application: path application/ does not exist
      """

  Scenario: ARCH a module missing a layer folder fails
    Given the folder "project/src/modules/orders/application" is removed
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md §4 layer application: path src/modules/orders/application/ does not exist (every module has every layer; an empty one keeps a .gitkeep)
      """

  Scenario: ARCH a layer dependency that is not a layer fails
    Given in "project/docs/architecture.md", `may-depend-on: [domain] }` becomes `may-depend-on: [infrastructure] }`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md §4 layer application: may-depend-on target infrastructure is not a layer
      """

  Scenario: ARCH a layer paradigm that is not defined fails
    Given in "project/docs/architecture.md", `{ name: domain, path: domain/, may-depend-on: [] }` becomes `{ name: domain, path: domain/, may-depend-on: [], paradigm: other@1 }`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md §4 layer domain: paradigm other@1 is not defined
      """

  Scenario: ARCH TypeScript manifests without a typescript-node component fail
    Given the file "project/package.json" contains:
      """
      { "name": "demo" }
      """
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  Manifest detection found TypeScript/Node files, but no component declares stack: typescript-node
      """

  Scenario: ARCH an integration doc that does not exist fails
    Given in "project/docs/architecture.md", `| docs/integrations/payments.md |` becomes `| docs/integrations/pay.md |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        ARCH  docs/architecture.md §6: integration doc docs/integrations/pay.md for payments does not exist
      """

  Scenario: ARCH a Key decisions row that does not exist fails
    Given in "project/docs/architecture.md", `| DR-001 | Use the demo stack |` becomes `| DR-001 | Use the demo stack |\n| DR-003 | Keep it small |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (2)
        ARCH  docs/architecture.md §8: decision DR-003 not found in specs/*/research.md
        ARCH  decision DR-003 referenced by architecture does not exist
      """

  Scenario: INT an integration doc without front-matter fails
    Given in "project/docs/integrations/payments.md", `---\nschema: integration/v1\nservice: payments\n---\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        INT  docs/integrations/payments.md: missing front-matter
      """

  Scenario: INT a schema other than integration/v1 fails
    Given in "project/docs/integrations/payments.md", `schema: integration/v1` becomes `schema: integration/v2`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        INT  docs/integrations/payments.md: schema must be integration/v1
      """

  Scenario: INT an integration doc without service fails
    Given in "project/docs/integrations/payments.md", `service: payments\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        INT  docs/integrations/payments.md: service missing
      """

  Scenario: INT a service with no architecture row fails
    Given in "project/docs/integrations/payments.md", `service: payments` becomes `service: billing`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        INT  docs/integrations/payments.md: service billing has no row in docs/architecture.md §6
      """

  Scenario: INT a missing section fails
    Given in "project/docs/integrations/payments.md", `## Limits\nNone.\n\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        INT  docs/integrations/payments.md: section "## Limits" missing
      """

  Scenario: SECRET a token-like value in an integration doc fails
    Given in "project/docs/integrations/payments.md", `Env var PAYMENTS_KEY.` becomes `token: abcdefghijklmnopqrstuvwx`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        SECRET  docs/integrations/payments.md: possible secret value found; integration docs may list env var names only
      """

  Scenario: CONST a missing framework section fails
    Given in "project/.specify/memory/constitution.md", `## Agentic SDLC: style deviations\n> _Framework defaults apply._\n\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        CONST  .specify/memory/constitution.md: section "## Agentic SDLC: style deviations" missing
      """

  Scenario: CONST a missing Default paradigm line fails
    Given in "project/.specify/memory/constitution.md", `- **Default paradigm:** demo-paradigm@1` becomes `- Paradigm: demo-paradigm@1`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        CONST  .specify/memory/constitution.md: Default paradigm line missing
      """

  Scenario: CONST a default paradigm that is not defined fails
    Given in "project/.specify/memory/constitution.md", `demo-paradigm@1` becomes `other@1`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        CONST  .specify/memory/constitution.md: default paradigm other@1 is not defined
      """

  Scenario: CONST a default paradigm of none passes
    Given in "project/.specify/memory/constitution.md", `**Default paradigm:** demo-paradigm@1` becomes `**Default paradigm:** none`
    When the tool runs
    Then it exits with 0 and prints:
      """
      PASS (0 warning(s))
      """

  Scenario: CONST a budgets section without a table fails
    Given in "project/.specify/memory/constitution.md", `| Loop | Budget |\n|---|---|\n| Re-execute after failed check | 2 |` becomes `Two each.`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        CONST  .specify/memory/constitution.md: budgets table missing
      """

  Scenario: CONST a budget that is not an integer fails
    Given in "project/.specify/memory/constitution.md", `| Re-execute after failed check | 2 |` becomes `| Re-execute after failed check | two |`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        CONST  .specify/memory/constitution.md: budget for "Re-execute after failed check" is not an integer
      """

  Scenario: BP a blueprint without front-matter fails
    Given in "project/specs/001-demo/blueprint.md", `---\nschema: blueprint/v2\nmission_type: feature\naffected: [app]\nbased_on: DR-001\napproved_at: G0\n---\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        BP  specs/001-demo/blueprint.md: missing front-matter
      """

  Scenario: BP a schema other than blueprint/v2 fails
    Given in "project/specs/001-demo/blueprint.md", `schema: blueprint/v2` becomes `schema: blueprint/v1`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        BP  specs/001-demo/blueprint.md: schema must be blueprint/v2
      """

  Scenario: BP a missing front-matter key fails
    Given in "project/specs/001-demo/blueprint.md", `approved_at: G0\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        BP  specs/001-demo/blueprint.md: front-matter approved_at missing
      """

  Scenario: BP a missing section fails
    Given in "project/specs/001-demo/blueprint.md", `## Assumptions\nNone.\n\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        BP  specs/001-demo/blueprint.md: section "## Assumptions" missing
      """

  Scenario: BP more than 3 open questions fail
    Given in "project/specs/001-demo/blueprint.md", `1. Which name?` becomes `1. Which name?\n2. Which store?\n3. Which owner?\n4. Which date?`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        BP  specs/001-demo/blueprint.md: Open questions has 4; max is 3
      """

  Scenario: DR a duplicate decision id fails
    Given in "project/specs/001-demo/research.md", `- **Decided by:** human · **Approved at:** G3 (2026-10-01)` becomes `- **Decided by:** human · **Approved at:** G3 (2026-10-01)\n\n## DR-001: Again\n- **Tree path:** none\n- **Criteria:** x\n- **Options considered:** a | b\n- **Chosen:** a\n- **Rejected:** b — no\n- **Confidence:** low\n- **Supersedes:** none\n- **Decided by:** human`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        DR  specs/001-demo/research.md: duplicate decision id DR-001
      """

  Scenario: DR a missing field fails
    Given in "project/specs/001-demo/research.md", `- **Criteria:** the mission names it.\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        DR  specs/001-demo/research.md DR-001: field "Criteria" missing or not bold
      """

  Scenario: DR an empty Rejected fails
    Given in "project/specs/001-demo/research.md", `- **Rejected:** other — not named.` becomes `- **Rejected:** none`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        DR  specs/001-demo/research.md DR-001: Rejected must name at least one rejected alternative
      """

  Scenario: DR a Confidence outside high, medium, low fails
    Given in "project/specs/001-demo/research.md", `- **Confidence:** high` becomes `- **Confidence:** sure`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        DR  specs/001-demo/research.md DR-001: Confidence must be high, medium, or low
      """

  Scenario: DR a Supersedes target that does not exist fails
    Given in "project/specs/001-demo/research.md", `- **Supersedes:** none` becomes `- **Supersedes:** DR-000`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        DR  specs/001-demo/research.md DR-001: Supersedes target DR-000 does not exist
      """

  Scenario: DR a Decided by that is not a role or human fails
    Given in "project/specs/001-demo/research.md", `- **Decided by:** human` becomes `- **Decided by:** boss`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        DR  specs/001-demo/research.md DR-001: Decided by boss is not a role id or human
      """

  Scenario: DR a Decided by that names a role passes
    Given in "project/specs/001-demo/research.md", `- **Decided by:** human` becomes `- **Decided by:** engineering`
    When the tool runs
    Then it passes with no warnings

  Scenario: TASK a task without a department tag fails
    Given in "project/specs/001-demo/tasks.md", `[Eng] [script]` becomes `[script]`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TASK  specs/001-demo/tasks.md:6: missing department tag from conventions.md roles
      """

  Scenario: TASK a task without an executor tag fails
    Given in "project/specs/001-demo/tasks.md", `[Eng] [script]` becomes `[Eng]`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TASK  specs/001-demo/tasks.md:6: missing executor tag [llm] or [script]
      """

  Scenario: TASK an llm task without a continuation line fails
    Given in "project/specs/001-demo/tasks.md", `  touches: none · refs: docs/architecture.md · procedure: demo/add-entity\n  inputs: name=Order; module=modules/orders\n` becomes ``
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TASK  specs/001-demo/tasks.md:3: [llm] task missing continuation line with touches/refs
      """

  Scenario: TASK an empty touches fails
    Given in "project/specs/001-demo/tasks.md", `touches: none ·` becomes `touches:  ·`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TASK  specs/001-demo/tasks.md:4: touches must be explicit (none or integration:<svc>)
      """

  Scenario: TASK an invalid touches entry fails
    Given in "project/specs/001-demo/tasks.md", `touches: none ·` becomes `touches: payments ·`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TASK  specs/001-demo/tasks.md:4: invalid touches entry payments
      """

  Scenario: TASK an integration without an architecture row fails
    Given in "project/specs/001-demo/tasks.md", `touches: none ·` becomes `touches: integration:billing ·`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TASK  specs/001-demo/tasks.md:4: integration billing has no architecture §6 row
      """

  Scenario: TASK an empty refs fails, and the rest of the line is still read
    Given in "project/specs/001-demo/tasks.md", `refs: docs/architecture.md ·` becomes `refs:  ·`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TASK  specs/001-demo/tasks.md:4: refs must be explicit (none or paths)
      """

  Scenario: TASK an empty refs at the end of the line fails
    Given in "project/specs/001-demo/tasks.md", `refs: docs/architecture.md · procedure: demo/add-entity\n  inputs: name=Order; module=modules/orders` becomes `refs:`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TASK  specs/001-demo/tasks.md:4: refs must be explicit (none or paths)
      WARN (1)
        TASK  specs/001-demo/tasks.md:4: stack demo has a procedure catalog; state procedure: none or procedure: demo/<slug>
      """

  Scenario: TASK a hot-path other than yes or no fails
    Given in "project/specs/001-demo/tasks.md", `procedure: demo/add-entity` becomes `procedure: demo/add-entity · hot-path: maybe`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TASK  specs/001-demo/tasks.md:4: hot-path must be yes or no
      """

  Scenario: TASK a hot-path of yes passes
    Given in "project/specs/001-demo/tasks.md", `procedure: demo/add-entity` becomes `procedure: demo/add-entity · hot-path: yes`
    When the tool runs
    Then it passes with no warnings

  Scenario: TASK continuation fields may come in another order
    Given in "project/specs/001-demo/tasks.md", `touches: none · refs: docs/architecture.md · procedure: demo/add-entity` becomes `refs: docs/architecture.md · procedure: demo/add-entity · touches: none`
    When the tool runs
    Then it passes with no warnings

  Scenario: TASK a refs path that does not exist fails
    Given in "project/specs/001-demo/tasks.md", `refs: docs/architecture.md` becomes `refs: docs/missing.md`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TASK  specs/001-demo/tasks.md:4: refs path docs/missing.md does not exist
      """

  Scenario: TASK a refs path under AGENT_HOME resolves there
    Given in "project/specs/001-demo/tasks.md", `refs: docs/architecture.md` becomes `refs: {{AGENT_HOME}}/knowledge/shared.md`
    When the tool runs
    Then it exits with 0 and prints:
      """
      PASS (0 warning(s))
      """

  Scenario: TASK no procedure while the stack has a catalog warns
    Given in "project/specs/001-demo/tasks.md", ` · procedure: demo/add-entity\n  inputs: name=Order; module=modules/orders` becomes ``
    And in "project/specs/001-demo/tasks.md", `(src/modules/orders/domain/Order.ts) [Eng] [llm]` becomes `(src/modules/orders/domain/Order.ts) [Eng] [llm]`
    When the tool runs
    Then it exits with 0 and prints:
      """
      PASS (1 warning(s))
        TASK  specs/001-demo/tasks.md:4: stack demo has a procedure catalog; state procedure: none or procedure: demo/<slug>
      """

  Scenario: TASK a procedure not shaped stack/slug fails
    Given in "project/specs/001-demo/tasks.md", `procedure: demo/add-entity` becomes `procedure: add-entity`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TASK  specs/001-demo/tasks.md:4: procedure must be none or <stack>/<slug>, got add-entity
      """

  Scenario: TASK a procedure that does not exist fails
    Given in "project/specs/001-demo/tasks.md", `procedure: demo/add-entity` becomes `procedure: demo/add-port`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TASK  specs/001-demo/tasks.md:4: procedure demo/add-port not found at {root}/procedures/demo/add-port.procedure.md
      """

  Scenario: TASK a procedure for another stack fails
    Given the folder "procedures/other" exists
    And the file "procedures/other/add-entity.procedure.md" contains:
      """
      ---
      stack: other
      inputs: [name, module?]
      allowed-paths:
        - {module}/domain/{name}.ts
      ---
      """
    And in "project/specs/001-demo/tasks.md", `procedure: demo/add-entity` becomes `procedure: other/add-entity`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TASK  specs/001-demo/tasks.md:4: procedure other/add-entity is for stack other, but the task path's component app is demo
      """

  Scenario: TASK a procedure task without a component path fails
    Given in "project/specs/001-demo/tasks.md", `Add the order entity (src/modules/orders/domain/Order.ts) [Eng]` becomes `Add the order entity [Eng]`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TASK  specs/001-demo/tasks.md:3: task with a procedure needs a path in (…) inside a component of architecture §3
      """

  Scenario: TASK a required procedure input that is missing fails
    Given in "project/specs/001-demo/tasks.md", `inputs: name=Order; module=modules/orders` becomes `inputs: module=modules/orders`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TASK  specs/001-demo/tasks.md:5: procedure demo/add-entity needs input name (inputs: name=<value>; …)
      """

  Scenario: TASK an input the procedure does not declare fails
    Given in "project/specs/001-demo/tasks.md", `inputs: name=Order; module=modules/orders` becomes `inputs: name=Order; module=modules/orders; kind=entity`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TASK  specs/001-demo/tasks.md:5: input kind is not declared by procedure demo/add-entity
      """

  Scenario: TASK inputs without a procedure fail
    Given in "project/specs/001-demo/tasks.md", ` · procedure: demo/add-entity` becomes ` · procedure: none`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TASK  specs/001-demo/tasks.md:5: inputs: given but the task has no procedure
      """

  Scenario: TASK a decision reference that does not exist fails
    Given in "project/specs/001-demo/tasks.md", `T002 Run the formatter` becomes `T002 Run the formatter (see DR-009)`
    When the tool runs
    Then it exits with 1 and prints:
      """
      FAIL (1)
        TASK  specs/001-demo/tasks.md: decision reference DR-009 does not exist in research.md
      """

  Scenario: SCOPE a task with no procedure task line fails
    Given "project" is a git repository with everything committed
    When the tool runs with "--task T009"
    Then it exits with 1 and prints:
      """
      FAIL (1)
        SCOPE  --task T009: no such [llm] task with a procedure: field in specs/*/tasks.md
      """

  Scenario: SCOPE a task with procedure none only warns
    Given in "project/specs/001-demo/tasks.md", ` · procedure: demo/add-entity\n  inputs: name=Order; module=modules/orders` becomes ` · procedure: none`
    And "project" is a git repository with everything committed
    When the tool runs with "--task T001"
    Then it exits with 0 and prints:
      """
      PASS (1 warning(s))
        SCOPE  T001: procedure: none, so there is no scope to check
      """

  Scenario: SCOPE changes inside the allowed paths pass with a note
    Given "project" is a git repository with everything committed
    And the file "project/src/modules/orders/domain/Order.ts" contains:
      """
      export class Order {}
      """
    When the tool runs with "--task T001"
    Then it exits with 0 and prints:
      """
      PASS (1 warning(s))
        SCOPE  T001: 1 changed file(s), all inside demo/add-entity allowed-paths
      """

  Scenario: SCOPE a change outside the allowed paths fails
    Given "project" is a git repository with everything committed
    And the file "project/src/modules/orders/application/PlaceOrder.ts" contains:
      """
      export class PlaceOrder {}
      """
    When the tool runs with "--task T001"
    Then it exits with 1 and prints:
      """
      FAIL (1)
        SCOPE  T001 (demo/add-entity): src/modules/orders/application/PlaceOrder.ts is outside the procedure's allowed-paths (modules/orders/domain/Order.ts)
      """

  Scenario: SCOPE a project that is not a git repository fails
    When the tool runs with "--task T001"
    Then it exits with 1 and prints:
      """
      FAIL (1)
        SCOPE  --task T001: git failed (Command failed: git -C {root}/project diff --relative --name-only HEAD)
      warning: Not a git repository. Use --no-index to compare two paths outside a working tree
      usage: git diff --no-index [<options>] <path> <path>

      Diff output format options
          -p, --patch           generate patch
          -s, --no-patch        suppress diff output
          -u                    generate patch
          -U, --unified[=<n>]   generate diffs with <n> lines context
          -W, --[no-]function-context
                                generate diffs with <n> lines context
          --raw                 generate the diff in raw format
          --patch-with-raw      synonym for '-p --raw'
          --patch-with-stat     synonym for '-p --stat'
          --numstat             machine friendly --stat
          --shortstat           output only the last line of --stat
          -X, --dirstat[=<param1>,<param2>...]
                                output the distribution of relative amount of changes for each sub-directory
          --cumulative          synonym for --dirstat=cumulative
          --dirstat-by-file[=<param1>,<param2>...]
                                synonym for --dirstat=files,<param1>,<param2>...
          --check               warn if changes introduce conflict markers or whitespace errors
          --summary             condensed summary such as creations, renames and mode changes
          --name-only           show only names of changed files
          --name-status         show only names and status of changed files
          --stat[=<width>[,<name-width>[,<count>]]]
                                generate diffstat
          --stat-width <width>  generate diffstat with a given width
          --stat-name-width <width>
                                generate diffstat with a given name width
          --stat-graph-width <width>
                                generate diffstat with a given graph width
          --stat-count <count>  generate diffstat with limited lines
          --[no-]compact-summary
                                generate compact summary in diffstat
          --binary              output a binary diff that can be applied
          --[no-]full-index     show full pre- and post-image object names on the "index" lines
          --[no-]color[=<when>] show colored diff
          --ws-error-highlight <kind>
                                highlight whitespace errors in the 'context', 'old' or 'new' lines in the diff
          -z                    do not munge pathnames and use NULs as output field terminators in --raw or --numstat
          --[no-]abbrev[=<n>]   use <n> digits to display object names
          --src-prefix <prefix> show the given source prefix instead of "a/"
          --dst-prefix <prefix> show the given destination prefix instead of "b/"
          --line-prefix <prefix>
                                prepend an additional prefix to every line of output
          --no-prefix           do not show any source or destination prefix
          --default-prefix      use default prefixes a/ and b/
          --inter-hunk-context <n>
                                show context between diff hunks up to the specified number of lines
          --output-indicator-new <char>
                                specify the character to indicate a new line instead of '+'
          --output-indicator-old <char>
                                specify the character to indicate an old line instead of '-'
          --output-indicator-context <char>
                                specify the character to indicate a context instead of ' '

      Diff rename options
          -B, --break-rewrites[=<n>[/<m>]]
                                break complete rewrite changes into pairs of delete and create
          -M, --find-renames[=<n>]
                                detect renames
          -D, --irreversible-delete
                                omit the preimage for deletes
          -C, --find-copies[=<n>]
                                detect copies
          --[no-]find-copies-harder
                                use unmodified files as source to find copies
          --no-renames          disable rename detection
          --[no-]rename-empty   use empty blobs as rename source
          --[no-]follow         continue listing the history of a file beyond renames
          -l <n>                prevent rename/copy detection if the number of rename/copy targets exceeds given limit

      Diff algorithm options
          --minimal             produce the smallest possible diff
          -w, --ignore-all-space
                                ignore whitespace when comparing lines
          -b, --ignore-space-change
                                ignore changes in amount of whitespace
          --ignore-space-at-eol ignore changes in whitespace at EOL
          --ignore-cr-at-eol    ignore carrier-return at the end of line
          --ignore-blank-lines  ignore changes whose lines are all blank
          -I, --[no-]ignore-matching-lines <regex>
                                ignore changes whose all lines match <regex>
          --[no-]indent-heuristic
                                heuristic to shift diff hunk boundaries for easy reading
          --patience            generate diff using the "patience diff" algorithm
          --histogram           generate diff using the "histogram diff" algorithm
          --diff-algorithm <algorithm>
                                choose a diff algorithm
          --anchored <text>     generate diff using the "anchored diff" algorithm
          --word-diff[=<mode>]  show word diff, using <mode> to delimit changed words
          --word-diff-regex <regex>
                                use <regex> to decide what a word is
          --color-words[=<regex>]
                                equivalent to --word-diff=color --word-diff-regex=<regex>
          --[no-]color-moved[=<mode>]
                                moved lines of code are colored differently
          --[no-]color-moved-ws <mode>
                                how white spaces are ignored in --color-moved

      Other diff options
          --[no-]relative[=<prefix>]
                                when run from subdir, exclude changes outside and show relative paths
          -a, --[no-]text       treat all files as text
          -R                    swap two inputs, reverse the diff
          --[no-]exit-code      exit with 1 if there were differences, 0 otherwise
          --[no-]quiet          disable all output of the program
          --[no-]ext-diff       allow an external diff helper to be executed
          --[no-]textconv       run external text conversion filters when comparing binary files
          --ignore-submodules[=<when>]
                                ignore changes to submodules in the diff generation
          --submodule[=<format>]
                                specify how differences in submodules are shown
          --ita-invisible-in-index
                                hide 'git add -N' entries from the index
          --ita-visible-in-index
                                treat 'git add -N' entries as real in the index
          -S <string>           look for differences that change the number of occurrences of the specified string
          -G <regex>            look for differences that change the number of occurrences of the specified regex
          --pickaxe-all         show all changes in the changeset with -S or -G
          --pickaxe-regex       treat <string> in -S as extended POSIX regular expression
          -O <file>             control the order in which files appear in the output
          --rotate-to <path>    show the change in the specified path first
          --skip-to <path>      skip the output to the specified path
          --find-object <object-id>
                                look for differences that change the number of occurrences of the specified object
          --diff-filter [(A|C|D|M|R|T|U|X|B)...[*]]
                                select files by diff type
          --output <file>       output to a specific file
      """

  # ---- traceability (TST-14) -----------------------------------------------------------------------

  Scenario: Every check code the validator prints has a scenario
    Then every rule code the tool prints is named by a scenario in this feature
