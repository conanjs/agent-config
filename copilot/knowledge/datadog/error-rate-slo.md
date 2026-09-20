# Datadog Error Rate SLO — Knowledge Document

**Context:** Created for `api-portal-frontend` (`ap-frontend` service) to track the Jira task:
> _"Create Error rate SLO — % of sessions/views without JS errors or failed API calls for ne-manage-shipment-frontend / api-portal-frontend"_

---

## What is Datadog?

Datadog is a cloud-based **observability and monitoring platform** — think of it as a hospital monitoring room with screens showing every application's vitals (metrics), recordings of what happened (logs), and request path maps (traces).

### Three Pillars of Observability

| Pillar | What it is | Analogy |
|---|---|---|
| **Metrics** | Numerical time-series data (CPU%, error count, latency) | Car speedometer — continuous readings |
| **Logs** | Timestamped text records of discrete events | Car black box — what happened at exact time |
| **Traces** | End-to-end record of a single request across services | FedEx package tracked through every warehouse |

---

## Key Datadog Products

| Product | Purpose |
|---|---|
| **RUM (Real User Monitoring)** | Browser SDK capturing real user sessions: views, errors, API calls, performance |
| **APM** | Distributed tracing across backend services |
| **Monitors & Alerts** | Rules that fire Slack/PagerDuty notifications when conditions are met |
| **SLOs** | Formal reliability targets with error budgets |
| **Dashboards** | Custom visualization boards |
| **Synthetic Monitoring** | Scheduled automated tests from Datadog infrastructure |

---

## RUM Setup in `api-portal-frontend`

**File:** `instrumentation-client.ts`

```ts
const DATADOG_SITE = 'datadoghq.eu';
const DATADOG_SERVICE_NAME = 'ap-frontend';  // ← service tag in all queries
// env: set from NEXT_PUBLIC_ENV → 'production' in production
// sessionSampleRate: 50  ← only 50% of sessions tracked
// trackResources: true   ← XHR/fetch calls tracked
// trackLongTasks: true
```

**Filtered out (never reaches Datadog):**
- `ResizeObserver loop limit exceeded` errors
- 401 XHR/fetch resource errors (auth noise)

**Packages:** `@datadog/browser-rum` + `@datadog/browser-rum-nextjs`

---

## SLO Concepts

### The Mental Model

```
Reality:      Some % of views will always have errors
                          │
SLI (Indicator):  Measure it → "error-free view rate" = 95.22% (observed baseline)
                          │
SLO (Objective):  Set a target → "must stay ≥ 95%"
                          │
Error Budget:     How much failure is allowed → 5% of views can fail
                          │
Burn Rate Alert:  How fast you're consuming the budget → alert at 2×
```

### Key SLO Terms

| Term | Meaning | Example |
|---|---|---|
| **SLI** | Service Level Indicator — the measured metric | Error-free view rate = 95.22% |
| **SLO** | Service Level Objective — the target | Must stay ≥ 95% |
| **SLA** | Service Level Agreement — contractual SLO with penalties | < 95% triggers a refund |
| **Error Budget** | How much failure is allowed before breaching SLO | 5% of views can fail |
| **Burn Rate** | How fast the error budget is being consumed | 2× = consuming twice as fast as sustainable |

### Two SLO Types in Datadog

| Type | How it works | Best for |
|---|---|---|
| **Monitor-based** | % of time a monitor is in OK state | Simple up/down checks |
| **By Count (Metric-based)** | `Good Events ÷ (Good Events + Bad Events) × 100` | Error rate, availability — **use this** |

---

## Available RUM Metrics (Verified via Datadog Metrics Explorer)

Metrics are named `rum.measure.view.*`, not `rum.view.*`:

| Metric | Type | What it represents |
|---|---|---|
| `rum.measure.view` | count-able event | The view event itself — use `sum(...).as_count()` to get total view count |
| `rum.measure.view.error_free` | 0 or 1 per view | 1 = no JS errors in that view, 0 = had errors |
| `rum.measure.view.time_spent` | duration per view | Time spent on the view (workaround for total view count via `count`, superseded — see below) |
| `rum.measure.view.crash_free` | 0 or 1 per view | 1 = no crash in that view |
| `rum.measure.view.slow_rendered` | 0 or 1 per view | 1 = view rendered slowly |
| `rum.measure.view.largest_contentful_paint` | duration (ns) per view | LCP — Core Web Vital, loading performance |
| `rum.measure.view.cumulative_layout_shift` | unitless score per view | CLS — Core Web Vital, visual stability |
| `rum.measure.view.interaction_to_next_paint` | duration (ns) per view | INP — Core Web Vital, responsiveness |
| `rum.measure.view.first_contentful_paint` | duration (ns) per view | FCP — first paint timing |

