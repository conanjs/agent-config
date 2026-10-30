---
schema: knowledge-doc/v1
type: reference
topic: code-documentation
status: verified
applies-to: ["C#", "TypeScript (TSDoc)", "JavaScript (JSDoc)", "Python", "Go", "Rust"]
last-verified: 2026-10-28
last-updated: 2026-10-28
tags: [doc-comments, tsdoc, jsdoc, xml-documentation, csharp, linting]
---

# Doc-comment standards across languages

## Summary
**TL;DR:** Every mainstream language has one standard way to document a public declaration, and a tool that reports a public declaration with no doc comment. C# uses `///` XML tags and compiler warning CS1591. TypeScript uses TSDoc `/** … */` with ESLint plugins. Python, Go and Rust each have their own form and lint. The parts are the same everywhere: summary, details, parameters, return, errors, example, and inherit-from-interface.
**Use this when:** choosing or reviewing doc-comment syntax, mapping a C# habit to another stack, or wiring the lint that enforces it.
**Not this doc:** when a comment is worth writing at all, which is the framework foundation `foundations/code/comments.md`.

## Scope
Doc comments on public declarations (types, functions, methods, properties, interface members). Implementation comments inside function bodies are out of scope. Versions as checked on 2026-10-25; the editor-hover table and the summary-lint notes on 2026-10-27.

## Catalog

**Part-by-part mapping**

| Part | C# XML doc (`///`) | TSDoc (`/** */`) | JSDoc (`/** */`) | Python docstring | Go | Rust (`///`) |
|---|---|---|---|---|---|---|
| Summary | `<summary>` ✅[^1] | first paragraph ✅[^3] | first paragraph | first line | first sentence, naming the symbol ✅[^6] | first paragraph |
| Details | `<remarks>` ✅[^1] | `@remarks` ✅[^3] | description | body | further paragraphs | further paragraphs |
| Parameter | `<param name="x">` ✅[^1] | `@param x - …` ✅[^3] | `@param {T} x …` | `Args:` (Google) or `Parameters` (NumPy) section | prose | prose |
| Return | `<returns>` ✅[^1] | `@returns` ✅[^3] | `@returns` | `Returns:` section | prose | prose |
| Errors | `<exception cref="X">` ✅[^1] | `@throws` ✅[^3] | `@throws` | `Raises:` section | prose | `# Errors` section |
| Example | `<example>` ✅[^1] | `@example` ✅[^3] | `@example` | `Examples` section | `Example…` functions | `# Examples` section ✅[^8] |
| Inherit from interface | `<inheritdoc/>` ✅[^1] | `{@inheritDoc Port.member}` ✅[^3] | — | — | — | — |
| Cross-reference | `<see cref>` ✅[^1] | `{@link X}` ✅[^3] | `{@link X}` | — | `[Name]` | `` [`Name`] `` |

**"Every public declaration is documented": who enforces it**

| Language | Tool | What it reports |
|---|---|---|
| C# | Compiler warning CS1591 when a documentation file is generated | Missing XML comment for a publicly visible type or member ✅[^2] |
| TypeScript | `eslint-plugin-jsdoc` `require-jsdoc` (presence) plus `eslint-plugin-tsdoc` `tsdoc/syntax` (format) | Missing comment; malformed tag, e.g. `@param` with no hyphen ✅[^4] ✅[^5] |
| Python | Ruff `D1xx` (pydocstyle), e.g. `D103` | Public function with no docstring ✅[^7] |
| Go | `revive` `exported`, `package-comments` | Exported function or method with no comment; package with no comment ✅[^9] |
| Rust | rustc `missing_docs` (allow-by-default, so turn it on) | Public item with no docs ✅[^10] |

**What the TypeScript editor shows on hover over an implementing method**

Measured 2026-10-27 on TypeScript 6.0.3, calling `getQuickInfoAtPosition` (the language-service call editors make) on `InMemoryDocumentStore.find`, which implements `DocumentStore.find`, in the stack reference `conanjs/agentic-sdlc-reference-typescript-node`.

