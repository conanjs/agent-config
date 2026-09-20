# Google Analytics 4: Event Collection and BigQuery Export Structure

> Part of the series: **API Portal Analytics: End-to-End Event Tracking Architecture (GTM → GA4 → BigQuery → Looker)**
> - Part 1: Google Tag Manager: Setup, Event Tracking, and Verification
> - Part 2: Google Analytics 4: Event Collection and BigQuery Export Structure ← you are here
> - Part 3: BigQuery Pipelines: Transforming GA4 Raw Data into KPI Tables
> - Part 4: Looker Studio: KPI Dashboards and Data Source Setup

---

## 1. What is GA4?

Google Analytics 4 (GA4) is an **event collection and reporting service** managed by Google. It receives events forwarded by GTM, stores them internally, and exports raw event data to BigQuery for custom analysis.

**Key mental model:**
> GA4 is the **collector**. It does not live in your codebase — it is a Google-managed cloud service that receives hits from GTM and exports them downstream.

---

## 2. How GA4 Receives Events

When the GTM GA4 Event Tag fires (see Part 1), it sends an HTTP request to the GA4 collection endpoint:

```
POST https://www.google-analytics.com/g/collect?...
```

This request contains:
- The event name (e.g. `[FAQ] Expand FAQ`)
- All event parameters (e.g. `categoryId`, `faqId`)
- User properties (e.g. `ecom_user_id`, `ecom_customer_country`)
- GA4-managed metadata: `user_pseudo_id` (anonymous device ID), session info, device type, geo, traffic source

GA4 stores this internally and makes it available in:
- **Realtime reports** — within seconds
- **DebugView** — while GTM Preview is active
- **Standard reports** — after ~24h processing
- **BigQuery export** — written to raw tables continuously (streaming) or daily

---

## 3. GA4 BigQuery Export: What It Is and How It Works

### What "export" means here
GA4 automatically **copies raw event data** from its internal storage into a BigQuery dataset you own. This export is not a download you trigger manually — once the GA4 → BigQuery link is enabled, Google writes event rows continuously.

> The word "export" = GA4 pushes data **into** your BigQuery project. You do not pull from GA4.

### Two export modes

| Mode | Table name pattern | When rows arrive | Notes |
|---|---|---|---|
| **Streaming (intraday)** | `events_intraday_YYYYMMDD` | Continuously during the day | Near-real-time; rows may still change |
| **Daily (finalized)** | `events_YYYYMMDD` | Once per day, next morning | Stable; safe for reporting |

In the current API Portal setup, only **streaming intraday tables** are present (no daily finalized tables yet). Check with your IT admin if you need daily export enabled.

### Where the data lands in BigQuery

```
BigQuery project: one-global-ecommerce-stage
  └── Dataset: analytics_543593757      ← GA4-managed, auto-populated by Google
        ├── events_intraday_20260807    ← today's streaming events (live)
        ├── events_intraday_20260806    ← yesterday's streaming events
        ├── events_intraday_20260805    ← ...
        ├── pseudonymous_users_         ← anonymous users without user_id
        └── users_                      ← users with known user_id
```

> `analytics_543593757` — the number `543593757` is the GA4 **property ID**. This dataset is created and written to by Google. You only read from it, never write.

### What `events_intraday_(26)` means in BigQuery Explorer

In the BigQuery left-side tree, `events_intraday_(26)` is a **grouped label**, not one physical table. It means: "there are 26 physical tables whose names all start with `events_intraday_`."

Think of it like a folder summary row:
- `events_intraday_(26)` = summary label showing 26 tables exist
- `events_intraday_20260806` = one real physical table you can query

GA4 writes to the **dated physical tables**, not to the group label.

---

## 4. Raw Event Table Structure

Each row in `events_intraday_YYYYMMDD` represents **one event fired by one user**. The schema mixes scalar columns and nested repeated fields.

### Scalar columns (one value per row)

