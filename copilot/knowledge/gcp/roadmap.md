# Google Cloud Platform Roadmap — From New Account to Architect

Personal learning roadmap for going from a brand-new personal Gmail-based GCP account
to solid, practical Cloud Architect-level competence. Written as a staged plan:
concepts first, hands-on second, certification as a checkpoint (not the goal itself).

---

## 0. What GCP Actually Is (Plain-English First)

**Analogy:** if a physical data center is like owning a building — you buy the land,
wire the electricity, install racks, patch the OS — Google Cloud is like renting fully
furnished office space in a high-rise Google already built and maintains. You rent
exactly what you need (a desk, a whole floor, a private server room), Google handles
power/cooling/physical security, and you pay only for what you occupy, by the hour.

GCP is Google's public cloud: a catalog of on-demand compute, storage, networking,
data, and AI services, billed by usage, provisioned via a web Console, the `gcloud`
CLI, or infrastructure-as-code (Terraform). Everything you create lives inside a
**resource hierarchy** — the organizing skeleton every other concept hangs off of, so
that's the first thing to internalize, before any specific service.

---

## 1. Resource Hierarchy & IAM (Learn This Before Anything Else)

**Concrete artifact:** every resource you ever create in GCP (a VM, a bucket, a
database) has exactly one direct parent, forming a tree:

```
Organization (e.g. "yourcompany.com" — only exists if you use Google Workspace/Cloud Identity)
  └── Folder (optional, e.g. "Engineering", "Finance" — groups projects)
        └── Project (e.g. "my-learning-project-2026")
              └── Resources (VM instances, storage buckets, databases, ...)
```

**Analogy:** Organization = the company. Folder = a department. Project = a specific
initiative's budget line and container — it has its own billing, its own APIs enabled,
its own quotas, its own IAM permissions. **Nothing exists outside a Project.** Every
`gcloud` command, every resource in the Console, is scoped to one.

For a purely personal Gmail account (no Workspace domain), you won't have an Organization
node — you'll just have standalone Projects, which is fine for learning.

**Exception you may see in practice:** if your Google account was ever associated with a
Google Workspace or Cloud Identity domain (even a free Cloud Identity tier), GCP
**automatically creates an Organization node** for that domain. For example, if you
registered a domain and activated Cloud Identity Free, you'll see that org in the dropdown
even on a personal/learning account. When creating a project for personal learning, select
**"No organization"** — your project will live directly under your billing account, with no
extra IAM/policy inheritance to worry about. Choosing the org-scoped option is also fine,
but adds resource-hierarchy complexity (org-level policies apply to all projects underneath)
that you don't need until you're deliberately learning org administration.

**IAM (Identity and Access Management)** answers "who can do what, on which resource."
Three pieces, always:

| Piece | What it is | Concrete example |
|---|---|---|
| **Principal** | Who | `you@gmail.com`, a service account, a Google group |
| **Role** | What set of permissions | `roles/compute.viewer` (read-only VM access) |
| **Resource** | Where it applies | This specific Project, or a specific bucket |

A **role binding** = attaching a principal + role at some node in the hierarchy.
Permissions **inherit downward**: a role granted at the Folder level applies to every
Project and resource underneath it. This is the mechanism behind "least privilege" —
grant the narrowest role, at the lowest node, that gets the job done.