| Comment on the implementing method | Summary shown | `@param` / `@returns` / `@remarks` shown |
|---|---|---|
| `/** {@inheritDoc DocumentStore.find} */` | Literal `{@inheritDoc DocumentStore.find}` text | The interface's |
| None | The interface's summary | The interface's |
| Own summary, no block tag (`/** {@link DocumentStore.find} against this process's memory: … */`) | The method's own summary | The interface's |
| Own summary plus `@see` or `@throws` | The method's own summary | None |
| Own summary plus `{@inheritDoc}` | — (`tsdoc/syntax` rejects it: `tsdoc-inheritdoc-incompatible-summary`) | — |

To re-run it, create a language service over the repo's `tsconfig.json` (`ts.createLanguageService`), call `getQuickInfoAtPosition(file, offsetOfMethodName)`, and print `displayPartsToString(info.documentation)` and `info.tags`.

**C# recommendations worth copying anywhere** ✅[^1]
- Document all publicly visible types and their public members.
- At a bare minimum, every type and member has a summary.
- Write complete sentences that end with a full stop.
- Put the comment on the interface or base type, and inherit it in implementations, so copies cannot drift.

## Lookup notes
- TSDoc is "loosely based on JSDoc" but has a strict grammar. Its reference parser and ESLint plugin come from Microsoft's `@microsoft/tsdoc` project. ✅[^3]
- `tsdoc/syntax` requires `@param name - description` (with the hyphen) and the inline form `{@inheritDoc X.y}`. A bare `@inheritDoc` is an error. Tested 2026-10-25 with eslint-plugin-tsdoc 0.5.4.
- Presence lint cannot judge meaning. `jsdoc/informative-docs` rejects `/** Delete. */` on `delete()`, but accepts `/** Gets the probe adapter. */`. Tested 2026-10-25 with eslint-plugin-jsdoc 65.4.2.
- `jsdoc/informative-docs` compares a summary with the documented symbol's own name only, not the enclosing class: `/** Applies one revision. */` on `ReviseDocument.run` passes it, although it only restates the class name. Tested 2026-10-27 with eslint-plugin-jsdoc 65.4.2. The framework's local rule `local-docs/specific-summary` also strips class and interface names (CMT-13).
- In the C# compiler, `<param>` names and `cref` targets are checked against the code. ✅[^1] TSDoc tools do not check names against the signature.
- `{@inheritDoc}` copies the summary, `@remarks`, `@param`, `@typeParam` and `@returns`; the same comment may not add its own summary or `@remarks`, but may add other tags such as `@throws` or `@example`. ✅[^11] `tsdoc/syntax` reports a violation as `tsdoc-inheritdoc-incompatible-tag` (tested 2026-10-25), and a summary beside it as `tsdoc-inheritdoc-incompatible-summary` (tested 2026-10-27).
- The TypeScript language service (editor hover) does not resolve the inline `{@inheritDoc X}` form and shows it as literal text. It does follow the JSDoc block tag `@inheritDoc`, and inherits automatically when a member has no comment. Tested 2026-10-25 on TypeScript 6.0.3.
- The same language service also inherits an interface member's `@param`, `@returns` and `@remarks` when the implementing method has its **own summary but no block tag**; one block tag (`@see`, `@throws`) stops that. So an implementation can carry its own summary, link the contract with `{@link Port.member}`, and still show the contract's notes on hover. Tested 2026-10-27 on TypeScript 6.0.3 through `getQuickInfoAtPosition`, the call editors make. The framework uses this form (CMT-12, TSN-13).
- A `{@link X}` resolves in the editor only when `X` is in scope in that file. In the stack reference, `{@link ReviseDocument}` written in `DocumentView.ts` (which does not import it) showed as plain text with no target. With an `import type` added only for the link, the link resolved and `tsc` passed, but `@typescript-eslint/no-unused-vars` failed on both imports, and the file now imported the files that import it. Tested 2026-10-28 on TypeScript 6.0.3 and typescript-eslint 8. So links work cheaply toward what a file already depends on (its port, its input type), and badly toward its callers.
- TypeDoc warns on `@link` tags it cannot resolve; its `validation.invalidLink` option is on by default. ✅[^12] The TypeScript compiler does not report them. Tested 2026-10-28.
- A broken link can be found without TypeDoc by asking the language service what an editor asks on a click: `getDefinitionAtPosition` at the link's last name segment. An empty answer is a link the editor shows as plain text. The stack reference runs this as `scripts/check-doc-links.mjs` in `pnpm run check`. On reference v4.0.0 before release it found 2 of 45 links broken, both in `DocumentError.ts`, which linked `Document` and `Document.MAX_BODY_LENGTH`. `Document` imports `DocumentError`, so the links pointed at a caller that was not in scope; they became plain words. Links to members of an `as const` object (`{@link LookupError.NotFound}`) resolved to the property. Tested 2026-10-28 on TypeScript 6.0.3.
- A list of callers in a comment duplicates what the editor computes live (Find All References, Call Hierarchy), and nothing fails when it goes stale. In Clean Architecture, an inner circle must not even mention the name of something declared in an outer circle. ✅[^13] *(Applying that to comments is our reading.)*

