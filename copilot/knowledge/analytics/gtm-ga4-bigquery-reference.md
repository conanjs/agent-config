# GTM → GA4 → BigQuery → Looker: Practical Knowledge Note

## 1) Exact ownership flow (who does what)

1. **App code** calls [`gtag.pushEvent`](./lib/analytics/gtag.ts)
2. **Browser `dataLayer`** receives `dataLayer.push({ event: ..., ...params })`
3. **GTM Trigger** matches the event name/conditions
4. **GTM GA4 Event Tag** sends the hit to GA4 endpoint
5. **GA4 service** stores the event and **exports** it into BigQuery dataset `analytics_<property_id>`
6. **Your scheduled SQL job** reads `analytics_*` and writes curated rows into `ga_ds.api_portal`
7. **Looker Studio** reads from `ga_ds.api_portal`

> Writing style note: using `Entity + Action` per step (for example, "GTM Trigger matches") clarifies system boundaries and ownership.

---

## 2) What `analytics_543593757` and `ga_ds` are

- `analytics_543593757` = **GA4 raw export dataset**
  - Managed/populated by GA4 export service
  - Contains raw event tables (sharded by date)
- `ga_ds` = **team-owned modeled dataset**
  - Populated by your SQL pipelines/scheduled queries
  - Contains clean reporting tables for dashboards

So the word **"export"** in "GA4 raw export dataset" means:
- GA4 exports/copies events into BigQuery raw tables in `analytics_<property_id>`.
- It does **not** mean GA4 exports directly to `ga_ds`.

---

## 3) `events_intraday_(26)` in BigQuery Explorer (plain explanation)

In the left BigQuery tree, `events_intraday_(26)` is a **group label**, not one physical table.

Think of it like:
- `invoice_(26)` = "there are 26 invoice files with prefix `invoice_`"
- Here: `events_intraday_(26)` = "there are 26 sharded tables with prefix `events_intraday_`"

Physical tables are the dated ones, for example:
- `events_intraday_20260806`
- `events_intraday_20260807`

GA4 writes to those **dated physical tables**, not to the group label row.

---

## 4) Why you may only see `events_intraday_*` and not `events_YYYYMMDD`

Common reasons:
1. BigQuery link is configured for **Streaming export only** (no Daily export)
2. Daily export exists but has not completed yet for that day
3. Permission/filtering/UI scope hides other tables

Most teams want both:
- **Streaming** for near-real-time (`events_intraday_*`)
- **Daily** for finalized reporting (`events_*`)

---

## 5) `events_intraday` mechanism: data-in and data-out

### Data-in (how rows arrive)
- During the day, GA4 export service continuously appends new event rows to `events_intraday_YYYYMMDD`.
- Rows are raw and nested (for example, `event_params` repeated key/value records).

### Data-out (how your team consumes it)
- Your SQL reads those rows for operational/near-real-time checks.
- For stable KPI reporting, your scheduled SQL transforms raw rows and writes curated rows to `ga_ds.api_portal`.

Why flatten/unnest:
- `event_params` stores key/value in nested records with typed slots (`string_value`, `int_value`, `double_value`, ...).
- Unnesting/flattening converts that into normal columns so queries are simpler, safer, and faster to maintain.

---

## 6) Important SQL gotcha from your screenshot (`_TABLE_SUFFIX` error)

`_TABLE_SUFFIX` works only with wildcard table references.

### Wrong (concrete table + `_TABLE_SUFFIX`)
```sql
SELECT *
FROM `project.analytics_543593757.events_intraday_20260806`
WHERE _TABLE_SUFFIX = '20260806';
```

### Correct (wildcard + `_TABLE_SUFFIX`)
```sql
SELECT *
FROM `project.analytics_543593757.events_intraday_*`
WHERE _TABLE_SUFFIX = '20260806';
```

---

## 7) Daily query strategy (practical)

### A) If you have Daily + Streaming export
- Use `events_*` for finalized historical days
- Union in today from `events_intraday_*`

```sql
SELECT *
FROM `project.analytics_543593757.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260801' AND FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY))

UNION ALL

