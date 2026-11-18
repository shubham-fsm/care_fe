# IPD Ward Board: Metabase SQL (prototype)

These are read-only Metabase native questions for an IPD ward board, shown inside CARE through
[analytics_plug](https://github.com/ohcnetwork/analytics_plug). The idea came from a brainstorm with the Sadar Hospital Ramgarh medical team.

The prototype has been tested on local CARE with seeded demo data only. It has **not** been run on staging or production.

| File | Card | What it shows |
|---|---|---|
| `ward_board_counts.sql` | 4 number cards | Patients, doses due now, doses missed or not given, tests pending |
| `ward_board_meds.sql` | Table | One row per active medicine for each IPD patient, with the status of each MAR slot (12–6 AM, 6 AM–12 PM, 12–6 PM, 6 PM–12 AM) |
| `ward_board_tests.sql` | Table | Lab or service requests for each IPD patient: done, pending, or late |

## Variables (Metabase template tags, all of type Text)

| Tag | Embedding setting | Notes |
|---|---|---|
| `{{facility_id}}` | **Locked** | CARE sends the facility's external id in the signed embed token, so a user cannot switch to another facility |
| `{{ward}}` | Editable, optional | Dropdown with a static list of location names, for example Male Ward and Female Ward |
| `{{gender}}` | Editable, optional | Dropdown: male / female / transgender / non_binary |

Lines inside `[[ ... ]]` are skipped when an optional filter is left empty.

## Assumptions to review

- Expected MAR slots by frequency: OD → 6 AM–12 PM; BD → 6 AM–12 PM and 6 PM–12 AM; TDS → 6 AM–12 PM, 12–6 PM and 6 PM–12 AM; QID → all four slots.
- A test counts as late after 24 hours.
- Times are shown in Asia/Kolkata.
- Run these queries with a read-only database user, preferably on a replica.
