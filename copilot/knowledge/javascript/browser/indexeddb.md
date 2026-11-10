---
schema: knowledge-doc/v1
type: concept
topic: javascript/browser
status: verified
applies-to: ["Indexed Database API 3.0 (W3C)", "Chrome 152 for every lab result"]
last-verified: 2026-11-10
last-updated: 2026-11-10
tags: [javascript, browser, storage, indexeddb, object-store, transaction, autocommit, index, keyrange, cursor, versioning, onupgradeneeded, versionchange, structured-clone]
---

# IndexedDB: versioned stores, transactions, indexes and cursors

## Summary
**TL;DR:** IndexedDB is a transactional key-value database inside the browser, one per origin and name, storing almost any value the structured-clone algorithm can copy (objects, `Date`, `Blob`, typed arrays — not functions). Its schema changes only in `upgradeneeded`, which fires when you open a **higher version**. All reads and writes happen in a **transaction** over named object stores; a transaction commits automatically as soon as no request is pending and control returns to the event loop, so awaiting anything that is not an IndexedDB request in the middle kills it. Search by key, by **key range**, through an **index** on a field, or step through results with a **cursor**.
**Use this when:** an app needs more than `localStorage`'s small string store: offline data, caches of API responses, files, or large lists queried by a field.
**Not this doc:** `localStorage`, `sessionStorage` and cookies → `browser-platform-deep-dive.md` §7.

## Problem
Code awaits a `fetch` inside a transaction and gets `TransactionInactiveError`; a duplicate `add` aborts every other write in the same transaction; two tabs on different code versions block each other's upgrade; and searching "all books under 7" loads the whole store because there is no index.

## Mental model
**Analogy:** a bank vault (database) with numbered editions (versions), shelves of boxes (object stores) labelled by key, and card catalogues (indexes) by another field. A transaction is a visit with a list of shelves and a mode (read only or read-write); the clerk closes the visit the moment you stop handing in requests, and if one request fails without you excusing it, the whole visit is rolled back.

**Artifact (lab ✅[^1]):**
```js
const open = indexedDB.open('library', 1);
open.onupgradeneeded = e => {                       // oldVersion 0 → newVersion 1
  const db = open.result;
  db.createObjectStore('books', { keyPath: 'id' }).createIndex('price_idx', 'price');
};
open.onsuccess = () => { const db = open.result; /* db.version === 1 */ };
```

## How it works
1. **Open and upgrade.** `indexedDB.open(name, version)` fires `upgradeneeded` (with `oldVersion`, `newVersion`) when the stored version is lower, then `success`; only inside `upgradeneeded` can you create or delete object stores and indexes ✅[^1] ✅[^2]. Opening with a lower version than stored fails with `VersionError` ✅[^1] ✅[^2]. `indexedDB.deleteDatabase(name)` removes it ✅[^1] ✅[^2].
2. **Parallel versions.** If another tab holds an older connection, it receives `versionchange`; it should `db.close()` (and ask the user to reload), otherwise the new open gets `blocked` ✅[^1] ✅[^2].
3. **Object stores and keys.** A store keeps values by key: an in-value `keyPath` (`{keyPath: 'id'}`), a generated key (`{autoIncrement: true}` gave 1, 2) or an explicit key argument ✅[^1] ✅[^2]. Values go through structured clone: a `Date` came back as a `Date`, a function threw `DataCloneError` ✅[^1] ✅[^2].
4. **Transactions.** `db.transaction(['books', 'free'], 'readwrite')` (or `'readonly'`, the default and the only mode that runs in parallel with others on the same stores) → `tx.objectStore('books')` → requests `add`, `put`, `get`, `getAll`, `getAllKeys`, `count`, `delete`, `clear` ✅[^1] ✅[^2]. `add` fails on an existing key with `ConstraintError`; `put` inserts or replaces ✅[^1] ✅[^2]. `tx.oncomplete` is the only proof the data is written; `tx.abort()` rolls back ✅[^2].
5. **Autocommit.** A transaction stays active while its requests' callbacks run and new requests are made from them; when the queue is empty and the task ends, it commits. A `setTimeout` (or `fetch`) between two requests made the next request throw `TransactionInactiveError` ✅[^1] ✅[^2]. Fetch first, then open the transaction.
6. **Errors.** A failed request fires `error` on the request, which bubbles to the transaction and the database; if no handler calls `event.preventDefault()`, the **transaction aborts** (`abort` with `ConstraintError`); with `preventDefault()` the other writes still committed ✅[^1] ✅[^2].
7. **Searching.** By key or key range: `IDBKeyRange.only`, `lowerBound`, `upperBound`, `bound(lower, upper, lowerOpen, upperOpen)`; `getAllKeys(IDBKeyRange.bound('css', 'html'))` → `['css', 'html']` ✅[^1] ✅[^2]. Keys are sorted, so results come back in key order ✅[^1] ✅[^2]. By field: `store.index('price_idx').getAll(IDBKeyRange.upperBound(7))` → the `css` and `html` books ✅[^1] ✅[^2]. A missing key returns `undefined` ✅[^1].
8. **Cursors.** `openCursor(range, direction)` walks records one at a time (`next`, `prev`, `nextunique`, `prevunique`) and calls `onsuccess` again after `cursor.continue()`; `openKeyCursor` skips values ✅[^1] ✅[^2]. `prev` gave `js, html, css` ✅[^1].
9. **Promise wrappers.** Libraries such as `idb` wrap requests in promises; the autocommit rule still applies to anything awaited ✅[^2].

