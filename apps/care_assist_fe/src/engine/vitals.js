// @ts-nocheck
// Vitals reading copied from the Chrome widget (content.js v1.1.12): LOINC / SNOMED codes, BP in all its stored forms.
  const VITALS = [
    { key: "bp", label: "BP", codes: ["85354-9", "55284-4", "35094-2", "75367002", "46973005", "364090009"], re: /blood\s*pressure|^bp\b/i },
    { key: "pulse", label: "Pulse", codes: ["8867-4", "8889-8"], re: /pulse|heart\s*rate/i },
    { key: "temp", label: "Temp", codes: ["8310-5", "8331-1", "8333-7"], re: /temperature|^temp\b/i },
    { key: "spo2", label: "SpO₂", codes: ["59408-5", "2708-6", "20564-1"], re: /spo2|sp\s*o2|oxygen\s*sat/i },
    { key: "rr", label: "Resp. rate", codes: ["9279-1"], re: /resp/i },
    { key: "rbs", label: "RBS", codes: ["2339-0", "15074-8", "2345-7", "41653-7"], re: /glucose|sugar|\brbs\b|grbs/i },
    { key: "weight", label: "Weight", codes: ["29463-7", "3141-9"], re: /weight/i },
    { key: "height", label: "Height", codes: ["8302-2", "8306-3"], re: /height/i },
    { key: "bmi", label: "BMI", codes: ["39156-5"], re: /\bbmi\b|body\s*mass/i },
  ];
  // Systolic / diastolic: LOINC (incl. sitting / standing / lying) and SNOMED codes, or the name.
  const SYS = ["8480-6", "8459-0", "8460-8", "8461-6", "271649006", "72313002", "163030003"];
  const DIA = ["8462-4", "8453-3", "8454-1", "8455-8", "271650006", "1091811000000102", "163031004"];
  const SYS_RE = /systolic|\bsbp\b|\bsys\b|upper (bp|reading)/i, DIA_RE = /diastolic|\bdbp\b|\bdia\b|lower (bp|reading)/i;
  // IPD encounters can have hundreds of chart entries (intake/output, nursing notes) after the last
  // BP. So vitals are also asked for by their LOINC codes, and the two lists are merged.
  const VCODES = [...new Set(VITALS.flatMap((v) => v.codes).concat(SYS, DIA))].join(",");
  const merge = (...lists) => { const seen = new Set(), out = []; for (const l of lists) for (const o of (l && l.results) || []) if (o && !seen.has(o.id)) { seen.add(o.id); out.push(o); } return { results: out }; };
  const num = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
  // Short units: CARE often stores long names ("Beats / minute", "degree Fahrenheit").
  const SHORT = [
    [/beats?\s*\/\s*min|\/min$|per\s*min/i, "/min"], [/breaths?\s*\/\s*min/i, "/min"],
    [/fahrenheit|\[degF\]|degF/i, "\u00b0F"], [/celsius|\bCel\b|\[degC\]/i, "\u00b0C"],
    [/^percent$|^%$/i, "%"], [/mm\s*\[?hg\]?|millimet.*mercury/i, "mmHg"],
    [/milligram.*decilit|mg\/dl/i, "mg/dL"], [/millimol.*lit|mmol\/l/i, "mmol/L"],
    [/^kilogram|^kg$/i, "kg"], [/^gram|^g$/i, "g"], [/centimet|^cm$/i, "cm"], [/kg\/m2|kg\/m\^2/i, "kg/m\u00b2"],
  ];
  const unitOf = (val) => {
    const raw = ((val && val.unit && (val.unit.code || val.unit.display)) || "").trim();
    const disp = ((val && val.unit && val.unit.display) || "").trim();
    for (const [re, short] of SHORT) if (re.test(raw) || re.test(disp)) return short;
    return raw.length > 8 ? "" : raw;
  };
  const codeOf = (c) => (c && c.code) || "";
  const nameOf = (c) => (c && c.display) || "";
  const valid = (iso) => iso && !Number.isNaN(new Date(iso).getTime());
  const time = (iso) => valid(iso) ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const date = (iso) => valid(iso) ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "";
  function whichVital(obs) {
    const c = codeOf(obs.main_code), n = nameOf(obs.main_code);
    if (SYS.includes(c) || SYS_RE.test(n)) return "sys";
    if (DIA.includes(c) || DIA_RE.test(n)) return "dia";
    for (const v of VITALS) if (v.codes.includes(c)) return v.key;
    for (const v of VITALS) if (v.re.test(n)) return v.key;
    return null;
  }

  // BP typed into a form whose "Systolic BP" / "Diastolic BP" questions have no code is saved only in
  // the form response, not as an observation (e.g. the nurses' IP vitals chart). Read it from there.
  function bpFromForms(res) {
    const out = [];
    for (const r of (res && res.results) || []) {
      if (!r || r.status === "entered_in_error") continue;
      const text = {};
      const walk = (qs) => { for (const q of qs || []) { if (q && q.id) text[q.id] = q.text || ""; if (q && q.questions) walk(q.questions); } };
      walk(r.questionnaire && r.questionnaire.questions);
      let sys = null, dia = null;
      for (const a of r.responses || []) {
        const t = text[a.question_id] || "", v = num(a.values && a.values[0] && a.values[0].value);
        if (v == null) continue;
        if (sys == null && SYS_RE.test(t)) sys = v; else if (dia == null && DIA_RE.test(t)) dia = v;
      }
      if (sys != null && dia != null && sys >= 40 && sys <= 300 && dia >= 20 && dia <= 200) out.push({ sys, dia, at: r.created_date, by: r.created_by });
    }
    return out;
  }

  // Latest value of each vital from a list of observations (newest first).
  // BP can be stored in several ways; all are collected and the most recent reading wins:
  //  - one BP observation with systolic / diastolic components, or a "120/80" text value
  //  - separate systolic and diastolic observations (e.g. a "BP (mm of Hg)" group with
  //    "Systolic BP" and "Diastolic BP" questions, as in the Jharkhand IP vitals chart)
  //  - two plain numbers both coded as "blood pressure" at the same time: higher = systolic
  function pick(list, extraBp) {
    const out = {};
    const t = (iso) => (valid(iso) ? new Date(iso).getTime() : 0);
    const bpC = [], sysL = [], diaL = [], bpNums = [];
    for (const o of list) {
      if (o.status === "entered_in_error") continue;
      const k = whichVital(o);
      if (!k) continue;
      const by = o.data_entered_by || o.created_by, at = o.effective_datetime;
      if (k === "bp") {
        const comps = o.component || [];
        const s = comps.find((x) => SYS.includes(codeOf(x.code)) || SYS_RE.test(nameOf(x.code)));
        const d = comps.find((x) => DIA.includes(codeOf(x.code)) || DIA_RE.test(nameOf(x.code)));
        const raw = o.value && o.value.value;
        if (s && d) bpC.push({ sys: num(s.value && s.value.value), dia: num(d.value && d.value.value), at, by });
        else if (raw && /^\s*\d{2,3}\s*\/\s*\d{2,3}\s*$/.test(raw)) { const [x, y] = raw.split("/").map(num); bpC.push({ sys: x, dia: y, at, by }); }
        else if (num(raw) != null) bpNums.push({ v: num(raw), at, by });
        continue;
      }
      if (k === "sys") { sysL.push({ v: num(o.value && o.value.value), at, by }); continue; }
      if (k === "dia") { diaL.push({ v: num(o.value && o.value.value), at, by }); continue; }
      if (!out[k]) out[k] = { v: num(o.value && o.value.value), raw: o.value && o.value.value, u: unitOf(o.value), at, by };
    }
    // separate systolic + diastolic: pair each systolic with the diastolic closest in time (within 30 min)
    for (const s of sysL) {
      const d = diaL.slice().sort((a, b) => Math.abs(t(a.at) - t(s.at)) - Math.abs(t(b.at) - t(s.at)))[0];
      if (d && Math.abs(t(d.at) - t(s.at)) <= 1800000) bpC.push({ sys: s.v, dia: d.v, at: t(s.at) >= t(d.at) ? s.at : d.at, by: s.by || d.by });
    }
    // two plain numbers coded as BP at the same time
    const seen = new Set();
    for (const a of bpNums) {
      if (seen.has(a)) continue;
      const pair = bpNums.filter((b) => b !== a && !seen.has(b) && Math.abs(t(b.at) - t(a.at)) <= 60000);
      if (pair.length === 1) { const b = pair[0]; seen.add(a); seen.add(b); bpC.push({ sys: Math.max(a.v, b.v), dia: Math.min(a.v, b.v), at: a.at, by: a.by || b.by }); }
    }
    for (const x of extraBp || []) bpC.push(x);
    if (bpC.length) out.bp = bpC.sort((a, b) => t(b.at) - t(a.at))[0];
    if (!out.bmi && out.weight && out.height && out.weight.v && out.height.v) {
      const m = out.height.u.includes("cm") || out.height.v > 3 ? out.height.v / 100 : out.height.v;
      const bmi = m > 0.3 ? Math.round((out.weight.v / (m * m)) * 10) / 10 : 0;
      // Only when weight and height look like the same adult/child (e.g. not a newborn's weight with the mother's height)
      if (bmi >= 10 && bmi <= 70) out.bmi = { v: bmi, u: "", calc: true };
    }
    return out;
  }

  // Thresholds live in thresholds.js (shared with suggest.js) and depend on the patient's age.
  function ageMonths(pt) {
    const now = new Date();
    if (pt && pt.date_of_birth) { const d = new Date(pt.date_of_birth); if (!Number.isNaN(d.getTime())) return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth() - (now.getDate() < d.getDate() ? 1 : 0)); }
    if (pt && Number.isInteger(pt.year_of_birth)) return Math.max(0, (now.getFullYear() - pt.year_of_birth) * 12);
    return null;
  }
  const ageLabel = (m) => (m == null ? "" : m < 24 ? `${m} mo` : `${Math.floor(m / 12)} y`);
export { VITALS, VCODES, merge, whichVital, bpFromForms, pick, ageMonths, ageLabel, valid, time, date };
