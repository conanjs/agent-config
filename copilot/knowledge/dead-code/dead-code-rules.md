# Dead / Unused Code — Scan Rules

## ALIVE — Do NOT report

1. **Internally-used exports** — `export` keyword is irrelevant. If a symbol is called/referenced within the same file by another live symbol, it is alive.

2. **Barrel re-exports** — A symbol re-exported through an `index.ts` is only alive if something outside eventually imports it and reaches `src/pages/`. Trace actual consumers, not just the barrel. If the barrel has zero live importers, both the barrel and its re-exports are dead.

3. **String enum members in `Record<Enum, V>` key type** — If the enum type appears in any `Record<EnumType, V>` or mapped type, all members are alive. Removing them would break exhaustiveness. Exception: `Partial<Record<...>>` does not protect members — Partial allows missing keys, so removal is still legal.

4. **Numeric enum members whose ordinal value is positionally load-bearing** — If a numeric enum (no explicit string values) is used as an array index or tab index where the ordinal position of each member must match a hardcoded array slot (e.g. tab panel contents array), removing any member shifts subsequent ordinals and causes runtime misalignment. All such members are alive even if no production code writes `Enum.MEMBER` as an expression.

5. **Types / interfaces in live signatures** — If a type appears in the parameter or return type of a live function or as a prop type of a live component, it is alive.

6. **Constants used internally within their own file** — If a constant is only referenced inside the same file, but that file itself is live, the constant is alive regardless of external imports.

7. **Whole-enum / whole-object usage** — If **at least one member** of an enum or constant object is used anywhere in a live chain, the **entire** enum/object is considered used — do not remove any of its other members. Treat the enum/object as an atomic unit: once any part is alive, all parts are alive. This also covers reflective/exhaustive operations: if the enum or object is passed as a whole to `Object.values(MyEnum)`, `isEnum(value, MyEnum)`, `parseQueryParams(raw, MyEnum)`, or any equivalent, every member is alive because its runtime value feeds the accepted-values set.

8. **Test-only symbols in source files** — If a constant, enum, or object is defined in a production source file but is only imported/used by test files, it is still **alive**. Tests document the expected contract; removing the symbol forces tests to use hardcoded magic values, destroying that documented intent. Do not remove it from the source file.

---

## DEAD — DO report

1. **Whole files with no live consumers** — Every exported symbol has zero consumers tracing back to `src/pages/`.

2. **Dead barrel `index.ts`** — Re-exports symbols but has zero live importers. Delete the barrel; trace whether the re-exported files themselves also have zero live direct importers.

3. **Unused enum members** — No production code accesses `Enum.MEMBER` anywhere in a live chain, the enum is not used as a `Record<>` key type, the enum is not a numeric ordinal used as a positional index, **and** the enum is never passed as a whole to a reflective operation (see ALIVE rule 7).

4. **Whole files whose only consumers are test files** — If an entire source file is only ever imported by test files (no production consumer at all), the file itself is dead. Note: this does NOT apply to individual named symbols within a file (see ALIVE rule 8 — test-only symbols inside a live source file should be kept).

5. **Unreachable assets** — `.scss`, `.svg`, `.png`, `.json` files not imported anywhere in a live chain.

---

## Tracing Method

For each candidate:

1. **Grep `src/pages/` first** — before any downstream analysis, check whether any page directly imports the candidate or its containing directory. A page-level import is the strongest possible liveness signal and takes precedence over any feature-level "dead" verdict.
2. `grep -rn "SymbolName\|filePath" src/ --include="*.ts" --include="*.tsx"`
3. Exclude the definition line itself, and any reference inside `*.test.*` or `__test__/` files.
4. Follow each remaining reference's import chain upward to `src/pages/`.
5. If NO chain reaches `src/pages/` → DEAD.
6. If at least ONE chain reaches `src/pages/` → ALIVE.
7. For enum members: additionally check for `Record<EnumType, ...>` (non-Partial), any numeric positional array/tab-index usage, **and any whole-enum pass to a reflective operation** (rule 7 above) — if any found, all members are alive.

**Multiple-chain warning:** A file can have more than one import chain. A chain traced through the "obvious" importer (e.g., `_app.tsx`) being dead does NOT prove the file is dead — verify there are no other consumers importing via a different but equally valid path.

---

## Per-Symbol Analysis in Live Files

**⚠️ A "live file" is NOT a "live file with all live symbols."**

When a file is determined to be live (contains at least one symbol used in a live chain), that is **not** the end of analysis. You MUST:

1. Enumerate **every export** in the file.
2. Trace each export independently against `src/pages/`.
3. Delete any export whose only consumers are dead files — even if the file itself stays alive.

**Common mistake:** Finding one live symbol and stopping. The other 44 constants in the same file can all be dead. Apply the same grep + chain-trace process symbol-by-symbol, not just file-by-file.

---

## Backward Tracing from the Live Symbol

When a file is partially alive, **start from the specific live symbol and trace only its direct dependencies** — do not assume that all imports at the top of the file are needed just because the file itself stays alive.

