# `slots/v1`: the sockets components fill

**Instance:** `contracts/slots.yaml` in agent-config · **Owner:** agent-config · **Consumers:** installer (resolve), doctor, `build cite` (location prefixes), renderer · **Record:** DR-401, DR-404, DR-416 · **Spec:** FR-003, AC-1.3, AC-1.4, AC-5.7, AC-5.8, AC-5.10

## Instance (annotated; comments are normative)

```yaml
schema: slots/v1
slots:
  - name: core
    reserved: true                 # filled only by agent-config's own component.yaml; a list entry naming it is an error
    contract: component/v1         # core's surface is its provides.exports
    required: true
    multiple: false
    scope: global
    locations:                     # mounts are relative to {{AGENT_HOME}}; they keep the 445 existing lines resolving (AC-8.5)
      - { name: core,          mount: core }
      - { name: instructions,  mount: instructions }
      - { name: patterns,      mount: patterns }
      - { name: procedures,    mount: procedures }
      - { name: references,    mount: references }
      - { name: atlas,         mount: atlas }
      - { name: tracker,       mount: tracker }
      - { name: agent-foundry, mount: frameworks/agent-foundry }
  - name: knowledge-storage
    contract: knowledge-provider/v1          # a string or a list; a list means the filler offers ALL of them
    required: false
    multiple: false
    scope: global
    self-contained: true                     # fillers cite no other component (DR-404); atlas and build cite enforce it
    locations:
      - { name: content,              mount: knowledge, index: provided }               # index.md at its root
      - { name: framework,            mount: frameworks/knowledge }
      - { name: company-kb-framework, mount: frameworks/company-kb, required: false }    # required when the filler offers company-kb/v1
  - name: company-knowledge-storage
    contract: [company-kb/v1, knowledge-provider/v1]
    required: false
    multiple: true
    scope: global
    locations:
      - { name: content, mount: companies, shared: true, index: generated }   # entries such as ots/ linked one by one; each has its own index.md
  - name: framework
    contract: framework/v1
    required: false
    multiple: true
    scope: per-project                       # files live in the home; skills, agents and routes appear only where enabled
    locations:
      - { name: framework, mount: "frameworks/{component}" }
```

The `global-variables.md` mount is not a slot location: it is a generated file the installer links at `{{AGENT_HOME}}/global-variables.md` (DR-414), and `build cite` classifies it as a core export.

## Reader rules

| Id | Rule | Message on failure |
|---|---|---|
| SL-1 | `count` or `mounts` present | Error naming the key and its replacement: "`count` is now `required` + `multiple`", "`mounts` is now `locations`" (AC-1.3) |
| SL-2 | A `contract` list means the filler offers every listed contract | — |
| SL-3 | Mounts are unique across slots; two installed components supplying the same mount entry fail install naming both (DR-416, FF-13) | Names both components and the mount |
| SL-4 | A citation's location path is classified by the longest mount that prefixes it; no match fails (AC-5.10) | Names the citing file and the path |
| SL-5 | `reserved: true` slots cannot be named by a list entry | Names the entry |
| SL-6 | A `multiple: false` slot with two fillers fails, naming both and the `use` command that picks one (AC-5.7) | — |
| SL-7 | A `shared: true` location is linked entry by entry, never as a whole folder (FR-027); its root `index.md` is generated when `index: generated` | — |

## Missing or stale

A component naming a slot absent from this file is skipped with a warning; the others install (AC-5.8). Rollout: phase 0 schema and instance, phase 2 reader.
