---
schema: knowledge-doc/v1
type: reference
topic: documentation
status: verified
applies-to: ["OpenAPI 3.2.0", "AsyncAPI 3.1.0", "OpenRPC 1.4.x", "OpenCLI 0.1 (opencli.org, draft)", "OpenCLI 1.0.0-alpha.16 (opencli.dev)", "usage 7.1.5 (jdx)", "JSON Schema 2020-12", "API Extractor", "IEEE Std 1003.1-2024", "Backstage catalog descriptor v1alpha1", "checked 2026-11-03"]
derived-from: [documentation/opencli-deep-dive.md, documentation/usage-spec-deep-dive.md, documentation/cli-description-formats-deep-dive.md]
last-verified: 2026-11-03
last-updated: 2026-11-03
tags: [interfaces, contracts, openapi, asyncapi, openrpc, opencli, cli, json-schema, api-extractor, backstage, documentation]
---

# Interface description standards, by kind of interface

## Summary
**TL;DR:** Every way another program or person can talk to a repo is an interface, and most kinds have a standard, machine-readable description format: OpenAPI for HTTP, AsyncAPI for events, OpenRPC for JSON-RPC, usage or OpenCLI for command-line tools (two unrelated specs share the name OpenCLI), JSON Schema for JSON data such as files and hook payloads, and an API Extractor report for a TypeScript library. A repo-level catalog that lists all of them has a convention too: Backstage's `catalog-info.yaml`.
**Use this when:** deciding how a repo documents what it exposes, choosing the format for one interface, or reviewing whether a tool can be used without reading its code.
**Not this doc:** how to design and version contracts between services (rules CON-1 … CON-14, `frameworks/agentic-sdlc/foundations/design/contract-design.md`); HTTP error mapping → `web-apis/http-error-mapping.md`.

## Scope
Formats that describe an interface so that a person or a program can use it without the source code, as published on 2026-11-03. Covers network APIs, command-line programs, data files and streams, libraries, and the catalog that lists a repo's interfaces. Not covered: GraphQL (its schema language describes itself) and protobuf (its `.proto` files are the description).

## Catalog

### Description formats

| Interface kind | Format | Version (2026-11-03) | Maturity | What one document describes | Status |
|---|---|---|---|---|---|
| HTTP request/response | OpenAPI | 3.2.0, released 19 Sep 2025; backward compatible with 3.1 | Standard (OpenAPI Initiative, Linux Foundation) | Paths, operations, parameters, request and response bodies, errors, security | ✅[^1] |
| Events and messages (queues, brokers, websockets) | AsyncAPI | 3.1.0 | Standard (AsyncAPI Initiative) | Channels, operations (send, receive), message payloads (JSON Schema), servers | ✅[^2] |
| JSON-RPC 2.0 calls | OpenRPC | 1.4.x | Standard for JSON-RPC 2.0 | Methods, params, results, errors, so a client can discover the service | ✅[^3] |
| Command-line program | usage (jdx), KDL 2.0 file `*.usage.kdl` | 7.1.5, released 2026-11-01 | One maintainer's project, used by mise | Commands, flags, args, exit codes, env vars and config behind flags, stdout outputs with JSON Schema, `effect` (read/write/destructive); `usage lint`, `usage diff` (breaking changes), completions, Markdown, man pages, SDKs, MCP | ✅[^5] |
| Command-line program | OpenCLI, opencli.org (Spectre.Console authors), JSON | 0.1 | **Draft** ("just a proposal"); exported by Spectre.Console.Cli; the .NET CLI intends to align | Commands, options, arguments, exit codes, `interactive`, `metadata`; no types, defaults or env vars | ✅[^4] |
| Command-line program | OpenCLI, opencli.dev (bcdxn), YAML/JSON | 1.0.0-alpha.16 | **Alpha**; tool `ocli` 1.3.0 generates docs and Cobra code | Commands, typed args and flags, defaults, env vars and config files behind flags, exit codes with a fixed status list | ✅[^11] |
| Command-line program, completion only | Fig completion spec (Amazon Q Developer CLI), carapace-spec; argc for Bash; docopt (last release 2014) | — | Tools for completion or parsing, not contracts | No exit codes or outputs | ✅[^12] |
| Command-line conventions (not a file format) | POSIX Utility Conventions, IEEE Std 1003.1-2024, chapter 12 | Issue 8 | Standard | The SYNOPSIS notation for options, operands, optional and repeated arguments, and the Utility Syntax Guidelines | ✅[^6] |
| Command-line behaviour (not a file format) | Command Line Interface Guidelines (clig.dev) | living | Community guide | `-h`/`--help`, docs that match the installed version, exit 0 on success and non-zero mapped to failure modes, data on stdout and diagnostics on stderr, `--json` for machines | ✅[^7] |
| JSON data: files, JSON Lines records, stdin/stdout payloads, config | JSON Schema | 2020-12 (previous 2019-09) | Standard draft series, the one OpenAPI and AsyncAPI embed | The shape of each JSON value: types, required fields, enums, formats | ✅[^8] |
| TypeScript library | API Extractor API report (`etc/<package>.api.md`) | living | Tool convention (Microsoft) | The public API's signatures as compact pseudocode, with release tags and documentation status; a changed report must be committed, so reviewers see every public API change | ✅[^9] |

### A repo's catalog of interfaces