**To find metrics:** Metrics → Explorer → type `rum.measure.view` → autocomplete shows all available. Always verify the exact metric name exists for your account before using it (naming can vary slightly by Datadog RUM SDK version).

### ⚠️ Correction — Preferred Denominator Metric

**Originally used:** `count:rum.measure.view.time_spent{...}` as a workaround for "total views" (every view has a `time_spent` sample, so counting records approximates total view count).

**Now confirmed available and preferred:**
```
sum:rum.measure.view{service:ap-frontend,env:production}.as_count()
```

`rum.measure.view` is the **direct, official view-count metric** — it counts the view event itself, not an indirect proxy like a timing field. Use this instead of `time_spent` wherever available.

**Updated Bad Events formula:**

| Query | Metric | Aggregation | Meaning |
|---|---|---|---|
| **a** | `rum.measure.view` | `sum` → `as_count()` | Total views (direct, official) |
| **b** | `rum.measure.view.error_free` | `sum by (everything)` | Error-free view count |
| **Formula** | `a - b` | — | Total views − error-free views = errored views |

Both approaches produce the same result when `time_spent` is recorded on every view — but `rum.measure.view` is more semantically correct and should be preferred going forward.

---

## Observed Baseline (Aug 2026)

From RUM → Summary → Frontend Errors for `ap-frontend`:
- **2.05K total views** over 2 weeks
- **4.78% error rate** = ~98 errored views
- **95.22% error-free rate** — this is the baseline for SLO target setting
- Top errors: `TypeError: Cannot read properties of undefined (reading 'M_ID')` (176 occurrences), CSP violations

**Rule for target setting:** Set SLO target *slightly below* current baseline. Setting 99.9% when you're at 95.22% means immediate breach.

---

## Error-Free View Rate SLO — Configuration

### SLO Type
**"By Count"** (metric-based ratio)

Datadog formula: `Good Events ÷ (Good Events + Bad Events) × 100`

### Good Events (Numerator) — Error-Free Views

| Field | Value | Rationale |
|---|---|---|
| Metric | `rum.measure.view.error_free` | 1 per error-free view, 0 per errored view |
| Aggregation | `sum by (everything)` | Sum of 1s = count of error-free views |
| From | `service:ap-frontend`, `env:production` | Scope to production only |

### Bad Events (Denominator-side) — Errored Views

No single metric for "errored views" exists, so use two queries + formula:

| Query | Metric | Aggregation | Meaning |
|---|---|---|---|
| **a** | `rum.measure.view` | `sum` → `as_count()` | Total views (direct, official metric) |
| **b** | `rum.measure.view.error_free` | `sum by (everything)` | Error-free view count |
| **Formula** | `a - b` | — | Total views − error-free views = errored views |

**Why `rum.measure.view` for total views?**
It's the direct, official metric for the view event itself. `sum:rum.measure.view{*}.as_count()` counts every view record. This replaced the earlier `count:rum.measure.view.time_spent` workaround once confirmed available — prefer this going forward as it's more semantically correct (not an indirect proxy via a timing field).

### Target & Time Window

| Field | Value | Rationale |
|---|---|---|
| **Rolling time window** | `30 Days` | Industry standard; 7 days too short — single bad day skews result |
| **Target** | `95%` | Matches ~95.22% observed baseline; avoids immediate breach |
| **Warning** | `96%` | Early warning before hitting hard target |

---

## Deep Dive: Step 1 vs Step 2 — What's the Difference?

**Analogy: a speed limit sign on a road.**

| Step | Role | Analogy |
|---|---|---|
| **Step 1 — Measurement (SLI)** | Defines *what you're measuring* and *how to calculate it* | Installing a speedometer — measures current speed |
| **Step 2 — Target & Time Window** | Defines *what value is acceptable* and *over what time period* | The speed limit sign — "stay under 60 km/h" |

