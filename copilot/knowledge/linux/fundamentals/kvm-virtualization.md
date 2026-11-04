---
schema: knowledge-doc/v1
type: concept
topic: linux/fundamentals
status: verified
applies-to: ["Linux ≥ 5.x with KVM", "x86-64 (VT-x/AMD-V) and arm64 (virtualization extensions)"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, kvm, virtualization, hypervisor, qemu, vcpu, virtio, vm-vs-container]
---

# KVM virtualization and how VMs differ from containers

## Summary
**TL;DR:** KVM turns the Linux kernel into a hypervisor. A user-space program (QEMU, Firecracker, cloud-hypervisor) opens `/dev/kvm`, creates a VM and its virtual CPUs with `ioctl` calls, and loops on `KVM_RUN`: the vCPU runs guest code directly on the real CPU using hardware virtualization until something needs emulation, then exits back to the program. Each VM runs **its own kernel**, which is the key difference from a container (a process sharing the host kernel). Devices are usually **virtio**: paravirtual devices designed for VMs.
**Use this when:** you compare VMs with containers for isolation, wonder what OrbStack / Docker Desktop / Kata / Firecracker do, see `/dev/kvm` requirements, or read cloud "vCPU" and "nested virtualization" terms.
**Not this doc:** containers in depth → `containers/container-from-primitives-deep-dive.md`.

## Problem
"Containers or VMs?" is often argued without the mechanism. VMs give a separate kernel per workload (strong isolation, more overhead); containers share the host kernel (light, but a kernel bug is shared). Tools such as Docker Desktop, OrbStack and Kata mix both, which confuses where code really runs.

## Mental model
**Analogy:** containers are flats in one building with shared foundations and plumbing (one kernel). VMs are separate houses on the same land: each has its own foundations (kernel), the land owner (KVM + the host kernel) only provides land, roads and utilities (CPU time, memory, virtual devices).

**Artifact:** the three levels of file descriptors a VM monitor uses, from the KVM API ✅[^1]:
```text
kvm  = open("/dev/kvm")                   # system ioctls: version, capabilities, KVM_CREATE_VM
vm   = ioctl(kvm, KVM_CREATE_VM, 0)       # VM ioctls: memory regions, KVM_CREATE_VCPU, devices
vcpu = ioctl(vm,  KVM_CREATE_VCPU, 0)     # vCPU ioctls: registers, KVM_RUN
run  = mmap(vcpu, …)                      # struct kvm_run: shared block describing why the vCPU exited
loop: ioctl(vcpu, KVM_RUN) → handle exit (I/O, MMIO, halt…) → repeat
```

## How it works
**4 actors:**
- **VM monitor in user space (QEMU, Firecracker, cloud-hypervisor)** — its job: set up guest memory and devices and run the vCPU loop, via ioctls on KVM file descriptors ✅[^1].
- **KVM (kernel module / built-in)** — its job: enter and leave guest mode on the real CPU, via the KVM API (`KVM_RUN` executes the guest vCPU) ✅[^1].
- **Guest kernel** — its job: run the guest OS, via its own scheduler, memory manager and drivers (virtio).
- **Host kernel** — its job: schedule each vCPU as an ordinary thread and back guest memory with ordinary pages — each vCPU is driven by the monitor calling `KVM_RUN` on its vCPU descriptor ✅[^1].

1. **System level:** `/dev/kvm` accepts system ioctls (global settings, create a VM) ✅[^1].
2. **VM level:** the VM descriptor configures the whole VM and creates vCPUs and devices ✅[^1].
3. **vCPU level:** `KVM_RUN` executes the guest on that vCPU; the shared `struct kvm_run` block (mapped from the vCPU descriptor) tells the monitor why the guest exited ✅[^1].
4. **Exits:** when the guest touches emulated hardware, the vCPU exits to the monitor, which emulates the device and calls `KVM_RUN` again; the exit reason is reported in `struct kvm_run` ✅[^1].
5. **Steal time:** a guest reports time its vCPUs wanted to run but the host ran something else as `steal` in `/proc/stat` ✅[^4].

