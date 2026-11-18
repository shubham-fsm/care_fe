-- Ward Board: today's medicine rounds per bed (Metabase native query).
-- {{facility_id}} is a locked text filter, filled in by CARE (analytics_plug).
-- {{ward}} and {{gender}} are optional dashboard filters; lines in [[ ]] are skipped when empty.
WITH params AS (SELECT {{facility_id}}::uuid AS facility_ext,
                       (now() AT TIME ZONE 'Asia/Kolkata')::date AS today,
                       extract(hour FROM now() AT TIME ZONE 'Asia/Kolkata')::int / 6 AS cur_slot),
ipd AS (
  SELECT e.id AS enc_id, p.name AS patient, l.name AS bed, pl.name AS ward,
         (current_date - (e.period->>'start')::date) + 1 AS day_of_stay
  FROM emr_encounter e
  JOIN facility_facility f ON f.id = e.facility_id
  JOIN emr_patient p ON p.id = e.patient_id
  LEFT JOIN emr_facilitylocation l ON l.id = e.current_location_id
  LEFT JOIN emr_facilitylocation pl ON pl.id = l.parent_id
  WHERE f.external_id = (SELECT facility_ext FROM params)
    AND e.encounter_class = 'imp' AND e.status = 'in_progress' AND e.deleted = false
    [[AND pl.name = {{ward}}]]      -- optional Ward filter (e.g. Male Ward / Female Ward)
    [[AND p.gender = {{gender}}]]   -- optional Gender filter (male / female / transgender / non_binary)
),
meds AS (
  SELECT i.*, mr.id AS mr_id, mr.medication->>'display' AS medicine,
         coalesce(mr.dosage_instruction->0->'timing'->'code'->>'code', '') AS freq,
         coalesce((mr.dosage_instruction->0->'timing'->'repeat'->>'frequency')::int, 0) AS per_day
  FROM ipd i JOIN emr_medicationrequest mr ON mr.encounter_id = i.enc_id AND mr.status = 'active' AND mr.deleted = false
),
given AS (
  SELECT ma.request_id, extract(hour FROM ma.occurrence_period_start AT TIME ZONE 'Asia/Kolkata')::int / 6 AS slot,
         bool_or(ma.status = 'completed') AS done, bool_or(ma.status = 'not_done') AS not_done,
         min(to_char(ma.occurrence_period_start AT TIME ZONE 'Asia/Kolkata', 'HH24:MI')) AS at
  FROM emr_medicationadministration ma
  WHERE ma.deleted = false AND ma.status <> 'entered_in_error'
    AND (ma.occurrence_period_start AT TIME ZONE 'Asia/Kolkata')::date = (SELECT today FROM params)
  GROUP BY 1, 2
),
cells AS (
  SELECT m.*, s.slot,
    CASE
      WHEN g.done THEN '✓ ' || g.at
      WHEN g.not_done THEN '✗ not given'
      WHEN NOT (s.slot = ANY (CASE m.per_day WHEN 1 THEN ARRAY[1] WHEN 2 THEN ARRAY[1,3] WHEN 3 THEN ARRAY[1,2,3]
                                             ELSE CASE WHEN m.per_day >= 4 THEN ARRAY[0,1,2,3] ELSE ARRAY[]::int[] END END)) THEN ''
      WHEN s.slot < (SELECT cur_slot FROM params) THEN '! missed'
      WHEN s.slot = (SELECT cur_slot FROM params) THEN '⏰ due'
      ELSE '·'
    END AS state
  FROM meds m CROSS JOIN generate_series(0, 3) AS s(slot)
  LEFT JOIN given g ON g.request_id = m.mr_id AND g.slot = s.slot
)
, grid AS (
  SELECT bed, ward, patient, day_of_stay, medicine, freq,
         max(state) FILTER (WHERE slot = 0) AS s0, max(state) FILTER (WHERE slot = 1) AS s1,
         max(state) FILTER (WHERE slot = 2) AS s2, max(state) FILTER (WHERE slot = 3) AS s3
  FROM cells GROUP BY bed, ward, patient, day_of_stay, medicine, freq
)
-- Bed / patient shown only on the first medicine row of each patient (like the paper sheet).
SELECT CASE WHEN rn = 1 THEN bed || coalesce(' · ' || ward, '') ELSE '' END AS "Bed",
       CASE WHEN rn = 1 THEN patient || ' · Day ' || day_of_stay ELSE '' END AS "Patient",
       medicine || CASE WHEN freq <> '' THEN ' (' || freq || ')' ELSE '' END AS "Medicine",
       s0 AS "12–6 AM", s1 AS "6 AM–12 PM", s2 AS "12–6 PM", s3 AS "6 PM–12 AM"
FROM (SELECT g.*, row_number() OVER (PARTITION BY bed, patient ORDER BY medicine) AS rn FROM grid g) x
ORDER BY x.bed, x.patient, rn;
