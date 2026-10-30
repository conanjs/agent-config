---
schema: knowledge-doc/v1
type: reference
topic: product-tours
status: draft
applies-to: ["Product Fruits Tours (portal as of 2026-10)", "react-product-fruits 2.x", "product-fruits npm 1.x"]
last-verified: 2026-10-30
last-updated: 2026-10-30
tags: [product-fruits, onboarding, tooltip, settings, api]
---

# Product Fruits settings and API reference

## Summary
**TL;DR:** Lookup tables for every Product Fruits setting a developer meets when adding a tour: React component props, user object fields, tour settings (trigger, targeting, termination, admin tools), card settings with their saved field names, the Tours JavaScript API, and browser events.
**Use this when:** filling in the tour editor, reading a saved tour, writing code that starts or controls a tour, or resetting a tour for testing.
**Not this doc:** how the pieces fit together and why → `product-tours/product-fruits-tours.md`.

## Scope

Covers Product Fruits **Tours** (not Flows, Hints or Checklists) as seen in the portal on 2026-10-30, the `react-product-fruits` 2.x component and the `window.productFruits.api.tours` API. Saved field names come from the tour JSON the portal stores; they are not a documented public contract and can change.

## Catalog

### React component props ✅[^2]

| Prop | Required | Default | Effect |
|---|---|---|---|
| `workspaceCode` | yes | — | Which workspace's content to load |
| `language` | yes | — | Content language; fixed at init ✅[^3] |
| `user` | yes | — | User object (next table); a later change sends `updateUserData` |
| `config.disableLocationChangeDetection` | no | `false` | `false` = the script watches URL changes itself (single-page apps) |
| `config.customNavigation` | no | — | `{ use: true, onGet, navigate }`: own functions for routers the script cannot follow |
| `lifeCycle` | no | `neverUnmount` | `unmount` destroys Product Fruits when the component unmounts |
| `debug` | no | `false` | Logs package actions to the console |

### User object ✅[^7]

| Field | Required | Type | Effect |
|---|---|---|---|
| `username` | yes | string | Unique user id. All tour state is saved per `username` |
| `email`, `firstname`, `lastname` | no | string | Profile fields ✅[^2]. With a two-way sync integration (e.g. HubSpot), send the e-mail as `username` |
| `signUpAt` | no | ISO date string | Sign-up date; usable for "new user" rules |
| `role` | no | string | One role; use `props` for several |
| `props` | no | object of string, number, boolean, or arrays of strings or numbers | Custom fields for targeting rules |
| `hmac` | no | `{ hash, expiration? }` | Identity verification: proves the user is real |
| `group` | no | `{ groupId, props }` | Company/team the user belongs to ✅[^2] |

### Tour settings (portal tour panel) ✅[^8]

| Setting | Options | Effect |
|---|---|---|
| Tour name | free text | Display name; code can find a tour by it |
| Tag | free text | Search label only |
| Status | Draft · Published | Only published tours reach users |
| Triggers → Once per user | — | Starts automatically, once per user |
| Triggers → Always | — | Starts on every matching page load. Portal: "Use this trigger only for single-page tours." |
| Triggers → Manually | — | Never starts alone. Portal: "This tour can be launched through Checklists, the Life Ring Button, or directly via our JavaScript API." |
| Triggers → Scheduled | every N days | Repeats on a schedule, e.g. "every 30 days" |
| Triggers → Custom JavaScript | script | A script in the portal decides. Portal warns to insert only trusted scripts |
| Triggers → On click | CSS selector | Starts on click of an element. Paid tiers, experimental, enabled by support ✅[^4] |
| Targeting → All users | — | Every identified user is eligible |
| Targeting → Segment | saved segment | Only users in the segment |
| Targeting → Custom rules | rules, e.g. "Username equals …" | Inline rules; **Test on user** checks one user; **Users (n)** lists matches |
| Termination | on/off | "Show 'Tour exit confirmation' screen when closing tour" |
| Admin tools → Restart for user | username | Resets one user's state for this tour |
| Admin tools → Restart for all users | — | Resets every user's state for this tour |
| … → Make a copy | — | Duplicate in the same workspace |
| … → Copy to another workspace | target workspace | Duplicate into another workspace (gets a new ID) |
| … → Delete | — | Removes the tour |

### Card settings ✅[^5] ✅[^6]

| Editor setting | Saved field | Values | Effect |
|---|---|---|---|
| Target | `elements[].query` | CSS selector | Element the card points at |
| Page | `url.parametrized` | path, `[dynamic]` = any value | Page where the card may show |
| Display type | `displayType` | `element` · `dialog` | Anchored to a target, or centred |
| Point arrow to target | `cardPosition.arrowToTarget` | boolean | Arrow from card to target |
| Card position | `cardPosition.position` | e.g. `or`, `ol`, `ot`, `ort`, `otr`, `olt` | Side and alignment ⚠️ unverified (codes read from saved tours; meaning inferred) |
| Detached position | `cardPosition` | 9 screen areas | Ignores the target position |
| Card size | `cardPosition.width`, min/max height | px or % | Card dimensions |
| Backdrop | `backdrop.type` | UI: Overlay · None · Boxed · Glow | Layer over the page; saved values seen: `boxed_bg`, `transparent` ⚠️ unverified (UI-to-value mapping) |
| Block clickthrough | `blockedKeys` | seen: `["_pointer-events"]` | Only the card is clickable; offered with every backdrop except Overlay ✅[^6]. Field mapping ⚠️ unverified |
| Advance action | `advanceAction` | Next button · click on target | What moves to the next card |
| Show delay | `showDelayMs` | ms | Delay before the card shows ✅[^8] |
| Advance on hide | `advanceOnHide` | boolean | Move on when the target disappears ✅[^8] |
| Advance if element missing | `advanceIfElMissing` | boolean | Skip the card when the target is missing ✅[^8] |
| Title / footer buttons | `content.title`, `content.footer` | visible, text per language | Built-in title and Skip/Next/Back buttons |
| Body | `content.body.<lang>[]` | rich text or HTML rows | Card content; one HTML row keeps layout under control |

