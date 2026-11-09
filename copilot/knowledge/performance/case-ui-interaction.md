---
schema: knowledge-doc/v1
type: case-study
topic: performance
status: verified
applies-to: ["Historical travel-booking frontend case"]
last-verified: 2026-11-07
last-updated: 2026-11-07
tags: [performance, research-synthesis]
---

# Case study: reducing interaction processing work

## Summary
**TL;DR:** Reducing main-thread work improves interaction even when backend metrics do not change. Associated business figures are correlations in the report, not proof that one technique caused the entire effect.
**Use this when:** learning from a sourced production change with explicit limitations.

## Context
A ticket-booking website used real-user data to identify slow interactions. The published Interaction to Next Paint (INP, the delay from interaction to the next paint) report is a real case, not a local measurement. ✅ [Original case](https://web.dev/case-studies/redbus-inp).

## Symptom
The report states an INP of roughly 870–900 ms before optimization and 350–370 ms afterward, with sales increasing about 7%. ✅ [Original case](https://web.dev/case-studies/redbus-inp). No raw experiment is available here to check causal attribution or uncertainty intervals.

## Root cause
Scroll-callback work and the number of results per load kept the main thread busy. The main thread coordinates the interface, like a staff member who both accepts requests and arranges the counter; more work can make customers wait even when the warehouse responds quickly.

## Fix
The team reduced scroll-callback frequency, used requestAnimationFrame to coordinate rendering, and reduced results per load from 30 to 10. ✅ [Original case](https://web.dev/case-studies/redbus-inp). This is a collection of changes, not three independent effect sizes.

## Generalized lesson
Measure input-to-paint by real device and user, while checking the experience of loading fewer results. The [runtime/client catalog](runtime-and-client-performance.md) retains Web Vitals definitions and thresholds; the improved case result still did not meet the good threshold of 200 ms. Do not use the sales figure to forecast another website's outcome.

## Takeaways
- Preserve the case workload and historical context when transferring lessons.
- Measure cross-layer effects; do not infer an optimal decision from a technology name.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 3 claims (✅) · Unverified: 0 claims (⚠️) · Last verified: 2026-11-07

## References
- [redBus improves Interaction to Next Paint](https://web.dev/case-studies/redbus-inp) — web.dev, living. Backs: historical reported context and outcome.
- [Coverage map](performance-map.md) — local entry and evidence policy.

## Related
- [Measurement contract](load-testing-and-regression.md)
