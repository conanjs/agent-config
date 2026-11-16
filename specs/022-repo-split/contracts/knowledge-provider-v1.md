# `knowledge-provider/v1` and `company-kb/v1`

## `knowledge-provider/v1`

**Defined by:** agent-config `contracts/knowledge-provider/` · **Provided by:** agent-knowledge (slot `knowledge-storage`), agent-companies (slot `company-knowledge-storage`) · **Consumers:** core, agentic-sdlc and agent-companies (citations), installer (mount, route), doctor · **Record:** DR-404 · **Spec:** FR-040, AC-1.8, AC-13.1 to AC-13.8

| Id | Rule |
|---|---|
| KP-1 | `index.md` at the root of the `content` location is the only entry point and describes the storage's own architecture |
| KP-2 | Every relative Markdown link in a body (fenced code skipped) resolves and stays inside the component; legacy docs (no `schema:` key) only warn (AC-13.5) |
| KP-3 | `provides.exports` lists every citable doc; removing or renaming one is a major version (AC-13.2) |
| KP-4 | A moved exported doc leaves a stub at its old path for one release (CON-12, AC-13.7) |
| KP-5 | `scripts/check.sh` passes in a checkout holding only this repo, with any provider passed in as an argument (AC-13.1, AC-10.6) |
| KP-6 | Cross-component citations, where the slot allows them, use the link-text form `{{AGENT_HOME}}/<location>/<path>` with a generated target (FR-023, FR-044) |

**Slot rule, not contract rule** (`knowledge-storage`, `self-contained: true`): no `{{AGENT_HOME}}` line and no citation of another component anywhere in the filler, content and frameworks alike. That is what lets the knowledge base stay **linked** (not rendered) and keeps the component graph acyclic. agent-companies provides this contract too but fills a slot without that rule, so its 21 citations of the knowledge base stay allowed.

**Core text** (the one line the core keeps about knowledge layers): "Installed knowledge layers and when to read each are listed in routes; read a layer's `index.md` before its docs."

**Missing:** no route, the layer is skipped; `doctor` lists citations that no longer resolve. **Enforcement:** report mode in phases 2 to 5, blocking from phase 6.

### Worked example: one citation in both forms (AC-1.8)

A file `foo.md` of agentic-sdlc cites the knowledge doc `x.md`.

| Form | Link text | Target |
|---|---|---|
| Source repo (what the author writes; target from `build cite --write`) | `{{AGENT_HOME}}/knowledge/x.md` | `https://github.com/conanjs/agent-knowledge/blob/main/x.md` (folder from the provider's `locations.content`) |
| Rendered on Mac, home `/Users/v/.agent-config`, copy at `generated/agentic-sdlc/foo.md` | `/Users/v/.agent-config/knowledge/x.md` | `../../knowledge/x.md` |
| Rendered on Windows, home `C:\Users\v\.agent-config`, same copy | `C:\Users\v\.agent-config\knowledge\x.md` | `../../knowledge/x.md` |

```markdown
<!-- source: agentic-sdlc/foo.md -->
See [{{AGENT_HOME}}/knowledge/x.md](https://github.com/conanjs/agent-knowledge/blob/main/x.md).

<!-- rendered: /Users/v/.agent-config/generated/agentic-sdlc/foo.md -->
Generated from `foo.md`; edit that file, not this copy.
See [/Users/v/.agent-config/knowledge/x.md](../../knowledge/x.md).
```

## `company-kb/v1`

**Owner:** agent-knowledge, `frameworks/company-kb/` (stays in agent-config's `copilot/frameworks/company-kb/` until phase 6) · **Consumers:** agent-companies (conforms), its validator, core `init-repo-kb`, agentic-sdlc (9 citations) · **Record:** DR-405 · **Spec:** AC-10.2, AC-10.6

- The schemas `frameworks/company-kb/schemas/*.schema.md` keep their shape and their path `{{AGENT_HOME}}/frameworks/company-kb/` (43 citations).
- agent-companies' `component.yaml` fills `company-knowledge-storage` and depends on `(knowledge-storage, company-kb/v1)`; its check runs the company-KB validator from the provider passed as an argument (or `AGENT_KNOWLEDGE`), never a hard-coded path (G12). Until phase 6 the provider is agent-config at a pinned SHA with a stand-in manifest.
- **Missing:** no installed knowledge provider offers `company-kb/v1`: agent-companies is not installed and NEEDS names slot `knowledge-storage` and the contract (AC-10.6).
