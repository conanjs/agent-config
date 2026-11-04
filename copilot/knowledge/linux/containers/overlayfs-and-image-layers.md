---
schema: knowledge-doc/v1
type: concept
topic: linux/containers
status: verified
applies-to: ["Linux ≥ 5.x overlayfs", "Docker overlay2 / containerd overlayfs snapshotter"]
derived-from: [linux/containers/container-from-primitives-deep-dive.md]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, overlayfs, image-layers, copy-up, whiteout, union-filesystem, docker, containerd]
---

# OverlayFS and container image layers

## Summary
**TL;DR:** A container image is a stack of read-only layers; overlayfs merges them (`lowerdir`, leftmost = top) with one writable layer per container (`upperdir`) into a single view (the merged mount). Reads fall through to the highest layer that has the file. The first write to a lower file **copies the whole file up** into the upper layer. Deleting a lower file creates a **whiteout** (a 0/0 character device) in the upper layer; the bytes stay in the image layer. That is why deleting files in a later Dockerfile step never shrinks the image.
**Use this when:** an image is bigger than expected, the first write to a big file is slow, you need to find a container's writable layer on disk, or a filesystem error mentions `upperdir`/`workdir`.
**Not this doc:** the full container build → `containers/container-from-primitives-deep-dive.md`; VFS basics → `storage/vfs-and-file-descriptors.md`.

## Problem
Teams `RUN rm -rf /build-cache` and wonder why the image is still 2 GB; databases inside containers are slow on first start; disk usage under `/var/lib/docker` does not match what `du` shows inside containers. All three follow from overlayfs's copy-up and whiteout rules.

## Mental model
**Analogy:** transparent sheets on an overhead projector. The bottom sheets (image layers) are printed and cannot be changed. The container gets a fresh top sheet. To "change" a word, you write the new word on the top sheet over it (copy-up). To "erase" a word, you put a white sticker over it on the top sheet (whiteout); the word is still printed underneath.

**Artifact:** the root mount of a running Docker container (lab, 2026-11-04) ✅[^3]:
```
overlay on / type overlay (rw,relatime,
  lowerdir=/var/lib/docker/overlay2/l/4CHK3T…:/var/lib/docker/overlay2/l/LHTMJK…:/var/lib/docker/overlay2/l/3G744X…,
  upperdir=/var/lib/docker/overlay2/f49ffc…/diff,
  workdir=/var/lib/docker/overlay2/f49ffc…/work)
```
Three image layers in `lowerdir`, the container's own changes in `upperdir` (`…/diff`), and overlayfs's scratch space in `workdir`.

## How it works
**4 actors:**
- **Lower layers** — its job: provide the read-only image content, via one or more directories; any filesystem, even another overlay ✅[^1].
- **Upper layer** — its job: receive every change, via a directory on a filesystem with `trusted.*`/`user.*` xattrs and `d_type` support (NFS is unsuitable) ✅[^1].
- **Work directory** — its job: give overlayfs scratch space for atomic operations, via a directory on the same filesystem as the upper layer ✅[^1].
- **overlayfs** — its job: present the merged view and apply copy-up and whiteout rules, via the VFS ✅[^1].

```
 merged view (container's /)      a.txt (from upper)   c.txt (from upper)   [b.txt hidden]
          ▲                              ▲                    ▲                  ▲
 upper  ──┼───────────────────── a.txt "changed"        c.txt "new"        b.txt = char dev 0/0 (whiteout)
          │                              │ copy-up on first write
 lower  ──┴───────────────────── a.txt "base"                              b.txt "keep"
```

1. **Lookup:** a name is searched from the upper layer down through the lower layers; the first match wins ✅[^1]: when a name exists in both, the upper object is visible and lower directories are merged.
2. **Layer order:** `lowerdir=/l1:/l2:/l3` stacks right to left — `/l1` is the top lower layer, `/l3` the bottom ✅[^1].
3. **Copy-up:** when a lower file is opened for writing or its metadata changes, it is copied into the upper layer — including all its data — and modified there ✅[^1]. With the `metacopy` feature only metadata is copied up first ✅[^1].
4. **Whiteout:** deleting a lower name creates a character device with device number 0/0 (or a zero-size file with the xattr `trusted.overlay.whiteout`) in the upper layer ✅[^1].
5. **Opaque directory:** replacing a lower directory marks the upper one with `trusted.overlay.opaque="y"`, hiding the whole lower directory ✅[^1].
6. **Read-only overlay:** leaving out `upperdir` and `workdir` produces a read-only merge ✅[^1].

