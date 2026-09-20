# BigQuery Pipelines: Transforming GA4 Raw Data into KPI Tables

> Part of the series: **API Portal Analytics: End-to-End Event Tracking Architecture (GTM → GA4 → BigQuery → Looker)**
> - Part 1: Google Tag Manager: Setup, Event Tracking, and Verification
> - Part 2: Google Analytics 4: Event Collection and BigQuery Export Structure
> - Part 3: BigQuery Pipelines: Transforming GA4 Raw Data into KPI Tables ← you are here
> - Part 4: Looker Studio: KPI Dashboards and Data Source Setup

---

## 1. Why a Pipeline Is Needed

GA4 exports raw event data into BigQuery with a nested, verbose structure (see Part 2). That raw format is hard to use directly in dashboards:

- `event_params` is a repeated array, not flat columns
- One user action produces dozens of params per row
- No business-level concepts like "KPI area" or "product type"

The pipeline's job is to **transform raw GA4 data into a clean, flat table** that Looker Studio can query simply and fast.

**Mental model:**
> Raw GA4 export = unprocessed ingredients
> Scheduled SQL = the recipe
> `ga_ds.api_portal` = the finished dish Looker serves

---

## 2. BigQuery Dataset Overview

| Dataset | Owner | Purpose |
|---|---|---|
| `analytics_543593757` | Google (GA4) | Raw event export — read only |
| `ga_ds` | Your team | Modeled/curated tables for reporting |

Within `ga_ds`, the tables relevant to this project:

| Table | Contents |
|---|---|
| `ga_ds.api_portal` | Flat aggregated KPI events for the API Portal |
| `ga_ds.one_user_unicorn` | Aggregated user data for One Unicorn product |

---

## 3. The Scheduled Query

The scheduled query lives in `schedule-query.sql` at the project root. It runs on a recurring schedule (set in BigQuery Scheduled Queries) and keeps `ga_ds.api_portal` up to date.

### Time window: D-3 to D-1

The query declares two date variables at the top:

```sql
DECLARE to_date   DATE DEFAULT DATE_SUB(CURRENT_DATE('+08:00'), INTERVAL 1 DAY);  -- D-1 = yesterday
DECLARE from_date DATE DEFAULT DATE_SUB(CURRENT_DATE('+08:00'), INTERVAL 3 DAY);  -- D-3 = 3 days ago
```

> **Symbol guide:**
> - `D` = the current date when the query runs
> - `D-1` = yesterday (1 day before D)
> - `D-3` = 3 days before today
>
> **Worked example** — if query runs on `2026-08-07`:
> - `from_date` = `2026-08-04`
> - `to_date` = `2026-08-06`
> - Query processes: Aug 4, Aug 5, Aug 6 (today is excluded)

Why a 3-day window instead of just yesterday?
GA4 data can arrive late. Events fired near midnight may land in BigQuery hours later. Reprocessing a short recent window ensures late-arriving events are captured without reprocessing all history.

---

## 4. Query Execution Steps

The query runs inside a **transaction** — meaning if any step fails, all changes are rolled back and the destination table is left untouched.

```
BEGIN TRANSACTION
  Step 1 → find which dates have raw GA4 data in the window
  Step 2 → delete those dates from ga_ds.api_portal
  Step 3 → re-insert rebuilt rows for those dates
COMMIT (or ROLLBACK on error)
```

### Step 1 — Identify affected dates

```sql
SET affected_dates = (
  SELECT COALESCE(ARRAY_AGG(DISTINCT PARSE_DATE('%Y%m%d', event_date)), [])
  FROM `analytics_543593757.events_*`
  WHERE SUBSTR(_TABLE_SUFFIX, -8) BETWEEN from_date AND to_date
);
```

- Reads the raw GA4 wildcard table `events_*` (matches both `events_YYYYMMDD` and `events_intraday_YYYYMMDD`)
- `SUBSTR(_TABLE_SUFFIX, -8)` extracts the last 8 characters of the table name suffix, which is the date string `YYYYMMDD`
- Collects the distinct `event_date` values found in that range into an array

