---
schema: knowledge-doc/v1
type: concept
topic: linux/system-management
status: verified
applies-to: ["Linux ≥ 5.8", "bpftrace ≥ 0.20", "libbpf"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, ebpf, bpf, bpftrace, verifier, jit, maps, tracepoints, kprobes, xdp, observability]
---

# eBPF: safe programs inside the kernel

## Summary
**TL;DR:** eBPF lets you load small programs into the running kernel and attach them to events — a system call, a tracepoint, a kernel function (kprobe), a network packet (XDP, tc), a cgroup hook or an LSM hook. Before loading, the **verifier** proves the program is safe (no invalid memory access, no unbounded loops, no unknown calls); a **JIT** compiles it to machine code; **maps** (hash, array, per-CPU, ring buffer…) hold state shared with user space. Tools like **bpftrace** and BCC make this a one-liner, and Cilium, Falco and many profilers are built on it.
**Use this when:** you need visibility that `/proc` and `strace` cannot give cheaply (latency histograms, who opens which files, which process sends packets), evaluate eBPF-based networking or security tools, or see "BPF" in kernel config, seccomp, or the LSM list.
**Not this doc:** the general tool catalog → `system-management/observability-tools.md`; seccomp's classic BPF filters → `containers/container-isolation.md`.

## Problem
`strace` stops the target at every system call and can slow it many times; adding logs means redeploying; kernel modules for custom tracing are risky. eBPF gives in-kernel, production-safe instrumentation — but only if you understand what the verifier allows and what privileges and kernel features it needs.

## Mental model
**Analogy:** event hooks on a factory line, with a strict safety inspector. You hand the inspector (verifier) a tiny instruction card ("each time a box passes station X, add 1 to the counter for its colour"). The inspector checks that the card cannot jam the line, loop forever or reach into the wrong bin, then a machinist (JIT) turns it into a fast tool. Counters (maps) hang on a board that the office (user space) can read at any time.

**Artifact:** counting `openat` system calls per command for 3 seconds (lab, Linux 6.17.8, bpftrace on Alpine 3.20, 2026-11-04) ✅[^4]:
```console
# bpftrace -e 'tracepoint:syscalls:sys_enter_openat { @opens[comm] = count(); } interval:s:3 { exit(); }'
@opens[bpftrace]: 1
@opens[bash]: 6
@opens[ls]: 21
@opens[cat]: 21
```
`tracepoint:syscalls:sys_enter_openat` = the event; `@opens[comm]` = a hash map keyed by command name; `count()` = the action; the map is printed when the script exits.

## How it works
**5 actors:**
- **Front end (bpftrace, BCC, a libbpf program, Cilium…)** — its job: compile source to eBPF bytecode and load it, via the `bpf(2)` system call ✅[^1].
- **Verifier** — its job: reject unsafe programs before they run, via a control-flow check and a simulation of every path tracking register and stack state ✅[^2].
- **JIT compiler** — its job: translate bytecode to native instructions; can be always-on since Linux 4.15 via `CONFIG_BPF_JIT_ALWAYS_ON` ✅[^1].
- **Hook (attach point)** — its job: run the program when the event happens, via program types: socket filter, kprobe, tracepoint, tc (`sched_cls`), XDP, perf_event, cgroup hooks and more ✅[^1].
- **Maps** — its job: hold state shared between programs and user space, via types such as hash, array, per-CPU variants, LRU, LPM trie, stack trace, perf event array ✅[^1].

```
bpftrace script ──compile──► eBPF bytecode ──bpf(BPF_PROG_LOAD)──► verifier ── reject → EACCES/EINVAL
                                                                       │ accept
                                                                       ▼
                                                                    JIT → native code
                                                                       │ attach
            event fires (syscall entry, packet, function call) ─────► program runs in kernel context
                                                                       │ update
                                                                       ▼
                                                          map (e.g. hash: comm → count) ◄── user space reads
```

1. **Load:** user space calls `bpf()` with the program and its type ✅[^1].
2. **Verify:** first a DAG check rejects loops and unreachable instructions, then every path is simulated; programs that read uninitialized registers, access the stack out of bounds, or dereference a map lookup without a NULL check are rejected ✅[^2].
3. **JIT and attach:** the program is compiled and attached to its event; some attachments (e.g. tc) persist after the loader exits ✅[^1].
4. **Run:** on each event the program runs in kernel context and calls allowed helper functions; the program type decides which helpers and context are available ✅[^1].
5. **Read results:** user space reads or polls maps ✅[^1].
6. **Privileges:** since Linux 4.4 unprivileged users may load limited socket filters unless `kernel.unprivileged_bpf_disabled` is set (the lab VM: `2`); tracing needs privilege ✅[^1] ✅[^4].