Step 1 answers: **"What is the number right now?"**
Step 2 answers: **"What number must it stay above, and for how long?"**

Without Step 2, you have a metric but no commitment. Step 2 is where the SLO becomes an actual *objective*.

---

## Deep Dive: What Does "Target" Actually Target?

The target is the **minimum acceptable value of your SLI** over the chosen time window.

Your SLI (from Step 1) computes: `error_free_views / total_views × 100` = currently ~95.22%

Your target of `95%` means:
> **"I commit that at any moment, looking back over the last 30 days, at least 95% of page views must have been error-free."**

If the live number drops below 95% → SLO is **breaching** → alerts fire → team acts.

---

## Deep Dive: Rolling Time Window

### Rolling = always looking backwards from right now

**Analogy:** Imagine a 30-day window as a physical magnifying glass you hold up to a calendar. As today moves forward, the glass moves with you — always showing the last 30 days, never a fixed calendar month.

```
Today = Aug 19  → window covers: Jul 20 → Aug 19
Tomorrow = Aug 20 → window covers: Jul 21 → Aug 20  (Jul 20 drops off)
```

The window slides forward continuously. Events older than 30 days stop counting. New events today count immediately.

### Rolling vs Calendar Month

| Type | Window | Resets |
|---|---|---|
| **Rolling 30 days** | Always: today minus 30 days | Never — continuously slides |
| **Calendar month** | Aug 1 → Aug 31 | Resets to 100% on Sep 1 |

**Why rolling is better:** Calendar month creates a false safety — a disaster on Aug 30 only affects you for 1 day before the window resets. Rolling 30 days means a bad incident stays in the window for a full 30 days → honest accountability.

---

## Deep Dive: Warning Threshold

**Analogy:** A car fuel gauge. The target is "don't run out of fuel." The warning threshold is the orange low-fuel light — it fires *before* you actually run out, giving you time to stop at a petrol station.

```
Healthy (green):    ≥ 96%   ← all good
Warning (orange):   95–96%  ← early signal, investigate now
SLO breach (red):   < 95%   ← commitment broken, urgent action needed
```

The warning fires when you're approaching the target but haven't crossed it yet — gives you time to act before the hard breach.

---

## Scenario Examples — Making It Concrete

### Scenario 1: Normal — SLO holding
```
Days 1-30: 95.5% of views are error-free
Target: 95%

SLI:    95.5%  ────────────────────────  ← green
Target: 95.0%  - - - - - - - - - - - -  ← line

Result: ✅ SLO met. Error budget = 5%, used 4.5%, 0.5% remaining.
```

### Scenario 2: Bad deploy on Day 15
```
Days 1-14:  98% error-free (healthy)
Day 15:     30% error-free (bad deploy for 2 hours)
Days 16-30: 98% error-free (fixed)

Total views: 2000
Errored views: ~200 from bad deploy
SLI: 1800/2000 = 90%

Target: 95%

Result: ❌ SLO BREACHING. 90% < 95%.
The bad 2-hour window drags the 30-day SLO below target for the next 30 days.
```

This is why rolling matters — the bad deploy doesn't "go away" after the day ends. It stays in the window for 30 days.

### Scenario 3: How the rolling window self-heals
```
Day 15:         Bad deploy → SLO breaches at 90%
Days 16-44:     98% error-free → slowly recovering
Day 45:         Day 15 slides OUT of the 30-day window → SLO recovers above 95%
```

The SLO heals as bad events age out — as long as no new incident occurs.

### Scenario 4: Warning threshold saves you before breach
```
Days 1-20:  95.8% error-free (healthy)
Day 21:     Errors creep up → SLI drops to 95.3%

Warning threshold: 96%
→ WARNING fires at 95.3% (still above 95% target but trending down)

Team investigates and fixes the issue.
Days 22-30: Back to 97% error-free → SLO never breached.
```

Warning gave 1% of headroom to catch and fix the issue before it became a formal breach.

---

## Error Budget — Practical Numbers for ap-frontend

With `95%` target over `30 days` and ~4,100 views/month:

```
Total allowed errored views = 5% × 4,100 = 205 views
Current burn rate           = 4.78% × 4,100 = ~196 views errored/month

Remaining budget = 205 - 196 = ~9 views left before breaching
```