SELECT *
FROM `project.analytics_543593757.events_intraday_*`
WHERE _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', CURRENT_DATE());
```

### B) If you only have Streaming export
- Query only `events_intraday_*` across a suffix range

```sql
SELECT *
FROM `project.analytics_543593757.events_intraday_*`
WHERE _TABLE_SUFFIX BETWEEN '20260801' AND FORMAT_DATE('%Y%m%d', CURRENT_DATE());
```

---

## 8) How this relates directly to this repo

- Event push code: [`lib/analytics/gtag.ts`](./lib/analytics/gtag.ts)
- GTM container load: [`components/common/GoogleTagManager.tsx`](./components/common/GoogleTagManager.tsx)
- Journey event sender: [`components/common/HeapJourneyTracker.tsx`](./components/common/HeapJourneyTracker.tsx)

These files are upstream event producers; BigQuery/Looker are downstream analytics consumers.

---

## 9) Deep-dive on this repo's scheduled query behavior

Reference: [`schedule-query.sql`](./schedule-query.sql)

Key point: this query reads from wildcard `events_*`, which matches **both**:
- `events_YYYYMMDD` (daily finalized)
- `events_intraday_YYYYMMDD` (streaming)

So even if you only see `events_intraday_20260806`, this scheduled query can still read it because:
- `_TABLE_SUFFIX` for `events_intraday_20260806` is `intraday_20260806`
- `SUBSTR(_TABLE_SUFFIX, -8)` extracts `20260806`

Why old `events_intraday_*` tables may be missing:
- By GA4 default behavior, intraday tables are temporary/streaming-oriented and older shards are typically cleaned up after finalized data is available.
- Which exact tables remain visible can vary by export mode and lifecycle timing.

Potential risk in this SQL:
- If both `events_YYYYMMDD` and `events_intraday_YYYYMMDD` are present for the same day, wildcard `events_*` may read both sources for that day.
- Depending on overlap timing, this can duplicate counts unless deduplication logic exists.

Operational recommendation:
- For stable daily pipelines, prefer finalized `events_*` for closed days.
- Optionally include `events_intraday_*` only for current day near-real-time, then reprocess a short backfill window.

---

## 10) Symbol glossary (plain English)

- `D` = "today" (current date in the query timezone)
- `D-1` = yesterday
- `D-3` = three days before today
- `from_date = D-3` means start reading data from 3 days ago
- `to_date = D-1` means stop at yesterday (exclude today)

Worked example (if today is `2026-08-07`):
- `D` = `2026-08-07`
- `D-1` = `2026-08-06`
- `D-3` = `2026-08-04`
- Query window = `2026-08-04` to `2026-08-06`

Why this window is used:
- It avoids unstable same-day streaming changes.
- It reprocesses a small recent range in case late events arrive.

---

## 11) GTM Tag setup: Event Name, Event Parameters, Measurement ID, User Properties

### A) Do we need to define a tag in GTM for FE-pushed events?
Yes (in your current design):
1. FE pushes an event to `dataLayer`.
2. GTM Trigger (Custom Event) matches that event name.
3. GTM GA4 Event Tag sends event to GA4.

So each tracked business event typically has:
- Event name in FE payload (`event` field), and
- A corresponding Trigger/Tag setup in GTM.

### B) Why do Event Parameters show `{{categoryId}}` in both columns?
In GTM GA4 Event tag UI:
- Left column = GA4 parameter name
- Right column = value expression

If both sides are `{{categoryId}}`, it means:
- Parameter name is dynamically read from GTM variable `categoryId`
- Parameter value is also read from the same GTM variable

That is valid but unusual. Most teams use:
- Left (parameter name): static literal (e.g., `category_id`)
- Right (value): GTM variable (e.g., `{{categoryId}}`)

Recommended pattern:
- `category_id` => `{{categoryId}}`
- `category_name` => `{{categoryName}}`
- `faq_id` => `{{faqId}}`
- `question_text` => `{{questionText}}`

### C) Why User Properties usually show only value as `{{...}}`?
Because property names are usually fixed GA4 schema keys:
- `ecom_user_id`
- `ecom_customer_code`
- `ecom_customer_country`

And only their values are dynamic from GTM variables.

### D) Measurement ID meaning
`{{measurementId}}` is a GTM variable resolving to GA4 stream Measurement ID (e.g., `G-XXXXXXX`).
It tells the GA4 tag which GA4 property/stream receives the hit.

### E) Suggested standard strategy
- Event name: exact business action name (stable)
- Event parameter names: static snake_case
- Event parameter values: GTM variables from dataLayer
- User property names: static schema keys
- User property values: GTM variables (stable identity attributes)

---

## 12) GA4 `event_params` structure and `UNNEST` mechanics (with examples)

### Physical shape in one GA4 event row
For one row in `events_intraday_YYYYMMDD`, columns like `event_date`, `event_name` are scalar fields.

`event_params` is a **repeated record** (array of objects):

```text
event_params = [
  { key: 'page_location', value: { string_value: 'https://.../all-digital-solutions/one-developer-portal?...' } },
  { key: 'ga_session_id', value: { int_value: 1785963632 } },
  { key: 'page_title', value: { string_value: '...' } }
]
```

So yes: conceptually this is an array of key/value objects for the same event row.

### Why `UNNEST` is required
In BigQuery, repeated fields are not auto-expanded into row sets in `FROM`.
`UNNEST(event_params)` is the explicit operator that turns the array elements into queryable rows.

Without `UNNEST`, SQL cannot iterate each element in that repeated field in a `FROM/JOIN` context.

### Before/after intuition
- Before: 1 event row with `event_params` array of N elements
- After `CROSS JOIN UNNEST(event_params) ep`: N rows (same event duplicated N times, one per param element)

### Pattern A — filter events by a param key/value (recommended)

```sql
SELECT
  ev.event_date,
  ev.event_name,
  ev.user_pseudo_id,
  ep.value.string_value AS page_location
