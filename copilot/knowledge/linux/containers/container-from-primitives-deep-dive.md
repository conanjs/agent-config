---
schema: deep-dive/v1
topic: linux/containers
status: verified
applies-to: ["Linux ≥ 5.x with cgroup v2", "OCI runtime spec 1.x (runc, crun)", "Docker / containerd / Kubernetes on Linux"]
last-updated: 2026-11-04
last-verified: 2026-11-04
synthesized-into:
  - { path: linux/containers/namespaces.md, on: 2026-11-04 }
  - { path: linux/containers/cgroups-v2.md, on: 2026-11-04 }
  - { path: linux/containers/overlayfs-and-image-layers.md, on: 2026-11-04 }
  - { path: linux/containers/container-networking.md, on: 2026-11-04 }
  - { path: linux/containers/container-isolation.md, on: 2026-11-04 }
tags: [linux, containers, namespaces, cgroups, overlayfs, pivot-root, veth, capabilities, seccomp, oci, runc]
---

# A container from kernel primitives, end to end

## Summary
**TL;DR:** There is no "container" object in the Linux kernel. A container is an ordinary process that a runtime (runc, crun) starts with five independent kernel features switched on: **namespaces** (what it can see), a **cgroup** (how much it can use), a **root filesystem** built from image layers with **overlayfs** and entered with `pivot_root`, a **network** namespace wired to the host with a **veth** pair, a bridge and NAT, and **privilege reduction** (dropped capabilities, seccomp, no_new_privs). This dive builds one by hand in a lab, step by step, with real output, then maps each step to what Docker/containerd/runc do.
**Use this when:** you want the complete picture of how containers work before reading the per-mechanism docs, need to explain "a container is just a process" with evidence, or debug something that sits between two mechanisms (for example a container that can reach the network but cannot `ping`).
**Depth:** every actor from the CLI down to the kernel; the five mechanisms built by hand on Linux 6.17.8 with captured output; how each mechanism changes what the others see (cross-mechanism matrix); the OCI create/start lifecycle; a failure and edge-case matrix; verified (✅) vs unverified (⚠️) marks throughout.

## 1. The actors

**6 actors:**
- **CLI (`docker`, `nerdctl`, `kubectl` → kubelet)** — its job: accept the user's request, via an API call to the daemon.
- **High-level runtime (dockerd + containerd, or CRI-O)** — its job: pull and unpack image layers, prepare the snapshot (overlay mount) and the OCI bundle, via its image store under `/var/lib/…`.
- **OCI bundle** — its job: describe the container, via a `config.json` plus a root filesystem directory ✅[^7].
- **Low-level runtime (runc, crun)** — its job: turn `config.json` into kernel state, via `clone`/`unshare`, cgroup files, `mount`, `pivot_root`, capability and seccomp system calls, then `execve` of the user's program ✅[^7].
- **Linux kernel** — its job: enforce all of it, via namespaces, cgroups, overlayfs, netfilter, capabilities and seccomp.
- **Container process (PID 1 of the container)** — its job: run the application, via ordinary system calls to the same host kernel.

```
 docker run ──API──► dockerd ──gRPC──► containerd ──(shim)──► runc create  ──► kernel state
                       │                  │                     │                 namespaces
                       │                  ├ pull + unpack layers │                 cgroup
                       │                  ├ overlay snapshot     │                 rootfs (overlay + pivot_root)
                       │                  └ write config.json ───┘                 veth/bridge/NAT (CNI or libnetwork)
                       │                                         └► runc start ──► execve(user program) as PID 1
```

The OCI runtime spec splits the last part in two: **create** builds the whole environment from `config.json` except the user's process, which "MUST NOT be run at this time"; **start** runs it. States go `creating → created → running → stopped`, and hooks run in between (`createRuntime`, `createContainer` during create; `startContainer` before the program; `poststart`; `poststop`) ✅[^7].

## 2. Lab setup

All output below was captured on 2026-11-04 in a privileged Alpine 3.20 container on OrbStack (Linux 6.17.8, arm64), which acts as the "host" for the hand-built container. The image and helper commands are in `linux/lab-setup.md`. A privileged container is used only because it is an easy way to get a scratch Linux kernel with root; on a real Linux machine the same commands run as root directly.

## 3. Step by step

### Step 1 — Root filesystem: an image layer plus overlayfs

