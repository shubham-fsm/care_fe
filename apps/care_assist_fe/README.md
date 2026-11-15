# OPD Saathi — CARE App (prototype)

The CARE Vitals + Suggestions Chrome widget rebuilt as a CARE plugin (Care App).

- `src/manifest.tsx` — puts `AssistPanel` in CARE's `Scribe` slot on the questionnaire form.
- `src/components/AssistPanel.tsx` — vitals, suggestions, tests, advice. Reads the form from CARE's
  own form state; "+ Diagnosis" adds the diagnosis to the form's Diagnosis question
  (verification: provisional), "+ Advice" appends to the Advice box. Nothing is saved until Submit.
- `src/engine/suggest.js` — the widget's 233 rules, unchanged (v1.1.12).
- `src/engine/vitals.js`, `thresholds.js` — vitals reading and thresholds from the widget.
- `src/engine/snomed_names.json` — 293 SNOMED codes for names production doctors already use.

## Run locally
Copy this folder to `care_fe/apps/care_assist_fe`, then in `care_fe`: `npm run dev`.
CARE's dev server finds `apps/*/src/manifest.tsx` on its own.

Prototype only: rules and advice are drafts that need clinician review; production use needs
tech-team and state approval. For production it must be built as a federated remote
(vite.config with `exposes: { "./manifest": "./src/manifest.tsx" }`) and enabled via plug config.