> Verified against official docs: *"IAM lets you grant granular access to specific
> Google Cloud resources... A role granted at a higher level in the hierarchy is
> inherited by all resources in the hierarchy below."*
> — [Resource Hierarchy overview](https://cloud.google.com/resource-manager/docs/cloud-platform-resource-hierarchy)

---

## 2. The Core Service Map (What to Learn, Grouped by Job)

GCP has 100+ products. You don't need most of them. This is the practical subset an
architect actually reaches for, grouped like a menu:

| Category | Core services | One-line purpose |
|---|---|---|
| **Compute** | Compute Engine (VMs), Cloud Run (containers, serverless), GKE (managed Kubernetes), Cloud Functions | Where your code runs |
| **Storage** | Cloud Storage (object/blob), Persistent Disk (block, attached to VMs), Filestore (managed NFS) | Where your files/blobs live |
| **Databases** | Cloud SQL (managed Postgres/MySQL), Spanner (global-scale SQL), Firestore (NoSQL docs), BigQuery (analytics warehouse) | Where structured data lives |
| **Networking** | VPC, Cloud Load Balancing, Cloud NAT, Cloud DNS, Cloud Armor (WAF/DDoS) | How things talk to each other and the internet |
| **IAM & Security** | IAM, Secret Manager, KMS (encryption keys), Security Command Center | Who can access what, and how secrets are protected |
| **Data/Analytics** | BigQuery, Dataflow, Pub/Sub, Dataproc | Moving and analyzing data at scale |
| **DevOps/Ops** | Cloud Build, Artifact Registry, Cloud Monitoring, Cloud Logging, Terraform (via `google` provider) | CI/CD, observability, infra-as-code |
| **AI/ML** | Vertex AI, Gemini API on Vertex | Managed ML training/serving, generative AI |

You already have hands-on exposure to one corner of this map — GKE cluster access and
authentication — documented in [[gke-lens-setup]].

---

## 3. Staged Roadmap

### Phase 0 — Account & Guardrails (Day 1)

- Create a **Billing Account** — new customers get **$300 in free credit, valid 90
  days**, usable across 20+ products up to monthly limits. You will not be auto-charged
  after the trial; it pauses until you explicitly upgrade.
  — [cloud.google.com/free](https://cloud.google.com/free)

  > **Why does the "Billing account" selector exist when creating a project?**
  > GCP separates *identity* (who you are) from *billing* (who pays). One Google
  > login can be granted access to manage multiple billing accounts — for example:
  > your personal account + your company's account + a client's account you administer.
  > GCP always shows the selector so you explicitly choose which account a project's
  > costs are charged to. If you only have one (the common case for personal learners),
  > you'll see a single "My Billing Account / Google Cloud Platform" entry — just select
  > it. The field is there for real-world multi-account scenarios, not because GCP
  > doubts which account is yours.
- Immediately set a **Budget Alert** (Billing → Budgets & Alerts) — this is the single
  most important five-minute step for a learning account. Full setup details:

  **Step 1 – Define:**
  - Choose **"Alerts only"** (not "Spend cap enforcement"). Alerts only sends emails;
    spend cap can abruptly pause running workloads and is still in Preview.
  - Give it a name: e.g. `learning-monthly-guard`.

  **Step 2 – Scope:**
  - Projects: "All projects" (one budget guards everything) or a specific project.
  - Services: "All services".
  - Credits: ✅ include — counts free-credit consumption so you see real usage.

  **Step 3 – Amount:**
  - Type: "Specified amount". Recommended starting values:
    - $10 — very conservative, light labs only
    - $20 — comfortable for active hands-on month
    - $50 — if running GKE, Dataflow, or multi-node experiments
  - **Important:** "Alerts only" budget is NOT a hard cap — you can exceed it.
    The alert is a tripwire, not a wall.

  **Step 4 – Actions (thresholds):**
  Recommended set on a $20 budget:

  | Threshold | Type | $ triggered | Purpose |
  |---|---|---|---|
  | 25% | Actual | $5 | Something unexpected is running |
  | 50% | Actual | $10 | Halfway checkpoint |
  | 90% | Actual | $18 | Take action soon |
  | 100% | Actual | $20 | At limit, investigate |
  | 100% | **Forecasted** | $20 projected | Catches runaway spend *before* it happens |

  "Actual" = money already spent. "Forecasted" = GCP's projection of month-end spend —
  add at least one forecasted threshold so you're warned *before* hitting the limit.

  Enable "Email alerts to billing admins and users" — fires to your Gmail automatically.
  Pub/Sub webhook is optional (used for auto-remediation via Cloud Functions; skip for now).

  **Scenario examples:**
  - Forgot to stop a VM over a weekend → 50% actual alert fires Monday morning.
  - Left a GKE cluster running (control plane ~$74/mo) → forecasted 100% fires within
    2–3 days even if actual spend is only $7.
  - Did a few small labs totaling $3 → no alerts fire; budget resets on the 1st.
- Learn what's **Always Free** (not just trial-free) so you can experiment
  indefinitely at $0 for small workloads: **1 e2-micro VM/month** (in `us-west1`,
  `us-east1`, or `us-central1`), 30 GB of standard persistent disk, 5 GB Cloud Storage,
  1 TB BigQuery queries/month, 2M Cloud Functions invocations/month. Confirm exact
  current numbers at [cloud.google.com/free](https://cloud.google.com/free) before
  relying on them — free-tier limits are policy, not code, and do change.
- Install the CLI: `brew install --cask google-cloud-sdk`, then `gcloud init`.

### Phase 1 — Core Concepts (Weeks 1–3)

Goal: be able to explain, not just click through, these before touching a certification:

1. Resource hierarchy + IAM (Section 1 above) — do this first, everything else assumes it.
2. **Compute Engine** basics: machine types, images, zones vs. regions, persistent disks.
3. **VPC networking**: subnets are regional, VPCs are global; firewall rules; the
   difference between an external IP and going through a Load Balancer.
4. **Cloud Storage**: storage classes (Standard/Nearline/Coldline/Archive) and why
   they're just a retrieval-frequency/cost trade-off, not a durability difference.
5. **Billing model**: sustained-use discounts, committed-use discounts, why a stopped
   VM still bills for its attached disk.

**Best free resource for this phase:** [Google Skills / Cloud Skills Boost](https://www.skills.google/) —
official, guided labs on a temporary sandboxed GCP project (you don't burn your own
credit), organized into role-based **Learning Paths**
([skills.google/paths](https://www.skills.google/paths)). Start with the
"Getting Started with Google Cloud" path.

### Phase 2 — Hands-On Projects (Weeks 3–8)

Build, don't just read. Suggested progression, each one layering on the last:

1. **Deploy a static site** on Cloud Storage + Cloud CDN — cheapest possible first win.
2. **Deploy a container** to Cloud Run — no cluster to manage, teaches the
   container→registry→deploy loop.
3. **Stand up a small GKE cluster** and connect via `kubectl`/Lens — you already have
   the auth mechanics documented in [[gke-lens-setup]]; this phase is about the
   Kubernetes/GKE concepts (Deployments, Services, Ingress) on top of that plumbing.
4. **Add a managed database** (Cloud SQL) and wire IAM + a VPC so only your app's
   service account can reach it — this is the exercise that actually teaches least
   privilege, not the slide about it.
5. **Introduce Terraform** for at least one of the above — write the VPC + Cloud Run
   service as code instead of clicking the Console. Architect-level work is almost
   always IaC, not console clicks.

### Phase 3 — Certification Path (Checkpoint, Weeks 8–16+)

Certifications are a forcing function to fill gaps, not a substitute for Phase 2. The
standard, most-recommended order:

| Order | Certification | Level | Cost (USD) | Typical prerequisite experience |
|---|---|---|---|---|
| Optional 0 | Cloud Digital Leader | Foundational | ~$99 | None — conceptual/non-technical overview |
| 1 | **Associate Cloud Engineer (ACE)** | Associate | ~$125 | ~6 months hands-on (Phases 0–2 above roughly cover this) |
| 2 | **Professional Cloud Architect (PCA)** | Professional | ~$200 | ACE-level knowledge + real design experience; widely regarded as the flagship GCP credential |

After PCA, specialize based on where the work actually is: **Professional Cloud
Security Engineer**, **Professional Cloud DevOps Engineer**, **Professional Data
Engineer**, or **Professional Machine Learning Engineer** — pick one only once you know
which direction your projects are pulling you, not before.

*Note on this table: pricing, exam-guide content, and the two-year professional-level
recertification cycle come from current (2026) third-party cert-prep roundups, not a
single official page fetched directly — cross-check exact current price and exam guide
at [cloud.google.com/certification](https://cloud.google.com/certification) before
registering, since Google revises exam guides periodically (most recently to add
generative AI and GKE Autopilot content).*

### Phase 4 — Think Like an Architect (Ongoing)

Once ACE-level mechanics are second nature, the actual architect skill is judgment
under trade-offs, not more service trivia:

- **High availability vs. cost**: multi-region vs. multi-zone vs. single-zone — know
  the failure domain each one buys you and what it costs.
- **Well-Architected Framework**: Google's own pillars (Operational Excellence,
  Security, Reliability, Cost Optimization, Performance) —
  [cloud.google.com/architecture/framework](https://cloud.google.com/architecture/framework)
  is the closest thing to an official architect syllabus.
- **Reference architectures**: read Google's published ones (e.g., "three-tier web
  app," "data lake on GCP") and be able to explain *why* each box is there, not just
  redraw the diagram.
- **Landing zones**: how a real org sets up Folders, Projects, and IAM at scale before
  any workload exists — this is the enterprise-scale version of Section 1.

---

## 4. Common Early Pitfalls (Cost & Otherwise)

| Pitfall | Why it happens | Guard |
|---|---|---|
| Forgot a running VM/GKE cluster | Console tab closed ≠ resource stopped | Budget alerts (Phase 0); `gcloud compute instances list` habit before logging off |
| Free-tier VM outside allowed regions | Always-Free e2-micro is region-locked | Always create in `us-west1`/`us-east1`/`us-central1` for free-tier work |
| Public bucket/firewall rule left open | Default "quick start" configs favor openness for demoability | Treat every `0.0.0.0/0` firewall rule and public bucket ACL as something to justify, not default |
| Confusing zone vs. region | VPC subnets are regional, instances are zonal, disks are zonal | Re-read Section 1 of the [VPC docs](https://cloud.google.com/vpc/docs/vpc) once, it clicks fast |
| Treating certification as the goal | Exam-crammed knowledge fades without hands-on reinforcement | Certifications sit at the end of a Phase 2 hands-on cycle in this roadmap, not the start |

---

## References

**Local artifacts:**
- [[gke-lens-setup]] — GKE cluster auth mechanics (exec credential plugin, kubeconfig, Lens setup) already documented from hands-on staging/prod work; directly relevant to Phase 2 step 3.

**External sources:**
- [Cloud Platform Resource Hierarchy — official docs](https://cloud.google.com/resource-manager/docs/cloud-platform-resource-hierarchy) — IAM inheritance, Organization/Folder/Project model
- [Google Cloud Free Program](https://cloud.google.com/free) — official $300/90-day trial and Always Free tier terms
- [Compute Engine Free Tier getting-started guide](https://cloud.google.com/free/docs/compute-getting-started) — e2-micro Always Free specifics
- [Google Cloud Certifications — official](https://cloud.google.com/certification) — authoritative current cert list, exam guides, pricing
- [Google Skills learning paths](https://www.skills.google/paths) — official guided labs (formerly Cloud Skills Boost / Qwiklabs)
- [Google Cloud Architecture Framework](https://cloud.google.com/architecture/framework) — the closest official "how an architect should think" reference

## Related

- [[gke-lens-setup]] — deep dive on GKE authentication you'll need once Phase 2 reaches Kubernetes
- (future) a dedicated note on GCP IAM least-privilege patterns, once you've built the Cloud SQL + service-account exercise in Phase 2 step 4
- (future) a Terraform-on-GCP note, once you've done Phase 2 step 5