**Updated Aug 20:** Error rate jumped to 5.85% → ~244 errored views/month → already exceeding the 209 budget → **SLO actively breaching**. Root cause: CSP `script-src` violation (172 occurrences, active). Must fix before SLO can hold.

**Conclusion:** The TypeErrors and CSP violations observed must be fixed to create more headroom. Once resolved, tighten the target to 97% in a future iteration.

---

## Deep Dive: Error Budget — How It Is Calculated

Error budget is **not set manually**. It is the mathematical consequence of your SLO target.

### Formula

```
Error Budget % = 100% - SLO Target %
               = 100% - 95%
               = 5%
```

Translated to actual view counts:
```
Total views in 30 days ≈ 4,180 views

Error Budget (views) = 5% × 4,180 = 209 views allowed to fail
```

### What "% of budget consumed" means in the alert

The Error Budget monitor asks: "alert when X% of the budget is consumed." This is NOT X% of total views — it's X% of the budget itself:

```
Budget = 209 views

"Alert if 5% of budget consumed"  → 5%  × 209 = ~10 views errored  → fires almost immediately (too sensitive)
"Alert if 50% of budget consumed" → 50% × 209 = ~104 views errored → halfway gone, investigate
"Alert if 90% of budget consumed" → 90% × 209 = ~188 views errored → almost breaching, urgent
```

### Error Budget = Bad Events consuming it

Every errored view (bad event) consumes one unit of budget:

```
Analogy: Budget is a jar with 209 coins.
Every errored page view removes one coin.
When jar is empty → SLO has breached.
```

| State | Views errored | Budget consumed | Status |
|---|---|---|---|
| Healthy | 0–104 | 0–50% | 🟢 Green |
| Warning | 104–188 | 50–90% | 🟡 Investigate |
| Alert | 188–209 | 90–100% | 🔴 Act now |
| Breach | > 209 | > 100% | ❌ SLO broken |

### Recommended alert thresholds

| Alert field | Value | Rationale |
|---|---|---|
| **Alert if** | `90` % of budget consumed | Almost out — urgent action needed |
| **Warn if** | `50` % of budget consumed | Halfway through — start monitoring closely |

---

## SLO Monitor — Alert Types Explained

After creating the SLO, Datadog offers two monitor types:

### Error Budget Monitor
Fires when a **cumulative % of the budget has been consumed** over the full 30-day window.
- Simpler, more intuitive
- Good for: "how much of my monthly allowance is gone?"
- Recommended for teams starting with SLOs

### Burn Rate Monitor
Fires when the **rate of budget consumption is too fast** — even if total consumed is still low. Catches fast-moving incidents earlier than Error Budget.

#### How Burn Rate is Calculated

```
Burn Rate = current error rate over window / SLO error budget %

Example: SLO target = 95%, budget = 5%
If current error rate = 71.4% over the last 1h:
  Burn Rate = 71.4% / 5% = 14.28× ≈ 14.4 → alert fires
```

**Analogy:** 30-day mobile data plan with 10GB:
- Burn rate 1×    = using data at exactly the pace that uses all 10GB in 30 days → sustainable
- Burn rate 6×    = double+ speed → 10GB gone in ~5 days → warning
- Burn rate 14.4× = 10GB gone in ~2 days → urgent alert

Applied to ap-frontend (budget = 5% of 4,180 views = 209 views):

| Burn rate | Error rate that triggers it | Budget gone in | Action |
|---|---|---|---|
| 1× | ~5% error rate | 30 days | Normal, no alert |
| 6× | ~30% error rate over last 1h | ~5 days | Warn |
| 14.4× | ~72% error rate over last 1h | ~2 days | Alert |

#### The Dual Window — Why `1h` AND `5m`

```
Evaluate the last [1h] and the last [5m]
```

Datadog requires **both** windows to exceed the threshold before firing. This prevents two failure modes:

| Problem | Solution |
|---|---|
| Only 1h window: 5-minute spike doesn't move 1h average → miss fast incidents | Add 5m short window to catch sudden spikes |
| Only 5m window: single noisy minute causes false alarm | Require both to agree → confirms real incident, not a blip |

**Rule:** Alert fires only when `1h burn rate ≥ threshold` AND `5m burn rate ≥ threshold`.

#### Burn Rate Recommended Thresholds

