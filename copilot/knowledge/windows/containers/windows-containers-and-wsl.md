---
schema: knowledge-doc/v1
type: concept
topic: windows/containers
status: verified
applies-to: ["Windows Server 2016+", "Windows 10 1809+ / Windows 11", "WSL 2"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [windows, containers, process-isolation, hyper-v-isolation, job-objects, silos, wsl, wsl2, docker-desktop]
---

# Windows containers and WSL 2

## Summary
**TL;DR:** Windows containers run in one of two isolation modes with the same images and tools. **Process isolation** shares the host kernel, like Linux containers, and isolates through per-container namespaces (object manager, file system, registry, network, processes) plus resource controls. **Hyper-V isolation** runs each container in a highly optimized VM with its own kernel, for stronger isolation and looser host/container version matching. Windows Server defaults to process isolation; Windows 10/11 Pro and Enterprise default to Hyper-V isolation. Linux containers on a Windows machine run inside a Linux VM — today usually **WSL 2**, which runs a real Linux kernel in a lightweight managed VM with full system-call compatibility.
**Use this when:** you choose an isolation mode, wonder why a Windows container image must match the host build, run Linux containers on Windows, or compare Windows containers with Linux namespaces and cgroups.
**Not this doc:** Linux container internals → `linux/containers/container-from-primitives-deep-dive.md`; KVM and VMs → `linux/fundamentals/kvm-virtualization.md`.

## Problem
Teams expect a Windows container image to run anywhere and hit version mismatches, or assume "Docker on Windows" means one thing when it can mean Windows containers (process or Hyper-V isolated) or Linux containers inside a VM. Each has different isolation, performance and compatibility.

## Mental model
**Analogy:** apartments versus guest houses. **Process isolation** gives each tenant a private flat in the host's building — private rooms, but shared foundations (the host kernel), so the flat's fittings must match the building's version. **Hyper-V isolation** gives each tenant a small prefab house with its own foundations (kernel) on the same land, so it can be a different model. **WSL 2** is one guest house that runs a Linux foundation, where all Linux tenants live.

**Artifact:** choosing the mode with Docker on Windows ✅[^1]:
```console
docker run --isolation=process  mcr.microsoft.com/windows/servercore:ltsc2022 cmd /c ver
docker run --isolation=hyperv   mcr.microsoft.com/windows/servercore:ltsc2022 cmd /c ver
```
(Image tag is an example; the `--isolation` values are documented.)

## How it works
**4 actors:**
- **Container runtime (Docker/containerd with the Windows host compute service)** — its job: create containers in the chosen isolation mode ✅[^3].
- **Windows kernel (process isolation)** — its job: virtualize namespaces per container and apply resource controls ✅[^1].
- **Hyper-V utility VM (Hyper-V isolation)** — its job: give each container its own kernel with hardware-level isolation ✅[^1].
- **WSL 2 VM** — its job: run a real Linux kernel for Linux distributions and Linux containers ✅[^2].

1. **Same images, same management:** both modes create, manage and run containers identically and use the same images; only the degree of isolation differs ✅[^1].
2. **Process isolation:** multiple containers share the host kernel; isolation comes from namespaces, resource control and other process isolation technologies ✅[^1]. Isolated namespaces include the Object Manager namespace, the file system, the network namespace and process namespaces ✅[^1]. The isolated namespaces listed are the file system, registry, network ports, process and thread ID space and the Object Manager namespace ✅[^1].
3. **Hyper-V isolation:** each container runs in an optimized VM and "effectively gets its own kernel"; the VM provides hardware-level isolation between containers and the host ✅[^1].
4. **Defaults:** Windows Server → process isolation; Windows 10 Pro/Enterprise → Hyper-V isolation; since the October 2018 update, Windows 10 users can request process isolation explicitly ✅[^1].
5. **WSL 2:** uses virtualization and its own Linux kernel instead of WSL 1's translation layer, for full system-call compatibility and better file-system performance; it runs as a Hyper-V VM and uses NAT networking by default ✅[^2].

**Windows vs Linux containers:**

| Topic | Windows (process isolation) | Linux |
|---|---|---|
| Kernel | Host Windows kernel | Host Linux kernel |
| Visibility isolation | Object Manager, file system, registry, network, process namespaces ✅[^1] | 8 namespace types |
| Resource limits | Resource controls (job objects) | cgroups v2 |
| Stronger mode | Hyper-V isolation (own kernel) | Micro-VMs (Kata, Firecracker) |
| Host/image version coupling | Process isolation only for supported host/base-image version pairs ✅[^4] | Loose (kernel ABI is stable) |

## Worked example
Where three `docker run` commands actually execute on a Windows 11 Pro laptop with Docker Desktop (WSL 2 backend):

| Command | Image OS | Runs in |
|---|---|---|
| `docker run nginx` | Linux | A Linux container in the WSL 2 VM (real Linux kernel) ✅[^2] ✅[^5] |
| `docker run --isolation=hyperv …servercore…` | Windows | Its own Hyper-V utility VM ✅[^1] |
| `docker run --isolation=process …servercore…` | Windows | Directly on the host kernel; image build must suit the host ✅[^1] ✅[^4] |

On a Windows Server host, the same Windows image without `--isolation` runs with process isolation by default ✅[^1].

## Edge cases
| Case | What happens | Why |
|---|---|---|
| Windows image older/newer than host with process isolation | Not a supported process-isolation combination | See the compatibility table ✅[^4] |
| Same image with Hyper-V isolation | Runs | Own kernel ✅[^1] |
| WSL 2 service needs to be on the host's LAN | Extra setup | NAT networking by default ✅[^2] |
| Files under `/mnt/c` from WSL 2 | Slower than the Linux file system | Microsoft recommends keeping Linux-tool work in the WSL file system for speed ✅[^6] |
| Kernel-mode exploit in a process-isolated container | Host affected | Shared kernel ✅[^1] |

## Takeaways
- Use Hyper-V isolation for untrusted or multi-tenant Windows containers; process isolation for density on matched hosts.
- Pin Windows base images to the host's LTSC release when using process isolation.
- On Windows workstations, keep Linux-container work inside the WSL 2 file system for speed.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 25 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [Isolation modes](https://learn.microsoft.com/en-us/virtualization/windowscontainers/manage-containers/hyperv-container) — Microsoft Learn, living. Backs: two modes, same images and management, process isolation via namespaces and resource control, isolated namespaces, Hyper-V isolation own kernel, Docker `--isolation`, defaults per Windows edition. [^1]
- [Comparing WSL Versions](https://learn.microsoft.com/en-us/windows/wsl/compare-versions) — Microsoft Learn, living. Backs: WSL 2 real Linux kernel in a managed VM, full system-call compatibility, file-system performance goal, Hyper-V VM with NAT networking. [^2]
- [Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects) — Microsoft Learn, living. Backs: further reading on the resource-control primitive.
- No Windows lab was available when this doc was written (macOS host); the worked example is illustrative.
- [Container platform tools on Windows](https://learn.microsoft.com/en-us/virtualization/windowscontainers/deploy-containers/containerd) — Microsoft Learn, living. Backs: containerd and the Host Compute Service (HCS) create Windows containers. [^3]
- [Windows container version compatibility](https://learn.microsoft.com/en-us/virtualization/windowscontainers/deploy-containers/version-compatibility) — Microsoft Learn, living. Backs: per host/base-image version table of which combinations support process isolation vs Hyper-V isolation. [^4]
- [Docker Desktop WSL 2 backend on Windows](https://docs.docker.com/desktop/features/wsl/) — Docker, living. Backs: Docker Desktop runs its Linux engine on WSL 2. [^5]
- [Working across Windows and Linux file systems](https://learn.microsoft.com/en-us/windows/wsl/filesystems) — Microsoft Learn, living. Backs: for the fastest performance, store files in the WSL file system when using Linux tools. [^6]

## Related
- `linux/containers/container-from-primitives-deep-dive.md` — Linux containers end to end.
- `windows/processes/processes-threads-and-handles.md` — job objects.
