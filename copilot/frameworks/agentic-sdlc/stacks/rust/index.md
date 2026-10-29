---
schema: stack/v2
last-updated: 2026-10-28
id: rust
detect-by: [Cargo.toml, Cargo.lock]
frameworks: []
paradigms: []
---

# Stack: Rust (`rust`)

**Applies to:** performance- or safety-critical services, CLIs, libraries and systems components written in Rust ·

**Detection:** [Cargo.toml, Cargo.lock]

**Framework profiles:**
> _None yet._

**Paradigm overlays:**
> _None yet._

## Slots
| Slot | Value |
|---|---|
| `language_version` | Rust stable, edition 2024, pinned via `rust-toolchain.toml` (`channel = "<x.y.z>"`, `components = ["rustfmt", "clippy"]`) and `rust-version` in `Cargo.toml` |
| `package_manager` | Cargo, with a committed `Cargo.lock` (also for libraries in this framework, so CI is reproducible) |
| `project_layout` | Feature-first (MOD-9, default): one crate per module and layer, `crates/modules/<module>/{domain,application,infrastructure,interface}/` (crate names `<module>-domain` and so on, so crate boundaries still enforce layers), plus `crates/modules/shared/` with the same four crates from day one · `crates/app/src/main.rs` (binary, composition root). Inside each module: `domain/` (entities, value objects, port traits — no I/O deps) · `application/` (use cases; depends on `domain` only) · `infrastructure/` (DB, HTTP clients — implements ports) · `interface/` (HTTP/gRPC handlers, CLI). Unit tests in `#[cfg(test)] mod tests` beside the code; integration tests in each crate's `tests/` directory. Opted-in layer-first (decision record required, MOD-9): Cargo workspace where crate boundaries enforce layers: `crates/domain/` (entities, value objects, port traits — no I/O deps) · `crates/application/` (use cases; depends on `domain` only) · `crates/infrastructure/` (DB, HTTP clients — implements ports) · `crates/interface/` (HTTP/gRPC handlers, CLI) · `crates/app/src/main.rs` (binary, composition root). Unit tests in `#[cfg(test)] mod tests` beside the code; integration tests in each crate's `tests/` directory |
| `style_guide` | https://doc.rust-lang.org/style-guide/ |
| `cmd.install` | `cargo fetch --locked` |
| `cmd.format` | `cargo fmt --all --check` |
| `cmd.lint` | `cargo clippy --workspace --all-targets --locked -- -D warnings` |
| `cmd.typecheck` | `cargo check --workspace --all-targets --locked` |
| `cmd.test_unit` | `cargo test --workspace --lib --bins --locked` |
| `cmd.test_integration` | `cargo test --workspace --test '*' --locked` |
| `cmd.build` | `cargo build --workspace --release --locked` |
| `cmd.audit` | `cargo audit` |
| `idiom.errors` | `Result<T, E>` everywhere; `thiserror` enums in library crates, `anyhow` with `.context()` only in the binary; no `unwrap()`/`expect()` outside tests and proven invariants |
| `idiom.concurrency` | `tokio` runtime for async I/O; `JoinSet` / `select!` with a cancellation token; `Send + Sync` state behind `Arc`; never block inside async code |
| `idiom.di` | Port traits in `domain`; use cases generic over the trait (or `Arc<dyn Trait>` at runtime boundaries); wiring in `main.rs` |
| `idiom.config` | `serde`-deserialised config struct built once at startup from env/file, validated, then passed by reference or `Arc` |
| `idiom.logging` | `tracing` with a JSON `tracing-subscriber` installed in `main.rs`; `#[instrument]` spans carry request context |
| `ci_template` | see below |
| `tools` | `rustfmt, clippy, cargo-audit` |

Notes: `cmd.audit` needs the `cargo-audit` subcommand installed (`cargo install cargo-audit --locked` locally; the CI template installs a prebuilt binary). `--test '*'` selects every integration-test target; a workspace with no `tests/` directory yet should skip `cmd.test_integration` in its TD-tree decision. Doc tests run with `cargo test --workspace --doc` when a crate publishes examples. Commands assume a POSIX shell (bash, Git Bash).

