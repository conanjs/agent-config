---
schema: knowledge-doc/v1
type: concept
topic: product-tours
status: draft
applies-to: ["Product Fruits Tours (portal as of 2026-10)", "react-product-fruits 2.x", "product-fruits npm 1.x"]
last-verified: 2026-10-30
last-updated: 2026-10-30
tags: [product-fruits, onboarding, tooltip, product-tour, react, nextjs]
---

# Product Fruits tours in a React or Next.js app

## Summary
**TL;DR:** Product Fruits is a hosted onboarding tool. Content (tours, cards, rules) is built in its web portal; the app only loads a script, sends a unique `username`, and optionally starts tours from code. Product Fruits remembers per `username` whether each tour was finished, so "show once per user" needs no storage in the app.
**Use this when:** adding a tooltip or product tour with Product Fruits, starting a tour from code, debugging why a tour does not show or shows again, or resetting a tour for testing.
**Not this doc:** every setting, API method and event as a lookup table → `product-tours/product-fruits-settings-and-api.md`.

## Problem

Teams expect a tooltip to be "a component in our code". With Product Fruits it is not. The content, the target element and the "who has seen it" memory all live outside the app. Without that model, people make three common mistakes:

- They store "seen" flags in `localStorage` that duplicate (and disagree with) Product Fruits' own memory.
- They call the start function on every visit and wonder why the tour never stops showing.
- They rename a page element and silently break a tour that points at it.

## Mental model

**Analogy:** a shop with a visiting guide. The head office (the portal) writes the guide's talk and says which shelf to point at. Each morning the guide arrives (the script loads) and asks your name at the door (the `username`). The guide keeps a notebook of who already heard each talk (per-user tour state). Next visit, the guide reads the notebook and leaves you alone. The shop manager (your code) can also say "give the talk now" — but saying that also erases your name from that page of the notebook.

**Artifact:** the whole app-side integration is one component plus an optional start call:

```tsx
// Load once, browser only
<ProductFruits
  workspaceCode={process.env.NEXT_PUBLIC_PF_WORKSPACE_CODE}
  language="en"
  user={{ username: currentUser.id, email: currentUser.email, props: { plan: 'pro' } }}
/>

// Optional: start a "manual" tour at the right moment
const tours = window.productFruits.api.tours;
const tour = tours.getTours().find((t) => t.name === 'Feature X intro');
if (tour?.userState === 'not_finished') tours.tryStartTour(tour.id);
```

## How it works

**4 actors:**
- **Portal** — its job: store tours, cards and rules, via the Product Fruits web editor.
- **App** — its job: load the script and identify the user, via the `react-product-fruits` component.
- **Script** — its job: decide and render cards in the page, via `window.productFruits`.
- **Service** — its job: return tour content and save each user's tour state, via Product Fruits' servers.

**Diagram:**

```
[Portal — remote]      [App — browser]              [Script — browser]            [Service — remote]
 build tour, publish
        │
        └──────────── stored on Product Fruits servers ─────────────────────────────▶ tour content
                        <ProductFruits user=…/>
                          │ adds <script src=app.productfruits.com/static/script.js>
                          │ pushes ['init', workspace, language, user]
                          └──────────────────────▶ script loads
                                                     │ ══════ network ══════
                                                     └──────────────────────────▶ content + this
                                                                                    user's states
                                                     ◀──────────────────────────────┘
                                                     fires `productfruits_ready`
                        your code: getTours(),
                        check userState, tryStartTour(id)
                          └──────────────────────▶ finds target by CSS selector,
                                                     renders card
                                                     user clicks Finish/OK
                                                     │ ══════ network ══════
                                                     └──────────────────────────▶ save "finished"
```

**Steps:**

1. **Portal:** an author creates a tour, sets its trigger, targeting and cards, then publishes. A new tour starts as an unpublished draft ✅[^8].
2. **App (local):** the component mounts in the browser only. The npm package throws if it runs on the server, so Next.js must load it client-side (`next/dynamic` with `ssr: false`) ✅[^2].
   - It adds a `<script>` tag for `https://app.productfruits.com/static/script.js` ✅[^2].
   - It queues `init` with the workspace code, language and user object ✅[^2].
3. **Script → Service (network):** the script downloads the workspace's published content and this user's tour states, then sets `window.productFruitsIsReady = true` and fires the `productfruits_ready` window event ✅[^2].
4. **Script (local):** for tours with an automatic trigger, it matches the card's page URL ✅[^8] and the targeting, finds the target element by CSS selector, and shows the card ✅[^5].
5. **App (local), manual tours only:** your code reads `getTours()`, checks the tour's `userState`, and calls `tryStartTour(id)` ✅[^1].
   - `tryStartTour` **resets this user's state to `not_finished`** before starting. It still applies the tour's rules ✅[^1].
6. **Script → Service (network):** when the user finishes or skips, the script saves `finished` or `skipped` for this `username` ✅[^1].
7. **Next visit:** step 3 returns the saved state. An automatic "once per user" tour does not start again; a manual tour starts only if your code ignores the state.

Two more mechanisms matter in practice:

- **User changes:** when the `user` prop changes after mount, the React package sends `updateUserData`; it does not re-initialize ✅[^2]. Language is fixed at init; switching language needs a destroy and re-init ✅[^3].
- **Lifecycle:** by default (`lifeCycle: 'neverUnmount'`) unmounting the component does not remove Product Fruits from the page ✅[^2].

## Worked example

Goal: show a one-card tooltip next to a "Summary" card the first time each user opens a tab.