**VM vs container:**

| Aspect | Container | KVM virtual machine |
|---|---|---|
| Kernel | Host kernel, shared | Own guest kernel |
| Isolation boundary | Namespaces, cgroups, capabilities, seccomp | Hardware virtualization + small device model |
| Start time | Process start | Kernel boot; micro-VMs such as Firecracker are designed for fast startup ✅[^5] |
| Memory overhead | Process memory | Guest kernel + page cache per VM |
| Visible in host `ps` | Yes, as normal processes | Only the monitor process and vCPU threads |
| Typical use | Packaging and density | Multi-tenant isolation, other OS kernels |

## Worked example
Where does a `docker run` actually execute on a Mac with OrbStack? Measured on 2026-11-04 ✅[^2]:

| Layer | Evidence |
|---|---|
| macOS host | Docker CLI runs here |
| Linux VM (a lightweight VM managed by OrbStack) | `uname -r` inside any container → `6.17.8-orbstack-…`, an arm64 Linux kernel ✅[^2] |
| Container | A process in namespaces inside that VM; sees the VM's kernel, not macOS |
| Nested KVM inside the VM | Not available: `/dev/kvm` absent in the VM ✅[^2] |

So "containers on a Mac" are containers inside one Linux VM: two different isolation technologies stacked ✅[^3].

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `/dev/kvm` missing (nested cloud VM, the lab VM) | Monitors fall back to slow emulation or refuse to start | No hardware virtualization exposed ✅[^2]; QEMU can fall back to TCG, a JIT that emulates the CPU ✅[^6] |
| Container breakout via a kernel bug | Host affected | Shared kernel |
| Guest kernel bug | Affects that guest's kernel, not the host kernel | Each VM runs its own kernel ✅[^1] |
| Kata Containers / Firecracker | Each container or pod runs inside a micro-VM | Lightweight VMs / microVMs on KVM ✅[^7] ✅[^5] |
| Over-committed vCPUs on a host | Guest sees "steal" time (`st` in `vmstat`) | `steal` in `/proc/stat` ✅[^4] |

## Takeaways
- Choose VMs (or micro-VMs) when tenants must not share a kernel; containers when they may.
- On macOS and Windows, Docker always means "containers inside a Linux VM": kernel versions and limits come from that VM.
- Watch `st` (steal) in `vmstat`/`top` on cloud VMs: it is CPU time your vCPU wanted but the host gave to others.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 20 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [The Definitive KVM API Documentation](https://docs.kernel.org/virt/kvm/api.html) — Linux kernel documentation, living. Backs: system/VM/vCPU/device ioctl classes, `KVM_CREATE_VM`, `KVM_CREATE_VCPU`, `KVM_RUN`, `struct kvm_run` mapped from the vCPU fd. [^1]
- `linux/lab-setup.md` — the lab where the OrbStack kernel version and the absence of `/dev/kvm` were observed on 2026-11-04. [^2]
- [OrbStack architecture](https://docs.orbstack.dev/architecture) — OrbStack, living. Backs: containers on macOS run in a Linux VM. [^3]
- [proc_stat(5)](https://man7.org/linux/man-pages/man5/proc_stat.5.html) — Linux man-pages project, living. Backs: `steal` time in `/proc/stat` (since 2.6.11). [^4]
- [Firecracker](https://github.com/firecracker-microvm/firecracker) — Firecracker project, living. Backs: microVMs on KVM; faster startup than traditional VMs. [^5]
- [QEMU: Introduction](https://www.qemu.org/docs/master/system/introduction.html) — QEMU project, living. Backs: accelerators such as KVM, and the TCG JIT that emulates CPUs without one. [^6]
- [Kata Containers](https://github.com/kata-containers/kata-containers) — Kata Containers project, living. Backs: containers run in lightweight virtual machines. [^7]

## Related
- `linux/containers/container-isolation.md` — the shared-kernel isolation layers.
- `linux/containers/container-from-primitives-deep-dive.md` — what a container is, end to end.