An image is a stack of read-only directory trees (layers). The runtime stacks them with overlayfs and adds an empty writable layer on top.

```console
# mkdir -p /c/lower /c/upper /c/work /c/rootfs
# tar -xf alpine-rootfs.tar -C /c/lower                         # the image layer (read-only by convention)
# mount -t overlay overlay \
    -o lowerdir=/c/lower,upperdir=/c/upper,workdir=/c/work /c/rootfs
step1 overlay ok
```

- `lowerdir` = image layers (several, separated by `:`; the leftmost is the top) ✅[^3].
- `upperdir` = the container's writable layer; `workdir` = scratch space on the same filesystem as `upperdir` ✅[^3].
- After the container ran (step 6), the upper layer held exactly what the container changed:
  ```console
  # ls /c/upper
  dev  etc  inside.sh  usr  written-by-container
  ```
  `etc` (resolv.conf copied in), `usr` (a helper binary copied in), `written-by-container` (created inside). The image layer in `/c/lower` was untouched.

An earlier attempt with `upperdir` on an existing overlay mount failed with "filesystem on /o/upper not supported as upperdir"; the upper filesystem needs extended-attribute and `d_type` support, so the lab puts everything on a `tmpfs` ✅[^3] ✅[^8].

### Step 2 — Resource limits: a cgroup

```console
# echo "+memory +cpu +pids" > /sys/fs/cgroup/cgroup.subtree_control
# mkdir /sys/fs/cgroup/box
# echo 64M > /sys/fs/cgroup/box/memory.max
# echo "50000 100000" > /sys/fs/cgroup/box/cpu.max          # 50 ms CPU per 100 ms = half a CPU
# echo 32 > /sys/fs/cgroup/box/pids.max
step2 cgroup: 67108864 / 50000 100000 / 32
```

Before this worked, the controllers could not be enabled: writing `+memory` to the root of the lab container's cgroup namespace failed with `write error: Resource busy`, because that cgroup still held processes. cgroup v2 only lets a (non-root) cgroup enable controllers for its children if it has no processes of its own ("no internal process" rule) ✅[^2]; the lab moved every process into a child `init` cgroup first ✅[^8]. Container runtimes never hit this because each container gets its own leaf cgroup.

After the run: `memory.peak=1773568` (≈ 1.7 MiB) and `pids.peak=5` ✅[^8].

### Step 3 — Network: namespace, veth pair, bridge, NAT

```console
# ip netns add box
# ip link add br0 type bridge; ip addr add 172.30.0.1/24 dev br0; ip link set br0 up
# ip link add vh type veth peer name eth0 netns box              # one end stays, one goes into "box"
# ip link set vh master br0 up
# ip -n box addr add 172.30.0.2/24 dev eth0; ip -n box link set eth0 up; ip -n box link set lo up
# ip -n box route add default via 172.30.0.1
# echo 1 > /proc/sys/net/ipv4/ip_forward
# iptables -t nat -A POSTROUTING -s 172.30.0.0/24 ! -o br0 -j MASQUERADE
step3 net ok
```

- A veth pair is a virtual cable: a packet sent into one end comes out of the other ✅[^4].
- The bridge is the host-side switch; its IP is the container's gateway.
- `ip_forward` is 0 by default and must be 1 for the host to route container traffic ✅[^9].
- MASQUERADE rewrites the container's source address on the way out (postrouting) ✅[^10].

### Step 4 — Namespaces, pivot_root, /proc

```console
# echo $$ > /sys/fs/cgroup/box/cgroup.procs                   # join the cgroup first; children inherit it
# ip netns exec box unshare --pid --mount --uts --ipc --cgroup --fork sh -c '
    hostname box
    mount --make-rprivate /                                    # mount changes must not leak to the host
    cd /c/rootfs && mkdir -p .oldroot && pivot_root . .oldroot && cd /
    mount -t proc proc /proc                                   # a /proc that shows only this PID namespace
    umount -l /.oldroot && rmdir /.oldroot                     # hide the host filesystem completely
    exec /usr/local/bin/setpriv --bounding-set=-all,+chown,+setuid,+setgid,+net_bind_service,+kill \
         --inh-caps=-all /bin/sh /inside.sh'
```

