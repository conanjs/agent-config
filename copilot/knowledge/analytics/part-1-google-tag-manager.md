# Google Tag Manager: Setup, Event Tracking, and Verification

> Part of the series: **API Portal Analytics: End-to-End Event Tracking Architecture (GTM → GA4 → BigQuery → Looker)**
> - Part 1: Google Tag Manager: Setup, Event Tracking, and Verification ← you are here
> - Part 2: Google Analytics 4: Event Collection and BigQuery Export Structure
> - Part 3: BigQuery Pipelines: Transforming GA4 Raw Data into KPI Tables
> - Part 4: Looker Studio: KPI Dashboards and Data Source Setup

---

## 1. What is Google Tag Manager?

Google Tag Manager (GTM) is a **tag management system** — a dispatcher that sits between your web application and analytics destinations like Google Analytics 4 (GA4).

**Key mental model:**
> GTM is the **router**, not the database. It receives signals from your app, decides what to do with them based on rules, and forwards them to the right destination.

The app does not talk directly to GA4. It talks to GTM, and GTM decides when and how to forward data to GA4.

---

## 2. Minimal Setup Checklist

For GTM to work on the API Portal, all four of these must be in place:

| # | What | Where | Status |
|---|---|---|---|
| 1 | GTM Container ID configured in app environment | `.env.development` / `.env.production` | ✅ Done |
| 2 | GTM container script loaded on every page | `components/common/GoogleTagManager.tsx` | ✅ Done |
| 3 | A **Trigger** defined in GTM workspace for each event name | GTM → Triggers | ✅ Done per event |
| 4 | A **Tag** defined in GTM workspace pointing to GA4 | GTM → Tags | ✅ Done per event |

If any one of these is missing, the event will not reach GA4.

---

## 3. Core Concepts: Tags, Triggers, Variables

GTM has three building blocks:

### Tag
The **action** GTM performs when triggered.
In this project, all tags are of type **Google Analytics: GA4 Event** — meaning the action is "send this event to GA4."

Example tag name: `[FAQ] Expand FAQ`

### Trigger
The **rule** that decides when a tag should fire.
In this project, all triggers are **Custom Event** triggers — they fire when the `event` field in `dataLayer` matches an exact name.

Example trigger: fires when `event = "[FAQ] Expand FAQ"`

### Variable
A **placeholder** that reads a value from `dataLayer` at the moment the tag fires.
Written as `{{variableName}}` in the GTM UI.

Example: `{{categoryId}}` reads `categoryId` from the pushed `dataLayer` object.

**Relationship summary:**

```
Trigger (when?)  →  Tag (what to do?)  →  Variable (what value to use?)
```

---

## 4. How the App Pushes Events

The app uses a shared utility in `lib/analytics/gtag.ts` to push events.

### Step-by-step

1. Feature code calls `gtag.pushEvent(...)` with an event name and optional data payload.
2. `gtag.pushEvent` calls `pushToGTM(...)` which appends to `window.dataLayer`.
3. GTM (already loaded in browser) monitors `dataLayer` and intercepts the new item.
4. GTM evaluates all Triggers. If one matches, the associated Tag fires.
5. The GA4 Event Tag sends the event to GA4.

### Code example

```typescript
// components/faq/Faq.tsx
gtag.pushEvent(HEAP_EVENTS.FAQ.EXPAND_FAQ, {
  categoryId: category.id,
  categoryName: category.name,
  faqId: faq.id,
  questionText: faq.question,
});
```

This produces the following `dataLayer` push:

```json
{
  "event": "[FAQ] Expand FAQ",
  "user_id": "u12345",
  "ecom_user_id": "u12345",
  "ecom_customer_code": "C001",
  "ecom_customer_country": "SG",
  "categoryId": "shipping",
  "categoryName": "Shipping",
  "faqId": "faq-001",
  "questionText": "How do I track my shipment?"
}
```

> Note: `user_id`, `ecom_user_id`, `ecom_customer_code`, `ecom_customer_country` are automatically merged from `userInfoContext` (set when user logs in via `gtag.pushUserInfo`). Anonymous users will have these fields as `undefined`.

---

## 5. Tag Definition in GTM

Each business event requires one Tag configured in the GTM workspace. Below is the anatomy of a GA4 Event tag.

### Tag Type
`Google Analytics: GA4 Event`

### Measurement ID
The GA4 property/stream identifier. Configured as a GTM variable `{{measurementId}}` so it can be changed without editing every tag.

Format: `G-XXXXXXXXXX`

### Event Name
The exact string that appears as `event_name` in GA4.
Must match the `event` field pushed by the app.

Example: `[FAQ] Expand FAQ`

> ⚠️ Case-sensitive. A mismatch between the app-pushed name and the tag event name means the data is lost.

### Event Parameters
Key-value pairs sent alongside the event. These become queryable fields in the GA4/BigQuery raw export.

| Event Parameter (name in GA4) | Value (read from dataLayer) |
|---|---|
| `categoryId` | `{{categoryId}}` |
| `categoryName` | `{{categoryName}}` |
| `faqId` | `{{faqId}}` |
| `questionText` | `{{questionText}}` |

> `{{categoryId}}` is a GTM Variable that reads `categoryId` from the `dataLayer` push.
> The **left column** is the name GA4 will store; the **right column** is where GTM reads the value from.

### User Properties
Stable user-identity attributes attached to every tag in this project. Their names are fixed; only values are dynamic.

