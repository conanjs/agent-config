---
schema: knowledge-doc/v1
type: concept
topic: javascript/browser
status: verified
applies-to: ["ECMAScript 2025 (ArrayBuffer, typed arrays, DataView)", "WHATWG Encoding and File API", "Chrome 152 for every lab result"]
last-verified: 2026-11-10
last-updated: 2026-11-10
tags: [javascript, browser, binary, arraybuffer, typedarray, uint8array, dataview, endianness, textencoder, textdecoder, blob, object-url, base64, file, filereader]
---

# Binary data, text encoding, Blob and File

## Summary
**TL;DR:** An **`ArrayBuffer`** is a fixed block of raw bytes with no way to read it; **views** give it meaning: typed arrays (`Uint8Array`, `Int16Array`, `Float64Array`, …) read it as a list of same-size numbers in the machine's byte order, and `DataView` reads any type at any offset in an explicit byte order (big-endian by default). `TextEncoder`/`TextDecoder` convert between strings and UTF-8 (or other) bytes. A **`Blob`** is an immutable chunk of data with a MIME type, usable as a URL (`URL.createObjectURL`) or read as text, bytes or a stream; a **`File`** is a Blob with a name and a modification date, typically from `<input type=file>` or drag-and-drop, and `FileReader` is the older event-based way to read one.
**Use this when:** parsing binary formats or network messages, converting text to bytes, generating downloads, previewing user files, or uploading parts of a file.
**Not this doc:** sending Blobs and Files over the network → `network-requests-in-depth.md`; storing them → `indexeddb.md`.

## Problem
A typed array silently wraps 256 to 0, a file format parsed with `Uint32Array` reads garbage because the format is big-endian, `btoa('é')` throws, memory grows because object URLs are never revoked, and a multi-byte character split across two network chunks decodes as `�`.

## Mental model
**Analogy:** an `ArrayBuffer` is a strip of film; views are projectors with different lenses. A `Uint8Array` shows each frame (byte) alone; a `Uint32Array` groups four frames into one picture; a `DataView` is a manual projector where you say "show four frames from position 4, read left to right". A `Blob` is a sealed envelope of film with a label (MIME type); a `File` is the same envelope with a name written on it.

**Artifact (lab ✅[^1]):**
```js
const buf = new ArrayBuffer(16), u8 = new Uint8Array(buf), u32 = new Uint32Array(buf), dv = new DataView(buf);
u32[0] = 0x01020304;  [...u8.slice(0, 4)]   // [4, 3, 2, 1]  — little-endian machine
dv.setUint32(4, 0x01020304);                // DataView default: big-endian
[...u8.slice(4, 8)]                          // [1, 2, 3, 4]
```

## How it works
1. **`ArrayBuffer`.** `new ArrayBuffer(16)` allocates 16 zeroed bytes; `byteLength` 16 ✅[^1] ✅[^2]. Resizable buffers exist (`new ArrayBuffer(4, {maxByteLength: 8})`, `resize(8)`) ✅[^1].
2. **Typed arrays.** `Uint8Array`, `Uint16Array`, `Uint32Array`, `Int8/16/32Array`, `Float32/64Array`, `BigInt64/BigUint64Array` and `Uint8ClampedArray` are views; `length` counts elements (a 16-byte buffer is 4 `Uint32`), `BYTES_PER_ELEMENT` gives the size ✅[^1] ✅[^2]. Created from a length, an array, another typed array or `(buffer, byteOffset, length)` ✅[^2].
3. **Out-of-range values wrap**: only the low bits are kept, so `Uint8Array([255, 256, 257, -1, 3.7])` holds `[255, 0, 1, 255, 3]`; `Uint8ClampedArray` clamps to 0–255 and rounds half to even (`[255, 256, 300, -5, 3.5, 4.5]` → `[255, 255, 255, 0, 4, 4]`) ✅[^1] ✅[^2]. Writing past the end is ignored and reading returns `undefined` ✅[^1].
4. **Array methods** work (`map`, `slice`, `find`…), but there is no `push` or `concat` because the size is fixed; `subarray` creates a view on the **same** memory while `slice` copies ✅[^1] ✅[^2].
5. **`DataView`** reads `getUint8/16/32`, `getInt…`, `getFloat…` at any byte offset with an optional `littleEndian` flag; default big-endian matters for network and file formats ✅[^1] ✅[^2].
6. **`TextEncoder`** always produces UTF-8: `'Hé😀'` is 7 bytes `[72, 195, 169, 240, 159, 152, 128]`; `encodeInto` writes into an existing array and reports `{read, written}` ✅[^1] ✅[^3]. **`TextDecoder(label)`** decodes UTF-8 or legacy encodings (`windows-1251` bytes → `"При"`), replaces invalid bytes with `U+FFFD` unless `{fatal: true}` (then `TypeError`), accepts any view (a `subarray` decodes just that slice), and with `{stream: true}` keeps a split multi-byte character for the next call ✅[^1] ✅[^3] ✅[^4].
7. **`Blob`.** `new Blob(parts, {type})` concatenates strings (as UTF-8), buffers, views and other blobs: `['héllo', Uint8Array[33]]` → size 7, text `"héllo!"` ✅[^1] ✅[^5]. Blobs are immutable; `slice(start, end, type)` makes new ones ✅[^1] ✅[^5]. Read with `text()`, `arrayBuffer()`, `bytes()` (a `Uint8Array`) or `stream()` ✅[^1] ✅[^5].
8. **Blob URLs.** `URL.createObjectURL(blob)` returns `blob:<origin>/<uuid>`, usable in `<a download>`, `<img src>` or `fetch`; it keeps the blob in memory until `URL.revokeObjectURL` (a `fetch` after revoking failed with `TypeError`) or the document unloads ✅[^1] ✅[^5].
9. **Base64.** A data URL from `FileReader.readAsDataURL` embeds the bytes (`"hi"` → `data:text/plain;base64,aGk=`); `btoa` accepts only Latin-1 characters (`btoa('é😀')` threw `InvalidCharacterError`), so encode text to bytes first; Chrome 152 also has `Uint8Array.prototype.toBase64()` ✅[^1] ✅[^5]. Images go to blobs with `canvas.toBlob(callback, 'image/png')` ✅[^1] ✅[^5].
10. **`File`** extends `Blob` with `name`, `lastModified` (and `webkitRelativePath`); `new File(parts, name, options)` builds one, `<input type=file>` exposes a `FileList` in `input.files` ✅[^1] ✅[^6].
11. **`FileReader`** reads asynchronously with `readAsArrayBuffer`, `readAsText(blob, encoding)`, `readAsDataURL`; events `loadstart → progress → load → loadend` (or `error`/`abort`), result in `reader.result`, `readyState` 2 when done; starting a second read while busy throws `InvalidStateError` ✅[^1] ✅[^6]. `FileReaderSync` exists only in workers ✅[^1] ✅[^6]. For new code the promise methods on `Blob` are simpler ✅[^5].

