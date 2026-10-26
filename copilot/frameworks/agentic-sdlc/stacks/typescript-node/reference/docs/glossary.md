# Glossary

Domain terms and naming choices for this repo (NAM-2, NAM-3).

| Term             | Meaning                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Document         | A text with an id and a version; every accepted revision creates the next version.         |
| Version          | Positive integer, 1 at creation, plus one per accepted revision.                           |
| Revise           | Replace a document's body, based on the version the caller read.                           |
| Version conflict | The caller's version is no longer the stored one: someone else revised the document first. |

**Naming choices**

| Choice                               | Decision                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `Store` or `Repository`              | `Store`: documents are simple keyed values, not aggregates with children. |
| Verb for new domain objects          | `create` (`Document.create`).                                             |
| Verb for assembling the object graph | `build` is not used; the composition root exposes `app()`.                |
