You are working inside the HaiKieu repository.

Repository root:
C:\WorkSpace VSC\WorkSpace VSC\HaiKieu

The current Báo cáo page has been overbuilt and does not match the real business requirement.

CURRENT PROBLEM

The page currently contains multiple report tabs such as:

- Biến động tồn kho
- Doanh thu theo ngày
- Doanh thu theo tháng
- Theo nhóm
- Hóa đơn VAT đầu vào

This is unnecessary.

The real required reporting scope is ONLY:

1. Tổng giá trị hóa đơn đầu vào (VAT)
2. Tổng doanh thu

Both metrics must support filtering by:

- Ngày
- Tháng
- Năm

The page must be simplified and polished accordingly.

==================================================
PRIMARY OUTCOME
==================================================

Redesign and refactor the HaiKieu Báo cáo page into a focused, trustworthy financial summary screen containing only:

A. Tổng giá trị hóa đơn VAT đầu vào
B. Tổng doanh thu

with a shared date-period filter supporting Day / Month / Year.

The result must feel like a finished production feature, not a prototype.

==================================================
P0 — REMOVE UNNECESSARY REPORTS
==================================================

Remove the current report concepts from the page UI:

- Biến động tồn kho
- Doanh thu theo ngày tab
- Doanh thu theo tháng tab
- Theo nhóm
- inventory-related calculations
- category-level reporting
- unnecessary explanatory formula panels

Do not leave dead tabs or hidden unused UI.

Do not keep unnecessary state or service calculations after the redesign.

Keep only the two required metrics.

==================================================
P0 — REAL DATA SOURCES
==================================================

Audit the actual repository/schema before editing.

The expected sources currently appear to be:

VAT INPUT:
`invoices`

Relevant evidence currently suggests:

- invoice_type = 'VAT'
- issue_date
- total_amount

REVENUE:
`sales_tickets`

Relevant evidence currently suggests:

- sale_date
- total_amount

Verify these against the actual repository before implementation.

Do not use mock data.
Do not use local hardcoded values.
Do not silently fall back to zero when a query fails.

==================================================
P0 — METRIC DEFINITIONS
==================================================

Metric 1:

Tổng giá trị hóa đơn đầu vào

Definition:

Sum real `invoices.total_amount`

filtered by:

`invoice_type = 'VAT'`

and the selected reporting period using `issue_date`.

Do NOT substitute:

- price_history purchase cost
- product import cost
- inventory cost

unless repository evidence proves that `invoices.total_amount` is not the correct invoice total.

Metric 2:

Tổng doanh thu

Definition:

Sum real `sales_tickets.total_amount`

for the selected reporting period using `sale_date`.

Do not mix sales revenue with purchase/inventory cost.

==================================================
P0 — REPORT PERIOD FILTER
==================================================

Create ONE shared report-period control.

The user can choose:

[ Ngày ] [ Tháng ] [ Năm ]

Behavior:

### Ngày

Show an actual date selector.

Example:

23/09/2026

Query range:

selected day 00:00
→ next day exclusive

### Tháng

Show month + year selection.

Example:

Tháng 9 / 2026

Query range:

2026-09-01
→ 2026-10-01 exclusive

### Năm

Show year selection.

Example:

2026

Query range:

2026-01-01
→ 2027-01-01 exclusive

Use safe local date handling.

Avoid timezone bugs.

Do not use string hacks that can shift the selected date because of UTC conversion.

==================================================
P0 — FILTER UX
==================================================

The filter must be compact and obvious.

Recommended structure:

Báo cáo

[ Ngày | Tháng | Năm ]

[ period selector                  ] [ Làm mới ]

Below it:

Đang xem:
23/09/2026

or

Tháng 09/2026

or

Năm 2026

Changing the reporting period should trigger the correct refresh.

Avoid unnecessary network requests.

"Làm mới" should genuinely refetch current data.

==================================================
P0 — REPORT SERVICE REFACTOR
==================================================

Refactor:

src/services/reportService.js

Remove unused report calculations related to:

- product groups
- inventory movements
- purchase-cost aggregation
- daily/monthly tab models
- category reporting

if they are no longer used elsewhere.

Create a focused API such as conceptually:

fetchFinancialSummary({
  mode,
  date,
  month,
  year
})

Return something like:

{
  period: {
    mode,
    from,
    to,
    label
  },

  vatInput: {
    totalAmount,
    invoiceCount
  },

  revenue: {
    totalAmount,
    ticketCount
  }
}

Exact naming should follow repository conventions.

The UI must consume this clean view model.

==================================================
P0 — QUERY SAFETY
==================================================

Ensure queries:

- use proper period bounds
- do not double-count rows
- ignore invalid totals explicitly
- distinguish query failure from legitimate zero
- work correctly when there are no records

If data exists but some rows contain invalid numeric values:

do not silently corrupt the total.

Surface a bounded data-quality warning only if necessary.

==================================================
P1 — UI REDESIGN
==================================================

Because this page only has two key numbers, make the visual quality high.

Do NOT make the screen feel empty or unfinished.

The hierarchy should be:

Báo cáo
period filter

then two strong financial summary cards.

Example conceptual layout:

┌──────────────────────────────┐
│ HÓA ĐƠN VAT ĐẦU VÀO          │
│                              │
│ 156.420.000 ₫                │
│                              │
│ 42 hóa đơn                   │
│ Trong tháng 09/2026          │
└──────────────────────────────┘

┌──────────────────────────────┐
│ DOANH THU                    │
│                              │
│ 84.520.000 ₫                 │
│                              │
│ 127 phiếu bán                │
│ Trong tháng 09/2026          │
└──────────────────────────────┘

Do not copy this literally if a better HaiKieu-native composition exists.