| Item | Fact | Status |
|---|---|---|
| Backstage `catalog-info.yaml` | Recommended file name for Backstage descriptor files | ✅[^10] |
| `kind: API` | Required `spec.type` (well known: `openapi`, `asyncapi`, `graphql`, `grpc`; any value accepted), `spec.lifecycle` (`experimental`, `production`, `deprecated`), `spec.owner`, `spec.definition` (the description document itself) | ✅[^10] |
| A component's interfaces | `spec.providesApis` and `spec.consumesApis` list API entities, giving the relations `providesApi`/`apiProvidedBy` and `consumesApi`/`apiConsumedBy` | ✅[^10] |

## Lookup notes
- **Kinds with no standard format:** environment variables a program reads, the hook protocols of coding agents (each agent documents its own JSON), and a project's file layout. Describe them in prose tables in the repo's interface catalog, and the JSON parts with JSON Schema.
- **"OpenCLI" names two unrelated specs.** `"opencli": "0.1"` is opencli.org; `opencliVersion: 1.0.0-alpha.16` is opencli.dev. Name the site, never just "OpenCLI" (`opencli-deep-dive.md`).
- **No CLI format describes stdin.** A program that reads JSON on stdin (a hook handler) needs a JSON Schema for it beside its CLI description.
- **usage covers the most** of any CLI format checked: exit codes, outputs with schemas, `effect`, and a breaking-change check (`usage-spec-deep-dive.md`); the full matrix and a decision guide are in `cli-description-formats-deep-dive.md`.
- **A description is only useful while it matches the code.** The usual guard is a check in CI: generate the help text or types from the description, or test that the program's commands, flags and exit codes equal the description's (the same idea as API Extractor's committed report).
- **One catalog per repo, many description files.** Backstage's model: the catalog lists each interface with its kind, owner, lifecycle and a link to its description document.

## Takeaways
- A repo is usable from outside only when each of its interfaces has a description a reader can find without the code, listed in one catalog (now CON-15, with CON-16 for the drift check).
- Pick the format by interface kind; where none exists, a table in the catalog plus JSON Schema for the data.

## Used by
| Where | Id / path | How |
|---|---|---|
| foundation | CON-15 | Source: |
| foundation | CON-16 | Source: |

## Verification status
- Verified: 14 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-03

## References
- [OpenAPI 3.2](https://redocly.com/blog/openapi-3-2) — Redocly, 2025; [OpenAPI Initiative news](https://openapis.org/tag/openapi). Backs: 3.2.0 release date and compatibility with 3.1. [^1]
- [AsyncAPI specification, latest](https://www.asyncapi.com/docs/reference/specification/latest) — AsyncAPI Initiative, read 2026-11-03. Backs: version 3.1.0. [^2]
- [OpenRPC specification](https://spec.open-rpc.org/) — OpenRPC, read 2026-11-03. Backs: describes JSON-RPC 2.0, version 1.4.x. [^3]
- [OpenCLI (opencli.org)](https://opencli.org/) — Patrik Svensson, Bob Lail, read 2026-11-03; [dotnet/command-line-api#2632](https://github.com/dotnet/command-line-api/issues/2632). Backs: version 0.1, draft status, fields, .NET alignment. [^4]
- [usage spec](https://usage.jdx.dev/spec/) and [jdx/usage](https://github.com/jdx/usage) — jdx, 7.1.5. Backs: KDL format, nodes, `effect`, outputs, exit codes, lint, diff, generators. [^5]
- [Utility Conventions, IEEE Std 1003.1-2024](https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/V1_chap12.html) — The Open Group / IEEE, 2024. Backs: synopsis notation and Utility Syntax Guidelines. [^6]
- [Command Line Interface Guidelines](https://clig.dev/) — Aanand Prasad, Ben Firshman, Carl Tashian, Eva Parish, living. Backs: help, docs, exit codes, stdout/stderr, `--json`. [^7]
- [JSON Schema specification](https://json-schema.org/specification) — JSON Schema, read 2026-11-03. Backs: current version 2020-12. [^8]
- [API Extractor: the API report](https://api-extractor.com/pages/overview/demo_api_report/) — Microsoft, living. Backs: report contents and the review workflow. [^9]
- [Backstage descriptor format](https://backstage.io/docs/features/software-catalog/descriptor-format/) — Backstage (CNCF), living. Backs: `catalog-info.yaml`, `kind: API`, `providesApis`/`consumesApis`. [^10]
- [bcdxn/opencli](https://github.com/bcdxn/opencli) and its [spec.schema.json](https://github.com/bcdxn/opencli/blob/main/spec.schema.json) — opencli.dev. Backs: version, fields, exit-code statuses, `ocli`. [^11]
- [withfig/autocomplete](https://github.com/withfig/autocomplete), [carapace-spec](https://github.com/carapace-sh/carapace-spec), [argc](https://github.com/sigoden/argc), [docopt on PyPI](https://pypi.org/project/docopt/). Backs: purpose and status of the completion and parsing formats. [^12]
- Local: `opencli-deep-dive.md`, `usage-spec-deep-dive.md`, `cli-description-formats-deep-dive.md` — the deep dives this reference is distilled from.

## Related
- `documentation/opencli-deep-dive.md`, `documentation/usage-spec-deep-dive.md`, `documentation/cli-description-formats-deep-dive.md` — the full investigations.
- `frameworks/agentic-sdlc/foundations/design/contract-design.md` — contract rules (CON-1 … CON-14) and the formats it names today (OpenAPI, AsyncAPI, protobuf).
- `web-apis/http-error-mapping.md`
- `documentation/learning-explanation-framework.md`