| Field | Value | Rationale |
|---|---|---|
| **Evaluate last** | `1` h and last `5m` | Keep defaults — dual window |
| **For** | `30-day target (primary)` | Keep default |
| **Alert when both burn rates are** | `14.4` or more | Budget gone in 2 days — immediate action |
| **Warn if they are** | `6` or more | Budget gone in 5 days — investigate before escalating |

---

## SLO Monitor — Notification Message Template & Mechanism

### Monitor Name
```
[RUM] ap-frontend — Error-Free View Rate Alert
```

### How the Template Works — Mechanism

Datadog monitor messages use **Mustache-style conditional templating**. The message has three blocks — Datadog evaluates the current monitor state and renders only the matching block.

```
{{#is_alert}}   ... {{/is_alert}}    ← renders ONLY when state = ALERT
{{#is_warning}} ... {{/is_warning}}  ← renders ONLY when state = WARNING
{{#is_recovery}}... {{/is_recovery}} ← renders ONLY when state = RECOVERY (back to OK)
```

**Analogy:** It's an if/else in code:
```js
if (state === 'alert')    → send the red 🔴 block
if (state === 'warning')  → send the yellow 🟡 block
if (state === 'recovery') → send the green ✅ block
```

Only one block fires per notification event. Each state transition triggers exactly one message.

### State Machine

```
              errors increase
    OK ──────────────────────► WARNING
    │                              │
    │ errors increase more         │ errors increase more
    │                              ▼
    └──────────────────────────► ALERT
                                   │
           errors decrease         │
    RECOVERY ◄─────────────────────┘
    (back to OK)
```

- OK → WARNING → only `{{#is_warning}}` fires
- OK → ALERT (skipping WARNING) → only `{{#is_alert}}` fires
- ALERT → OK → only `{{#is_recovery}}` fires

### Template Variables Injected at Runtime

| Variable | What Datadog injects |
|---|---|
| `{{value}}` | The actual current metric value when alert fired (e.g., `94.2`) |
| `{{threshold}}` | The threshold that was crossed (e.g., `95` for alert, `96` for warning) |
| `{{event.url}}` | Direct URL to the event details page for this specific alert |

### The `@mention` Routing

```
**Attention:** @googlechat-ecom1-so-monitoring-alert
```

The `@` prefix is a **routing directive** — tells Datadog where to deliver the notification (Google Chat, Slack, PagerDuty). The handle must match a configured integration under Datadog → Integrations.

---

### Full Message Template

Based on team pattern. Adapted for `ap-frontend` error-free view rate SLO:

```
{{#is_alert}}
🔴 **[ALERT] High SLO Error Budget Consumption!** 🚨

**Service:** `ap-frontend`
**SLO:** `[RUM] ap-frontend — Error-Free View Rate`

📝 **Description & Impact**
The system detected an abnormal increase in **JS errors / errored page views**, which is rapidly consuming the 30-day SLO Error Budget.
* **SLO Target:** 95% error-free views
* **Current Value:** `{{value}}`  (Threshold: `{{threshold}}`)
* **Impact:** If this rate continues, the 30-day SLO target will be **violated**.

🛠️ **Required Actions**
1. Check RUM → Frontend Errors for `ap-frontend` in production.
2. Identify top error types (CSP violations, TypeErrors, React errors).
3. Check recent deployments in RUM → Deployments for correlation.
4. Fix or suppress known noise errors (CSP eval, ResizeObserver).

🔗 **Links**
* 📈 [RUM Frontend Errors](https://app.datadoghq.eu/rum/performance-monitoring?query=%40type%3Aerror%20%40service%3Aap-frontend%20%40env%3Aproduction)
* 🔔 [Event Details]({{event.url}})
* 📊 [SLO Dashboard](https://app.datadoghq.eu/slo)

**Attention:** @googlechat-ecom1-so-monitoring-alert
{{/is_alert}}

{{#is_warning}}
🟡 **[WARNING] Elevated SLO Error Budget Consumption!**

**Service:** `ap-frontend`
**SLO:** `[RUM] ap-frontend — Error-Free View Rate`

📝 **Description**
The error budget consumption is currently elevated. Monitor closely to prevent SLO breach.
* **Current Value:** `{{value}}`  (Threshold: `{{threshold}}`)

🔗 **Links**
* 📈 [RUM Frontend Errors](https://app.datadoghq.eu/rum/performance-monitoring?query=%40type%3Aerror%20%40service%3Aap-frontend%20%40env%3Aproduction)

**Attention:** @googlechat-ecom1-so-monitoring-alert
{{/is_warning}}

{{#is_recovery}}
✅ **[RECOVERED] SLO Error-Free View Rate is back to normal!** 🎉

**Service:** `ap-frontend`
**SLO:** `[RUM] ap-frontend — Error-Free View Rate`

📝 **Status Update**
The error budget consumption has dropped below the alert threshold and the system is stabilizing.

**Attention:** @googlechat-ecom1-so-monitoring-alert
{{/is_recovery}}
```