- `ip netns exec box` → network namespace; `unshare` → PID, mount, UTS, IPC and cgroup namespaces ✅[^1].
- `--fork` is needed for the PID namespace: the **first child** created after `unshare(CLONE_NEWPID)` becomes PID 1 of the new namespace ✅[^8] (lab: without `--fork` the caller kept PID 11 and its first child was PID 1); the PID namespace of the caller never changes ✅[^1].
- `pivot_root` swaps the root to the overlay; lazily unmounting the old root removes every path back to the host's files. This is the same sequence the kernel documents for switching root at boot ✅[^11].
- A process in a new PID namespace should mount a fresh `/proc`, or tools like `ps` show the wrong processes ✅[^5].

### Step 5 — Privilege reduction

`setpriv` drops every capability from the bounding set except five, then `exec`s the shell. Seccomp was not applied in this hand-built run (`Seccomp: 0`); Docker applies a default filter (`Seccomp: 2`, see §5).

### Step 6 — What the process sees

```console
--- inside container ---
box                                    # UTS namespace: own hostname
uid=0(root) gid=0(root) …              # still UID 0 (no user namespace in this run)
PID   PPID  COMMAND
    1     0 sh                         # PID namespace: the shell is PID 1
   11     1 ps
pid:[4026532900]                       # namespace identities (host had pid:[4026532635])
mnt:[4026532897]                       #                       (host had mnt:[4026532632])
net:[4026532766]                       #                       (host had net:[4026532637])
uts:[4026532898]                       #                       (host had uts:[4026532633])
0::/                                   # cgroup namespace: its own cgroup looks like the root
(no cgroupfs mounted inside)
    inet 172.30.0.2/24 scope global eth0
default via 172.30.0.1 dev eth0
ping: permission denied (are you root?)   # CAP_NET_RAW dropped
Name:	example.com                         # but UDP DNS through the NAT works
Address: 104.20.23.154
CapEff:	00000000000004e1               # = chown(0) kill(5) setgid(6) setuid(7) net_bind_service(10)
Seccomp:	0
bin dev etc home inside.sh lib media mnt opt proc root run sbin srv sys tmp usr var
```

Two processes are in the same namespace exactly when their `/proc/<pid>/ns/<type>` links show the same inode ✅[^1]; every inode above differs from the host's, which proves the isolation. `0x4e1` = 1 + 32 + 64 + 128 + 1024 = bits 0, 5, 6, 7, 10 ✅[^6] ✅[^8].

## 4. Mapping the hand-built steps to Docker / runc

| Step | By hand | What the real stack does |
|---|---|---|
| Image | `tar -x` into `lower` | containerd unpacks each layer into its snapshotter; the overlay `lowerdir` lists all layers ✅[^8] (the lab's Docker root mount shows three `lowerdir` entries) |
| Writable layer | `upperdir=/c/upper` | One upper dir per container under `/var/lib/docker/overlay2/<id>/diff` ✅[^8] |
| cgroup | `mkdir` + `memory.max`, `cpu.max`, `pids.max` | runc writes the same files from `config.json` `linux.resources` ✅[^15] |
| Namespaces | `unshare` + `ip netns` | runc `clone`s with the `CLONE_NEW*` flags listed in `config.json` `linux.namespaces` ✅[^15] |
| Root switch | `pivot_root` | runc uses `pivot_root` unless run with `--no-pivot` ✅[^16] |
| Network | veth + bridge + MASQUERADE by hand | Docker's bridge driver: `docker0` bridge, a veth per container, NAT rules; Kubernetes: a CNI plugin ✅[^8] (lab: two containers on one bridge network; nginx logged the client container's own IP, so no NAT between them); Kubernetes uses CNI plugins ✅[^17] |
| Capabilities | `setpriv --bounding-set` | Docker's default keeps 14 capabilities (`0xa80425fb` measured) ✅[^8] |
| Seccomp | none | Docker's default profile blocks about 44 system calls with `EPERM` ✅[^12] |
| PID 1 | `exec sh` | The image's `ENTRYPOINT`/`CMD`, started by runc `start` ✅[^7] |

## 5. A default Docker container vs a privileged one (measured)