> **Why `SUBSTR(_TABLE_SUFFIX, -8)`?**
> The wildcard `events_*` matches both table types:
> - `events_20260806` → suffix = `20260806` → last 8 chars = `20260806` ✅
> - `events_intraday_20260806` → suffix = `intraday_20260806` → last 8 chars = `20260806` ✅
>
> This extracts just the date from either table name.

### Step 2 — Clear affected dates

```sql
DELETE FROM `ga_ds.api_portal`
WHERE event_date IN UNNEST(affected_dates);
```

Deletes **only the rows for dates that will be rebuilt**. Older dates are left untouched. This is why the destination table accumulates history over time — each run only refreshes its small window.

### Step 3 — Rebuild from raw export

Three sub-steps using CTEs (named sub-queries):

#### 3a. `raw_event` — filter only API Portal events

Reads `events_*` for the same date window and keeps only rows relevant to the API Portal:

```sql
WHERE event_name LIKE '[FAQ]%'
   OR event_name LIKE '[Shipping API EDI Catalog]%'
   OR event_name LIKE '[Integration Request]%'
   OR event_name LIKE '[Journey Tracker]%'
   OR (
     event_name IN ('page_view', 'session_start', 'first_visit')
     AND page_location LIKE '%/all-digital-solutions/one-developer-portal%'
   )
```

> Standard GA4 events (`page_view`, `session_start`, `first_visit`) are included only when the page URL belongs to the API Portal path. This avoids pulling in unrelated page views from the rest of the ONE website.

#### 3b. `event` — flatten nested fields into named columns

Extracts every useful dimension from `event_params` using scalar subqueries:

```sql
(SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'categoryId') AS category_id
```

Notable transformations:

| Output column | Source | Logic |
|---|---|---|
| `session_id` | `user_pseudo_id` + `ga_session_id` param | Concatenated to form a unique session key |
| `ecom_user_id` | `event_params.ecom_user_id` | Falls back to `'(Anonymous)'` if missing |
| `product_id` | `apiProductId` or `ediProductId` | First non-null wins |
| `product_type` | derived | `'api'` or `'edi'` based on which product ID param is present |
| `page_path` | `page_location` param | URL path extracted via regex (strips host and query string) |
| `is_complete_*` | `event_params` string `"true"/"false"` | Converted to BOOLEAN |
| `faq_category_id` | `categoryId` param | Only populated for `event_domain = 'FAQ'` events |

#### 3c. Final SELECT + GROUP BY — aggregate into one row per dimension combination

```sql
SELECT ..., COUNT(*) AS event_count
FROM event
GROUP BY event_date, event_name, session_id, user_pseudo_id, ...all dimensions...
```

This collapses identical dimension combinations within the same day into a single row with a count. For example, if the same user clicked the same FAQ twice in the same session, the result is one row with `event_count = 2`.

---

## 5. Destination Table: `ga_ds.api_portal`

### Full column schema

| Column | Type | Example | KPI Area |
|---|---|---|---|
| `event_date` | DATE | `2026-08-06` | All |
| `event_name` | STRING | `[FAQ] Expand FAQ` | All |
| `event_domain` | STRING | `FAQ` | All |
| `session_id` | STRING | `abc123-1785963632` | All |
| `user_pseudo_id` | STRING | `abc123.xxx` | All |
| `ecom_user_id` | STRING | `u12345` or `(Anonymous)` | All |
| `ecom_customer_code` | STRING | `C001` or `(Anonymous)` | All |
| `ecom_customer_country` | STRING | `SG` or `(Anonymous)` | All |
| `geo_country` | STRING | `Singapore` | Traffic |
| `region` | STRING | `Central Singapore` | Traffic |
| `device_category` | STRING | `desktop` | Traffic |
| `first_touch_source` | STRING | `google` | Traffic |
| `first_touch_medium` | STRING | `organic` | Traffic |
| `page_path` | STRING | `/all-digital-solutions/one-developer-portal` | Traffic |
| `product_id` | STRING | `api-001` | Product Discovery |
| `product_type` | STRING | `api` or `edi` | Product Discovery |
| `product_name` | STRING | `Shipment Tracking API` | Product Discovery |
| `product_category` | STRING | `Shipping` | Product Discovery |
| `tab` | STRING | `api` | Product Discovery |
| `sort_value` | STRING | `name_asc` | Product Discovery |
| `format` | STRING | `EDIFACT` | Product Discovery |
| `method` | STRING | `GET` | Product Discovery |
| `is_complete_company_information` | BOOLEAN | `true` | Conversion |
| `is_complete_technical_contacts` | BOOLEAN | `true` | Conversion |
| `is_complete_implementation_details` | BOOLEAN | `false` | Conversion |
| `is_complete_business_detail` | BOOLEAN | `true` | Conversion |
| `is_complete_timeline` | BOOLEAN | `false` | Conversion |
| `journey_path` | STRING | `/api-catalog → /integration-request` | Conversion |
| `start_path` | STRING | `/api-catalog` | Conversion |
| `endpoint_path` | STRING | `/integration-request` | Conversion |
| `faq_category_id` | STRING | `shipping` | FAQ |
| `faq_category_name` | STRING | `Shipping` | FAQ |
| `faq_id` | STRING | `faq-001` | FAQ |
| `faq_question_text` | STRING | `How do I track my shipment?` | FAQ |
| `event_count` | INTEGER | `3` | All |

