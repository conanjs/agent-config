# Looker Studio: KPI Dashboards and Data Source Setup

> Part of the series: **API Portal Analytics: End-to-End Event Tracking Architecture (GTM → GA4 → BigQuery → Looker)**
> - Part 1: Google Tag Manager: Setup, Event Tracking, and Verification
> - Part 2: Google Analytics 4: Event Collection and BigQuery Export Structure
> - Part 3: BigQuery Pipelines: Transforming GA4 Raw Data into KPI Tables
> - Part 4: Looker Studio: KPI Dashboards and Data Source Setup ← you are here

---

## 1. What is Looker Studio?

Looker Studio (formerly Google Data Studio) is a **free web-based dashboard and reporting tool** by Google. It connects to data sources (like BigQuery tables), lets you build charts and KPI cards, and produces shareable reports.

**Key mental model:**
> Looker Studio is the **display layer**. It does not store data, transform data, or run pipelines. It only reads from a connected data source and visualizes what it finds.

Looker Studio reads from `ga_ds.api_portal` — the clean, flat table produced by the BigQuery pipeline. It does **not** read directly from raw GA4 export tables.

---

## 2. Why Not Read Directly from GA4 or Raw BigQuery Tables?

| Option | Problem |
|---|---|
| Connect Looker directly to GA4 | Limited custom dimensions, slow, no SQL control |
| Connect Looker to `analytics_*` raw tables | Nested fields (`event_params`) cannot be used directly in Looker charts; requires SQL transformation |
| Connect Looker to `ga_ds.api_portal` ✅ | Flat columns, pre-aggregated, fast, fully controlled by your team |

---

## 3. Data Source: `ga_ds.api_portal`

In Looker Studio, a **Data Source** is the connection between the report and a table or query result.

For this project:

- **Data Source type**: BigQuery
- **Project**: `one-global-ecommerce-stage`
- **Dataset**: `ga_ds`
- **Table**: `api_portal`

Once connected, all columns in `ga_ds.api_portal` become available as **Dimensions** (text/category fields) or **Metrics** (numeric fields) in Looker Studio.

| Looker Studio concept | Meaning | Example from this project |
|---|---|---|
| **Dimension** | A descriptive field you group or filter by | `event_name`, `geo_country`, `device_category` |
| **Metric** | A numeric value you aggregate | `event_count`, `SUM(event_count)`, `COUNT(DISTINCT session_id)` |
| **Date range control** | Filter the report by `event_date` | "Last 30 days", "Aug 2026" |

---

## 4. The 4 KPI Areas

The dashboard covers four business KPI areas, each answered by different events and dimensions from `ga_ds.api_portal`.

### KPI Area 1 — Traffic & Discoverability
*How are users finding and arriving at the API Portal?*

| Metric | How to compute | Relevant columns |
|---|---|---|
| Total sessions | `COUNT(DISTINCT session_id)` | `session_id`, `event_date` |
| Unique users | `COUNT(DISTINCT user_pseudo_id)` | `user_pseudo_id`, `event_date` |
| Logged-in vs anonymous ratio | Filter `ecom_user_id != '(Anonymous)'` vs total | `ecom_user_id` |
| Traffic by country | Group by `geo_country` | `geo_country`, `event_count` |
| Traffic by device | Group by `device_category` | `device_category`, `event_count` |
| Top traffic sources | Group by `first_touch_source`, `first_touch_medium` | `first_touch_source`, `first_touch_medium` |
| Page views over time | Filter `event_name = 'page_view'`, group by date | `event_date`, `event_count` |

Relevant events: `page_view`, `session_start`, `first_visit`

---

### KPI Area 2 — Product Discovery
*Which APIs and EDI products are users exploring?*

| Metric | How to compute | Relevant columns |
|---|---|---|
| Most viewed API products | Group by `product_name` where `product_type = 'api'` | `product_name`, `event_count` |
| Most downloaded EDI specs | Filter `event_name = '[Shipping API EDI Catalog] EDI Download Clicked'` | `product_name`, `product_type` |
| Top searched terms | Filter `event_name = '[Shipping API EDI Catalog] Search Used'` | `tab`, `event_count` |
| Sort usage | Filter `event_name = '[Shipping API EDI Catalog] Sort Changed'` | `sort_value` |
| Category popularity | Group by `product_category` | `product_category`, `event_count` |
| API Playground usage | Filter `event_name = '[Shipping API EDI Catalog] API Detail Playground Clicked'` | `product_id`, `event_count` |

Relevant events: `[Shipping API EDI Catalog] *`

---

### KPI Area 3 — Conversion to Service Request
*Are users completing the integration request form?*

