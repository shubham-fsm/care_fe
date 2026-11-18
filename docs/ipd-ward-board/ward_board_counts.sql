-- Ward Board: top counts (one Metabase "number" card each; pick the column).
WITH p AS (SELECT {{facility_id}}::uuid AS fx,
                  (now() AT TIME ZONE 'Asia/Kolkata')::date AS today,
                  extract(hour FROM now() AT TIME ZONE 'Asia/Kolkata')::int / 6 AS cur),
ipd AS (SELECT e.id FROM emr_encounter e JOIN facility_facility f ON f.id = e.facility_id
        JOIN emr_patient pt ON pt.id = e.patient_id
        LEFT JOIN emr_facilitylocation l ON l.id = e.current_location_id LEFT JOIN emr_facilitylocation pl ON pl.id = l.parent_id
        WHERE f.external_id = (SELECT fx FROM p) AND e.encounter_class = 'imp' AND e.status = 'in_progress' AND e.deleted = false
        [[AND pl.name = {{ward}}]] [[AND pt.gender = {{gender}}]]),
mr AS (SELECT m.id, coalesce((m.dosage_instruction->0->'timing'->'repeat'->>'frequency')::int, 0) AS n
       FROM emr_medicationrequest m WHERE m.encounter_id IN (SELECT id FROM ipd) AND m.status = 'active' AND m.deleted = false),
slots AS (SELECT mr.id, s FROM mr, unnest(CASE mr.n WHEN 1 THEN ARRAY[1] WHEN 2 THEN ARRAY[1,3] WHEN 3 THEN ARRAY[1,2,3]
                                       ELSE CASE WHEN mr.n >= 4 THEN ARRAY[0,1,2,3] ELSE ARRAY[]::int[] END END) s),
adm AS (SELECT a.request_id, extract(hour FROM a.occurrence_period_start AT TIME ZONE 'Asia/Kolkata')::int / 6 AS s, a.status
        FROM emr_medicationadministration a
        WHERE a.deleted = false AND a.status <> 'entered_in_error'
          AND (a.occurrence_period_start AT TIME ZONE 'Asia/Kolkata')::date = (SELECT today FROM p))
SELECT
  (SELECT count(*) FROM ipd) AS "Patients",
  (SELECT count(*) FROM slots x WHERE x.s = (SELECT cur FROM p) AND NOT EXISTS (SELECT 1 FROM adm a WHERE a.request_id = x.id AND a.s = x.s)) AS "Doses due now",
  (SELECT count(*) FROM slots x WHERE x.s < (SELECT cur FROM p) AND NOT EXISTS (SELECT 1 FROM adm a WHERE a.request_id = x.id AND a.s = x.s AND a.status = 'completed')) AS "Missed / not given",
  (SELECT count(*) FROM emr_servicerequest r WHERE r.encounter_id IN (SELECT id FROM ipd) AND r.deleted = false
      AND r.status NOT IN ('completed', 'entered_in_error', 'revoked')) AS "Tests pending";
