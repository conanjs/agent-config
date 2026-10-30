# Conventions (fixture)

## 1. Roles
roles:
  - { id: orchestrator, tag: "—", tier: Top, file: agents/orchestrator.md }
  - { id: engineering, tag: "[Eng]", tier: Mid, file: agents/engineering.md }

## 4. Profile dimensions
profile_dimensions:
  - { id: stack, required_for: code, folder: stacks/, skill: sdlc-stack-<id>, selected_by: engineering, tree: TS, layer_override: false }
  - { id: paradigm, required_for: none, folder: paradigms/, skill: sdlc-paradigm-<id>, selected_by: engineering, tree: none, layer_override: true }
