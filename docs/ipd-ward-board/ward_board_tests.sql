-- Ward Board: tests per bed (pending first).
SELECT CASE WHEN row_number() OVER w = 1 THEN l.name || coalesce(' · ' || pl.name, '') ELSE '' END AS "Bed",
       CASE WHEN row_number() OVER w = 1 THEN p.name ELSE '' END AS "Patient", sr.title AS "Test",
       CASE WHEN sr.status = 'completed' THEN '✓ done'
            WHEN now() - sr.created_date > interval '24 hours' THEN '⏳ pending > 24 h'
            ELSE '⏳ pending' END AS "Status"
FROM emr_servicerequest sr
JOIN emr_encounter e ON e.id = sr.encounter_id
JOIN facility_facility f ON f.id = e.facility_id
JOIN emr_patient p ON p.id = e.patient_id
LEFT JOIN emr_facilitylocation l ON l.id = e.current_location_id
LEFT JOIN emr_facilitylocation pl ON pl.id = l.parent_id
WHERE f.external_id = {{facility_id}}::uuid
  AND e.encounter_class = 'imp' AND e.status = 'in_progress'
  AND sr.deleted = false AND sr.status NOT IN ('entered_in_error', 'revoked')
  [[AND pl.name = {{ward}}]]
  [[AND p.gender = {{gender}}]]
WINDOW w AS (PARTITION BY e.id ORDER BY (sr.status = 'completed'), sr.title)
ORDER BY l.name, e.id, (sr.status = 'completed'), sr.title;