| Metric | How to compute | Relevant columns |
|---|---|---|
| Form start rate | Count `[Integration Request] Submit Form Started` | `event_name`, `event_date` |
| Completion rate | Count `Completed` / Count `Started` | `event_name` |
| Drop-off rate | Count `Drop-off` / Count `Started` | `event_name` |
| Avg time to complete | Avg of `timeToCompleteMs` param | Not currently in `api_portal` schema (add if needed) |
| Incomplete sections at drop-off | Filter `Drop-off`, group by `is_complete_*` columns | `is_complete_company_information`, etc. |
| Journey path to form | Filter `[Journey Tracker]` events | `journey_path`, `start_path`, `endpoint_path` |
| Validation error fields | Filter `Validation Errors` event | Not currently in `api_portal` schema (add if needed) |

Relevant events: `[Integration Request] *`, `[Journey Tracker] *`

---

### KPI Area 4 — FAQ Behavior
*Which FAQs do users engage with most?*

| Metric | How to compute | Relevant columns |
|---|---|---|
| Most expanded FAQs | Filter `[FAQ] Expand FAQ`, group by `faq_question_text` | `faq_question_text`, `event_count` |
| Top FAQ categories | Group by `faq_category_name` | `faq_category_name`, `event_count` |
| Category selection vs expansion | Compare `Select FAQ Category` vs `Expand FAQ` counts | `event_name` |

Relevant events: `[FAQ] *`

---

## 5. Key Looker Studio Formulas

These calculated fields are commonly needed when building charts:

**Unique sessions (custom metric)**
```
COUNT_DISTINCT(session_id)
```

**Unique users (custom metric)**
```
COUNT_DISTINCT(user_pseudo_id)
```

**Completion rate (calculated field)**
```
SUM(IF(event_name = '[Integration Request] Submit Form Completed', event_count, 0))
/
SUM(IF(event_name = '[Integration Request] Submit Form Started', event_count, 0))
```

**Logged-in user share (calculated field)**
```
SUM(IF(ecom_user_id != '(Anonymous)', event_count, 0))
/
SUM(event_count)
```

---

## 6. Data Freshness

Looker Studio reads `ga_ds.api_portal` at query time. Freshness depends on when the BigQuery scheduled query last ran:

| Scenario | Data freshness in Looker |
|---|---|
| Scheduled query ran today | Data up to D-1 (yesterday) |
| Scheduled query failed | Data up to the last successful run |
| Today's data needed | Not available by design (today excluded from window) |

> **D-1** = yesterday. Today's events are intentionally excluded from the pipeline window to avoid processing unstable intraday data.

To check last pipeline run: open BigQuery → **Scheduled Queries** → find the `ga_ds.api_portal` job → review run history.

---

## 7. Navigating Looker Studio: Where to Find Data Sources

When you open a Looker Studio report in edit mode (as seen in the UI), the screen has these areas:

```
┌──────────────────────────────────────────────────────────────┐
│  Top bar: File  Edit  View  Insert  Page  Arrange  Resource  │
│  Toolbar: Add data | Blend | Add a chart | Add a control...  │
├──────────────────────┬───────────────────────────────────────┤
│  Left panel          │  Canvas (report pages)                │
│  (page list)         │                                       │
│                      │                              ┌────────┤
│                      │                              │ Right  │
│                      │                              │ panel  │
│                      │                              │ (Data) │
└──────────────────────┴──────────────────────────────┴────────┘
```

### View data sources connected to this report

1. In the top menu bar: click **Resource**
2. Select **Manage added data sources**
3. A dialog lists all data sources currently connected to this report
4. Click **Edit** next to any data source to see its full configuration (connector type, project, dataset, table, field types)

### Add a new data source to the report

**Option A — from the toolbar (while editing):**
1. Click **Add data** in the toolbar
2. Select **BigQuery**
3. Choose project `one-global-ecommerce-stage` → dataset `ga_ds` → table `api_portal`
4. Click **Add**

**Option B — from the Resource menu:**
1. Top menu → **Resource** → **Manage added data sources**
2. Click **Add a data source** → follow the same BigQuery steps

### View/edit a data source's field configuration

1. Top menu → **Resource** → **Manage added data sources**
2. Find the data source (e.g. `api_portal`)
3. Click **Edit**
4. You can see all fields, rename them, change their type (e.g. Date, Number, Text), or add calculated fields

### What the right-side Data panel shows (in edit mode)

The right-side **Data** panel lists all data sources attached to the current page/chart. In your screenshot you can see entries like `api_portal`, `events_intraday_YYYYMMDD`, `one_user_unicorn` — these are all data sources connected to different charts across report pages. Clicking one selects it so you can drag its fields onto a chart.

### How to set up the data source for the first time