### Tours API: `window.productFruits.api.tours` ✅[^1]

| Member | Signature | Effect |
|---|---|---|
| `getTours` | `() → Tour[]` | Each tour has `id`, `name`, `isRunning`, `currentCard`, `userState` |
| `userState` values | `not_finished` · `finished` · `skipped` | This user's saved state for the tour |
| `tryStartTour` | `(tourId)` | Resets this user to `not_finished`, then starts if rules match |
| `isTourEligible` | `(tourId) → Promise<'eligible' \| 'not_eligible'>` | Rules/segment check; cached briefly |
| `markAs` | `(tourId, 'finished' \| 'skipped', kill = true)` | Sets the state; `kill = false` keeps the card open |
| `advanceToNextStep` | `(tourId)` | Next card; on the last card it finishes the tour ✅[^8] |
| `_goToStep` | `(tourId: number, cardGuid: string)` | Jump to one card |
| `listen` | `(event, callback) → dispose` | Subscribe to a tour event |

### Events

| Event | Where | When |
|---|---|---|
| `productfruits_ready` | `window` | Script loaded; API usable ✅[^2] |
| `productfruits_card_custom_btn_click` | `window`, `detail.id` | A custom card button with action "Execute JavaScript" was clicked ✅[^9] |
| `tour-finished` | `tours.listen` | User finished a tour (not on skip) ✅[^1] |
| `tour-skipped` | `tours.listen` | User skipped a tour ✅[^1] |
| `tour-advanced` | `tours.listen` | A card rendered; second argument has `currentCardId` ✅[^1] |
| `tour-card-completed` | `tours.listen` | User completed a card, e.g. clicked Next ✅[^1] |

### Console helpers

| Command | Effect |
|---|---|
| `window.productFruits.api.validateInstallation()` | Checks the install for common problems ✅[^7] |
| `window.productFruits.api.tours.tryStartTour(id)` | Shows a tour again for the current user (resets state) ✅[^1] |

## Lookup notes
- Tour IDs differ between workspaces; a copied tour gets a new ID. Names can stay the same ✅[^8].
- "Restart for user" needs the app's `username` value, not the user's email or the portal account.
- Saved field names (`blockedKeys`, `cardPosition.position` codes) are internal; read them from a saved tour before relying on them.

## Takeaways
- Use **Manually** + code when the tour must start at a precise moment (after a click or when data is loaded).
- Reset a single tester with **Restart for user**; avoid **Restart for all users** in shared test workspaces.

## Used by
- _Not cited by any rule yet._

## Verification status
- Verified: 24 claims (✅) · Unverified: 3 claims (⚠️) · Last verified: 2026-10-30

## References
- [Tours API](https://help.productfruits.com/en/article/javascript-api-product-tours) — Product Fruits, living. Backs: Tours API, Events (tour-*). [^1]
- [react-product-fruits](https://github.com/product-fruits/react-product-fruits) — Product Fruits, living; v2.2.61 source read locally on 2026-10-30, re-checked against 2.3.0 and `product-fruits` 1.1.0 (npm, 2026-10-30). Backs: component props, `customNavigation`, profile fields, `productfruits_ready`, `group`. [^2]
- [Installation to React or NextJS Applications](https://help.productfruits.com/en/article/developers-integration-react-nextjs) — Product Fruits, living. Backs: `language` fixed at init. [^3]
- [Launching Tours on Element Click](https://help.productfruits.com/en/article/launching-tours-on-element-click) — Product Fruits, living. Backs: On click trigger. [^4]
- [Tour Editor Part 3: How to Position and Size Your Tour Cards](https://help.productfruits.com/en/article/editor-part-3) — Product Fruits, living. Backs: card size, position, Detached. [^5]
- [Tour Editor Part 2: Basic Settings](https://help.productfruits.com/en/article/editor-part-2) — Product Fruits, living. Backs: arrow, backdrop, block clickthrough, advance action. [^6]
- [How to Install Product Fruits](https://help.productfruits.com/en/article/how-to-install-product-fruits) — Product Fruits, living. Backs: user object, `validateInstallation`. [^7]
- Product Fruits portal, Tours editor and saved tour JSON — observed 2026-10-30. Backs: tour settings, saved field names, IDs per workspace, finish on last card. [^8]
- [Custom Buttons and JavaScript Actions](https://help.productfruits.com/en/article/tour-hints-custom-buttons-and-javascript-actions) — Product Fruits, living. Backs: custom button event. [^9]

## Related
- `product-tours/product-fruits-tours.md` — how it works, worked example, edge cases.