| Column | Type | Example | What it means |
|---|---|---|---|
| `event_date` | STRING | `"20260807"` | Date the event occurred (YYYYMMDD) |
| `event_name` | STRING | `"[FAQ] Expand FAQ"` | Name of the event |
| `event_timestamp` | INTEGER | `1785963670000000` | Microseconds since Unix epoch |
| `user_pseudo_id` | STRING | `"abc123.1785963632"` | GA4's anonymous device identifier |
| `user_id` | STRING | `"u12345"` or `null` | Your app's user ID (only when logged in) |

### Nested repeated fields (arrays — multiple values per row)

| Column | What it contains |
|---|---|
| `event_params` | Array of key-value pairs for this specific event |
| `user_properties` | Array of key-value pairs describing the user |
| `device` | Device type, OS, browser |
| `geo` | Country, region, city |
| `traffic_source` | Source, medium, campaign |

---

## 5. `event_params` Structure and Querying

### Physical shape

`event_params` is an **array of objects** — each object holds one parameter for the event.

```
event_params = [
  { key: "page_location", value: { string_value: "https://stage.one-line.com/.../one-developer-portal", int_value: null, float_value: null, double_value: null } },
  { key: "page_title",    value: { string_value: "ONE Developer Portal", ... } },
  { key: "ga_session_id", value: { string_value: null, int_value: 1785963632, ... } },
  { key: "categoryId",    value: { string_value: "shipping", ... } },
  { key: "faqId",         value: { string_value: "faq-001", ... } }
]
```

Each element always has four typed value slots, but only the matching type is populated; the rest are `null`.

| Field | Type | Used for |
|---|---|---|
| `key` | STRING | Parameter name |
| `value.string_value` | STRING | Text values |
| `value.int_value` | INTEGER | Integer numbers |
| `value.float_value` | FLOAT | Decimal numbers |
| `value.double_value` | FLOAT | High-precision decimals |

### Why UNNEST is required

`event_params` is not a table — it is an array embedded inside each row. SQL cannot iterate array elements directly in a `FROM` or `WHERE` clause. `UNNEST(event_params)` is BigQuery's operator that **expands the array into rows** so you can filter and select individual elements.

**Before UNNEST** — 1 event row with 10 params in an array:

| event_name | event_params (array) |
|---|---|
| `[FAQ] Expand FAQ` | `[ {key: "categoryId", ...}, {key: "faqId", ...}, ... ]` |

**After `CROSS JOIN UNNEST(event_params) ep`** — 10 rows, one per param:

| event_name | ep.key | ep.value.string_value | ep.value.int_value |
|---|---|---|---|
| `[FAQ] Expand FAQ` | `categoryId` | `"shipping"` | `null` |
| `[FAQ] Expand FAQ` | `faqId` | `"faq-001"` | `null` |
| `[FAQ] Expand FAQ` | `ga_session_id` | `null` | `1785963632` |
| `[FAQ] Expand FAQ` | `page_location` | `"https://..."` | `null` |

### Query patterns

**Pattern A — filter events by a specific parameter value**
```sql
SELECT
  ev.event_date,
  ev.event_name,
  ev.user_pseudo_id,
  ep.value.string_value AS page_location
FROM `one-global-ecommerce-stage.analytics_543593757.events_intraday_*` ev
CROSS JOIN UNNEST(ev.event_params) ep
WHERE _TABLE_SUFFIX = '20260807'
  AND ep.key = 'page_location'
  AND ep.value.string_value LIKE '%all-digital-solutions/one-developer-portal%';
```

**Pattern B — extract one param as a column per event row (recommended for reporting)**
```sql
SELECT
  ev.event_name,
  ev.user_pseudo_id,
  (SELECT ep.value.string_value FROM UNNEST(ev.event_params) ep WHERE ep.key = 'page_location') AS page_location,
  (SELECT ep.value.string_value FROM UNNEST(ev.event_params) ep WHERE ep.key = 'categoryId')    AS category_id,
  (SELECT ep.value.string_value FROM UNNEST(ev.event_params) ep WHERE ep.key = 'faqId')         AS faq_id
FROM `one-global-ecommerce-stage.analytics_543593757.events_intraday_20260807` ev;
```

