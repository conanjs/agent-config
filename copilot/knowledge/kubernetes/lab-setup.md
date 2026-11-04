---
schema: knowledge-doc/v1
type: how-to
topic: kubernetes
status: verified
applies-to: ["Docker with a Linux engine (OrbStack, Docker Desktop, Linux)", "k3s v1.33.5+k3s1"]
last-verified: 2026-11-04
last-updated: 2026-11-04
tags: [kubernetes, lab, k3s, docker, kubectl, practice]
---

# Run a disposable Kubernetes lab with k3s in Docker

## Summary
**TL;DR:** Start k3s — a complete, certified Kubernetes in one binary — as a privileged, throwaway container, and drive it with `docker exec <name> kubectl …`. You get a real API server, scheduler, controllers, kubelet, containerd, flannel CNI, CoreDNS, kube-proxy (iptables mode), a network-policy controller and a local-path storage provisioner in under a minute. Every captured output in the `kubernetes/` docs written on 2026-11-04 comes from this lab.
**Use this when:** you want to reproduce an example from the Kubernetes docs, test a manifest, or look at node internals (iptables rules, containerd, cgroups) that managed clusters hide.
**Not this doc:** a Linux kernel lab without Kubernetes → `linux/lab-setup.md`.

## Goal & prerequisites
**End state:** `docker exec k3slab kubectl get nodes` shows one `Ready` node, and pods can pull images and resolve Service names.

**Needs:**
- Docker CLI with a running Linux engine (OrbStack or Docker Desktop on macOS; Docker on Linux).
- Network access to pull `rancher/k3s` and workload images.
- Accept that `--privileged` gives the container full control of the Docker VM's kernel — use only for this lab.

Reference run: OrbStack, Linux 6.17.8, arm64; `rancher/k3s:v1.33.5-k3s1`, which reported Kubernetes `v1.33.5+k3s1` and `containerd://2.1.4-k3s1` ✅[^1].

## Steps
1. **Start the server** (Traefik and metrics-server disabled to keep it small):
   ```console
   $ docker run -d --name k3slab --privileged --tmpfs /run --tmpfs /var/run \
       rancher/k3s:v1.33.5-k3s1 server --disable traefik --disable metrics-server
   ```
2. **Wait ~20 s, then check the node:**
   ```console
   $ docker exec k3slab kubectl get nodes -o wide
   ```
3. **Run commands inside the node container** — `kubectl`, `crictl` (container runtime CLI) and `iptables-save` are all there:
   ```console
   $ docker exec k3slab kubectl create deployment web --image=nginx:1.27-alpine --replicas=3
   $ docker exec k3slab crictl ps
   $ docker exec k3slab sh -c 'iptables-save -t nat | grep default/web'
   ```
4. **Copy a script in for longer experiments:** `docker cp script.sh k3slab:/script.sh && docker exec k3slab sh /script.sh`.
5. **(Optional) use your host `kubectl`:** start the container with `-p 16443:6443 … --tls-san 127.0.0.1`, copy `/etc/rancher/k3s/k3s.yaml` out of it ✅[^2], change `127.0.0.1:6443` to `127.0.0.1:16443`, and set `KUBECONFIG` to the copy (lab: host `kubectl get nodes` worked) ✅[^1].
6. **Remove everything:** `docker rm -f k3slab`.

## Verify
```console
$ docker exec k3slab kubectl get nodes
NAME           STATUS   ROLES                  AGE   VERSION
b12cb390c3b7   Ready    control-plane,master   17s   v1.33.5+k3s1
$ docker exec k3slab kubectl get pods -A
kube-system   coredns-64fd4b4794-bppb5                  1/1     Running
kube-system   local-path-provisioner-774c6665dc-jgj2s   1/1     Running
```
Captured on the reference run ✅[^1].

## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| Node never `Ready` | Container not privileged, or cgroup/tmpfs setup missing | Use the exact `docker run` flags in step 1 ✅[^1] |
| Pods `ImagePullBackOff` for valid images | No outbound network from the Docker VM | Check the host's network/proxy |
| HPA shows no metrics | metrics-server was disabled in step 1 | Start without `--disable metrics-server` ✅[^1] |
| `crictl` not found via `k3s crictl` | This image ships `crictl` directly | Call `crictl` ✅[^1] |
| Cluster state looks odd after host sleep | Long-running lab | `docker rm -f k3slab` and start again |

## Rollback
`docker rm -f k3slab` deletes the cluster with all its state; `docker rmi rancher/k3s:v1.33.5-k3s1` removes the image.

## Takeaways
- Use a throwaway single-node cluster to see node internals (iptables, containerd, cgroups) that managed clusters hide.
- Keep lab clusters disposable: recreate rather than repair.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 7 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-04

## References
- Reference lab run of 2026-11-04 — OrbStack on macOS, Linux 6.17.8, arm64, `rancher/k3s:v1.33.5-k3s1`: start-up, versions, bundled components, `crictl` location, disabled metrics-server, all observed directly. [^1]
- [K3s documentation](https://docs.k3s.io/) — K3s project, living. Backs: further reading on k3s flags and bundled components.
- [k3s on Docker Hub](https://hub.docker.com/r/rancher/k3s) — Rancher, living. Backs: the image used.
- [K3s documentation](https://docs.k3s.io/) — K3s project, living. Backs: kubeconfig at `/etc/rancher/k3s/k3s.yaml`. [^2]

## Related
- `kubernetes/learning-path.md` — what to try in the lab, in order.
- `linux/lab-setup.md` — the kernel-level lab.