1. Open [Looker Studio](https://lookerstudio.google.com)
2. Open the existing report or create a new one
3. Top menu → **Resource** → **Manage added data sources** → **Add a data source**
4. Select **BigQuery** connector
5. Choose:
   - Project: `one-global-ecommerce-stage`
   - Dataset: `ga_ds`
   - Table: `api_portal`
6. Click **Connect** → review field list → ensure `event_date` is type **Date**
7. Click **Add to report**
8. Use `event_date` as the date range dimension in all charts built from this source

---

## 8. Caveats

- Looker Studio does **not** backfill or cache data — it always queries live from BigQuery.
- `event_count` counts raw hits (including duplicates within a session). Use `COUNT(DISTINCT session_id)` for session-level analysis.
- `(Anonymous)` is a sentinel value for unauthenticated users — exclude it when computing authenticated-user-only metrics.
- Looker Studio charts can be slow if the underlying table is unpartitioned and large. Consider adding a `PARTITION BY event_date` to `ga_ds.api_portal` if query times become an issue.
- Always apply a date range filter in every chart to avoid scanning the full table history unnecessarily.

---

## References

- BigQuery data source: `one-global-ecommerce-stage.ga_ds.api_portal`
- [Looker Studio report](https://datastudio.google.com) — existing "Unicorn demo KPI" report
- `schedule-query.sql` — upstream pipeline that populates `ga_ds.api_portal`
- Part 3: BigQuery Pipelines — explains `ga_ds.api_portal` schema in full detail

---

## Related

- Part 1: Google Tag Manager: Setup, Event Tracking, and Verification
- Part 3: BigQuery Pipelines: Transforming GA4 Raw Data into KPI Tables
- `gtm-ga4-bigquery-reference.md` — raw reference notes and SQL patterns

---

## 10) Dimension vs Metric — Concepts Explained

### Plain English definition

**Dimension** = a field that describes a **category or label** — the thing you group rows by.
It answers: *"per what?"*

**Metric** = a **number that is always computed through aggregation** (SUM, COUNT, AVG) relative to a dimension.
It answers: *"how many / how much?"*

### The key distinction from "just a column"

In a raw SQL table, every column is simply a column. But in Looker Studio (and analytics tools in general), columns are classified into one of two roles:

| Role | Type | Purpose | Examples |
|---|---|---|---|
| **Dimension** | Text, Date, Boolean | Group/categorize rows — the "per what" axis | `faq_question_text`, `geo_country`, `event_name`, `event_date` |
| **Metric** | Number | Aggregate per dimension — the "how many" axis | `SUM(event_count)`, `COUNT(DISTINCT session_id)` |

### Analogy: Excel pivot table

Think of it like building a pivot table:
- **Row labels** = Dimensions (the categories down the left column)
- **Values in cells** = Metrics (the numbers in each cell)

### Concrete example from this project

Goal: "Which FAQ questions were expanded most often?"

| Dimension | Metric |
|---|---|
| `faq_question_text` (one row per question) | `SUM(event_count)` (total expansions per question) |

Resulting table:

| faq_question_text | SUM(event_count) |
|---|---|
| How do your API products compare to your EDI products? | 20 |
| Is API or EDI a better choice for me? | 7 |
| Do I need to pay to use your APIs? | 5 |

- The **left column** (question text) = Dimension — it defines what each row represents
- The **right column** (count) = Metric — it's the aggregated number per dimension value

### Rule of thumb

- If the value is a text label or date → it's a Dimension
- If the value is a number you add up or count → it's a Metric
- A column like `event_count` in the raw table is technically a number column, but in Looker Studio it becomes a Metric when you apply `SUM(event_count)` to it

---

## 10) Dimension vs Metric: Concepts and Examples

### Plain-English definition

**Dimension** = a field that describes a **category or label** — the "per what" axis. It is what you group rows by.

**Metric** = a **number always computed from grouping** — aggregated (SUM, COUNT, AVG) relative to a dimension. It answers "how many/much" per dimension value.

The distinction is not just about data type. Both can be columns in a SQL table. The difference is their role in a chart or table:

> In a pivot table in Excel:
> - Row labels = Dimensions
> - Numbers in cells = Metrics

### Example from this project

| Dimension | Metric |
|---|---|
| `faq_question_text` (one row per question) | `SUM(event_count)` (total expands per question) |
| `geo_country` (one row per country) | `COUNT(DISTINCT session_id)` (unique sessions per country) |
| `event_date` (one row per day) | `SUM(event_count)` (total events per day) |
| `device_category` (one row per device type) | `COUNT(DISTINCT user_pseudo_id)` (unique users per device) |

### In Looker Studio terms

When you click a chart, the Setup panel shows:
- **Dimension** slot = drag a text/date column here (the grouping key)
- **Metric** slot = drag a numeric column here (the aggregated value)

Looker Studio will auto-aggregate the metric (default: SUM) per each unique combination of dimension values.

### Key rules

- A column can be either a Dimension or a Metric depending on how you use it — not fixed by its data type alone.
- A numeric column (e.g., `event_count`) used as a **Dimension** would group rows by each unique count value — valid but rarely useful.
- A text column (e.g., `event_name`) used as a **Metric** makes no sense — Looker won't allow it.
- `event_date` is a special Dimension: it enables date range controls and time-series charts.