Pattern B keeps one row per event, making it easier to aggregate and join.

---

## 6. `user_properties` Structure and Querying

### Physical shape

`user_properties` is an array of objects, identical in structure to `event_params` but with an extra `set_timestamp_micros` field per element.

```
user_properties = [
  { key: "ecom_user_id",          value: { string_value: "u12345", set_timestamp_micros: 1785963632000000 } },
  { key: "ecom_customer_code",    value: { string_value: "C001",   set_timestamp_micros: 1785963632000000 } },
  { key: "ecom_customer_country", value: { string_value: "SG",     set_timestamp_micros: 1785963632000000 } }
]
```

`set_timestamp_micros` = the microsecond timestamp when this property was **last set** on the user.

### Post-UNNEST row shape

| event_name | user_pseudo_id | up.key | up.value.string_value | up.value.set_timestamp_micros |
|---|---|---|---|---|
| `page_view` | `abc123` | `ecom_user_id` | `u12345` | `1785963632000000` |
| `page_view` | `abc123` | `ecom_customer_code` | `C001` | `1785963632000000` |
| `page_view` | `abc123` | `ecom_customer_country` | `SG` | `1785963632000000` |

### Query pattern (scalar subquery per property)
```sql
SELECT
  ev.event_name,
  ev.user_pseudo_id,
  (SELECT up.value.string_value FROM UNNEST(ev.user_properties) up WHERE up.key = 'ecom_user_id')          AS ecom_user_id,
  (SELECT up.value.string_value FROM UNNEST(ev.user_properties) up WHERE up.key = 'ecom_customer_code')    AS customer_code,
  (SELECT up.value.string_value FROM UNNEST(ev.user_properties) up WHERE up.key = 'ecom_customer_country') AS customer_country
FROM `one-global-ecommerce-stage.analytics_543593757.events_intraday_20260807` ev;
```

---

## 7. Event Parameters vs User Properties: When to Use Each

| | Event Parameters | User Properties |
|---|---|---|
| **Scope** | One event occurrence | The user (across all events) |
| **Changes** | Per action / per click | Rarely (when user identity changes) |
| **Examples** | `faqId`, `journeyPath`, `errorStatus`, `sortValue` | `ecom_user_id`, `ecom_customer_country` |
| **In BigQuery** | `event_params` repeated field | `user_properties` repeated field |
| **Rule of thumb** | What happened | Who did it |

---

## 8. How to Verify Events Reached GA4

### GA4 DebugView (recommended for exact parameter inspection)
1. Open GA4 → **Admin → DebugView**
2. Trigger the event in your browser while GTM Preview is active
3. Confirm event name and all expected parameters appear

### GA4 Realtime (quick sanity check)
1. Open GA4 → **Reports → Realtime**
2. Trigger the event
3. Confirm event count increases

### BigQuery (confirm raw export is flowing)
```sql
SELECT event_name, COUNT(*) AS count
FROM `one-global-ecommerce-stage.analytics_543593757.events_intraday_*`
WHERE _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', CURRENT_DATE())
GROUP BY event_name
ORDER BY count DESC;
```

---

## 9. GA4 User and Session Identity

### User Identity: `user_pseudo_id`

GA4 automatically assigns every browser/device a **`user_pseudo_id`** — a random anonymous ID stored as a cookie. This is GA4's primary user identifier and is **always present**, regardless of login state.

```
user_pseudo_id = "1157390041.1784748529"
                   ↑ random client ID   ↑ first-visit Unix timestamp
                                          (when the _ga cookie was first created for this browser)
```