## Foundation mapping
| Foundation rule | How it's expressed in this stack |
|---|---|
| `foundations/design/clean-architecture.md` | One crate per layer; `Cargo.toml` dependencies make an inward-pointing graph and the compiler rejects anything else |
| `foundations/design/design-principles.md` | Small traits at the consumer, newtypes for domain values, ownership instead of shared mutable state, `pub(crate)` by default |
| `foundations/code/error-handling.md` | `idiom.errors`: typed error enums per crate, `?` propagation with `#[from]`, context added at the binary edge |
| `foundations/code/coding-standards.md` | `cmd.format`, `cmd.lint` with warnings denied, `cmd.typecheck`; `#![forbid(unsafe_code)]` unless justified in a decision record |
| `foundations/delivery/testing-strategy.md` | Unit tests in-module with fake trait impls; integration tests in `tests/` exercise the public API and real adapters |
| `foundations/delivery/release-pipeline.md` | CI template below; `--locked` everywhere; release binaries from `cmd.build` |
| `foundations/delivery/threat-modeling.md` | `cmd.audit` against the RustSec database; validate input at `interface/`; review every `unsafe` block and new dependency |
| `foundations/design/module-boundaries.md` (MOD-11) | W2: each feature has a wiring module (a `<feature>` crate or `wiring.rs`) with a constructor that takes its adapters as trait objects or generics and returns the feature's router; the binary crate creates the adapters. `Cargo.toml` keeps adapter crates out of the wiring crate's dependencies, so the compiler enforces it |

## Reference topics
| Topic | Attach when | Path |
|---|---|---|
| Blocking in async runtimes | Tokio code does file I/O, blocking calls or CPU-heavy work | {{AGENT_HOME}}/knowledge/concurrency/blocking-in-async-runtimes.md |
| Structured concurrency | task spawns Tokio tasks | {{AGENT_HOME}}/knowledge/concurrency/structured-concurrency.md |
| Shared state and data races | task shares state across tasks or threads | {{AGENT_HOME}}/knowledge/concurrency/shared-state-and-data-races.md |
| Library vs application errors | task defines error types or touches anyhow/thiserror | {{AGENT_HOME}}/knowledge/error-handling/library-vs-application-errors.md |
| Structured logging | task adds or changes tracing/logging | {{AGENT_HOME}}/knowledge/operations/structured-logging.md |

## CI template

```yaml
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: dtolnay/rust-toolchain@stable        # rust-toolchain.toml overrides the channel
        with:
          components: rustfmt, clippy
      - uses: taiki-e/install-action@v2
        with:
          tool: cargo-audit
      - run: cargo fetch --locked                                          # cmd.install
      - run: cargo fmt --all --check                                       # cmd.format
      - run: cargo clippy --workspace --all-targets --locked -- -D warnings  # cmd.lint
      - run: cargo check --workspace --all-targets --locked                # cmd.typecheck
      - run: cargo test --workspace --lib --bins --locked                  # cmd.test_unit
      - run: cargo test --workspace --test '*' --locked                    # cmd.test_integration
      - run: cargo build --workspace --release --locked                    # cmd.build
      - run: cargo audit                                                   # cmd.audit
```

## Toolchain defaults rationale

- **Cargo** — the only standard build tool and package manager; `--locked` fails if `Cargo.lock` would change.
- **rustfmt** (via `cargo fmt`) — the official formatter; one style, no debate.
- **clippy** — the official lint collection; `-D warnings` turns every lint into a failing check so warnings can't accumulate.
- **cargo check** — fastest full type/borrow check without codegen; separates type errors from test failures.
- **cargo test target selection** — `--lib --bins` for in-module unit tests, `--test '*'` for the `tests/` integration targets; no extra test framework needed.
- **cargo-audit** — RustSec's official scanner; audits `Cargo.lock` against the RustSec advisory database and exits non-zero on vulnerabilities.

## References

**Local artifacts:**
- `schemas/stack.schema.md`: schema for this stack index.
- `stacks/rust/idioms.md`: long-form idioms for the slot table.

**External authoritative sources:**
- https://doc.rust-lang.org/cargo/commands/cargo-test.html
- https://doc.rust-lang.org/cargo/commands/cargo-fetch.html
- https://doc.rust-lang.org/cargo/commands/cargo-check.html
- https://doc.rust-lang.org/cargo/reference/workspaces.html
- https://doc.rust-lang.org/cargo/guide/tests.html
- https://github.com/rust-lang/rustfmt
- https://doc.rust-lang.org/clippy/usage.html
- https://rust-lang.github.io/rustup/overrides.html#the-toolchain-file
- https://github.com/rustsec/rustsec/tree/main/cargo-audit
- https://github.com/dtolnay/rust-toolchain
- https://github.com/taiki-e/install-action

## Related

- [idioms.md](idioms.md) - long-form `idiom.*` slots.
- [Stack schema](../../../schemas/stack.schema.md) - required structure for this file.
- [Clean architecture](../../foundations/design/clean-architecture.md) - [Error handling](../../foundations/code/error-handling.md) - [Testing strategy](../../foundations/delivery/testing-strategy.md).
- Other stacks: [typescript-node](../typescript-node/index.md) - [go](../go/index.md) - [python](../python/index.md).