FROM `one-global-ecommerce-stage.analytics_543593757.events_intraday_*` ev
CROSS JOIN UNNEST(ev.event_params) ep
WHERE _TABLE_SUFFIX = '20260806'
  AND ep.key = 'page_location'
  AND ep.value.string_value LIKE '%all-digital-solutions/one-developer-portal%';
```

### Pattern B — extract one param as a scalar column per event row

```sql
SELECT
  ev.event_name,
  (
    SELECT ep.value.string_value
    FROM UNNEST(ev.event_params) ep
    WHERE ep.key = 'page_location'
  ) AS page_location
FROM `one-global-ecommerce-stage.analytics_543593757.events_intraday_20260806` ev;
```

This keeps one output row per event.

### Why your attempt errored conceptually
When selecting `event_params.key` directly, you treated repeated data as scalar.
Use either:
- `CROSS JOIN UNNEST(ev.event_params) ep` then `ep.key`, or
- scalar subquery `(SELECT ... FROM UNNEST(ev.event_params) ...)`.

---

## 13) Exact output row shape after `UNNEST(event_params)`

### Input (before UNNEST)
One GA4 event row has:
- scalar columns: `event_date`, `event_name`, `user_pseudo_id`, ...
- repeated column: `event_params` (array of param records)

### Output (after `CROSS JOIN UNNEST(event_params) ep`)
Each output row has:
- all selected parent event columns (for example `event_date`, `event_name`, `user_pseudo_id`)
- one unnested record alias `ep` with fields:
  - `ep.key` (STRING)
  - `ep.value.string_value` (STRING)
  - `ep.value.int_value` (INT64)
  - `ep.value.float_value` (FLOAT64)
  - `ep.value.double_value` (FLOAT64)

So the array becomes "one param per row".

### Example output rows (same event repeated by param)

| event_date | event_name | user_pseudo_id | ep.key | ep.value.string_value | ep.value.int_value |
|---|---|---|---|---|---|
| 20260806 | page_view | abc123 | page_location | https://stage.one-line.com/.../all-digital-solutions/one-developer-portal | NULL |
| 20260806 | page_view | abc123 | page_title | ONE Developer Portal | NULL |
| 20260806 | page_view | abc123 | ga_session_id | NULL | 1785963632 |

### Why this matters
- Filter by key/value easily: `WHERE ep.key = 'page_location'`
- But row count increases (one input event can become many output rows)
- If you need one row per event again, pivot or use scalar subqueries per key

---

## 14) User Properties in GA4 BigQuery export

### Where they live
`user_properties` is a repeated record field on every event row — same structure as `event_params`.
There are no flat named columns for user properties.

### Shape of `user_properties` array
```text
user_properties = [
  { key: "ecom_user_id",          value: { string_value: "u12345", set_timestamp_micros: 1234... } },
  { key: "ecom_customer_code",    value: { string_value: "C001",   set_timestamp_micros: 1234... } },
  { key: "ecom_customer_country", value: { string_value: "SG",     set_timestamp_micros: 1234... } }
]
```

Fields per element:
- `key` (STRING) — property name
- `value.string_value` / `value.int_value` / `value.float_value` / `value.double_value`
- `value.set_timestamp_micros` (INT64) — when this property was last set on the user

### Post-UNNEST row shape

| event_name | user_pseudo_id | up.key | up.value.string_value | up.value.set_timestamp_micros |
|---|---|---|---|---|
| page_view | abc123 | ecom_user_id | u12345 | 1785963632000000 |
| page_view | abc123 | ecom_customer_code | C001 | 1785963632000000 |
| page_view | abc123 | ecom_customer_country | SG | 1785963632000000 |

### Query pattern A — UNNEST to filter
```sql
SELECT ev.event_name, ev.user_pseudo_id, up.key, up.value.string_value
FROM `project.analytics_543593757.events_intraday_20260806` ev
CROSS JOIN UNNEST(ev.user_properties) up
WHERE up.key = 'ecom_customer_country';
```

### Query pattern B — scalar subquery (one row per event)
```sql
SELECT
  ev.event_name,
  (SELECT up.value.string_value FROM UNNEST(ev.user_properties) up WHERE up.key = 'ecom_user_id') AS ecom_user_id,
  (SELECT up.value.string_value FROM UNNEST(ev.user_properties) up WHERE up.key = 'ecom_customer_country') AS customer_country