> **Important:** The after-dot part is the user's **first-ever visit timestamp** (`user_first_touch_timestamp`), NOT the `ga_session_id`. The `ga_session_id` is the *current session's* start timestamp and will **always differ** from the first-visit timestamp — even if `ga_session_number = 1` (the user's very first session).
>
> **Why they differ even on first session:** GA4 takes two separate clock readings during the same page load — one when it creates/reads the `_ga` cookie (→ `user_first_touch_timestamp`, stored in `user_pseudo_id` after-dot), and one when it assigns the session ID (→ `ga_session_id`). These are milliseconds to seconds apart.
>
> **Real examples:**
>
> *First-ever session (ga_session_number = 1):*
> ```
> user_pseudo_id              = 2089024339.1786355321
> user_first_touch_timestamp  = 1786355321078395 µs = 1786355321 s  ← matches after-dot ✓
> ga_session_id               = 1786355320                           ← 1 second earlier
> Difference: 1 second — same page load, two separate clock reads
> ```
>
> *Returning session (ga_session_number = 31):*
> ```
> user_pseudo_id after-dot  = 1784748529  ← first visited ~6 days ago
> ga_session_id             = 1785270341  ← this session started today
> Difference: 521,812 seconds ≈ 6 days
> ```

**Analogy:** A wristband GA4 puts on every visitor the moment they land. No login required. Persists as long as the browser cookie exists. Cleared cookies = new wristband = new user.

#### How to Find Your Own `user_pseudo_id` from Browser Cookies

GA4 stores the client identity in the `_ga` cookie. You can read it directly in DevTools:

1. Open DevTools → **Application** tab → **Cookies** → your domain
2. Find the `_ga` cookie — its value looks like: `GA1.1140741330.1786354717`
3. Strip the `GA1.` prefix → `user_pseudo_id = 1140741330.1786354717`

```
_ga cookie value:  GA1.1140741330.1786354717
                       ↑            ↑
                  client_id    first-visit Unix timestamp
                  (random)     (when _ga was first created)

user_pseudo_id  =  1140741330.1786354717   ← what BigQuery stores
```

> **Note:** If your `first-visit timestamp` is recent (e.g., today), you'll only see events from that date onward in BigQuery — your history is short.

#### Query to Look Up Your Own Events in BigQuery

```sql
-- Replace with your own user_pseudo_id from the _ga cookie
SELECT
  event_date,
  FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', TIMESTAMP_MICROS(event_timestamp)) AS event_time,
  event_name,
  user_pseudo_id,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id')     AS session_id,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_number') AS session_number
FROM `one-global-ecommerce-stage.analytics_543593757.events_intraday_*`
WHERE user_pseudo_id = '1140741330.1786354717'
  AND _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Ho_Chi_Minh'))
ORDER BY event_timestamp DESC
LIMIT 50;
```

To check your full history across all intraday dates:

```sql
SELECT
  event_date,
  event_name,
  (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_number') AS session_number
FROM `one-global-ecommerce-stage.analytics_543593757.events_intraday_*`
WHERE user_pseudo_id = '1140741330.1786354717'
ORDER BY event_date DESC, event_timestamp DESC
LIMIT 100;
```

| Field | When populated | Purpose |
|---|---|---|
| `user_pseudo_id` | Every event, always | Anonymous device-level identity |
| `ecom_user_id` (user_property) | Only when logged in | Your app's authenticated user ID |

**Limitation:** Device-scoped, not person-scoped. Same person on iPhone + laptop = 2 different `user_pseudo_id`s → slight overcount of total users.

---

### Session Identity: `ga_session_id` vs `ga_session_number`

Both fields are stored inside `event_params` (not as top-level columns). You access them via UNNEST.

| Field | Type | What it is |
|---|---|---|
| `ga_session_id` | Integer (Unix seconds) | **Which session** — unique ID for this specific visit window |
| `ga_session_number` | Integer (counter) | **How many sessions** this user has had in total (lifetime counter) |

#### `ga_session_id` — Session Fingerprint

GA4 sets this to the **Unix timestamp (in seconds) of when the session started**:
- `1785270341` = a specific second when the session began
- All events within the same session share the same `ga_session_id`
- Scoped to `user_pseudo_id` — two users can theoretically have the same value (same start-second), so you always combine both for a globally unique session key:

```sql
CONCAT(user_pseudo_id, '.', CAST(ga_session_id AS STRING)) AS unique_session_id
```

#### `ga_session_number` — Visit Counter

GA4 increments this by 1 each time a new session starts for a `user_pseudo_id`:
- `ga_session_number = 1` → this user's very first visit ever
- `ga_session_number = 31` → this user has visited 31 times total (see BigQuery screenshot example below)
- Stored in the browser. Survives across visits. Resets to 1 only if cookies are cleared.

#### Real Data Example (from `events_intraday_20260729`)

```
user_pseudo_id = 1157390041.1784748529
                              ↑ first-visit timestamp (6 days before this session)

event 1: session_start   → ga_session_id = 1785270341, ga_session_number = 31
event 2: page_view        → ga_session_id = 1785270341, ga_session_number = 31
event 3: user_engagement  → ga_session_id = 1785270341, ga_session_number = 31
```

All events in the same session carry the **same `ga_session_id` and `ga_session_number`**.

---

### How GA4 Counts Standard Metrics

| Metric | SQL equivalent |
|---|---|
| Total Users | `COUNT(DISTINCT user_pseudo_id)` |
| New Users | `COUNT(DISTINCT user_pseudo_id)` WHERE `event_name = 'first_visit'` |
| Returning Users | Total Users − New Users |
| Total Sessions | `COUNT(DISTINCT unique_session_id)` |

```sql
-- New vs Returning users for a period
SELECT
  COUNTIF(ga_session_number = 1)  AS new_users,
  COUNTIF(ga_session_number > 1)  AS returning_users
FROM (
  SELECT
    user_pseudo_id,
    MIN(CAST(ep.value.int_value AS INT64)) AS ga_session_number
  FROM ga_ds.api_portal,
    UNNEST(event_params) AS ep
  WHERE ep.key = 'ga_session_number'
    AND event_date BETWEEN '20260801' AND '20260831'
  GROUP BY user_pseudo_id
)
```

---

### When to Use Each Field

| Chart Goal | Field |
|---|---|
| Unique visitors | COUNT DISTINCT `user_pseudo_id` |
| New visitors | `ga_session_number = 1` |
| Returning visitors | `ga_session_number > 1` |
| Unique sessions | COUNT DISTINCT `unique_session_id` |
| Logged-in user actions | Filter `ecom_user_id != '(Anonymous)'` |
| Session depth distribution | GROUP BY `ga_session_number` |

---

## 10. Key Caveats

- GA4 BigQuery export must be **explicitly enabled** in GA4 Admin — it is not on by default.
- `events_intraday_*` rows are **not final**. Late-arriving events can still be added to an existing intraday table.
- User properties only appear on rows **after** the property was first set. Older rows may have `null`.
- GA4 processes timezone in the **property's configured timezone**, which may differ from UTC.
- Do not send PII (email, full name, phone number) as event parameters or user properties.

---

## References

- BigQuery dataset: `one-global-ecommerce-stage.analytics_543593757`
- GA4 property ID: `543593757`
- [GA4 Admin → BigQuery Links](https://analytics.google.com) — where export is enabled
- [GA4 DebugView](https://analytics.google.com) — real-time event verification
- `gtm-ga4-bigquery-reference.md` — sections 3–5 (event_params, UNNEST, user_properties)

---

## Related

- Part 1: Google Tag Manager: Setup, Event Tracking, and Verification
- Part 3: BigQuery Pipelines: Transforming GA4 Raw Data into KPI Tables
- `gtm-ga4-bigquery-reference.md` — raw reference notes including SQL patterns
