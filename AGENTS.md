# agent-config: rules for working in this repo

These apply only when working in this repository. The global instructions every agent loads are `copilot/instructions/core.instructions.md`.

- **Knowledge base (`copilot/knowledge/`):** every new doc follows `copilot/frameworks/knowledge/schemas/_system.md`: a typed `knowledge-doc/v1`, or a free-form `deep-dive/v1` for "deep dive" or "thorough" requests, later synthesized into typed docs. `node copilot/frameworks/knowledge/tools/validate-knowledge.mjs` must pass. Docs without a `schema:` key are legacy: never retrofit them.
- **Company KBs (`copilot/companies/`):** read `copilot/frameworks/company-kb/schemas/_system.md` before writing or editing a doc there; it also defines the two repo layouts (flat or grouped by project).
- **Patterns (`copilot/patterns/`):** a new pattern file follows `copilot/patterns/pattern.schema.md`.
- **Before committing** any change under `copilot/knowledge/` or `copilot/procedures/`, and always for text drafted in another AI chat: use the `review-docs` skill (`copilot/procedures/review-docs.procedure.md`), validators first, then the checks they cannot do.
- **Installers** (`installers/install.sh`, `.ps1`, `uninstall.*`): backups land at `~/.agent-config-backups/<timestamp>/` (`%USERPROFILE%\.agent-config-backups\<timestamp>\` on Windows). `SETUP.md` and the README's Usage section describe the mechanism; `copilot/patterns/backup-before-overwrite.pattern.md` is the general technique.
- **Checks:** `scripts/check-docs.sh` runs every validator and the test suites; run it before committing.