### Name and Tags

| Field | Value |
|---|---|
| **Name** | `[RUM] ap-frontend — Error-Free View Rate` |
| **Description** | `% of page views for ap-frontend (api-portal-frontend) with no JS errors. Good = sum(rum.measure.view.error_free). Bad = sum(rum.measure.view).as_count() - sum(rum.measure.view.error_free). Rolling 30-day window.` |
| **Tags** | `service:ap-frontend`, `env:production` |

---

## Views-Based vs Sessions-Based Decision

| Basis | Formula | Chose? |
|---|---|---|
| **Views-based** ✅ | `(views without error) / total views` | Yes — more granular, one bad page ≠ one bad session |
| Sessions-based | `(sessions without error) / total sessions` | No — one error in session counts entire session as bad |

---

## After Creating the SLO — Burn Rate Alert

After saving, click **"Create & Set Alert"** to open the SLO Monitor page. See "SLO Monitor — Alert Types Explained" and "SLO Monitor — Notification Message Template" sections above for full configuration.

---

## Future SLO — API Call Success Rate

The Jira task also mentions "failed API calls". Create a second SLO:

| Field | Value |
|---|---|
| **Good Events** | `rum.measure.resource.success` or resource calls with status < 400 |
| **Bad Events** | Resource calls with status >= 400 (401s already filtered in `beforeSend`) |
| **Target** | ~`90%` (resource error rate was high in observed data) |
| **Name** | `[RUM] ap-frontend — API Call Success Rate` |

---

## Core Web Vitals SLOs — LCP, CLS, INP

### Do these have native/built-in Datadog RUM metrics?

**Yes.** Datadog RUM Browser SDK automatically captures Core Web Vitals per view as first-class metrics (same family as `rum.measure.view.error_free`):

| Web Vital | Datadog metric | What it measures |
|---|---|---|
| **LCP** (Largest Contentful Paint) | `rum.measure.view.largest_contentful_paint` | Loading performance — time until largest visible element renders |
| **CLS** (Cumulative Layout Shift) | `rum.measure.view.cumulative_layout_shift` | Visual stability — unitless score of unexpected layout shifts |
| **INP** (Interaction to Next Paint) | `rum.measure.view.interaction_to_next_paint` | Responsiveness — delay between user interaction and next visual update |
| FCP (First Contentful Paint) | `rum.measure.view.first_contentful_paint` | Time to first pixel painted |

These are the same metrics shown in RUM → Summary → **"Optimize Vitals"** panel (Loading Time, LCP, FCP, CLS, INP charts observed earlier for `ap-frontend`).

**Always verify exact metric names in Metrics Explorer** (`rum.measure.view.largest`, `rum.measure.view.cumulative`, `rum.measure.view.interaction`) before building the SLO — naming can vary slightly by RUM SDK version.

### Official Google Core Web Vitals Thresholds (Good / Needs Improvement / Poor)

| Web Vital | Good | Needs Improvement | Poor |
|---|---|---|---|
| LCP | ≤ 2.5s | ≤ 4s | > 4s |
| CLS | ≤ 0.1 | ≤ 0.25 | > 0.25 |
| INP | ≤ 200ms | ≤ 500ms | > 500ms |

Use the **"Good"** threshold as the SLO's uptime condition.

### SLO Type: "By Time Slices" — Why This, Not "By Count"

Web Vitals are **continuous duration/score values per view**, not a pre-computed binary "good/bad" flag like `error_free`. Datadog's **"By Time Slices"** SLO type is built for exactly this: it evaluates an **aggregated value (e.g. p75) over fixed time windows** against a threshold, and each window counts as "up" (good) or "down" (bad) — like traditional infrastructure uptime, but applied to a percentile metric.

