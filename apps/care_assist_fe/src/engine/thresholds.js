// @ts-nocheck
// CARE widget — shared vital-sign thresholds (used by the vitals panel AND the suggestions,
// so the two never disagree). Sources: see "Indian OPD symptoms diagnoses and tests" report.
//   NP-NCD Operational Guidelines 2023; ICMR STW Hypertension, Cardiology, Pulmonology, Neurology;
//   ICMR Antimicrobial Treatment Guidelines 2019 (fever red flags); MoHFW Respiratory STG 2016/2017
//   and IMNCI (child fast breathing, young-infant temperature).
// Child pulse and 5-17 year breathing-rate flags are OFF: no Indian source for normal ranges was found.
(() => {
  "use strict";
  // IMNCI fast breathing (breaths/min) by age in months; null = no sourced threshold.
  const rrFast = (ageM) => (ageM == null ? null : ageM < 2 ? 60 : ageM < 12 ? 50 : ageM < 60 ? 40 : null);
  const isAdult = (ageM) => ageM == null || ageM >= 216; // unknown age is treated as adult
  const toF = (v) => (v < 45 ? v * 9 / 5 + 32 : v);

  // "hi" / "lo" / "" for the vitals panel.
  function flag(k, x, ageM) {
    if (!x) return "";
    if (k === "bp") {
      if (!isAdult(ageM)) return ""; // child BP norms not covered
      if (x.sys >= 140 || x.dia >= 90) return "hi"; // NP-NCD / ICMR STW HTN
      if (x.sys < 90) return "lo"; // ICMR red flag (SBP < 90)
      return "";
    }
    const v = x.v; if (v == null) return "";
    if (k === "pulse") return isAdult(ageM) ? (v > 100 ? "hi" : v < 60 ? "lo" : "") : "";
    if (k === "temp") { const f = toF(v); const low = ageM != null && ageM < 2 ? 95.9 : 95; return f >= 99.5 ? "hi" : f < low ? "lo" : ""; }
    if (k === "spo2") return v < 94 ? "lo" : "";
    if (k === "rr") {
      if (isAdult(ageM)) return v > 24 ? "hi" : v < 12 ? "lo" : ""; // ICMR TG: RR > 24 fever red flag
      const fast = rrFast(ageM); return fast && v >= fast ? "hi" : "";
    }
    if (k === "rbs") return v >= 140 ? "hi" : v < 70 ? "lo" : ""; // NP-NCD: >=140 suspected diabetes, confirm
    return "";
  }

  // Urgent findings from vitals: always shown in a red banner, never hidden.
  function urgent(cur, ageM) {
    const out = [];
    const adult = isAdult(ageM);
    const bp = cur.bp, pulse = cur.pulse && cur.pulse.v, rr = cur.rr && cur.rr.v, spo2 = cur.spo2 && cur.spo2.v, temp = cur.temp && cur.temp.v;
    if (bp && bp.sys != null && bp.sys < 90) out.push("Systolic BP below 90 — shock risk, act now");
    if (adult && bp && (bp.sys >= 180 || bp.dia >= 110)) out.push("BP ≥ 180/110 — start treatment and refer (NP-NCD); emergency if organ symptoms");
    if (spo2 != null && spo2 < 90) out.push("SpO₂ below 90% — give oxygen, emergency");
    else if (spo2 != null && spo2 < 92) out.push("SpO₂ below 92% — severe, refer");
    if (adult && rr != null && rr > 30) out.push("Respiratory rate above 30 — severe, refer");
    if (ageM != null && ageM < 60 && rr != null && rr > 70) out.push("Child breathing above 70/min — severe, refer (IMNCI)");
    if (adult && pulse != null && (pulse > 120 || pulse < 50)) out.push(`Pulse ${pulse} — urgent assessment`);
    if (ageM != null && ageM < 2 && temp != null) { const f = toF(temp); if (f >= 99.5 || f < 95.9) out.push("Young infant with abnormal temperature — possible serious infection, refer (IMNCI)"); }
    return out;
  }

  globalThis.CVW_T = { rrFast, flag, urgent, isAdult };
  if (typeof module !== "undefined") module.exports = globalThis.CVW_T;
})();
export default globalThis.CVW_T;
