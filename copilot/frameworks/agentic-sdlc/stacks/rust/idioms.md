---
schema: stack-idioms/v1
last-updated: 2026-10-25
stack: rust
rule-prefix: RS
---

# Idioms: Rust (`rust`)

Long form of the `idiom.*` slots in [index.md](index.md). Each idiom shows how stack-agnostic rules are written in Rust; reusable explanations live in `{{AGENT_HOME}}/knowledge/` and are cited from rule `Source` cells when seeded.

## idiom.errors

Every fallible function returns `Result`. Library crates define their own error enum with `thiserror`, converting lower-level errors with `#[from]` so `?` propagates them. The binary uses `anyhow` and adds human context with `.context()`. `unwrap()`/`expect()` appear only in tests or behind a documented invariant.

```rust
#[derive(Debug, thiserror::Error)]
pub enum RepoError {
    #[error("user {0} not found")]
    NotFound(UserId),
    #[error("database error")]
    Db(#[from] sqlx::Error),
}

pub async fn get_user(pool: &PgPool, id: UserId) -> Result<User, RepoError> {
    sqlx::query_as::<_, User>(QUERY)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or(RepoError::NotFound(id))
}
```

## idiom.concurrency

Async I/O runs on `tokio`. Spawned tasks are owned by a `JoinSet` (or awaited handle) so none outlive their parent; cancellation flows through a `CancellationToken` checked in `select!`. Shared state is `Arc<T>` with `T: Send + Sync`. Blocking or CPU-heavy work goes to `spawn_blocking`.

```rust
pub async fn fetch_all(client: reqwest::Client, urls: Vec<String>) -> anyhow::Result<Vec<String>> {
    let mut set = tokio::task::JoinSet::new();
    for url in urls {
        let client = client.clone();
        set.spawn(async move { client.get(&url).send().await?.error_for_status()?.text().await });
    }
    let mut out = Vec::new();
    while let Some(res) = set.join_next().await {
        out.push(res??);
    }
    Ok(out)
}
```

## idiom.di

Ports are traits in the `domain` crate. Use cases are generic over them (static dispatch, zero cost) or hold `Arc<dyn Trait>` where the implementation is picked at runtime. Only `main.rs` names concrete adapters. Tests implement the trait on a small fake.

```rust
pub trait UserRepo: Send + Sync {
    fn save(&self, user: &User) -> impl Future<Output = Result<(), RepoError>> + Send;
}

pub struct RegisterUser<R: UserRepo> {
    repo: R,
}

impl<R: UserRepo> RegisterUser<R> {
    pub fn new(repo: R) -> Self { Self { repo } }

    pub async fn run(&self, email: Email) -> Result<User, RepoError> {
        let user = User::new(email);
        self.repo.save(&user).await?;
        Ok(user)
    }
}

// main.rs
let register = RegisterUser::new(PgUserRepo::new(pool.clone()));
```

## idiom.config

A plain struct derives `serde::Deserialize`; `main.rs` builds it once from the environment (or a file plus env overrides), validates it, and fails before serving if it is wrong. Components take the fields they need — no global statics.

```rust
use anyhow::Context;

#[derive(Debug, serde::Deserialize)]
pub struct Config {
    pub database_url: String,
    #[serde(default = "default_port")]
    pub port: u16,
}

fn default_port() -> u16 { 8080 }

pub fn load() -> anyhow::Result<Config> {
    envy::from_env::<Config>().context("invalid configuration")
}
```

## idiom.logging

Use `tracing` for logs and spans. `main.rs` installs a JSON `tracing-subscriber` with an env-driven filter. `#[instrument]` puts request context on every event inside the span; skip fields that might hold secrets.

```rust
tracing_subscriber::fmt().json().with_env_filter(EnvFilter::from_default_env()).init();

#[tracing::instrument(skip(self, email), fields(request_id = %req_id))]
pub async fn handle_register(&self, req_id: RequestId, email: Email) -> Result<User, ApiError> {
    tracing::info!("user.register.start");
    // ...
}
```