## Worked example
Hand-made overlay in the lab (Linux 6.17.8, 2026-11-04) ✅[^3]:
```console
# mount -t tmpfs tmp /o; mkdir -p /o/lower /o/upper /o/work /o/merged
# echo base > /o/lower/a.txt; echo keep > /o/lower/b.txt
# mount -t overlay overlay -o lowerdir=/o/lower,upperdir=/o/upper,workdir=/o/work /o/merged
# echo changed > /o/merged/a.txt; rm /o/merged/b.txt; echo new > /o/merged/c.txt
# ls /o/merged
a.txt  c.txt
# cat /o/lower/a.txt
base                                   # the lower layer never changes
# ls -l /o/upper
-rw-r--r-- 1 root root    8 Nov  4 04:42 a.txt     # copied up, then modified
c--------- 2 root root 0, 0 Nov  4 04:42 b.txt     # whiteout: character device 0,0
-rw-r--r-- 1 root root    4 Nov  4 04:42 c.txt     # new file, only in upper
```
The first attempt with `/o` on the container's own overlay root failed: "filesystem on /o/upper not supported as upperdir", which is why the example mounts a `tmpfs` first ✅[^3].

Applied to a Dockerfile:

| Step | Layer gets | Image size impact |
|---|---|---|
| `RUN download 500 MB toolchain` | 500 MB of files | +500 MB |
| `RUN rm -rf /toolchain` | Whiteouts only | +≈0, the 500 MB remain in the earlier layer |
| Same work in **one** `RUN … && rm …`, or a multi-stage build | Never stored | +0 |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Container appends 1 byte to a 5 GB lower file | 5 GB copied to the upper layer first | Copy-up copies the whole file ✅[^1] |
| `upperdir` on NFS or a filesystem without xattrs | Mount fails | Upper requirements ✅[^1] |
| `workdir` on a different filesystem from `upperdir` | Mount fails | Must be the same filesystem ✅[^1] (lab: `mount: … wrong fs type, bad option …`) ✅[^3] |
| Deleting image files inside the running container | Container disk usage does not drop | Whiteouts hide, lower layers keep the bytes ✅[^1] |
| Heavy write workloads (databases) on the container root | Slower, copy-up, upper layer grows | Copy-up and upper-layer growth ✅[^1]; use a volume instead |
| Hard link to a lower file, then write | Copy-up can break the hard link; the `index=on` feature exists to preserve such links ✅[^1] | overlayfs copy-up semantics |

## Takeaways
- Remove temporary files in the **same** `RUN` that created them, or use multi-stage builds. [rule-candidate]
- Put databases, caches and anything write-heavy on volumes, not the container's root filesystem. [rule-candidate]
- Find a container's changes on disk in its `upperdir` (`docker inspect` → `GraphDriver.Data.UpperDir`) ✅[^3] (lab: `docker inspect -f '{{.GraphDriver.Name}} {{index .GraphDriver.Data "UpperDir"}}'` → `overlay2 /var/lib/docker/overlay2/…`).

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 22 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Overlay Filesystem](https://docs.kernel.org/filesystems/overlayfs.html) — Linux kernel documentation, living. Backs: layer roles, upper requirements, NFS unsuitable, workdir same filesystem, multiple lower order, copy-up, metacopy, whiteouts, opaque directories, read-only overlay. [^1]
- [OCI Image Format: Image Layer Filesystem Changeset](https://github.com/opencontainers/image-spec/blob/main/layer.md) — Open Container Initiative, living. Backs: further reading, how layers and whiteouts are stored in image tarballs.
- `linux/lab-setup.md` — the lab where the Docker root mount, the manual overlay and the upperdir error were captured on 2026-11-04. [^3]
- `linux/containers/container-from-primitives-deep-dive.md` — the deep dive this doc was distilled from.

## Related
- `linux/containers/container-from-primitives-deep-dive.md` — overlay as step 1 of building a container.
- `linux/storage/vfs-and-file-descriptors.md` — the VFS layer overlay plugs into.
- `linux/storage/block-io-and-durability.md` — durability depends on the upper filesystem.