FROM `project.analytics_543593757.events_intraday_20260806` ev;
```

---

## References

- `lib/analytics/gtag.ts` — GTM push utility
- `components/common/GoogleTagManager.tsx` — GTM loader
- `lib/constants/heap-events.ts` — event name constants
- `schedule-query.sql` — scheduled BigQuery pipeline
- BigQuery raw dataset: `one-global-ecommerce-stage.analytics_543593757`
- BigQuery modeled dataset: `one-global-ecommerce-stage.ga_ds`

---

## Related

- Part 1: Google Tag Manager: Setup, Event Tracking, and Verification
- Part 2: Google Analytics 4: Event Collection and BigQuery Export Structure
- Part 3: BigQuery Pipelines: Transforming GA4 Raw Data into KPI Tables
- Part 4: Looker Studio: KPI Dashboards and Data Source Setup

---

## 15) ⚠️ GTM Pitfall: Using a Variable as Both Parameter Name and Value

### What went wrong

In the GTM GA4 Event tag for `[FAQ] Expand FAQ`, the event parameter was configured as:

| Left column (Parameter Name) | Right column (Value) |
|---|---|
| `{{questionText}}` | `{{questionText}}` |

Both columns used the GTM variable `{{questionText}}`.

When GTM resolved `{{questionText}}` to the actual question text (e.g., `"Are webhooks supported?"`), it used that resolved string as the **GA4 parameter key name** — not as the value.

### What GA4 stored in BigQuery (broken)

```
event_params = [
  { key: "Are webhooks supported?",        value: { string_value: "Are webhooks supported?" } },
  { key: "How do your API products com...", value: { string_value: "..." } }
]
```

### What it should store (correct)

```
event_params = [
  { key: "questionText", value: { string_value: "Are webhooks supported?" } }
]
```

### Why this causes null in BigQuery / Looker

The scheduled query extracts:
```sql
(SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'questionText') AS faq_question_text
```

But `key = 'questionText'` never matches — the key is the actual question text, not the string `"questionText"`. So `faq_question_text` is always `null` in `ga_ds.api_portal`.

### How to verify this bug in BigQuery

```sql
SELECT DISTINCT ep.key
FROM `one-global-ecommerce-stage.analytics_543593757.events_intraday_*`
CROSS JOIN UNNEST(event_params) ep
WHERE event_name = '[FAQ] Expand FAQ'
ORDER BY ep.key;
```

If the results show question sentences as keys (e.g., `"Are webhooks supported?"`) instead of short technical names (e.g., `"questionText"`), the GTM parameter name is misconfigured.

### Fix

In GTM → Tags → `[FAQ] Expand FAQ` → Event Parameters:

| Left column (Parameter Name) | Right column (Value) |
|---|---|
| `questionText` ← static string | `{{questionText}}` ← variable |

The left column must always be a **static, fixed key name**. Only the right column should be a dynamic variable.

### General rule for all GTM event parameters

> Parameter name (left column) = static snake_case or camelCase string, never a variable.
> Parameter value (right column) = GTM variable `{{...}}` reading from dataLayer.