```console
$ docker run --rm linlab:1 sh -c 'grep -E "CapEff|Seccomp" /proc/self/status; unshare --pid --fork true; ip link add x type dummy; mount -t tmpfs t /mnt'
CapEff:	00000000a80425fb
Seccomp:	2
Seccomp_filters:	1
unshare: unshare failed: Operation not permitted
RTNETLINK answers: Operation not permitted
mount: /mnt: permission denied.
```
With `--privileged` the same container showed `CapEff: 000001ffffffffff` and `Seccomp: 0`, and all three commands succeed ✅[^8]. The three failures map to three mechanisms: `unshare` (needs `CAP_SYS_ADMIN` and is blocked by the seccomp profile), `ip link add` (needs `CAP_NET_ADMIN`), `mount` (needs `CAP_SYS_ADMIN`) ✅[^6] ✅[^12].

## 6. How the mechanisms affect each other

| Change on … | Effect on namespaces | Effect on cgroups | Effect on filesystem | Effect on network | Effect on privilege |
|---|---|---|---|---|---|
| **New PID namespace** | Container PID 1 gets init duties (reaping, signal rules) ✅[^5] | None; cgroup membership is inherited, independent of PID namespace ✅[^8] (lab: the hand-built container joined the cgroup before `unshare` and stayed in it) | `/proc` must be remounted to match ✅[^5] | None | Processes outside are invisible, so cannot be signalled from inside ✅[^5] |
| **New mount namespace + pivot_root** | — | cgroupfs not visible unless mounted inside (lab: "no cgroupfs mounted inside") ✅[^8] | Host files unreachable after old root is unmounted ✅[^11] | `/etc/resolv.conf` must be provided in the rootfs ✅[^8] | — |
| **cgroup limits** | — | `memory.max` → OOM kill inside the cgroup; `pids.max` → `fork` fails with `EAGAIN` ✅[^2] | Page cache of files written counts toward the memory limit ✅[^2] | Not covered here (socket buffer accounting not verified) | — |
| **New network namespace** | Only `lo` exists, and it is down ✅[^8] | — | — | Needs a veth/bridge/NAT or it is offline ✅[^8] | Creating interfaces needs `CAP_NET_ADMIN` ✅[^6] |
| **New user namespace** | Root inside maps to an unprivileged UID outside ✅[^13] | — | UIDs in image layers are seen through the mapping; files owned by unmapped IDs show as `nobody` ✅[^13] | — | Full capabilities inside, none on the host's resources ✅[^13] |
| **Dropped capabilities** | Cannot create more namespaces without `CAP_SYS_ADMIN` ✅[^6] | — (not tested) | `mount` refused ✅[^8] | Raw sockets (`ping`) refused without `CAP_NET_RAW` ✅[^8] | — |
| **Seccomp filter** | `unshare`, `setns`, `mount` blocked even with the capability ✅[^12] | — | — | Some socket families blocked ✅[^12] | Filters persist across `execve` and children ✅[^14] |

## 7. Failure and edge-case matrix

| Symptom | Mechanism | Cause | Check |
|---|---|---|---|
| Container exits with 137 | cgroup memory | `memory.max` reached | `memory.events` `oom_kill` ✅[^2] |
| "can't fork: Resource temporarily unavailable" | cgroup pids | `pids.max` reached (lab: limit 3, fourth fork failed, `pids.events max 1`) | `pids.events` ✅[^8] |
| Service slow, CPU low on the host | cgroup cpu | `cpu.max` throttling (lab: 20% quota, 20 of 21 periods throttled) | `cpu.stat` `nr_throttled` ✅[^8] |
| `ps` shows host processes | mount/PID | `/proc` not remounted | `readlink /proc/self/ns/pid` ✅[^5] |
| No network at all | network | Missing veth, route or `ip_forward` | `ip addr`, `ip route` inside; `sysctl net.ipv4.ip_forward` ✅[^9] |
| Reach IPs but not names | filesystem | No `/etc/resolv.conf` in rootfs | `cat /etc/resolv.conf` ✅[^8] |
| `ping` fails, TCP/UDP work | capabilities | `CAP_NET_RAW` dropped | `CapEff` ✅[^8] |
| `docker stop` takes 10 s | PID namespace | PID 1 has no `SIGTERM` handler | see `processes/signals.md` ✅[^5] |
| Disk fills although files were deleted inside | overlayfs | Deleting a lower-layer file only adds a whiteout; the layer keeps its bytes | `ls -l` the upper dir: a `c 0,0` device ✅[^3] ✅[^8] |
| Big files slow on first write | overlayfs | Copy-up copies the whole file into the upper layer | ✅[^3] |

