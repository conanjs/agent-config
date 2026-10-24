---
schema: stack/v2
last-updated: 2026-10-04
id: python
detect-by: [pyproject.toml, uv.lock]
frameworks: []
paradigms: []
---

# Stack: Python (`python`)

**Applies to:** services, workers, CLIs and data/ML components written in Python ·

**Detection:** [pyproject.toml, uv.lock]

**Framework profiles:**
> _None yet._

**Paradigm overlays:**
> _None yet._

## Slots
| Slot | Value |
|---|---|
| `language_version` | CPython 3.13+ (a release still in bugfix support), pinned in `.python-version` and `requires-python` in `pyproject.toml`; fully type-annotated code |
| `package_manager` | uv — project and dev dependencies in `pyproject.toml` (`[dependency-groups] dev`), resolved into a committed `uv.lock` |
| `project_layout` | `src/<pkg>/domain/` (entities, value objects, `Protocol` ports — stdlib only) · `src/<pkg>/application/` (use cases; imports `domain` only) · `src/<pkg>/infrastructure/` (DB, HTTP clients, queues — implements ports) · `src/<pkg>/interface/` (HTTP app, CLI, consumers) · `src/<pkg>/main.py` (composition root). Tests in `tests/unit/` and `tests/integration/` (every integration test marked `integration`) |
| `style_guide` | https://peps.python.org/pep-0008/ |
| `cmd.install` | `uv sync --locked --all-extras` |
| `cmd.format` | `uv run ruff format --check .` |
| `cmd.lint` | `uv run ruff check .` |
| `cmd.typecheck` | `uv run mypy src tests` |
| `cmd.test_unit` | `uv run pytest -m "not integration"` |
| `cmd.test_integration` | `uv run pytest -m integration` |
| `cmd.build` | `uv build` |
| `cmd.audit` | `uv export --frozen --no-emit-project --output-file requirements-audit.txt && uvx pip-audit --strict --disable-pip --no-deps -r requirements-audit.txt` |
| `idiom.errors` | Domain exception hierarchy rooted in one base class; chain with `raise ... from err`; never bare `except:` |
| `idiom.concurrency` | `asyncio` with `TaskGroup` and `asyncio.timeout` for I/O-bound work; process pools for CPU-bound work; no blocking calls inside coroutines |
| `idiom.di` | Constructor injection of `typing.Protocol` ports; wiring only in `main.py`; no DI framework by default |
| `idiom.config` | Typed settings object built once from the environment at startup and validated; passed down, never read from `os.environ` deep in code |
| `idiom.logging` | Stdlib `logging` with a JSON formatter configured once in `main.py`; `logging.getLogger(__name__)` per module; structured `extra` fields |
| `ci_template` | see below |
| `tools` | `uv, uvx, ruff, mypy, pytest, pip-audit` |

Notes: register the marker with `[tool.pytest.ini_options] markers = ["integration: needs real external services"]` and `addopts = "--strict-markers"`. pytest exits 5 when no test is collected, so a component without integration tests yet must mark `cmd.test_integration` as skipped in its TD-tree decision rather than run it. `requirements-audit.txt` is a generated file — add it to `.gitignore`. Commands assume a POSIX shell (bash, Git Bash).

## Foundation mapping
| Foundation rule | How it's expressed in this stack |
|---|---|
| `foundations/design/clean-architecture.md` | Layer subpackages under `src/<pkg>/`; dependency direction enforced with ruff's `flake8-tidy-imports` banned-module rules (or an import-contract check) |
| `foundations/design/design-principles.md` | Small modules, `Protocol` interfaces at the consumer, frozen dataclasses for value objects, composition over inheritance |
| `foundations/code/error-handling.md` | `idiom.errors`: domain exceptions for expected failures, chaining with `from`, one exception-to-response mapper in `interface/` |
| `foundations/code/coding-standards.md` | `cmd.format`, `cmd.lint`, `cmd.typecheck` with `strict = true` in `[tool.mypy]` |
| `foundations/delivery/testing-strategy.md` | Fast unit tests with fakes in `tests/unit/`; real adapters in `tests/integration/` selected by marker |
| `foundations/delivery/release-pipeline.md` | CI template below; `--locked` install; sdist + wheel in `dist/` from `cmd.build` |
| `foundations/delivery/threat-modeling.md` | `cmd.audit` against the exact locked versions; validate input at `interface/`; secrets only via environment, never logged |

