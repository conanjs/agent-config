---
schema: stack/v2
last-updated: 2026-10-28
id: go
detect-by: [go.mod, go.sum]
frameworks: []
paradigms: []
---

# Stack: Go (`go`)

**Applies to:** network services, workers and CLIs written in Go ·

**Detection:** [go.mod, go.sum]

**Framework profiles:**
> _None yet._

**Paradigm overlays:**
> _None yet._

## Slots
| Slot | Value |
|---|---|
| `language_version` | One of the two most recent Go minor releases (the supported window), pinned by the `go` and `toolchain` directives in `go.mod` |
| `package_manager` | Go modules (`go.mod` / `go.sum`); no vendoring unless the build environment is offline |
| `project_layout` | Feature-first (MOD-9, default): `internal/modules/<module>/{domain,app,infra,transport}/` per feature area, plus `internal/modules/shared/` with the same four packages from day one · `cmd/<app>/main.go` (composition root, one per binary). Inside each module: `domain/` (entities, value objects, port interfaces — stdlib imports only) · `app/` (use cases; imports `domain` only) · `infra/` (DB, HTTP clients, queues — implements ports) · `transport/` (HTTP/gRPC handlers, CLI). Unit tests as `*_test.go` beside the code; integration tests as `*_integration_test.go` with `//go:build integration`. Opted-in layer-first (decision record required, MOD-9): `cmd/<app>/main.go` (composition root, one per binary) · `internal/domain/` (entities, value objects, port interfaces — stdlib imports only) · `internal/app/` (use cases; imports `domain` only) · `internal/infra/` (DB, HTTP clients, queues — implements ports) · `internal/transport/` (HTTP/gRPC handlers, CLI). Unit tests as `*_test.go` beside the code; integration tests as `*_integration_test.go` with `//go:build integration` |
| `style_guide` | https://go.dev/doc/effective_go |
| `cmd.install` | `go mod download && go mod verify` |
| `cmd.format` | `test -z "$(gofmt -l .)"` |
| `cmd.lint` | `golangci-lint run ./...` |
| `cmd.typecheck` | `go vet ./...` |
| `cmd.test_unit` | `go test ./...` |
| `cmd.test_integration` | `go test -tags=integration -count=1 ./...` |
| `cmd.build` | `go build ./...` |
| `cmd.audit` | `go run golang.org/x/vuln/cmd/govulncheck@latest ./...` |
| `idiom.errors` | Return `error` last; wrap with `fmt.Errorf("...: %w", err)`; sentinel/typed errors checked with `errors.Is` / `errors.As` |
| `idiom.concurrency` | Goroutines owned by a parent that waits for them; `context.Context` first parameter for cancellation; `errgroup` for fan-out |
| `idiom.di` | Small interfaces declared at the consumer; constructors `NewX(deps...)` taking interfaces, returning structs; wiring in `cmd/<app>/main.go` |
| `idiom.config` | Load env/flags once in `main` into a typed struct; validate; pass values down — no package-level config globals |
| `idiom.logging` | `log/slog` with a JSON handler built in `main` and injected; request-scoped attributes via `logger.With` |
| `ci_template` | see below |
| `tools` | `gofmt, golangci-lint, govulncheck` |

Notes: `cmd.format` prints nothing; when it fails run `gofmt -l .` to list the offending files (`gofmt -w .` fixes them). `go vet` type-checks every package (including test files) and runs the vet analyzers, so it doubles as the type-check gate. Commands assume a POSIX shell (bash, Git Bash).

## Foundation mapping
| Foundation rule | How it's expressed in this stack |
|---|---|
| `foundations/design/clean-architecture.md` | `internal/` layer packages; the compiler forbids import cycles and `internal/` blocks outside imports; a `depguard` rule in `.golangci.yml` blocks `domain` → `infra` imports |
| `foundations/design/design-principles.md` | Accept interfaces, return structs; small interfaces (1–3 methods) at the consumer; no premature generics |
| `foundations/code/error-handling.md` | `idiom.errors`: wrap with context at each layer, inspect with `errors.Is/As`, map to transport status once in `transport/` |
| `foundations/code/coding-standards.md` | `cmd.format`, `cmd.lint` (with `errcheck`, `staticcheck`, `govet` enabled), `cmd.typecheck` |
| `foundations/delivery/testing-strategy.md` | Table-driven unit tests with fakes; integration tests behind the `integration` build tag via `cmd.test_integration` |
| `foundations/delivery/release-pipeline.md` | CI template below; static binaries from `cmd/`; `go.sum` checked by `go mod verify` |
| `foundations/delivery/threat-modeling.md` | `cmd.audit` reports only vulnerabilities reachable from your code; validate input in `transport/`; `context` deadlines on every outbound call |
| `foundations/design/module-boundaries.md` (MOD-11) | W2: a `module.go` in each `internal/modules/<module>/` package with `func New(deps Deps) *Module` building the module's use cases and handlers; `cmd/<app>/main.go` creates the adapters and calls each `New`. A `depguard` rule keeps the module package from importing its `infra` package, and the layer packages from importing the module package |

