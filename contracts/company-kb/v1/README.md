# `company-kb/v1`

How a company knowledge base is laid out and checked. Record DR-405; spec AC-10.2, AC-10.6.

| Field            | Value                                                                                                                                                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner            | agent-knowledge, `frameworks/company-kb/` (it stays in agent-config's `copilot/frameworks/company-kb/` until phase 6)                                                                                                                                             |
| Consumers        | agent-companies (conforms) and its validator, core `init-repo-kb`, agentic-sdlc (9 citations)                                                                                                                                                                     |
| Versioning rule  | Pinned by major only (FR-006); readers read the current and previous major. The schemas under `frameworks/company-kb/schemas/*.schema.md` keep their shape and their path `{{AGENT_HOME}}/frameworks/company-kb/` (43 citations); changing either is a new major. |
| Missing or stale | No installed knowledge provider offers `company-kb/v1`: agent-companies is not installed, and NEEDS names slot `knowledge-storage` and the contract (AC-10.6).                                                                                                    |

## The file this contract reads

A checkable view of the `component.yaml` of agent-companies (the slot it fills and the dependency it declares) plus its check settings. Nobody writes it by hand in a repo: it is a fixture for the contract tests and for `doctor`, which read it to compare with the real `component.yaml`; the keys that repeat `component.yaml` must agree with it. Examples are in `examples/valid/` (flat and grouped) and `examples/invalid/`.

| Key         | Meaning                                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`    | `company-kb/v1`                                                                                                                                          |
| `slot`      | the slot filled, `company-knowledge-storage`                                                                                                             |
| `layout`    | `flat` or `grouped` (by project), as the schemas define                                                                                                  |
| `companies` | the folder of the companies, a contained relative path (M-03)                                                                                            |
| `schemas`   | the schemas folder inside the component, a contained relative path, never a path into another repo (G12)                                                 |
| `provider`  | the dependency: `slot` `knowledge-storage` and contract `company-kb/v1`                                                                                  |
| `check`     | optional: `provider-env` (an upper snake case variable such as `AGENT_KNOWLEDGE`) and `provider-argument` (the provider is also accepted as an argument) |

The check runs the company-KB validator from the provider passed as an argument or `AGENT_KNOWLEDGE`, never a hard-coded path. Until phase 6 the provider is agent-config at a pinned SHA with a stand-in manifest.

## Worked example

agent-companies, flat layout, checking against the provider it is given:

```yaml
schema: company-kb/v1
slot: company-knowledge-storage
layout: flat
companies: companies
schemas: frameworks/company-kb/schemas
provider: { slot: knowledge-storage, contract: company-kb/v1 }
check: { provider-env: AGENT_KNOWLEDGE, provider-argument: true }
```
