# GKE + Lens Setup Guide

---

## Architecture: GKE vs Kubernetes vs Cluster API Endpoint

```
┌──────────────────────────────────────────────────────────────┐
│                      GOOGLE CLOUD (GCP)                      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              GKE (Google Kubernetes Engine)            │  │
│  │  Managed service: provisions VMs, installs/upgrades    │  │
│  │  Kubernetes, manages networking, storage, autoscaling  │  │
│  │                                                        │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │             YOUR CLUSTER (Kubernetes)            │  │  │
│  │  │                                                  │  │  │
│  │  │  Control Plane (managed by GKE)                  │  │  │
│  │  │  ┌────────────────────────────────────────────┐  │  │  │
│  │  │  │  kube-apiserver  https://34.x.x.x:443      │◄─┼──┼──┼── kubectl / Lens
│  │  │  │  etcd  |  scheduler  |  controller-manager  │  │  │  │
│  │  │  └────────────────────────────────────────────┘  │  │  │
│  │  │                                                  │  │  │
│  │  │  Worker Nodes → pods and containers run here    │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  GCP Management API  (container.googleapis.com)              │
│  → used ONLY by `gcloud get-credentials` to discover        │
│    the cluster endpoint IP and CA certificate                │
└──────────────────────────────────────────────────────────────┘
```

### The Three Terms Defined

| Term | What it is |
|------|-----------|
| **Kubernetes** | Open-source container orchestration software. Runs anywhere. GKE, EKS, AKS all run Kubernetes under the hood. |
| **GKE** | Google's managed service that runs Kubernetes for you — handles VM provisioning, K8s upgrades, networking, autoscaling. A wrapper around Kubernetes. |
| **Cluster API endpoint** | The IP:port of `kube-apiserver` — a process running inside your cluster's control plane. GKE exposes it as `https://<IP>:443`. This is what `kubectl` and Lens talk to directly, every time. |

### Two Separate API Calls in the Full Flow

1. **`gcloud get-credentials`** → hits **GCP Management API** → "give me the endpoint and cert for my cluster" → writes `34.x.x.x` + CA cert into `~/.kube/config` (one-time setup)
2. **Every kubectl / Lens operation** → hits `https://34.x.x.x:443` directly → **Kubernetes API Server** — GCP Management API is not involved anymore

---

## Kubernetes vs GKE vs Minikube — The Full Comparison