## Worked example
Who executes what on a busy host, live (lab, 2026-11-04) ✅[^4]:
```console
# bpftrace -e 'tracepoint:sched:sched_process_exec { printf("%-6d %s\n", pid, str(args->filename)); }'
4959   /bin/ls
4960   /bin/uname
```
Compared with alternatives for the same question:

| Tool | Overhead | Coverage |
|---|---|---|
| `strace -f -e execve` on one process tree | High: lab `strace` run was ≈ 37× slower on a syscall loop ✅[^4] | Only traced tree |
| Polling `ps` | Misses short-lived processes | Snapshot only |
| eBPF tracepoint | A verified, JIT-compiled program runs per event in the kernel ✅[^1] | Every process on the host |

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Unsafe or too-complex program | Load fails with a verifier log | Verifier rejects ✅[^1] ✅[^2] |
| "Could not find kernel headers" warning | Fine for tracepoints; kprobe scripts needing struct layouts may fail | BTF or headers needed for type info ✅[^4] (lab: both tracepoint scripts ran despite the warning) |
| Running inside a default Docker container | `bpf` is blocked | Default seccomp profile blocks `bpf` and `perf_event_open` ✅[^3] |
| Kernel function renamed in a new release | kprobe attach fails | kprobes target internal functions; tracepoints are a stabler interface — kprobes can attach to almost any kernel code address, i.e. internal functions ✅[^5] |
| XDP program drops packets before the stack | Fast filtering/DDoS defence | XDP runs at the driver ✅[^1] ✅[^6] |

## Trade-offs
| Option | Gains | Costs |
|---|---|---|
| Tracepoints | Stable, documented events | Only where tracepoints exist |
| kprobes / fentry | Any kernel function | Breaks across kernel versions |
| bpftrace one-liners | Fast answers | Not for long-running products |
| libbpf + CO-RE programs | Portable production tools | More engineering |

## Takeaways
- Reach for eBPF (bpftrace/BCC) instead of `strace` when the target is in production or the question spans the whole host.
- Prefer tracepoints over kprobes for scripts you will keep.
- Running eBPF tools needs host privilege; plan for a privileged agent (DaemonSet) rather than enabling `bpf` in application containers.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 23 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [bpf(2)](https://man7.org/linux/man-pages/man2/bpf.2.html) — Linux man-pages project, living. Backs: programs and attachment, verifier rejection, JIT, map types, program types, unprivileged use and `unprivileged_bpf_disabled`, persistence. [^1]
- [eBPF verifier](https://docs.kernel.org/bpf/verifier.html) — Linux kernel documentation, living. Backs: two-step verification and examples of rejected programs. [^2]
- [Seccomp security profiles for Docker](https://docs.docker.com/engine/security/seccomp/) — Docker, living. Backs: `bpf` and `perf_event_open` blocked by default. [^3]
- `linux/lab-setup.md` — the lab where both bpftrace runs, the headers warning and `unprivileged_bpf_disabled` were captured on 2026-11-04. [^4]
- [BPF Documentation](https://docs.kernel.org/bpf/index.html) — Linux kernel documentation, living. Backs: further reading (maps, program types, BTF, libbpf).
- [bpftrace](https://github.com/bpftrace/bpftrace) — bpftrace project, living. Backs: further reading on the language.
- [Kernel Probes (Kprobes)](https://docs.kernel.org/trace/kprobes.html) — Linux kernel documentation, living. Backs: kprobes can break into almost any kernel code address. [^5]
- [AF_XDP](https://docs.kernel.org/networking/af_xdp.html) — Linux kernel documentation, living. Backs: XDP programs act on ingress frames before the stack and can redirect them. [^6]

## Related
- `linux/system-management/observability-tools.md` — where eBPF fits among other tools.
- `linux/security/lsm-and-landlock.md` — the BPF LSM.
- `linux/networking/packet-path.md` — where XDP and tc hooks sit.
