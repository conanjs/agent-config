---
schema: knowledge-doc/v1
type: reference
topic: js-runtime
status: verified
applies-to: ["Node.js 24.22.1 WHATWG URL and git 2.50.1 (Apple Git-155, curl transport) on macOS, tested 2026-11-14"]
last-verified: 2026-11-14
last-updated: 2026-11-14
tags: [url, security, git, parser-differential, validation]
---

# Checking a URL with Node's `URL`, then handing it to git

## Summary
**TL;DR:** Node's `new URL()` reads a backslash in an `https:` URL as `/`, so `https://tok\@127.0.0.1:9/o/r` has host `tok` and no user name ✅[^node-probe] git, given the same string, connected to `127.0.0.1` port 9 ✅[^git-probe] Node also drops a tab or newline inside the URL without an error: `https://git<TAB>hub.com/o/r` has host `github.com` ✅[^node-probe][^whatwg] So a check on the parsed URL does not check the string git uses. Refuse backslash, whitespace and control characters first, then require `new URL(v).href` to equal the string.
**Use this when:** a tool validates a repository or download URL with `URL` and then passes the original string to git, curl or a shell.
**Not this doc:** how the installer's reader applies the rule → spec 022 security record M-07.

## Scope
Two parsers reading one string differently: a parser differential. It is like two clerks reading a hand-written address: one reads a smudge as a slash and files the letter under "tok", the other reads it as part of a name and posts it to 127.0.0.1. Example: the host check passes `https://github.com\@evil.com/o` as GitHub, because Node sees host `github.com`.

## Catalog

| Input | Node `URL` reads | git 2.50.1 does | Evidence |
|---|---|---|---|
| `https://tok\@127.0.0.1:9/o/r` | host `tok`, user name empty, href `https://tok/@127.0.0.1:9/o/r` | connects to `127.0.0.1` port 9 | ✅[^node-probe][^git-probe] |
| `https://github.com\@evil.com/o` | host `github.com`, href `https://github.com/@evil.com/o` | not run here | ✅[^node-probe] |
| `https://git<TAB>hub.com/o/r` | host `github.com`; the tab is removed | not run here | ✅[^node-probe] |
| `https://github.com/o/r<LF>--x` | href `https://github.com/o/r--x`; the newline is removed | not run here | ✅[^node-probe] |

## Lookup notes
- The WHATWG URL standard treats `\` as a path separator in special schemes (http, https and others) and removes ASCII tab and newline before parsing; Node follows it. Git hands the string to curl, which does not.
- The spec 022 security role also probed `https://127.0.0.2\@127.0.0.1` with `git ls-remote` and saw the same split (not repeated here).
- The check that closes it: reject `/[\\\s\u0000-\u001f\u007f]/`, then compare `new URL(v).href` with `v` (allowing only a trailing `/`).

## Takeaways
- Validate the exact string a tool will pass on: reject characters the parser rewrites, then require the parsed href to equal the input. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 7 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-14

## References
- Local measurement, 2026-11-14 — `new URL(v)` printing `host`, `username` and `href` for the four inputs, Node.js v24.22.1 on macOS. Backs: the Node column. [^node-probe]
- Local measurement, 2026-11-14 — `GIT_TRACE_CURL=1 git ls-remote 'https://tok\@127.0.0.1:9/o/r'`, git 2.50.1 (Apple Git-155): the trace shows "Trying 127.0.0.1:9...". Backs: the git column. [^git-probe]
- [WHATWG URL Standard](https://url.spec.whatwg.org/#concept-basic-url-parser) — WHATWG, living standard. Backs: backslash as separator in special schemes, tab and newline removal. [^whatwg]

## Related
- [js-runtime index](index.md)