## Takeaways
- Require a doc comment on every public declaration, enforced by lint, in every stack. [rule-candidate]
- Link a doc comment toward what the code depends on (its contract, its input), never toward its callers; the editor lists callers live. [rule-candidate]
- Write the contract once on the interface or port. An implementation keeps a summary of its own that links the contract and says what it adds; in TypeScript it carries no block tag, so the editor still shows the contract's notes. [rule-candidate]

## Used by
| Where | Id / path | How |
|---|---|---|
| foundation | CMT-12 | Source: |

## Verification status
- Verified: 30 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-10-28

## References
- [Recommended XML documentation tags](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/xmldoc/recommended-tags) — Microsoft, living. Backs: C# column, recommendations, inheritdoc. [^1]
- [Compiler Warning CS1591](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-messages/cs1591) — Microsoft, living. Backs: C# enforcement. [^2]
- [TSDoc](https://tsdoc.org/) — TSDoc project (Microsoft), living. Backs: TSDoc column, relation to JSDoc. [^3]
- [eslint-plugin-jsdoc: require-jsdoc](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-jsdoc.md) — eslint-plugin-jsdoc maintainers, living. Backs: TypeScript enforcement. [^4]
- [eslint-plugin-tsdoc](https://tsdoc.org/pages/packages/eslint-plugin-tsdoc/) — TSDoc project, living. Backs: TypeScript format check. [^5]
- [Go Doc Comments](https://go.dev/doc/comment) — Go team, living. Backs: Go summary convention. [^6]
- [undocumented-public-function (D103)](https://docs.astral.sh/ruff/rules/undocumented-public-function/) — Astral, living. Backs: Python enforcement. [^7]
- [How to write documentation](https://doc.rust-lang.org/rustdoc/how-to-write-documentation.html) — Rust project, living. Backs: Rust examples section. [^8]
- [revive rule descriptions](https://github.com/mgechev/revive/blob/master/RULES_DESCRIPTIONS.md) — revive maintainers, living. Backs: Go enforcement. [^9]
- [Allowed-by-default lints: missing_docs](https://doc.rust-lang.org/rustc/lints/listing/allowed-by-default.html) — Rust project, living. Backs: Rust enforcement. [^10]
- [TSDoc: @inheritDoc](https://tsdoc.org/pages/tags/inheritdoc/) — TSDoc project (Microsoft), living. Backs: what `{@inheritDoc}` copies and forbids. [^11]
- [TypeDoc: {@inheritDoc}](https://typedoc.org/documents/Tags.__inheritDoc_.html) — TypeDoc maintainers, living. TypeDoc accepts both the inline and the block form.
- [TypeDoc: Validation options](https://typedoc.org/documents/Options.Validation.html) — TypeDoc maintainers, living. Backs: Lookup notes (`invalidLink`). [^12]
- [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) — Robert C. Martin, 2012. Backs: Lookup notes (the Dependency Rule names). [^13]
- `copilot/frameworks/agentic-sdlc/foundations/code/comments.md` — CMT-5 and CMT-12 apply this.
- `copilot/frameworks/agentic-sdlc/stacks/typescript-node/idioms.md` — TSN-13 and its tested lint config.

## Related
- `js-runtime/subpath-imports.md`
- `software-design/architecture-styles/clean-architecture.md`