```
Formula (conceptual): % of 5-minute time slices where p75(metric) <= threshold
```

**Analogy:** Instead of asking "was each individual page load good or bad?" (per-event, like error_free), it asks "during each 5-minute window, was the typical (p75) experience acceptable?" — smoothing out single-view noise while still catching sustained degradation.

### Why Time Slices vs By Count Here

| | By Count (used for error rate) | By Time Slices (used for Web Vitals) |
|---|---|---|
| Input | Binary good/bad per event (`error_free` = 0 or 1) | Continuous value per event (LCP in ms, CLS score) |
| Aggregation | Sum of 1s | Percentile (p75) per time slice, compared to threshold |
| Best for | Events with clear pass/fail per occurrence | Metrics needing percentile-based SLA (e.g. "75% of experiences load in under 2.5s") |

### Example Configuration — P75 INP SLO (from observed screenshot)

| Field | Value |
|---|---|
| **SLO Type** | By Time Slices |
| **Metric** | `rum.measure.view.interaction_to_next_paint` |
| **From** | `application.id:<app-id>` |
| **Aggregation** | `p75 by (everything)` |
| **Uptime condition** | value `<=` `200000000` nanoseconds (= 200ms, the "Good" INP threshold) |
| **Time slice size** | `5 Minute` |
| **Rolling time window** | `30 Days` |
| **Target** | `98%` |
| **Warning** | `99.95%` (default, can tune) |
| **Name** | `[API-PORTAL] [api-portal-frontend] P75 Interaction To Next Paint (INP)` |
| **Services** | `ap-frontend` |
| **Tags** | `api-portal`, `api-portal-frontend`, `core-web-vital`, `env:prod` |

**Note on units:** Datadog stores duration metrics in **nanoseconds**. `200ms = 200,000,000 ns`. Double-check the unit dropdown next to the threshold field (shows `nanoseconds` in the screenshot) matches what you intend.

### Parallel Configuration — P75 LCP SLO

| Field | Value |
|---|---|
| **Metric** | `rum.measure.view.largest_contentful_paint` |
| **Aggregation** | `p75 by (everything)` |
| **Uptime condition** | value `<=` `2500000000` nanoseconds (= 2.5s) |
| **Time slice size** | `5 Minute` |
| **Target** | `95%` (adjust to baseline — LCP was in "Needs Improvement" zone for some pages per earlier RUM screenshot) |
| **Name** | `[API-PORTAL] [api-portal-frontend] P75 Largest Contentful Paint (LCP)` |

### Parallel Configuration — P75 CLS SLO

| Field | Value |
|---|---|
| **Metric** | `rum.measure.view.cumulative_layout_shift` |
| **Aggregation** | `p75 by (everything)` |
| **Uptime condition** | value `<=` `0.1` (unitless score, no nanoseconds conversion needed) |
| **Time slice size** | `5 Minute` |
| **Target** | `98%` (CLS was observed at `0.0000` — very stable — so a tight target is safe) |
| **Name** | `[API-PORTAL] [api-portal-frontend] P75 Cumulative Layout Shift (CLS)` |

### Monitor for Time-Slices SLOs

Same "Error Budget" / "Burn Rate" monitor options apply as for count-based SLOs (see earlier sections) — attach a burn rate alert the same way, scoped to the Web Vital SLO instead of the error-free view rate SLO.

---

## Navigation Quick Reference

| Goal | Path |
|---|---|
| View RUM summary | Digital Experience → RUM → ap-frontend → Summary |
| View frontend errors | Digital Experience → RUM → ap-frontend → Frontend Errors |
| Explore RUM metrics | Metrics → Explorer → type `rum.measure.view` |
| Create SLO | Service Mgmt → SLOs → New SLO (or `app.datadoghq.eu/slo/new`) |
| View existing SLOs | Service Mgmt → SLOs |

---

## References

### Local Artifacts
- `api-portal-frontend/instrumentation-client.ts` — Datadog RUM initialization (service name, env, filters)
- `api-portal-frontend/config/env-variables.ts` — `NEXT_PUBLIC_DATADOG_APPLICATION_ID`, `NEXT_PUBLIC_DATADOG_CLIENT_TOKEN`, `NEXT_PUBLIC_ENV`
- `ne-manage-shipment-frontend/src/shared-frontend/shared/configs/browserRum.ts` — Equivalent RUM init for ne-frontend service