## Worked example
Add two books, try a duplicate, read cheap books by index:

| Step | Code (inside one `readwrite` transaction) | Result (lab ✅[^1]) |
|---|---|---|
| 1 | `s.add({id: 'js', price: 10, created: new Date(0)}); s.add({id: 'css', price: 5}); s.put({id: 'html', price: 7})` | 3 records |
| 2 | `s.add({id: 'js', price: 1})` with no error handler | `ConstraintError`; **whole transaction aborted**, nothing stored |
| 3 | Same, but `req.onerror = e => e.preventDefault()` | Transaction `complete`, 3 records |
| 4 | `s.index('price_idx').getAll(IDBKeyRange.upperBound(7))` | `css`, `html` |
| 5 | `s.openCursor(null, 'prev')` + `continue()` | `js`, `html`, `css` |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `await fetch()` inside a transaction | `TransactionInactiveError` on the next request | Autocommit when no request is pending ✅[^1] ✅[^2] |
| `createObjectStore` outside `upgradeneeded` | `InvalidStateError` | Schema changes need a version-change transaction ✅[^2] |
| Old tab ignores `versionchange` | New tab's open is `blocked` | The old connection is still open ✅[^1] ✅[^2] |
| Storing a class instance | Comes back as a plain object | Structured clone drops prototypes ✅[^3] |
| Private browsing or storage pressure | Data may be evicted | Browser storage is best-effort unless persisted ✅[^4] |

## Takeaways
- Change the schema only by bumping the version and handling `upgradeneeded`; always handle `versionchange` by closing. [rule-candidate]
- Never await non-IndexedDB work inside a transaction; gather data first. [rule-candidate]
- Treat `oncomplete`, not request `success`, as "saved".

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 41 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-10

## References
- `javascript/browser/browser-lab-setup.md` — the Chrome 152.0.7977.167 lab, a throwaway database created and deleted on 2026-11-10. [^1]
- [IndexedDB](https://javascript.info/indexeddb) — javascript.info, living. Backs: opening and versioning, parallel update problem, stores, transactions, autocommit, errors, searching, indexes, cursors, promise wrappers. [^2]
- [The structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) — MDN, living. Backs: the prototype chain is not copied. [^3]
- [Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) — MDN, living. Background: transactions and versions.
- [Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) — MDN, living. Backs: best-effort storage and eviction. [^4]
- [Indexed Database API 3.0](https://w3c.github.io/IndexedDB/) — W3C, living editor's draft. Background: transaction lifetime and key ordering.

## Related
- `javascript/browser/browser-platform-deep-dive.md` — web storage and cookies.
- `javascript/browser/binary-data-blobs-and-files.md` — Blobs and Files stored in IndexedDB.