| Property Name | Value (read from dataLayer) |
|---|---|
| `ecom_user_id` | `{{ecom_user_id}}` |
| `ecom_customer_code` | `{{ecom_customer_code}}` |
| `ecom_customer_country` | `{{ecom_customer_country}}` |

> **Event parameters** describe what happened (per-action data).
> **User properties** describe who the user is (stable identity, consistent across events).

### Triggering
Each tag has one Trigger attached. The trigger's Custom Event name must exactly match the `event` field the app pushes.

Example: tag `[FAQ] Expand FAQ` → trigger `[FAQ] Expand FAQ` (Custom Event).

---

## 6. All Tracked Events (API Portal)

| Domain | Event Name (exact string) | Key Parameters |
|---|---|---|
| FAQ | `[FAQ] Select FAQ Category` | `categoryId`, `categoryName` |
| FAQ | `[FAQ] Expand FAQ` | `categoryId`, `categoryName`, `faqId`, `questionText` |
| Product Catalog | `[Shipping API EDI Catalog] Tab Clicked` | `tab` |
| Product Catalog | `[Shipping API EDI Catalog] API Category Clicked` | `categoryId`, `categoryName` |
| Product Catalog | `[Shipping API EDI Catalog] Search Used` | `searchQuery`, `tab` |
| Product Catalog | `[Shipping API EDI Catalog] Sort Changed` | `sortValue`, `tab` |
| Product Catalog | `[Shipping API EDI Catalog] EDI Download Clicked` | `ediProductId`, `ediProductTitle` |
| Product Catalog | `[Shipping API EDI Catalog] View API Detail Clicked` | `apiProductId`, `apiProductName` |
| Product Catalog | `[Shipping API EDI Catalog] API Detail Playground Clicked` | `apiProductId` |
| Integration Request | `[Integration Request] Submit Form Started` | `startTime` |
| Integration Request | `[Integration Request] Submit Form Completed` | `timeToCompleteMs`, `isComplete*` fields |
| Integration Request | `[Integration Request] Submit Form Drop-off` | `timeSpentMs`, `isComplete*` fields |
| Integration Request | `[Integration Request] Submit Form Submission Error` | `errorMessage`, `errorStatus` |
| Integration Request | `[Integration Request] Submit Form Validation Errors` | `errorFields`, `errorCount` |
| Journey Tracker | `[Journey Tracker] Journey to Integration Request Page` | `journeyPath`, `journeyLength`, `startPath`, `endpointPath` |

---

## 7. Full Data Flow

```
[API Portal Frontend]
  ↓  gtag.pushEvent("[FAQ] Expand FAQ", { categoryId, faqId, ... })
  ↓  window.dataLayer.push({ event: "[FAQ] Expand FAQ", ecom_user_id, categoryId, ... })

[GTM Container — running in browser]
  ↓  Custom Event Trigger: event = "[FAQ] Expand FAQ" → MATCH
  ↓  GA4 Event Tag fires
  ↓  Reads GTM Variables: {{categoryId}}, {{faqId}}, {{ecom_user_id}}, etc.
  ↓  Sends HTTP hit to GA4 collection endpoint (https://www.google-analytics.com/g/collect)

[GA4 Service]
  ↓  Receives and stores event internally
  ↓  Visible in GA4 Realtime / DebugView immediately
  ↓  Exports raw event rows to BigQuery: analytics_543593757.events_intraday_YYYYMMDD

[BigQuery — analytics_543593757]
  → Raw events available for scheduled SQL pipelines
  → See Part 2 (GA4 Analytics) and Part 3 (BigQuery Pipelines)
```

---

## 8. How to Verify an Event Is Working (Step-by-Step)

### Step 1 — GTM Preview / Tag Assistant
1. Open GTM workspace → click **Preview**
2. Enter your local or staging URL (e.g. `http://localhost:3000` or your staging domain)
3. Tag Assistant opens and connects to your browser tab
4. Perform the action in the app (e.g. expand an FAQ item)
5. In Tag Assistant left panel → confirm the event name appears
6. Click the event → check **Tags Fired** section → confirm the correct GA4 tag fired

> If event appears but tag did not fire → Trigger name does not match the pushed `event` value.
> If tag fires but parameters are empty → GTM Variable names do not match the `dataLayer` field names.

### Step 2 — GA4 DebugView
1. Open GA4 → **Admin → DebugView**
2. Trigger the event again in your browser
3. Confirm event name and its parameters appear in DebugView within seconds

### Step 3 — GA4 Realtime (quick sanity check)
1. Open GA4 → **Reports → Realtime**
2. Trigger the event
3. Confirm event count increases under the event name

---

## References

- `lib/analytics/gtag.ts` — GTM `dataLayer` push wrapper
- `components/common/GoogleTagManager.tsx` — GTM container script loader
- `lib/constants/heap-events.ts` — all tracked event name constants
- `components/common/HeapJourneyTracker.tsx` — journey tracking component
- `.env.development` / `.env.production` — `NEXT_PUBLIC_GTM_CONTAINER_ID`
- [GTM workspace](https://tagmanager.google.com) — Tags, Triggers, Variables config

---

## Related

- Part 2: Google Analytics 4: Event Collection and BigQuery Export Structure
- Part 3: BigQuery Pipelines: Transforming GA4 Raw Data into KPI Tables
- `gtm-ga4-bigquery-reference.md` — raw working notes and deep-dives on GTM/GA4
