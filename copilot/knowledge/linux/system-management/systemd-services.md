---
schema: knowledge-doc/v1
type: concept
topic: linux/system-management
status: verified
applies-to: ["systemd ≥ 250 on Linux with cgroup v2"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [linux, systemd, units, services, targets, dependencies, journald, slices, resource-control, drop-ins]
---

# systemd units, services and resource control

## Summary
**TL;DR:** systemd (PID 1 on most distributions) manages everything as **units**: services, sockets, timers, mounts, targets, slices and more. Each unit file declares **requirements** (`Wants=`, `Requires=`) and, separately, **ordering** (`After=`, `Before=`) — requiring a unit does not order it. Every service runs in its own **cgroup** inside a **slice** (`system.slice` by default), so `CPUQuota=`, `MemoryMax=`, `TasksMax=` in a unit are just cgroup v2 files. Logs go to the journal (`journalctl -u <unit>`). You override a vendor unit with a **drop-in** (`systemctl edit`), never by editing it in `/usr/lib`.
**Use this when:** you write or debug a service unit, a service starts too early or not at all, you want limits or restart policies for a daemon, or you need to read its logs.
**Not this doc:** how systemd gets to PID 1 during boot → `fundamentals/boot-process.md`; the cgroup files themselves → `containers/cgroups-v2.md`.

## Problem
A service that "depends on the database" still starts before it; a unit edited in `/usr/lib/systemd/system` loses its change after a package update; a forking daemon is reported as started before it is ready; a service eats all memory because nobody set a limit. All of these come from misreading the unit model.

## Mental model
**Analogy:** a stage manager with a cue sheet. Each act (unit) lists who must also be on stage (`Wants`/`Requires`) and, separately, who must go on **before** it (`After`). The cue sheet is assembled from the original script (`/usr/lib`), the director's notes (`/etc`), and sticky notes (drop-ins) that override single lines. Each act gets its own dressing room with a size limit (cgroup in a slice).

**Artifact:** a service unit for a web API, with each line's job:
```ini
# /etc/systemd/system/api.service
[Unit]
Description=Example API
Wants=network-online.target          # pull it in (weak requirement) …
After=network-online.target          # … and start after it (ordering is separate)

[Service]
Type=notify                          # "started" = the app sent READY=1 via sd_notify()
ExecStart=/usr/local/bin/api --port 8080
User=api
Restart=on-failure
RestartSec=2
TimeoutStopSec=30                    # SIGTERM, then SIGKILL after 30 s
MemoryHigh=400M                      # → cgroup memory.high (throttle)
MemoryMax=512M                       # → cgroup memory.max (OOM kill inside the unit)
CPUQuota=150%                        # → cgroup cpu.max (1.5 CPUs)
TasksMax=256                         # → cgroup pids.max

[Install]
WantedBy=multi-user.target           # "systemctl enable" links it into multi-user.target.wants/
```

## How it works
**4 actors:**
- **Unit files** — its job: declare what to run and how it relates to other units, via files in `/etc/systemd/system`, `/run/systemd/system`, `/usr/lib/systemd/system` ✅[^1].
- **systemd (PID 1)** — its job: build a dependency graph into jobs and start/stop units in order, via its job engine ✅[^1].
- **cgroup tree** — its job: contain each unit's processes and apply its resource settings, via slices and per-unit cgroups ✅[^3].
- **journald** — its job: collect stdout/stderr and logs of every unit, via the journal ✅[^4].

1. **Loading:** for the same unit name, `/etc` overrides `/run`, which overrides `/usr/lib`; drop-ins in `<unit>.d/*.conf` are applied after the main file in alphanumeric order, with the same precedence ✅[^1].
2. **Requirements:** `Wants=` is weak (the unit starts even if the wanted one fails); `Requires=` is strong (if the required unit fails and this unit is ordered `After=` it, this one does not start; stopping or restarting it also stops or restarts this one). The docs recommend `Wants=` for robustness ✅[^1].
3. **Ordering:** "requirement dependencies do not influence the order in which services are started or stopped"; add `After=`/`Before=` explicitly ✅[^1].
4. **Start-up readiness (`Type=`):** `simple` = started right after fork; `exec` = after `execve` succeeded; `forking` = when the original process exits; `oneshot` = when the main process exits; `notify` = when the service sends `READY=1`; `dbus` = when the bus name is taken ✅[^2].
5. **Restart:** `Restart=` is `no` by default; options include `on-failure` and `always`; `RestartSec=` defaults to 100 ms ✅[^2].
6. **Stop:** `ExecStop=` commands run if set; then `SIGTERM`; `SIGKILL` if the service is still alive after `TimeoutStopSec=` ✅[^2].
7. **Resources:** units live in a cgroup tree of slices (`-.slice` → `system.slice`, `user.slice` → `user-<uid>.slice`); services default to `system.slice` ✅[^3]. Directives map to cgroup v2 files ✅[^3]:

| Directive | cgroup v2 file |
|---|---|
| `CPUWeight=` | `cpu.weight` (1–10000, default 100) |
| `CPUQuota=` | `cpu.max` (percent of one CPU; 150% = 1.5 CPUs) |
| `MemoryHigh=` | `memory.high` (main throttle mechanism) |
| `MemoryMax=` | `memory.max` (OOM kill inside the unit) |
| `TasksMax=` | `pids.max` |
| `IOWeight=` | `io.weight` |

8. **Enabling:** `[Install]` is only used by `systemctl enable`, which creates symlinks in `.wants/` or `.requires/` directories of the target ✅[^1].

**Unit types** ✅[^1]: service, socket, device, mount, automount, swap, target, path, timer, slice, scope.

## Worked example
"The API starts before PostgreSQL is up and crashes at boot." Unit has `Requires=postgresql.service` and no `After=`.

| Step | What systemd does | Why |
|---|---|---|
| 1 | Queues start jobs for both units | `Requires=` pulls PostgreSQL in ✅[^1] |
| 2 | Starts both **in parallel** | No ordering was declared ✅[^1] |
| 3 | API connects before PostgreSQL listens → exits 1 | Race |
| 4 | Unit `failed`, no retry | `Restart=` defaults to `no` ✅[^2] |

Fix with a drop-in instead of editing the vendor file:
```console
$ sudo systemctl edit api.service          # opens /etc/systemd/system/api.service.d/override.conf
[Unit]
After=postgresql.service
[Service]
Restart=on-failure
$ sudo systemctl daemon-reload && sudo systemctl restart api
$ systemctl status api                      # state, main PID, cgroup tree, last log lines
$ journalctl -u api -b                      # this boot's logs for the unit
$ systemctl show api -p MemoryMax -p CPUQuotaPerSecUSec
```
Readiness is still only "process started" unless the dependency's unit uses `Type=notify` or similar readiness signalling ✅[^2]. The robust app-side fix is to retry connections at start-up.

## Edge cases
| Case | What happens | Why |
|---|---|---|
| `Requires=` without `After=` | Parallel start; race | Requirement ≠ ordering ✅[^1] |
| Edited file in `/usr/lib/systemd/system` | Lost on package update | Vendor path; use `/etc` or drop-ins ✅[^1] |
| Changed a unit file, no reload | Old definition still used | `systemctl daemon-reload` needed ✅[^5] |
| `Type=simple` daemon that forks into the background | systemd tracks the wrong process, may kill the daemon | Use `Type=forking` (+ `PIDFile=`) or run it in the foreground ✅[^2] |
| `Type=oneshot` with `Restart=always` | Rejected | Not allowed for oneshot ✅[^2] |
| Service exceeds `MemoryMax=` | OOM kill inside the unit; unit marked failed | cgroup `memory.max` ✅[^3] |

## Takeaways
- Always pair a requirement with an ordering: `Wants=X` + `After=X`. [rule-candidate]
- Override vendor units with drop-ins (`systemctl edit`), never in place.
- Give every long-running service `Restart=on-failure`, a stop timeout that matches its graceful shutdown, and memory/task limits.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 24 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- [systemd.unit(5)](https://man7.org/linux/man-pages/man5/systemd.unit.5.html) — systemd project via Linux man-pages, living. Backs: unit types, search paths and precedence, drop-ins, `Wants`/`Requires`, requirements vs ordering, `[Install]` and enable symlinks. [^1]
- [systemd.service(5)](https://man7.org/linux/man-pages/man5/systemd.service.5.html) — systemd project via Linux man-pages, living. Backs: `Type=` values, `Restart=` default and options, `RestartSec=` default, stop sequence, oneshot restrictions. [^2]
- [systemd.resource-control(5)](https://man7.org/linux/man-pages/man5/systemd.resource-control.5.html) — systemd project via Linux man-pages, living. Backs: cgroup tree of slices, default `system.slice`, directive → cgroup file mapping. [^3]
- [journalctl(1)](https://man7.org/linux/man-pages/man1/journalctl.1.html) — systemd project via Linux man-pages, living. Backs: further reading, `-u`, `-b`, `-k`, `-f` options.
- [systemd.exec(5)](https://man7.org/linux/man-pages/man5/systemd.exec.5.html) — systemd project via Linux man-pages, living. Backs: `StandardOutput=` defaults to `DefaultStandardOutput=`, which defaults to `journal`. [^4]
- [systemctl(1)](https://man7.org/linux/man-pages/man1/systemctl.1.html) — systemd project via Linux man-pages, living. Backs: `daemon-reload` is needed after unit files change on disk. [^5]

## Related
- `linux/fundamentals/boot-process.md` — targets during boot.
- `linux/containers/cgroups-v2.md` — the cgroup files behind the directives.
- `linux/processes/signals.md` — graceful shutdown on `SIGTERM`.
