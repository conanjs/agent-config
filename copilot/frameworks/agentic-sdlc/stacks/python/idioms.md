---
schema: stack-idioms/v1
last-updated: 2026-10-25
stack: python
rule-prefix: PY
---

# Idioms: Python (`python`)

Long form of the `idiom.*` slots in [index.md](index.md). Each idiom shows how stack-agnostic rules are written in Python; reusable explanations live in `{{AGENT_HOME}}/knowledge/` and are cited from rule `Source` cells when seeded.

## idiom.errors

Each component has one base exception; domain failures subclass it so callers can catch by meaning. When translating a lower-level error, chain it with `raise ... from err` so the traceback keeps the cause. Never use bare `except:` or swallow `Exception` silently.

```python
class AppError(Exception):
    """Base for all errors raised by this component."""

class UserNotFound(AppError):
    def __init__(self, user_id: str) -> None:
        super().__init__(f"user {user_id} not found")
        self.user_id = user_id

class RepositoryError(AppError): ...

def get_user(conn: Connection, user_id: str) -> User:
    try:
        row = conn.execute(QUERY, (user_id,)).fetchone()
    except DatabaseError as err:
        raise RepositoryError(f"load user {user_id}") from err
    if row is None:
        raise UserNotFound(user_id)
    return User(*row)
```

## idiom.concurrency

I/O-bound work uses `asyncio`. Fan-out goes through `asyncio.TaskGroup` (structured: one failure cancels siblings) and deadlines through `asyncio.timeout`. Never call blocking I/O inside a coroutine — offload with `asyncio.to_thread`. CPU-bound work goes to a `ProcessPoolExecutor`.

```python
async def fetch_all(client: httpx.AsyncClient, urls: list[str]) -> list[bytes]:
    async with asyncio.timeout(5):
        async with asyncio.TaskGroup() as tg:
            tasks = [tg.create_task(client.get(url)) for url in urls]
    return [t.result().raise_for_status().content for t in tasks]
```

## idiom.di

Ports are `typing.Protocol` classes owned by the consumer; adapters satisfy them structurally. Use cases take ports in `__init__`. Only `main.py` constructs concrete adapters. Tests pass fakes — no monkeypatching of imports.

```python
class UserRepo(Protocol):
    def save(self, user: User) -> None: ...

class RegisterUser:
    def __init__(self, repo: UserRepo, clock: Callable[[], datetime]) -> None:
        self._repo = repo
        self._clock = clock

    def run(self, email: str) -> User:
        user = User.create(email, created_at=self._clock())
        self._repo.save(user)
        return user

# main.py
register_user = RegisterUser(PgUserRepo(pool), clock=lambda: datetime.now(UTC))
```

## idiom.config

Build one immutable, typed settings object from the environment at startup and fail fast when it is invalid. Pass values to constructors; nothing below `main.py` reads `os.environ`.

```python
@dataclass(frozen=True, slots=True)
class Settings:
    database_url: str
    port: int = 8080
    log_level: str = "INFO"

    @classmethod
    def from_env(cls, env: Mapping[str, str] = os.environ) -> "Settings":
        try:
            return cls(
                database_url=env["DATABASE_URL"],
                port=int(env.get("PORT", "8080")),
                log_level=env.get("LOG_LEVEL", "INFO"),
            )
        except (KeyError, ValueError) as err:
            raise SystemExit(f"invalid configuration: {err}") from err
```

## idiom.logging

Configure logging once in `main.py` (JSON formatter, level from settings). Each module uses `logging.getLogger(__name__)`; log stable event names and put data in `extra`, not in f-strings. Never log secrets or whole request bodies.

```python
log = logging.getLogger(__name__)

def handle_register(email: str, request_id: str) -> None:
    log.info("user.register.start", extra={"request_id": request_id})
```

## Language conventions

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| PY-1 | Type every public function and method | Public APIs have parameter and return annotations checked by mypy | A service method accepts or returns untyped `dict` | typecheck | — |
| PY-2 | Use Protocol ports at the consumer boundary | Use cases depend on narrow `Protocol` classes they own | Infrastructure exports a concrete base class that application code imports | typecheck | — |
| PY-3 | Keep formatting and imports under ruff | `cmd.format` and `cmd.lint` pass with no changes | Manual import ordering or formatter-only drift | lint | — |
| PY-4 | Chain translated exceptions with `raise ... from err` | Tracebacks preserve the original cause | A database error is caught and replaced without a cause | llm | — |

## Runtime & performance

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| PY-5 | Never block the asyncio event loop | Blocking I/O runs in `asyncio.to_thread` or a process pool | A coroutine calls a synchronous HTTP client directly | llm | `knowledge/concurrency/blocking-in-async-runtimes.md` |
| PY-6 | Use TaskGroup for owned fan-out | Sibling tasks are awaited and cancelled together on failure | Tasks are created and never joined | llm | `knowledge/concurrency/structured-concurrency.md` |
| PY-7 | Keep settings immutable after startup | Config is built once and passed as a typed object | Deep modules call `os.environ` during request handling | llm | `knowledge/operations/config-at-startup.md` |

## Enforcement

A project fails `tools/validate-project.mjs` unless the first config file found contains every string below. This makes the documentation (CMT-5, CMT-12) and import-path (IMP-1, IMP-2) rules part of every repo on this stack, not something each author remembers.

```lint-baseline
config: pyproject.toml | ruff.toml
require:
  - "D1"
  - TID252
  - ban-relative-imports = "all"
```


| Rule | Tool config |
|---|---|
| PY-1 | `mypy src tests` with `strict = true` in `[tool.mypy]` |
| PY-2 | `mypy` structural checks for `typing.Protocol` ports |
| PY-3 | `ruff format --check .` and `ruff check .` |
| CS-2 (unit size) | Ruff `C901` complexity and configured line/function-size rules, or `llm (fallback)` if not configured |
| CMT-5, CMT-12 (doc comments) | Ruff `D1` rules (pydocstyle "undocumented public …", e.g. `D103` for public functions) in `select`, with one docstring convention set in `[tool.ruff.lint.pydocstyle]`. `Protocol` ports carry the contract; implementations reference it |
| IMP-1, IMP-2 (import paths) | Ruff `TID252` with `[tool.ruff.lint.flake8-tidy-imports] ban-relative-imports = "all"` (the default `"parents"` still allows sibling imports): every import names the package, e.g. `from app.core.role import Role` |
| FF-1 (layer deps) | Ruff `flake8-tidy-imports` banned-module rules or import-contract script generated from `docs/architecture.md` §4 |

## References

**Local artifacts:**
- `stacks/python/index.md`: slot table that points to these idioms.
- `schemas/stack-idioms.schema.md`: schema for this file.

**External authoritative sources:**
- https://docs.astral.sh/ruff/rules/undocumented-public-function/ (D103, pydocstyle D1 family)
- https://docs.python.org/3/tutorial/errors.html#exception-chaining
- https://docs.python.org/3/library/asyncio-task.html#task-groups
- https://docs.python.org/3/library/typing.html#typing.Protocol
- https://docs.python.org/3/library/dataclasses.html
- https://docs.python.org/3/howto/logging.html

## Related

- [index.md](index.md) - stack slot table.
- [Stack idioms schema](../../../schemas/stack-idioms.schema.md) - required structure for this file.
- [Error handling](../../foundations/code/error-handling.md) - [Clean architecture](../../foundations/design/clean-architecture.md) - [Design principles](../../foundations/design/design-principles.md).