1. **App:** mark the element with a stable attribute: `<div data-tour="summary-card">`.
2. **Portal:** create tour `Summary card intro`; trigger **Manually**; one card with target `[data-tour="summary-card"]`, position right, backdrop **Boxed**, block clickthrough on (offered with every backdrop except the default Overlay) ✅[^6]; one custom HTML **OK** button; publish.
3. **App:** when the tab becomes active and the user id is known:
   - wait for `productfruits_ready` if `window.productFruits?.api?.tours` is missing;
   - find the tour by name; stop unless `userState === 'not_finished'` and no tour `isRunning`;
   - stop unless `isTourEligible(id)` resolves `eligible`;
   - wait for `[data-tour="summary-card"]` to exist, scroll it to the centre, call `tryStartTour(id)`.
4. **User:** sees the card, clicks OK. The button calls `advanceToNextStep(runningTourId)`; on the last card this finishes the tour, and the service saves `finished` ✅[^8].
5. **Next time:** `getTours()` returns `userState: 'finished'`; step 3 stops. No `localStorage` was needed.

Observed with a real one-card tour on 2026-10-30: the tour showed once, OK closed it, and reopening the tab did not show it again ✅[^8].

## Edge cases

| Case | What happens | Why |
|---|---|---|
| `tryStartTour` called on every visit | Tour shows every time | It resets the user to `not_finished` first ✅[^1] |
| Tour started before the real user id is known | "Seen" is saved for the placeholder/anonymous username, shared by everyone | State is keyed by `username` ✅[^7] |
| `username` not unique per person | Users share one "seen" state | Product Fruits needs a unique identifier per user ✅[^7] |
| Target element renamed or removed | Card has no target; tour does not show or breaks | Cards find targets by CSS selector ✅[^5] |
| Target renders after the start call | Card may not find its element | Wait for the element before starting ⚠️ unverified (exact failure mode depends on card settings) |
| Tour exists only in a test workspace | Nothing shows in production | Workspaces are separate; tour IDs differ per workspace ✅[^8] |
| Code finds tours by hard-coded ID | Breaks when the tour is copied to another workspace | IDs differ per workspace; names can match ✅[^8] |
| Another tour is already running | Starting a second one overlaps or competes | Check `isRunning` on all tours first ⚠️ unverified (exact overlap behaviour not tested) |
| User reloads mid-tour without finishing | A manual-trigger tour is not resumed; state stays `not_finished`, so app code that checks the state starts it again later | Observed 2026-10-30: `tryStartTour` → reload without finishing → `userState: not_finished`, `isRunning: false`, nothing shown ✅[^8] |
| Content Security Policy blocks the script | Nothing loads | Allow `https://*.productfruits.com`, `wss://*.productfruits.com` and `https://productfruits.help/`, plus `data:` images and `blob:` media; integrations such as YouTube need their own ✅[^7] |

## Trade-offs

| Option | Gains | Costs |
|---|---|---|
| Automatic trigger ("Once per user") | No app code | Shows on page load, not at a precise moment; needs URL rules |
| Manual trigger + start from code | Exact timing (e.g. after a tab click, when data is loaded) | App code and tests to maintain |
| "On click" trigger | No code for click-start | Paid tiers, experimental, enabled by support ✅[^4] |
| Built-in buttons | No HTML to maintain | Less control over design |
| Custom HTML card with own buttons | Matches the design system | HTML/CSS lives in the portal, outside code review |

## Takeaways
- Never call `tryStartTour` without first checking `userState === 'not_finished'`; it resets the state. [rule-candidate]
- Start manual tours only after the real user id is known. [rule-candidate]
- Point cards at a dedicated, stable attribute (e.g. `data-tour="…"`), never at generated class names. [rule-candidate]
- Find tours by name in code, not by ID, when the same tour lives in several workspaces.
- Do not store "seen" flags in the app; Product Fruits already stores them per `username`.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 25 claims (✅) · Unverified: 2 claims (⚠️) · Last verified: 2026-10-30

## References
- [Tours API](https://help.productfruits.com/en/article/javascript-api-product-tours) — Product Fruits, living. Backs: How it works 5–6, Edge cases (tryStartTour reset). [^1]
- [react-product-fruits](https://github.com/product-fruits/react-product-fruits) — Product Fruits, living; source of v2.2.61 and `product-fruits` 1.0.27 read locally on 2026-10-30, re-checked against 2.3.0 and 1.1.0 (npm, 2026-10-30): same behaviour. Backs: How it works 2–3, user changes, lifecycle. [^2]
- [Installation to React or NextJS Applications](https://help.productfruits.com/en/article/developers-integration-react-nextjs) — Product Fruits, living. Backs: language fixed at init. [^3]
- [Launching Tours on Element Click](https://help.productfruits.com/en/article/launching-tours-on-element-click) — Product Fruits, living. Backs: Trade-offs ("On click"). [^4]
- [Tours Overview](https://help.productfruits.com/en/article/tours-overview) — Product Fruits, living. Backs: How it works 4, targets by CSS selector. [^5]
- [Tour Editor Part 2: Basic Settings](https://help.productfruits.com/en/article/editor-part-2) — Product Fruits, living. Backs: Worked example 2 (backdrop, block clickthrough). [^6]
- [How to Install Product Fruits](https://help.productfruits.com/en/article/how-to-install-product-fruits) — Product Fruits, living. Backs: unique `username`, state keyed per user, CSP sources. [^7]
- Hands-on test in the Product Fruits portal and a Next.js app, 2026-10-30: new tour is a draft until published, one-card manual tour shows once, OK via `advanceToNextStep` finishes it, tour IDs differ per workspace, and a reload mid-tour leaves a manual tour `not_finished` and not running. [^8]

## Related
- `product-tours/product-fruits-settings-and-api.md` — every setting, API method and event.
- `js-runtime/` — runtime behaviour of browser JavaScript.