## Reference topics
| Topic | Attach when | Path |
|---|---|---|
| Structured concurrency | task starts goroutines, fan-out or background workers | {{AGENT_HOME}}/knowledge/concurrency/structured-concurrency.md |
| Shared state and data races | task shares maps, caches or counters between goroutines | {{AGENT_HOME}}/knowledge/concurrency/shared-state-and-data-races.md |
| Handle errors once | task changes error wrapping, logging or propagation | {{AGENT_HOME}}/knowledge/error-handling/handle-errors-once.md |
| Config at startup | task adds or reads configuration | {{AGENT_HOME}}/knowledge/operations/config-at-startup.md |
| Structured logging | task adds or changes logging | {{AGENT_HOME}}/knowledge/operations/structured-logging.md |
| HTTP error mapping | task adds an HTTP endpoint or changes error responses | {{AGENT_HOME}}/knowledge/web-apis/http-error-mapping.md |

## CI template

```yaml
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-go@v7
        with:
          go-version-file: go.mod
      - uses: golangci/golangci-lint-action@v9
        with:
          version: v2.14
          install-only: true
      - run: go mod download && go mod verify                              # cmd.install
      - run: test -z "$(gofmt -l .)"                                       # cmd.format
      - run: golangci-lint run ./...                                       # cmd.lint
      - run: go vet ./...                                                  # cmd.typecheck
      - run: go test ./...                                                 # cmd.test_unit
      - run: go test -tags=integration -count=1 ./...                      # cmd.test_integration
      - run: go build ./...                                                # cmd.build
      - run: go run golang.org/x/vuln/cmd/govulncheck@latest ./...         # cmd.audit
```

## Toolchain defaults rationale

- **Go modules** — the only supported dependency system; `go mod verify` checks the module cache against `go.sum`.
- **gofmt** — the canonical formatter shipped with Go; there is one accepted format, so no config.
- **golangci-lint** (v2 config, `version: "2"`) — runs many linters in one pass with shared caching; the de facto standard aggregator.
- **go vet** — ships with the toolchain, type-checks all packages including tests, catches suspicious constructs the compiler allows.
- **go test + build tag** — integration tests stay out of the default `go test ./...` run without a second test framework; `-count=1` disables result caching for tests that touch real systems.
- **govulncheck** — Go team's official scanner; uses call-graph reachability, so it reports fewer false positives than manifest-only scanners. `go run …@latest` needs no prior install.

## References

**Local artifacts:**
- `schemas/stack.schema.md`: schema for this stack index.
- `stacks/go/idioms.md`: long-form idioms for the slot table.

**External authoritative sources:**
- https://go.dev/doc/devel/release
- https://go.dev/ref/mod
- https://pkg.go.dev/cmd/gofmt
- https://pkg.go.dev/cmd/vet
- https://pkg.go.dev/cmd/go#hdr-Build_constraints
- https://golangci-lint.run/
- https://github.com/golangci/golangci-lint-action
- https://pkg.go.dev/golang.org/x/vuln/cmd/govulncheck
- https://go.dev/doc/modules/layout
- https://github.com/actions/setup-go

## Related

- [idioms.md](idioms.md) - long-form `idiom.*` slots.
- [Stack schema](../../../schemas/stack.schema.md) - required structure for this file.
- [Clean architecture](../../foundations/design/clean-architecture.md) - [Error handling](../../foundations/code/error-handling.md) - [Testing strategy](../../foundations/delivery/testing-strategy.md).
- Other stacks: [typescript-node](../typescript-node/index.md) - [python](../python/index.md) - [rust](../rust/index.md).