## Language conventions

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| RS-1 | Keep crate APIs explicit and narrow | Only intended types and functions are `pub`; internals stay `pub(crate)` or private | A crate exports helpers only used internally | lint | — |
| RS-2 | Return `Result<T, E>` for every expected failure | Callers handle typed error variants with `?` or matching | A library panics on invalid input | typecheck | — |
| RS-3 | Forbid unsafe code unless a decision record permits it | Crates have `#![forbid(unsafe_code)]` or documented exceptions | An `unsafe` block appears without review context | lint | — |
| RS-4 | Use rustfmt and deny clippy warnings | `cmd.format` and `cmd.lint` pass at zero warnings | Warnings accumulate because CI only logs them | lint | — |

## Runtime & performance

| Id | Rule | Holds when | Typical violation | Enforced by | Source |
|---|---|---|---|---|---|
| RS-5 | Do not hold blocking work on async executor threads | CPU-heavy or blocking calls use `spawn_blocking` | A Tokio task performs filesystem or CPU-heavy work inline | llm | `knowledge/concurrency/blocking-in-async-runtimes.md` |
| RS-6 | Own spawned tasks with JoinSet or awaited handles | Every task is awaited, cancelled or supervised | A spawned task can outlive its request scope | llm | `knowledge/concurrency/structured-concurrency.md` |
| RS-7 | Share concurrent state only through Send + Sync-safe wrappers | Shared state is `Arc<T>` and mutation is synchronized | A non-thread-safe type is moved across async tasks | typecheck | `knowledge/concurrency/shared-state-and-data-races.md` |
| RS-8 | Keep binary-only context errors out of library crates | Libraries expose typed errors; binaries add `anyhow` context | A library returns `anyhow::Error` to callers | llm | `knowledge/error-handling/library-vs-application-errors.md` |

## Enforcement

A project fails `tools/validate-project.mjs` unless the first config file found contains every string below. This makes the documentation (CMT-5, CMT-12) and import-path (IMP-1, IMP-2) rules part of every repo on this stack, not something each author remembers.

```lint-baseline
config: src/lib.rs | src/main.rs
require:
  - missing_docs
```


| Rule | Tool config |
|---|---|
| RS-1 | Rust visibility rules plus `clippy::missing_errors_doc`/API review where configured |
| RS-2 | Compiler type checking through `cargo check --workspace --all-targets --locked` |
| RS-3 | `#![forbid(unsafe_code)]`; any exception documented in a decision record |
| RS-4 | `cargo fmt --all --check`; `cargo clippy --workspace --all-targets --locked -- -D warnings` |
| CMT-5, CMT-12 (doc comments) | `#![deny(missing_docs)]` at each crate root (the rustc lint is allow-by-default) plus `clippy::missing_errors_doc`. Trait items carry the contract; implementations reference the trait |
| IMP-1, IMP-2 (import paths) | `use crate::core::role::Role` for anything outside the current module; `super::` only from an inline `#[cfg(test)]` module to its parent. No lint covers this, so it is `llm (fallback)` |
| RS-7 | Rust `Send`/`Sync` trait bounds checked by `cargo check` |
| FF-1 (layer deps) | Cargo workspace dependency graph checked from crate `Cargo.toml` files against `docs/architecture.md` §4 |

## References

**Local artifacts:**
- `stacks/rust/index.md`: slot table that points to these idioms.
- `schemas/stack-idioms.schema.md`: schema for this file.

**External authoritative sources:**
- https://doc.rust-lang.org/rustc/lints/listing/allowed-by-default.html#missing-docs
- https://doc.rust-lang.org/book/ch09-00-error-handling.html
- https://docs.rs/thiserror
- https://docs.rs/anyhow
- https://docs.rs/tokio/latest/tokio/task/struct.JoinSet.html
- https://docs.rs/tokio-util/latest/tokio_util/sync/struct.CancellationToken.html
- https://docs.rs/serde
- https://docs.rs/tracing

## Related

- [index.md](index.md) - stack slot table.
- [Stack idioms schema](../../../schemas/stack-idioms.schema.md) - required structure for this file.
- [Error handling](../../foundations/code/error-handling.md) - [Clean architecture](../../foundations/design/clean-architecture.md) - [Design principles](../../foundations/design/design-principles.md).
