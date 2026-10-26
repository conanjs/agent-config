---
schema: stack-idioms/v1
last-updated: 2026-10-25
stack: go
rule-prefix: GO
---

# Idioms: Go (`go`)

Long form of the `idiom.*` slots in [index.md](index.md). Each idiom shows how stack-agnostic rules are written in Go; reusable explanations live in `{{AGENT_HOME}}/knowledge/` and are cited from rule `Source` cells when seeded.

## idiom.errors

Errors are values returned last. Each layer adds context by wrapping with `%w`, so the chain stays inspectable. Callers branch on meaning with `errors.Is` (sentinels) or `errors.As` (typed errors), never on message text. Don't log and return the same error — do one.

```go
var ErrNotFound = errors.New("not found")

func (r *PgUserRepo) Get(ctx context.Context, id string) (domain.User, error) {
	var u domain.User
	err := r.db.QueryRowContext(ctx, q, id).Scan(&u.ID, &u.Email)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.User{}, fmt.Errorf("user %s: %w", id, ErrNotFound)
	}
	if err != nil {
		return domain.User{}, fmt.Errorf("query user %s: %w", id, err)
	}
	return u, nil
}
```

## idiom.concurrency

Every goroutine has an owner that waits for it and a way to stop it. `context.Context` is the first parameter of anything that blocks or does I/O. Use `errgroup.WithContext` for fan-out: the first error cancels the rest. Share memory by communicating; guard the rest with `sync.Mutex`.

```go
func FetchAll(ctx context.Context, c *http.Client, urls []string) ([][]byte, error) {
	g, ctx := errgroup.WithContext(ctx)
	out := make([][]byte, len(urls))
	for i, url := range urls {
		g.Go(func() error {
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
			if err != nil {
				return err
			}
			resp, err := c.Do(req)
			if err != nil {
				return fmt.Errorf("get %s: %w", url, err)
			}
			defer resp.Body.Close()
			out[i], err = io.ReadAll(resp.Body)
			return err
		})
	}
	return out, g.Wait()
}
```

## idiom.di

Interfaces are declared by the package that *uses* them, kept to the methods it needs. Constructors take interfaces and return concrete structs. `cmd/<app>/main.go` is the only place that builds the graph; no DI framework by default.

```go
// internal/app/register.go
type UserStore interface {
	Save(ctx context.Context, u domain.User) error
}

type RegisterUser struct {
	store UserStore
	now   func() time.Time
}

func NewRegisterUser(s UserStore, now func() time.Time) *RegisterUser {
	return &RegisterUser{store: s, now: now}
}

// cmd/api/main.go
reg := app.NewRegisterUser(infra.NewPgUserRepo(db), time.Now)
```

## idiom.config

`main` reads environment variables (and flags) once into a typed struct, validates it, and passes fields to constructors. No package reads `os.Getenv` or holds config in globals, so tests construct exactly the config they need.

```go
type Config struct {
	Addr        string
	DatabaseURL string
	Timeout     time.Duration
}

func LoadConfig(getenv func(string) string) (Config, error) {
	c := Config{Addr: getenv("ADDR"), DatabaseURL: getenv("DATABASE_URL")}
	if c.Addr == "" {
		c.Addr = ":8080"
	}
	if c.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}
	t, err := time.ParseDuration(cmp.Or(getenv("TIMEOUT"), "5s"))
	if err != nil {
		return Config{}, fmt.Errorf("TIMEOUT: %w", err)
	}
	c.Timeout = t
	return c, nil
}
```

## idiom.logging

Use the standard library's `log/slog` with a JSON handler built in `main` and passed down (or stored on the struct). Attach request-scoped fields with `With`; log stable event names plus key/value attributes.

```go
logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	log := h.log.With("request_id", r.Header.Get("X-Request-Id"), "route", "POST /users")
	log.InfoContext(r.Context(), "user.register.start")
}
```

## Language conventions

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| GO-1 | Keep interfaces small and consumer-owned | An interface has only methods the consuming package calls | A provider package exports broad interfaces for every implementation | llm | — |
| GO-2 | Pass context first to blocking or I/O functions | `context.Context` is the first parameter and is forwarded to calls | A repository method starts a query without accepting context | lint | — |
| GO-3 | Format with gofmt and keep lint warnings at zero | `cmd.format` and `cmd.lint` pass without changed output or warnings | Code relies on local formatting preferences or unchecked lint warnings | lint | — |
| GO-4 | Wrap errors with `%w` when crossing a boundary | Callers can inspect the cause with `errors.Is` or `errors.As` | An error message is rebuilt with `%v` and loses the cause | llm | — |

## Runtime & performance

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| GO-5 | Do not start goroutines without ownership and cancellation | A parent waits for every goroutine and can stop it | A fire-and-forget goroutine reads a channel forever | llm | `knowledge/concurrency/structured-concurrency.md` |
| GO-6 | Protect shared mutable state or move it through channels | Shared state is behind synchronization or not shared | A map is written by multiple goroutines without a mutex | lint | `knowledge/concurrency/shared-state-and-data-races.md` |
| GO-7 | Do not log and return the same error | Each failure is reported at exactly one boundary | A repository logs an error and the handler logs it again | llm | `knowledge/error-handling/handle-errors-once.md` |

## Enforcement

A project fails `tools/validate-project.mjs` unless the first config file found contains every string below. This makes the documentation (CMT-5, CMT-12) and import-path (IMP-1, IMP-2) rules part of every repo on this stack, not something each author remembers.

```lint-baseline
config: .golangci.yml | .golangci.yaml
require:
  - exported
  - package-comments
```


| Rule | Tool config |
|---|---|
| GO-2 | `containedctx`/custom `golangci-lint` rule where available; otherwise `llm (fallback)` for exported blocking APIs |
| GO-3 | `gofmt -l .` via `cmd.format`; `golangci-lint run ./...` with `errcheck`, `staticcheck` and `govet` enabled |
| GO-6 | `go vet ./...` plus `golangci-lint` concurrency rules where configured |
| CS-2 (unit size) | `gocyclo`/`cyclop` and `funlen` in `.golangci.yml`, or `llm (fallback)` if not configured |
| CMT-5, CMT-12 (doc comments) | `revive` rules `exported` (doc comment on every exported function and method) and `package-comments`, enabled in `.golangci.yml`. Interface methods carry the contract; implementations reference the interface in their comment |
| IMP-1, IMP-2 (import paths) | Imports use the full module path (`<module>/core/role`), which is the Go form of an alias; any relative import path is a review finding (`llm (fallback)`) |
| FF-1 (layer deps) | `depguard` rules generated from `docs/architecture.md` §4 `may-depend-on` |

## References

**Local artifacts:**
- `stacks/go/index.md`: slot table that points to these idioms.
- `schemas/stack-idioms.schema.md`: schema for this file.

**External authoritative sources:**
- https://github.com/mgechev/revive/blob/master/RULES_DESCRIPTIONS.md (rules `exported`, `package-comments`)
- https://go.dev/blog/go1.13-errors
- https://pkg.go.dev/errors
- https://pkg.go.dev/context
- https://pkg.go.dev/golang.org/x/sync/errgroup
- https://go.dev/wiki/CodeReviewComments#interfaces
- https://pkg.go.dev/log/slog

## Related

- [index.md](index.md) - stack slot table.
- [Stack idioms schema](../../../schemas/stack-idioms.schema.md) - required structure for this file.
- [Error handling](../../foundations/code/error-handling.md) - [Clean architecture](../../foundations/design/clean-architecture.md) - [Design principles](../../foundations/design/design-principles.md).
