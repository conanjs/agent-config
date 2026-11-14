# `components-list/v1` and `components-lock/v1`

**Instances:** `components.yaml` (agent-config root, public), `{{AGENT_HOME}}/components.local.yaml` (never tracked), `{{AGENT_HOME}}/components.lock` (installer only, JSON on disk) · **Owner:** agent-config · **Consumers:** installer, doctor, `add`, `use`, `plan` · **Record:** DR-403 (with security M-02, M-07) · **Spec:** FR-014, FR-019, FR-020, FR-028, AC-3.1 to AC-3.8

## Lists

```yaml
# components.yaml (public)
schema: components-list/v1
local: false
components:                              # name + source only; the slot comes from each component.yaml
  - name: agent-knowledge
    source: { type: git, url: https://github.com/conanjs/agent-knowledge.git, ref: main }
  - name: agentic-sdlc
    source: { type: git, url: https://github.com/conanjs/agentic-sdlc.git, ref: v1.0.0 }   # a tag (A-5)
  - name: agent-companies
    source: { type: git, url: https://github.com/conanjs/agent-companies.git, ref: main }
---
# {{AGENT_HOME}}/components.local.yaml (written only by V, `add` or `use`; backed up before each rewrite, A-D3)
schema: components-list/v1
local: true
components:
  - name: agent-knowledge                # a known name: overrides its source
    source: { type: path, path: ~/workspace/agent-knowledge }           # live link; lock records live
  - name: my-notes                       # a new name: adds a component
    source: { type: archive, url: https://example.invalid/n.tgz, sha256: "…" }   # recognised, refused in this release (AC-3.7)
```

| Id | Rule |
|---|---|
| CL-1 | Local entries merge by name and win over public ones; `plan` shows the override (FR-019, Edge Cases) |
| CL-2 | `components.local.yaml` and `variables.local.yaml` never lie inside a tracked path; the repo check fails naming the file (AC-3.8) |
| CL-3 | `source.type` is `git` (`url` with scheme `https` or `ssh`, `ref`), `path` (`path`) or `archive` (`url`, `sha256`; refused for now) |
| CL-4 | A source URL with a user-info part (`user:pass@`) fails validation, naming the component only (M-07) |
| CL-5 | A component no list names is never fetched, even if a manifest suggests it (AC-4.5) |
| CL-6 | A slot's default provider is the `components.yaml` entry whose manifest names that slot (DR-403) |

## Lock (shown as YAML; written as JSON with sorted keys)

```yaml
schema: components-lock/v1
components:
  agent-knowledge:
    source: { type: git, url: https://github.com/conanjs/agent-knowledge.git, ref: main }
    resolved: { commit: 3f2a…(40 hex) }        # git; path: { live: true, path: <absolute> }; archive: { sha256 }
    manifest: { version: 1.2.0, slot: knowledge-storage, contracts: [knowledge-provider/v1, company-kb/v1] }
    build: null                                # or { source_sha, build: 1, adapters: { claude: 1, agents: 1 } }
    store_id: 9a41c0d2e7f1                     # current tree under store/
  agentic-sdlc:
    source: { type: git, url: https://github.com/conanjs/agentic-sdlc.git, ref: v1.0.0 }
    resolved: { commit: 9c1d…, tag: v1.0.0 }
```

| Id | Rule |
|---|---|
| LK-1 | The lock lives in the home, never in a repo (it holds local paths and the user name) |
| LK-2 | `install` checks out `resolved.commit`; only `install --update [<name>]` advances a `git` source, printing the commit range and any privileged change (M-02) |
| LK-3 | A locked tag that now resolves to another commit exits 1, "tag moved", naming the component (P-4, T-16) |
| LK-4 | The lock is written at the commit point of an install, by temporary file and rename (DR-202, DR-104) |

## Missing or stale

Acquire or validation fails: the previous version stays linked (AC-3.4, AC-7.2). A missing `path` source fails `install` (exit 1) and `doctor`, leaving earlier links alone (AC-3.3).