> Source: [GKE official docs](https://cloud.google.com/kubernetes-engine/docs/concepts/kubernetes-engine-overview): *"GKE is a managed implementation of the Kubernetes open source container orchestration platform."*

```
Kubernetes (open-source spec)
│  Defines: kube-apiserver, etcd, kubelet, scheduler,
│           cloud-controller-manager interface, etc.
│
├── GKE = Google's managed implementation
│     - Runs all K8s components
│     - Implements cloud-controller-manager for GCP
│       (handles: GCP load balancers, routes, Compute Engine node lifecycle)
│     - Provisions Compute Engine VMs as worker nodes
│     - Adds GCP Management API (container.googleapis.com) for cluster lifecycle
│     - Manages upgrades, HA, security patches automatically
│
├── EKS = Amazon's managed implementation (same pattern, AWS infra)
├── AKS = Azure's managed implementation  (same pattern, Azure infra)
│
└── minikube = local implementation
               - No cloud-controller-manager (no cloud infra)
               - Runs entire cluster on your laptop in Docker/VM
               - No managed operations — you start/stop manually
```

### What `cloud-controller-manager` Is (The Official Cloud Bridge)

Kubernetes defines this component in its spec as the official integration point for cloud providers. Each provider implements their own version:

| Cloud | `cloud-controller-manager` handles |
|---|---|
| GKE (Google) | GCP load balancers, Compute Engine node lifecycle, GCP routes |
| EKS (AWS) | AWS ELB, EC2 node lifecycle, VPC routes |
| AKS (Azure) | Azure Load Balancer, Azure VM node lifecycle |
| minikube | **None** — no cloud, no cloud-controller-manager |

> Source: [Kubernetes architecture docs](https://kubernetes.io/docs/concepts/architecture/): *"If you are running Kubernetes on your own premises, or in a learning environment inside your own PC, the cluster does not have a cloud controller manager."*

### What GKE Consists Of (Confirmed by Official Docs)

GKE is **not** a wrapper "around" Kubernetes — it **is** the Kubernetes implementation, plus Google-managed infrastructure and operations on top:

```
GKE
├── Kubernetes components (the open-source software)
│   ├── kube-apiserver      ← the cluster API endpoint you connect to
│   ├── etcd                ← cluster state store
│   ├── kube-scheduler      ← decides which node runs which pod
│   ├── kube-controller-manager
│   └── cloud-controller-manager  ← Google's GCP-specific implementation
│
├── Compute Engine VMs      ← Google provisions these as worker nodes
│   └── kubelet + kube-proxy + container runtime on each VM
│
└── GCP Management API      ← Google's extra lifecycle layer (not part of K8s spec)
    (container.googleapis.com)
    → create/delete/list/describe clusters
    → return cluster endpoint to gcloud get-credentials
```

### Conclusion: What GKE Is (One-Sentence Summary)

> GKE is Google's managed service that provisions Compute Engine VMs, installs the **standard open-source Kubernetes software** on them to form clusters, adds GCP-specific integrations (`cloud-controller-manager`), and operates all of it automatically (upgrades, HA, patching).

The core K8s components (`kube-apiserver`, `etcd`, `kubelet`, etc.) are **not re-implemented by Google** — they are the same open-source binaries from kubernetes.io. Google's contribution is the infrastructure, operations, and cloud integrations around them.

### Can You Download Kubernetes Yourself?

Yes — but it is **not like minikube**. The raw Kubernetes components are individual Linux server binaries with no installer, no UI, no automation:

```bash
# Example: raw K8s binaries downloadable from kubernetes.io
curl -LO "https://dl.k8s.io/v1.31.0/bin/linux/amd64/kube-apiserver"
curl -LO "https://dl.k8s.io/v1.31.0/bin/linux/amd64/kube-scheduler"
curl -LO "https://dl.k8s.io/v1.31.0/bin/linux/amd64/etcd"
curl -LO "https://dl.k8s.io/v1.31.0/bin/linux/amd64/kubelet"
# ... then manually configure TLS certs, config files, networking, systemd services
```

To use raw binaries you must manually: generate TLS certificates, write config files for each component, set up etcd, configure CNI networking, and wire everything together on Linux VMs. This is known as "Kubernetes the Hard Way" — a learning exercise, not how anyone deploys in practice.

`kubectl` is the **only** K8s binary you already use — it is the client that talks to a cluster, not a server component.

### The Spectrum from Manual to Managed

```
Raw K8s binaries    kubeadm           minikube / kind      GKE / EKS / AKS
(download yourself) (bootstrap tool)  (local dev tools)    (fully managed)

You wire everything  Semi-automated    One command,         Zero ops,
manually on VMs      cluster bootstrap runs on laptop       cloud does all

◄─────────────────────────── more manual       more automated ──────────────►
```

| | **Raw binaries** | **minikube** | **GKE** |
|---|---|---|---|
| Setup | Hours/days manual | `minikube start` (seconds) | `gcloud get-credentials` |
| UI | None | `minikube dashboard` (web UI) | Lens / GCP Console |
| Runs on | Real Linux VMs | Your laptop | Google Cloud VMs |
| Audience | Infra engineers | Developers learning/testing | All production use |

### Comparison Table

| | **minikube** | **GKE** | **EKS (AWS)** | **AKS (Azure)** |
|---|---|---|---|---|
| What it is | Local K8s engine | Google's managed K8s implementation | Amazon's managed K8s implementation | Azure's managed K8s implementation |
| Runs on | Your laptop (Docker/VM) | Compute Engine VMs | AWS EC2 VMs | Azure VMs |
| Who manages infra | You | Google | Amazon | Microsoft |
| cloud-controller-manager | None | GCP implementation | AWS implementation | Azure implementation |
| Clusters it can manage | 1 default, more via profiles | Many per project | Many per account | Many per account |
| Use case | Dev / learning | Production | Production | Production |

### One Minikube = One Cluster?

Default: yes. But minikube supports **profiles** — each profile is a separate independent cluster:

```bash
minikube start                  # default cluster, profile name "minikube"
minikube start -p cluster-two   # second separate cluster
minikube profile list            # see all local clusters
kubectl config get-contexts      # all profiles appear here too
```

Each profile gets its own entry in `~/.kube/config`, same as GKE clusters. In practice, multiple profiles are rarely used — use namespaces inside one cluster to separate workloads instead.

---

## Authentication Flow at Runtime

### Why There Is No Token in kubeconfig

kubeconfig intentionally stores **no token**. Instead it stores an instruction:

```yaml
users:
- name: gke_one-global-ecommerce-stage_asia-southeast1_sea1-stg-ecom-gke
  user:
    exec:
      command: gke-gcloud-auth-plugin   # "run this to get a token on demand"
      provideClusterInfo: true
```

This is an official Kubernetes feature called the **exec credential plugin**. Instead of a static stored token, kubectl/Lens calls an external binary to fetch a fresh token whenever one is needed.

### Why Not Store the Token Statically?

GKE tokens expire in ~1 hour. Static storage would require manual refresh every hour.

```
Static token (bad):   token hardcoded in kubeconfig
                      → expires in 1hr → auth errors → manual refresh

exec plugin (GKE):    command to GET a token stored in kubeconfig
                      → called on demand, always fresh, fully transparent
```

### What the Plugin Returns (ExecCredential Format)

When you run `gke-gcloud-auth-plugin` directly, the output is exactly what kubectl/Lens receives:

```json
{
  "kind": "ExecCredential",
  "apiVersion": "client.authentication.k8s.io/v1beta1",
  "status": {
    "expirationTimestamp": "2026-07-31T07:29:27Z",
    "token": "ya29.a0ARGnu0bb..."   // Google OAuth2 access token sent to kube-apiserver
  }
}
```

The `ya29.` prefix is Google's OAuth2 **access token** format. This is placed in `Authorization: Bearer ya29...` on every HTTP request to the cluster. kubectl/Lens only ever sees this access token — they never know about refresh tokens.

### Where the Refresh Token Lives (Hidden from kubectl)

The refresh token is stored **privately** by gcloud and never exposed to kubectl or Lens:

```bash
# Written by `gcloud auth login`, never shown to kubectl:
~/.config/gcloud/legacy_credentials/vinh.doq@one-line.com/adc.json
# Contents:
{
  "client_id": "...",
  "client_secret": "...",
  "refresh_token": "1//0eXXXXX...",   // long-lived, never shown to kubectl
  "type": "authorized_user"
}
```

### Full Authentication Flow (Step by Step)

```
Lens / kubectl
  |
  |  1. "I need to call the cluster API. Check kubeconfig for credentials."
  |
  v
kubeconfig
  |
  |  2. Sees exec: gke-gcloud-auth-plugin
  |     "No stored token - run this binary to get one."
  |
  v
gke-gcloud-auth-plugin  (binary on your Mac)
  |
  +-- Is there a cached access token in gcloud's local store?
  |     AND is it still valid (not expired yet)?
  |         |
  |         +-- YES -> return it directly from local file
  |         |         (no network call at all -- what you see when running the plugin manually)
  |         |
  |         +-- NO (expired or first time)
  |               |
  |               v
  |         Calls Google OAuth API with the refresh token from ~/.config/gcloud/
  |           -> Google validates your identity
  |           -> Returns new access token (valid ~1 hour)
  |           -> Plugin caches it in gcloud's local store
  |
  v
Returns ExecCredential JSON to kubectl/Lens  (only access token + expiry, no refresh token)
  |
  v
kubectl / Lens attaches it to every HTTP request:
  Authorization: Bearer ya29.a0ARGnu0bb...
  |
  v
GKE kube-apiserver  (https://34.142.216.191:443)
  |
  |  Validates access token against Google's identity service.
  |  Checks IAM permissions for your Google account in GCP.
  |
  v
Response returned to Lens / kubectl
```

### Where Your Actual Credentials Live

```
~/.config/gcloud/legacy_credentials/<your-email>/
+-- adc.json           <- refresh token (long-lived, written by `gcloud auth login`)
                          never shown to kubectl/Lens

~/.config/gcloud/      <- gcloud's local access token cache (short-lived, ~1hr)

~/.kube/config         <- NO token stored here at all
                          only the exec instruction to call gke-gcloud-auth-plugin
```

The plugin bridges these: reads refresh token from gcloud's files -> returns cached access token if still valid -> calls Google OAuth API only when expired -> hands only the access token to kubectl/Lens.

### Does Lens Call kubectl Commands?

Partially. Lens uses the same kubeconfig and the same exec plugin mechanism as kubectl, but it calls the Kubernetes API directly via its own HTTP client rather than shelling out to `kubectl` for every operation. The `gke-gcloud-auth-plugin` binary is still invoked the same way — Lens fully respects the exec credential spec.

---

## What Gets Written into ~/.kube/config

```yaml
clusters:
- cluster:
    certificate-authority-data: <base64-CA-cert>  # verifies cluster authenticity
    server: https://34.142.216.191                # Kubernetes API Server IP (direct)
  name: gke_PROJECT_REGION_CLUSTERNAME

contexts:
- context:
    cluster: gke_PROJECT_REGION_CLUSTERNAME  # which cluster to connect to
    user: gke_PROJECT_REGION_CLUSTERNAME     # which credentials to use
    # namespace: optional, defaults to "default"
  name: gke_PROJECT_REGION_CLUSTERNAME       # the label you switch between

current-context: gke_PROJECT_REGION_CLUSTERNAME  # currently active context

users:
- name: gke_PROJECT_REGION_CLUSTERNAME
  user:
    exec:
      command: gke-gcloud-auth-plugin         # fetches short-lived OAuth token
      provideClusterInfo: true
```

A **context** = named binding of (cluster + user + namespace). Switching context = switching which cluster kubectl/Lens targets.

---

## The Long Cluster Name Explained

```
gke_one-global-ecommerce-stage_asia-southeast1_sea1-stg-ecom-gke
│    │                          │                │
│    │                          │                └── Name YOU gave the cluster in GCP
│    │                          └─────────────────── GCP Region
│    └────────────────────────────────────────────── GCP Project ID
└─────────────────────────────────────────────────── Fixed prefix "gke"
```

Auto-generated pattern by `gcloud get-credentials`:
```
gke_{PROJECT_ID}_{REGION}_{CLUSTER_NAME_YOU_CHOSE}
```

`sea1-stg-ecom-gke` = the exact name your team chose when creating the cluster in GCP Console or Terraform.

---

## Prerequisites (macOS)

```bash
# 1. Google Cloud SDK
brew install --cask google-cloud-sdk

# 2. Auth plugin (required since GKE 1.26+)
gcloud components install gke-gcloud-auth-plugin

# 3. Confirm plugin is found
gke-gcloud-auth-plugin --version

# 4. Set env var — add permanently to ~/.zshrc
echo 'export USE_GKE_GCLOUD_AUTH_PLUGIN=True' >> ~/.zshrc
source ~/.zshrc
```

---

## Connecting to a GKE Cluster (Full Setup, One-Time Per Cluster)

```bash
# 1. Authenticate your Google account
gcloud auth login

# 2. (Optional convenience) Set default project
#    Only needed if you run gcloud commands WITHOUT --project flag.
#    get-credentials below uses --project explicitly, so this is optional.
gcloud config set project PROJECT_ID

# 3. Fetch cluster credentials — writes cluster/user/context into ~/.kube/config
gcloud container clusters get-credentials CLUSTER_NAME \
  --region REGION \
  --project PROJECT_ID
```

Lens auto-detects the new context. Repeat step 3 for each cluster. Multiple clusters accumulate in kubeconfig — nothing gets overwritten.

---

## `gcloud config set project` — When It Matters

This sets the **default project** for your entire gcloud session. Affects commands that have no explicit `--project` flag:

```bash
gcloud container clusters list    # which project's clusters?
gcloud iam service-accounts list  # which project's IAM?
gcloud logging read "..."         # which project's logs?
```

For `get-credentials` specifically, the `--project` flag makes it optional. But it's documented in setup flows as a convenience so you don't have to type `--project` everywhere.

---

## Switching Between Clusters

**In Lens:** Click the cluster in the Navigator sidebar → it switches and expands automatically.

**In terminal:**
```bash
kubectl config get-contexts               # list all contexts
kubectl config use-context CONTEXT_NAME   # switch active context
kubectl config current-context            # show current active context
```

---

## Lens Cluster Settings Tab

- **Cluster Name field** → the context name from kubeconfig. Editable in Lens for display label only — does not change kubeconfig.
- **KUBECONFIG link** → `/Users/vinh.doq/.kube/config` — Lens reads this file directly. Confirmed from Settings tab.
- **Proxy, Metrics, Namespaces** → Lens-level overrides stored in Lens's own internal database, NOT in kubeconfig.

---

## VPN is Mandatory

Staging/production GKE clusters use **Master Authorized Networks** — a firewall whitelist on the Kubernetes API Server. Only allowed CIDRs can reach port 443.

**Always connect to VPN first**, then open Lens or run kubectl.

Verify the whitelist:
```bash
gcloud container clusters describe CLUSTER_NAME \
  --region REGION \
  --project PROJECT_ID \
  --format="yaml(masterAuthorizedNetworksConfig)"
```

---

## Daily Use Checklist

```
1. Connect VPN                    ← always first
2. gcloud auth login              ← only if token expired (every few hours)
3. Open Lens or run kubectl
```

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `gke-gcloud-auth-plugin not found` | Plugin not installed | `gcloud components install gke-gcloud-auth-plugin` |
| `dial tcp ...:443: i/o timeout` | Not on VPN / IP not whitelisted | Connect VPN first |
| `Your current project is [None]` | gcloud default project not set | `gcloud config set project PROJECT_ID` |
| Orange dot in Lens (can't connect) | Lens GUI can't find plugin (PATH issue) | Add plugin path to `launchctl`; reboot |
| Token expired errors | OAuth token >1hr old | `gcloud auth login` again |