The correct question is: *"What does **this exact live symbol** reference in its own implementation?"*  
The wrong shortcut is: *"This file is alive, so every `import` statement at the top of the file must also be alive."*

You still need to trace forward through imports — but only the imports that the live symbol's code path actually reaches. Imports used exclusively by dead symbols in the same file are themselves dead.

**Concrete example** *(from `constants/one-quote-booking/link.ts` — 45 exported constants, stepped through during dead-code deletion)*:

- `link.ts` is partially alive: `ONE_QUOTE_TERMS_AND_CONDITIONS` is live because `CancelBookingDetail.tsx` imports it via the barrel → reaches `src/pages/`.
- `link.ts` also imports `LOCALE_STATIC_ENDPOINT` from `subtitle-language.ts` — but that import is used only to build `USER_GUIDE_VIDEO`, a different constant that has zero consumers.
- `ONE_QUOTE_TERMS_AND_CONDITIONS` itself only references `envVariables` (from the env config) — it does not touch `LOCALE_STATIC_ENDPOINT` at all.

**Wrong reasoning:** "`link.ts` is alive → it imports from `subtitle-language.ts` → `subtitle-language.ts` must be alive."  
**Correct reasoning:** "Only `ONE_QUOTE_TERMS_AND_CONDITIONS` is alive in `link.ts`. It never references `LOCALE_STATIC_ENDPOINT`. Therefore `subtitle-language.ts` is not kept alive by this chain — delete it."

---

## Don't Trust the Source — Always Verify at Runtime

**⚠️ CSV reports, prior analyses, and teammate findings are starting points, not ground truth.**

Common mistakes that happen when the source is trusted blindly:

- Symbol-to-file mismatch: CSV says "keep `terms-and-conditions.ts` for `ONE_QUOTE_TERMS_AND_CONDITIONS`" but the symbol is actually in `link.ts`.
- Stale data: a file was moved or renamed after the CSV was written.
- Tracing errors in the CSV note field.

**Rule:** For every row in the CSV that says "keep" or "partial", open the actual file and confirm:
- The named symbol is **exported from that exact file**.
- The import path in the consumer matches the file you are keeping.
- No intervening barrel re-exports the symbol from a different source.

If you find a mismatch, correct the CSV and the guide before acting.

---

## Import Path Exactness Rule

When tracing a symbol to confirm it reaches `src/pages/`, you MUST verify the **exact import path string** in the consumer file — not just the symbol name.

The same symbol name (e.g. `gtag`, `safeApiClient`) can be exported from multiple sources:
- `@shared-frontend/shared/configs` (external package alias)
- `src/shared/configs` (local shared folder, different team scope)
- `src/modules/shipment-overview/shared/...` (this module)

A page importing `gtag` from `@shared-frontend/shared/configs` does NOT make a file in `src/modules/shipment-overview/shared/` alive, even if both export a symbol with the same name.

**Check:** open the consumer file and read the exact `from '...'` string. If it points to a different package or path than the file you are tracing, the chain is broken — the file is still dead.

---

## Cascading Dead Analysis — Extra Caution

When a file is declared dead because "its only consumer is [file X] which is dead", the dead verdict for X must itself be independently confirmed **before** declaring the dependent file dead. A broken link anywhere in the chain invalidates all downstream dead verdicts.

Additionally, for directories declared dead as a feature unit (e.g., "the entire OCB feature is dead"), always check individual files within the directory for **non-feature importers** — live components from outside the feature can import specific leaf files directly, bypassing the feature-level assessment.

---

## False Positive Checklist (verify before adding any row)

- [ ] Symbol has `export` but is still called within the same file by another live symbol → skip
- [ ] Enum is used as a non-Partial `Record<Enum, V>` key type anywhere → skip all its members
- [ ] Enum is numeric (no explicit string values) and its ordinal is used as a positional array/tab index → skip affected members
- [ ] Enum or object has **at least one member/property** used in a live chain → skip ALL other members/properties (whole-enum rule: treat as atomic unit)
- [ ] Enum or object is passed whole to `Object.values()`, `isEnum()`, `parseQueryParams()`, or any equivalent reflective operation → skip ALL members/properties (corollary of above)
- [ ] Symbol is only imported by test files but the **source file itself is live** → symbol is alive; do not remove it (ALIVE rule 8)
- [ ] Barrel `index.ts` re-exports it AND the barrel itself has live importers → alive; note: a direct file import (e.g. `./Foo/Foo.tsx`) does NOT make the barrel (`./Foo`) live
- [ ] Type appears in a prop type or function signature of a live component/hook → alive
- [ ] File is live (has one live symbol) but you stopped at file-level — verify every export individually; dead symbols within a live file must still be removed
- [ ] CSV/source says "keep file X for symbol Y" but you didn't open file X to confirm Y is actually exported from it — always verify the symbol-to-file mapping before acting
- [ ] You traced forward from a live file's imports instead of backward from the specific live symbol — re-trace: only what the live symbol directly needs survives