## Worked example
Reading a 4-byte big-endian length prefix and a UTF-8 message from received bytes:

| Step | Code | Result |
|---|---|---|
| 1 | `bytes = new Uint8Array([0, 0, 0, 3, 72, 105, 33])` | 7 bytes |
| 2 | `len = new DataView(bytes.buffer).getUint32(0)` | 3 (big-endian default) ✅[^7] |
| 3 | `new TextDecoder().decode(bytes.subarray(4, 4 + len))` | `"Hi!"` (a view decodes only its window ✅[^7]) |
| 4 | `new Uint32Array(bytes.buffer.slice(0, 4))[0]` instead | 50331648 on a little-endian machine — wrong byte order ✅[^7] |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `new Int16Array(new Uint8Array([0xff, 0xff]).buffer)[0]` | −1 | Same bits, signed view ✅[^1] |
| `Uint32Array` on a buffer whose length is not a multiple of 4 | `RangeError` | Views need whole elements ✅[^7] |
| Decoding chunk by chunk without `stream: true` | `�` at chunk borders | Multi-byte characters split ✅[^1] ✅[^4] |
| Blob slice without a type | `type` is `""` | Pass the type as the third argument ✅[^1] |
| Object URL never revoked | Blob kept alive | The URL table holds a reference ✅[^5] |

## Takeaways
- Parse network and file formats with `DataView` and an explicit endianness; use typed arrays for same-type bulk data. [rule-candidate]
- Decode streamed text with one `TextDecoder` and `{stream: true}`.
- Revoke every object URL once it is used. [rule-candidate]

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 47 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-10

## References
- `javascript/browser/browser-lab-setup.md` — the Chrome 152.0.7977.167 lab, 2026-11-10. [^1]
- [ArrayBuffer, binary arrays](https://javascript.info/arraybuffer-binary-arrays) — javascript.info, living. Backs: buffers, views, typed array types, wrapping, methods, `DataView`. [^2]
- [TextDecoder and TextEncoder](https://javascript.info/text-decoder) — javascript.info, living. Backs: decoding labels, views, `stream`, `encodeInto`. [^3]
- [TextDecoder](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder) — MDN, living. Backs: `fatal`, `stream`. [^4]
- [Blob](https://javascript.info/blob) — javascript.info, living. Backs: Blob parts and type, object URLs and revocation, base64, `toBlob`, reading as buffer or stream. [^5]
- [File and FileReader](https://javascript.info/file) — javascript.info, living. Backs: `File`, `input.files`, `FileReader` methods, events, `FileReaderSync`. [^6]
- `linux/lab-setup.md` — Node.js 24.22.1, 2026-11-10: the worked example (3, `"Hi!"`, 50331648) and `new Uint32Array(new ArrayBuffer(6))` throwing `RangeError`. [^7]
- [FileReader](https://developer.mozilla.org/en-US/docs/Web/API/FileReader) — MDN, living. Background: methods, events and `readyState`.
- [Encoding Standard](https://encoding.spec.whatwg.org/) — WHATWG, living. Background: UTF-8 and legacy encodings.

## Related
- `javascript/browser/network-requests-in-depth.md` — uploading Blobs, resumable upload with `file.slice`.
- `javascript/data-types/numbers-and-strings.md` — UTF-16 strings versus UTF-8 bytes.