### External Sources
- [Datadog SLO Documentation](https://docs.datadoghq.com/service_management/service_level_objectives/)
- [Datadog RUM Browser SDK](https://docs.datadoghq.com/real_user_monitoring/browser/)
- [Datadog Metric-based SLO](https://docs.datadoghq.com/service_management/service_level_objectives/metric/)
- [Datadog RUM Metrics Reference](https://docs.datadoghq.com/real_user_monitoring/browser/monitoring_page_performance/)
- [Datadog Burn Rate Alerts](https://docs.datadoghq.com/service_management/service_level_objectives/burn_rate/)
- [Datadog SLO — By Time Slices](https://docs.datadoghq.com/service_management/service_level_objectives/time_slice/)
- [Datadog RUM Core Web Vitals](https://docs.datadoghq.com/real_user_monitoring/browser/monitoring_page_performance/#core-web-vitals)
- [web.dev — Core Web Vitals thresholds (Google)](https://web.dev/articles/vitals)

---

## Related

- `{{AGENT_HOME}}/knowledge/gcp/roadmap.md` — GCP infrastructure knowledge
- Jira task: "Create Error rate SLO — % of sessions/views without JS errors or failed API calls (similar to backend availability) for ne-manage-shipment-frontend"

---

## Reading the Live SLO — Status, Error Budget, and Monitor Explained

### SLO Status: 94.2% with Error Budget: -14%

**Status 94.2% < target 95% → SLO is actively breaching.** The 30-day rolling window has accumulated too many errored views.

**Error Budget -14% → budget is gone and in debt.**

How -14% is calculated:
```
Budget:            5% of 2.08K views = ~104 views allowed to fail
Actual bad events: ~120 errored views (red bars in Good/bad events chart)

Budget consumed = 120 / 104 = 115%
Budget LEFT     = 100% - 115% = -15% ≈ -14% displayed (-14.6 reqs = 14.6 views over limit)
```

**Analogy:** Monthly data plan allowed 10GB. You used 11.4GB. You're -1.4GB in deficit. The number goes negative because you kept spending after the jar was empty.

The **Error Budget Burndown** graph shows:
- Starts at 100% (Jul 26 — full budget)
- Drops steadily from Aug 9 when errors spiked
- Crosses the red "out of budget" line and goes below 0
- Burn Rate chart confirms peaks of **16.67×, 15.56×, 18.75×** — all above the 14.4× alert threshold

---

### Why Monitor Shows "OK" While SLO is Breaching — Not a Contradiction

They measure completely different time scopes:

| | SLO | Burn Rate Monitor |
|---|---|---|
| **Looks at** | Cumulative 30 days of history | Only the last **1h** AND last **5m** right now |
| **Question it answers** | "Has the 30-day commitment been kept?" | "Is the error rate dangerously high **right now**?" |
| **Aug 20 answer** | No — 94.2% < 95% (past damage) | Yes — burn rate is low at this moment |

**Analogy:** You overspent your monthly budget last week (SLO breaching). But right now today you're not spending anything (Monitor OK). Both statements are simultaneously true.

The monitor fires only when **both** 1h and 5m burn rates exceed `14.4×`. Those spikes happened Aug 9-16. The monitor was created Aug 20 — it never saw those past spikes. Current burn rate is settled → OK.

`0 sent to recipients` confirms: monitor hasn't fired since creation because current burn rate is below 14.4×.

---

### How the SLO Self-Heals

The SLO will not recover until Aug 9-16 bad events **age out of the 30-day rolling window**:

```
Bad events from Aug 9  → drop out of window on Sep 9
Bad events from Aug 16 → drop out of window on Sep 16

If no new errors occur, SLO recovers to ~95%+ by mid-September.
```

**Fastest recovery path:** Fix the top errors (CSP script-src, TypeError M_ID) → fewer bad events going forward → error rate drops → SLO climbs back above 95% sooner.

---

### Monitor Created After the Incident — Expected Behavior

The burn rate monitor was created **after** the incident window (Aug 9-16). Going forward, if errors spike again to those levels (burn rate > 14.4×), the monitor will correctly fire. The setup is correct — it was just created retrospectively. Future incidents will be caught in real time.