## 8. What to read next

The five mechanisms each have their own focused doc, distilled from this dive:
- `linux/containers/namespaces.md`
- `linux/containers/cgroups-v2.md`
- `linux/containers/overlayfs-and-image-layers.md`
- `linux/containers/container-networking.md`
- `linux/containers/container-isolation.md`

## References
- [namespaces(7)](https://man7.org/linux/man-pages/man7/namespaces.7.html) — Linux man-pages project, living. Backs: namespace types, `clone`/`unshare`/`setns`, `/proc/<pid>/ns` identity. [^1]
- [Control Group v2](https://docs.kernel.org/admin-guide/cgroup-v2.html) — Linux kernel documentation, living. Backs: no internal process rule, `memory.max` OOM, `pids.max` `EAGAIN`, `memory.events`. [^2]
- [Overlay Filesystem](https://docs.kernel.org/filesystems/overlayfs.html) — Linux kernel documentation, living. Backs: lower/upper/work roles, multiple lower layers, whiteouts, copy-up, upper filesystem requirements. [^3]
- [veth(4)](https://man7.org/linux/man-pages/man4/veth.4.html) — Linux man-pages project, living. Backs: veth pairs. [^4]
- [pid_namespaces(7)](https://man7.org/linux/man-pages/man7/pid_namespaces.7.html) — Linux man-pages project, living. Backs: namespace init duties and signals, remounting `/proc`, visibility. [^5]
- [capabilities(7)](https://man7.org/linux/man-pages/man7/capabilities.7.html) — Linux man-pages project, living. Backs: capability numbers and what `CAP_SYS_ADMIN`, `CAP_NET_ADMIN`, `CAP_NET_RAW` allow. [^6]
- [OCI Runtime Specification: runtime](https://github.com/opencontainers/runtime-spec/blob/main/runtime.md) — Open Container Initiative, living. Backs: bundle, create vs start, states, hooks. [^7]
- `linux/lab-setup.md` — the lab (OrbStack, Linux 6.17.8, arm64, Alpine 3.20) where every console block in this dive was captured on 2026-11-04. [^8]
- [IP Sysctl](https://docs.kernel.org/networking/ip-sysctl.html) — Linux kernel documentation, living. Backs: `ip_forward` default 0. [^9]
- [Netfilter hooks](https://wiki.nftables.org/wiki-nftables/index.php/Netfilter_hooks) — nftables project wiki, living. Backs: srcnat in postrouting. [^10]
- [Ramfs, rootfs and initramfs](https://docs.kernel.org/filesystems/ramfs-rootfs-initramfs.html) — Linux kernel documentation, living. Backs: `pivot_root(".", ".")` + lazy unmount as the root-switch sequence. [^11]
- [Seccomp security profiles for Docker](https://docs.docker.com/engine/security/seccomp/) — Docker, living. Backs: default profile blocks ~44 calls with `EPERM`, including `unshare`, `mount`, `clone` with namespace flags. [^12]
- [user_namespaces(7)](https://man7.org/linux/man-pages/man7/user_namespaces.7.html) — Linux man-pages project, living. Backs: UID mapping, capabilities only inside. [^13]
- [seccomp(2)](https://man7.org/linux/man-pages/man2/seccomp.2.html) — Linux man-pages project, living. Backs: filters inherited by children and kept across `execve`. [^14]
- [OCI Runtime Specification: config.md](https://github.com/opencontainers/runtime-spec/blob/main/config.md) — Open Container Initiative, living. Backs: `process.capabilities`, `process.noNewPrivileges`, `linux.seccomp`, `linux.namespaces`, `linux.resources` fields. [^15]
- [runc-run(8)](https://github.com/opencontainers/runc/blob/main/man/runc-run.8.md) — runc project, living. Backs: runc uses pivot_root unless `--no-pivot` is given. [^16]
- [Services, Load Balancing, and Networking](https://kubernetes.io/docs/concepts/services-networking/) — Kubernetes project, living. Backs: one network namespace per pod shared by its containers; pod network implemented by CNI plugins. [^17]

## Related
- `linux/processes/process-lifecycle.md` — the process a container really is.
- `kubernetes/container-cpu-memory-limits-deep-dive.md` — the same cgroup limits from the Kubernetes side.
- `linux/networking/netfilter-and-nat.md` — the NAT rules used in step 3.