## Reference topics
| Topic | Attach when | Path |
|---|---|---|
| Blocking in async runtimes | async code calls a blocking library, file I/O or CPU-heavy work | {{AGENT_HOME}}/knowledge/concurrency/blocking-in-async-runtimes.md |
| Structured concurrency | task fans out with asyncio tasks | {{AGENT_HOME}}/knowledge/concurrency/structured-concurrency.md |
| Library vs application errors | task defines exception types for a reusable package | {{AGENT_HOME}}/knowledge/error-handling/library-vs-application-errors.md |
| Config at startup | task adds or reads settings | {{AGENT_HOME}}/knowledge/operations/config-at-startup.md |
| Structured logging | task adds or changes logging | {{AGENT_HOME}}/knowledge/operations/structured-logging.md |
| HTTP error mapping | task adds an HTTP endpoint or changes error responses | {{AGENT_HOME}}/knowledge/web-apis/http-error-mapping.md |

## CI template

```yaml
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: astral-sh/setup-uv@v7   # uv reads .python-version and installs that interpreter on sync
      - run: uv sync --locked --all-extras                                 # cmd.install
      - run: uv run ruff format --check .                                  # cmd.format
      - run: uv run ruff check .                                           # cmd.lint
      - run: uv run mypy src tests                                         # cmd.typecheck
      - run: uv run pytest -m "not integration"                            # cmd.test_unit
      - run: uv run pytest -m integration                                  # cmd.test_integration
      - run: uv build                                                      # cmd.build
      - run: uv export --frozen --no-emit-project --output-file requirements-audit.txt && uvx pip-audit --strict --disable-pip --no-deps -r requirements-audit.txt  # cmd.audit
```

## Toolchain defaults rationale

- **uv** — one fast tool for interpreter install, locking, syncing and building; `--locked` fails if `uv.lock` is stale.
- **ruff** — formatter and linter in one binary, replacing black/isort/flake8 with a single config in `pyproject.toml`.
- **mypy** — the reference static type checker with a mature strict mode and plugin ecosystem.
- **pytest** — de facto test runner; markers split unit from integration without separate configs.
- **pip-audit** (via `uvx`) — PyPA-maintained, queries the PyPI/OSV advisory data; auditing the exported lock pins the exact versions, and `--disable-pip --no-deps` avoids re-resolving. uv's native `uv audit` is an alternative once the team standardises on it.

## References

**Local artifacts:**
- `schemas/stack.schema.md`: schema for this stack index.
- `stacks/python/idioms.md`: long-form idioms for the slot table.

**External authoritative sources:**
- https://devguide.python.org/versions/
- https://docs.astral.sh/uv/reference/cli/
- https://docs.astral.sh/uv/guides/integration/github/
- https://docs.astral.sh/ruff/formatter/
- https://docs.astral.sh/ruff/linter/
- https://mypy.readthedocs.io/en/stable/command_line.html
- https://docs.pytest.org/en/stable/how-to/mark.html
- https://docs.pytest.org/en/stable/reference/exit-codes.html
- https://github.com/pypa/pip-audit
- https://github.com/astral-sh/setup-uv

## Related

- [idioms.md](idioms.md) - long-form `idiom.*` slots.
- [Stack schema](../../../schemas/stack.schema.md) - required structure for this file.
- [Clean architecture](../../foundations/design/clean-architecture.md) - [Error handling](../../foundations/code/error-handling.md) - [Testing strategy](../../foundations/delivery/testing-strategy.md).
- Other stacks: [typescript-node](../typescript-node/index.md) - [go](../go/index.md) - [rust](../rust/index.md).