---

## 6. How History Accumulates Over Time

The destination table keeps growing because each run only **deletes and rebuilds its own 3-day window**, leaving older dates untouched.

**Worked example across four daily runs:**

| Run date (D) | Window processed | Dates in table after run |
|---|---|---|
| Aug 4 | Aug 1 – Aug 3 | Aug 1, 2, 3 |
| Aug 5 | Aug 2 – Aug 4 | Aug 1, **2, 3, 4** (2 & 3 refreshed) |
| Aug 6 | Aug 3 – Aug 5 | Aug 1, 2, **3, 4, 5** (3 & 4 refreshed) |
| Aug 7 | Aug 4 – Aug 6 | Aug 1, 2, 3, **4, 5, 6** (4 & 5 refreshed) |

> Rows for Aug 1 loaded on Aug 4 are never touched again after Aug 6 (outside the window).
> This means Looker Studio can always query the full date range — not just the last 3 days.

---

## 7. Error Handling

The entire query runs in a `BEGIN TRANSACTION / COMMIT` block:

```sql
BEGIN TRANSACTION;
  -- all steps
COMMIT TRANSACTION;
EXCEPTION WHEN ERROR THEN
  ROLLBACK TRANSACTION;
  RAISE USING MESSAGE = FORMAT('ga_ds.api_portal load failed: %s', @@error.message);
END;
```

If any step fails:
- The transaction is rolled back
- `ga_ds.api_portal` is left in its pre-run state (no partial writes)
- The error message is surfaced for debugging

---

## 8. Key Caveats

- The wildcard `events_*` matches both `events_YYYYMMDD` and `events_intraday_YYYYMMDD`. If both exist for the same date (daily export enabled), they may overlap and double-count. Monitor if daily export is ever enabled.
- `event_count` is a count of raw GA4 event hits after grouping — not unique users. Use `COUNT(DISTINCT user_pseudo_id)` for unique user metrics in Looker.
- `(Anonymous)` is a sentinel value for unauthenticated users — not a real user ID. Filter it out when computing authenticated-only metrics.
- The query timezone is `+08:00` (SGT). Date boundaries reflect SGT midnight, not UTC.

---

## References

- `schedule-query.sql` — the full scheduled query (project root)
- BigQuery source dataset: `one-global-ecommerce-stage.analytics_543593757.events_*`
- BigQuery destination table: `one-global-ecommerce-stage.ga_ds.api_portal`
- [BigQuery Scheduled Queries console](https://console.cloud.google.com/bigquery/scheduled-queries) — run history and schedule config
- `gtm-ga4-bigquery-reference.md` — sections 9–10 (scheduled query mechanics, D-notation)

---

## Related

- Part 2: Google Analytics 4: Event Collection and BigQuery Export Structure
- Part 4: Looker Studio: KPI Dashboards and Data Source Setup
- `gtm-ga4-bigquery-reference.md` — raw reference notes