==================================================
P1 — CARD DESIGN
==================================================

Each metric card should contain:

- clear label
- prominent currency value
- relevant record count
- active reporting period
- subtle icon
- optional secondary source label

Example:

Tổng giá trị hóa đơn đầu vào

156.420.000 ₫

42 hóa đơn VAT
Tháng 09/2026

And:

Tổng doanh thu

84.520.000 ₫

127 phiếu bán
Tháng 09/2026

Do not show unnecessary accounting formulas inside the normal UI.

==================================================
P1 — VISUAL STYLE
==================================================

Follow the existing HaiKieu visual language:

- navy/blue primary
- white surfaces
- light slate borders
- restrained shadows
- rounded corners
- clear typography
- professional accounting/business feel

Avoid:

- excessive gradients
- rainbow cards
- unnecessary badges
- too many borders
- tiny text
- decorative charts with no business purpose

The page should feel mature and trustworthy.

==================================================
P1 — MOBILE
==================================================

Mobile target:

390 × 844

Requirements:

- no horizontal overflow
- filters fit cleanly
- segmented Ngày / Tháng / Năm control is easy to tap
- currency values remain readable
- cards do not feel cramped
- spacing feels intentional
- no unnecessary scrolling

Suggested mobile layout:

title
filter mode
period picker + refresh

VAT card

Revenue card

==================================================
P1 — DESKTOP
==================================================

Desktop target:

1440 × 900

Use horizontal space.

Suggested:

header/filter row

two metric cards side-by-side

Do NOT render a narrow mobile column in the center of desktop.

The cards can be larger and more informative on desktop while keeping the same data.

==================================================
P1 — LOADING / ERROR / EMPTY
==================================================

Loading:

Use proper skeletons for the two metric cards.

Do not flash fake zero values.

Error:

Show one clean error state:

"Không thể tải dữ liệu báo cáo"

with:

[ Thử lại ]

Zero-data period:

Display:

0 ₫

with supporting text such as:

"Không có hóa đơn VAT trong kỳ này"

or

"Không có doanh thu trong kỳ này"

Zero data is not an error.

==================================================
P1 — NUMBER FORMATTING
==================================================

Use consistent Vietnamese money formatting.

Correct:

156.420.000 ₫

2.421.412 ₫

0 ₫

Never render:

-0 ₫
+0
NaN
undefined

==================================================
P1 — ACCESSIBILITY
==================================================

Ensure:

- filter controls have labels
- keyboard focus is visible
- buttons have accessible names
- selected period mode has aria state where appropriate
- date/month/year controls are usable with keyboard

==================================================
P2 — OPTIONAL SMALL POLISH
==================================================

Only after everything above works:

A small subtitle may show:

"Tổng hợp dữ liệu tài chính theo kỳ"

or similar.

A subtle source note can be used, such as:

"Dữ liệu được tổng hợp từ hóa đơn VAT và phiếu bán hàng."

Do NOT add charts, tables, trends, percentages, comparisons, category reports, or additional KPIs unless explicitly required.

The requirement is intentionally small.

Polish the two metrics instead of creating more features.

==================================================
MUST NEVER HAPPEN
==================================================

- Never reintroduce inventory reporting.
- Never add extra report tabs.
- Never add charts just to fill space.
- Never fake financial values.
- Never convert query failure into 0.
- Never use purchase cost as invoice total.
- Never mix inventory cost with sales revenue.
- Never double-count records.
- Never create a new backend server unnecessarily.
- Never bypass Supabase RLS.
- Never expose privileged credentials.
- Never hardcode the current year as the only usable period.
- Never leave dead reportService code after removing old reports.
- Never create a visually empty page simply because there are only two KPIs.

==================================================
TESTS
==================================================

Add/refactor focused report tests.

At minimum:

1. VAT total for a single selected day
2. Revenue total for a single selected day
3. VAT total for selected month
4. Revenue total for selected month
5. VAT total for selected year
6. Revenue total for selected year
7. correct period boundaries
8. empty period returns legitimate zero
9. query failure is not displayed as zero
10. invalid numeric rows are handled safely
11. date/month/year selection does not shift due to timezone
12. record counts are correct

Remove obsolete tests for report functionality that no longer exists.

==================================================
BROWSER VERIFICATION
==================================================

Use the HaiKieu browser verification infrastructure.

Verify:

Mobile:
390 × 844

Desktop:
1440 × 900

For each:

- Ngày mode
- Tháng mode
- Năm mode
- period control
- refresh
- loaded values
- zero-data state
- no overflow
- no console errors
- no page errors

Use the REAL report page and real data.

Do not validate through a fake screenshot-only fixture.

==================================================
ACCEPTANCE CRITERIA
==================================================

The task is complete only when:

1. Báo cáo contains exactly the two required financial metrics.
2. All obsolete reporting tabs are removed.
3. VAT total uses verified real VAT invoice data.
4. Revenue uses verified real sales data.
5. Both metrics filter correctly by day.
6. Both metrics filter correctly by month.
7. Both metrics filter correctly by year.
8. Record counts correspond to the same period.
9. Query failure is distinguishable from zero.
10. UI is polished on mobile.
11. UI is polished on desktop.
12. Loading, error and zero states are complete.
13. Obsolete report service logic is removed safely.
14. Automated tests pass.
15. Production build passes.
16. Browser verification passes.
17. No unrelated functionality is changed.

==================================================
FINAL REPORT
==================================================

Report:

- old report functionality removed
- final report architecture
- exact VAT data source
- exact revenue data source
- day/month/year period-bound logic
- report service API
- files changed
- tests executed
- real database verification
- mobile browser verification
- desktop browser verification
- remaining limitations, if any

Do not claim completion until the actual visual result looks like a finished HaiKieu feature.