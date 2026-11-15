import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import type { QuestionnaireFormState } from "../../../../src/components/Questionnaire/QuestionnaireForm";

import ENGINE from "../engine/suggest.js";
import CVW_T from "../engine/thresholds.js";
import {
  VCODES,
  ageLabel,
  ageMonths,
  bpFromForms,
  merge,
  pick,
} from "../engine/vitals.js";
import SNOMED from "../engine/snomed_names.json";
import { apiGet, searchCondition, type CodeConcept } from "../lib/api";

type Props = {
  formState: QuestionnaireFormState[];
  setFormState: React.Dispatch<React.SetStateAction<QuestionnaireFormState[]>>;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type Rule = {
  dx: string;
  search: string;
  searchBase?: string;
  why: string[];
  advice?: string;
};

const ROUTE =
  /\/facility\/([^/]+)\/patient\/([^/]+)\/encounter\/([^/]+)\/questionnaire/;
const ADVICE_Q = /^\s*(advice|advise|salah|सलाह)\b/i;
const SNOMED_SYSTEM = "http://snomed.info/sct";

// ---------- read the form from CARE's own form state (no page scraping)
function allQuestions(qs: any[] = [], out: Record<string, any> = {}) {
  for (const q of qs) {
    if (q?.id) out[q.id] = q;
    if (q?.questions) allQuestions(q.questions, out);
  }
  return out;
}

function complaintText(forms: QuestionnaireFormState[]) {
  const parts: string[] = [];
  for (const f of forms) {
    const qs = allQuestions(f.questionnaire?.questions as any[]);
    for (const r of f.responses || []) {
      const q = qs[r.question_id];
      if (r.structured_type === "symptom") {
        for (const s of (r.values?.[0]?.value as any[]) || [])
          if (s?.code?.display) parts.push(s.code.display);
        continue;
      }
      if (r.structured_type) continue; // diagnosis, medicines, etc. are not the complaint
      if (q && ADVICE_Q.test(q.text || "")) continue; // the advice box is the plan, not the complaint
      for (const v of r.values || [])
        if (typeof v.value === "string" && v.value.trim()) parts.push(v.value);
    }
  }
  return ENGINE.dropNegations(parts.join(" \n "));
}

function findResponse(
  forms: QuestionnaireFormState[],
  test: (r: any, q: any) => boolean,
) {
  for (let fi = 0; fi < forms.length; fi++) {
    const qs = allQuestions(forms[fi].questionnaire?.questions as any[]);
    const ri = (forms[fi].responses || []).findIndex((r) =>
      test(r, qs[r.question_id]),
    );
    if (ri >= 0) return { fi, ri };
  }
  return null;
}

// ---------- type into one of CARE's search boxes (tests; diagnosis only as last resort)
function setInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
    input,
    value,
  );
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
function openAndSearch(buttonText: string, value: string) {
  const btn = [
    ...document.querySelectorAll<HTMLButtonElement>("button[role=combobox]"),
  ].find(
    (b) =>
      b.offsetParent &&
      (b.innerText || "").trim().toLowerCase().startsWith(buttonText.toLowerCase()),
  );
  if (!btn) return false;
  btn.scrollIntoView({ block: "center" });
  btn.click();
  let n = 0;
  const iv = setInterval(() => {
    const input = [
      ...document.querySelectorAll<HTMLInputElement>(
        "input[role=combobox], [cmdk-input]",
      ),
    ].find((i) => i.offsetParent && !i.closest("#opd-saathi"));
    if (input) {
      clearInterval(iv);
      input.focus();
      setInput(input, value.slice(0, 120));
    } else if (++n > 20) clearInterval(iv);
  }, 100);
  return true;
}

// X-ray of the part named in the complaint (and its side); never an X-ray of another part.
const XPART: [RegExp, RegExp][] = [
  [/knee|ghutn/i, /knee/i], [/wrist|kalai/i, /wrist/i], [/ankle|takhn/i, /ankle/i],
  [/shoulder|kandh/i, /shoulder/i], [/elbow|kohni/i, /elbow/i],
  [/finger|thumb|ungli|hand|palm|haath/i, /hand|finger|thumb/i],
  [/toe|foot|feet|heel|pair|paon/i, /foot|toe|calcan/i], [/hip|pelvi|kulha/i, /hip|pelvi/i],
  [/forearm/i, /forearm|radius|ulna/i], [/thigh|femur|jangh/i, /femur|thigh/i],
  [/\bleg\b|shin|tibia|pindli/i, /lower leg|tibia|fibula|leg/i], [/neck|cervical|gardan/i, /cervical/i],
  [/lower back|lumbar|kamar|back/i, /lumbar|lumbo|sacral/i], [/chest|rib|seena|chhati/i, /chest|rib/i],
  [/skull|head|scalp|sir\b/i, /skull/i],
];
function xrayFor(text: string, hits: string[]) {
  const p = XPART.find(([re]) => re.test(text));
  if (!p) return null;
  const side =
    /\bleft\b/i.test(text) !== /\bright\b/i.test(text)
      ? /\bleft\b/i.test(text) ? "left" : "right"
      : null;
  const ok = hits.filter((n) => p[1].test(n));
  return (
    (side && ok.find((n) => new RegExp(`\\b${side}\\b`, "i").test(n))) ||
    ok.find((n) => !/\b(left|right)\b/i.test(n)) ||
    ok[0] ||
    null
  );
}

const localDate = () => {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

const adviceOf = (r: Rule) => {
  if (r.advice) return r.advice;
  const i = r.dx.indexOf(" — ");
  return i > 0
    ? `${r.dx.slice(0, i).replace(/\s*\([^)]*\)\s*$/, "")}: ${r.dx.slice(i + 3)}`
    : "";
};

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const VITAL_ROWS: [string, string][] = [
  ["bp", "BP"], ["pulse", "Pulse"], ["temp", "Temp"], ["spo2", "SpO₂"],
  ["rr", "Resp."], ["rbs", "RBS"], ["weight", "Weight"],
];

export default function AssistPanel({ formState, setFormState }: Props) {
  const m = window.location.pathname.match(ROUTE);
  const [open, setOpen] = useState(true);
  const [status, setStatus] = useState<Record<string, string>>({});
  const facilityId = m?.[1] || "";
  const patientId = m?.[2] || "";
  const encounterId = m?.[3] || "";

  // ---------- vitals + patient (read-only, refreshed every minute)
  const { data: ctx } = useQuery({
    queryKey: ["opd-saathi", "ctx", patientId, encounterId],
    enabled: !!encounterId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const pid = encodeURIComponent(patientId);
      const eid = encodeURIComponent(encounterId);
      const [pt, a, b, forms] = await Promise.all([
        apiGet<any>(`/api/v1/patient/${pid}/`).catch(() => null),
        apiGet<any>(`/api/v1/patient/${pid}/observation/?encounter=${eid}&limit=200`).catch(() => null),
        apiGet<any>(`/api/v1/patient/${pid}/observation/?encounter=${eid}&codes=${VCODES}&limit=200`).catch(() => null),
        apiGet<any>(`/api/v1/patient/${pid}/questionnaire_response/?encounter=${eid}&limit=30`).catch(() => null),
      ]);
      const list = merge(b, a).results.sort((x: any, y: any) =>
        String(y.effective_datetime).localeCompare(String(x.effective_datetime)),
      );
      return {
        vitals: pick(list, bpFromForms(forms)),
        ageM: ageMonths(pt),
        gender: pt?.gender as string | undefined,
      };
    },
  });

  // ---------- tests set up at this facility (activity definitions)
  const { data: facTests = [] } = useQuery({
    queryKey: ["opd-saathi", "tests", facilityId],
    enabled: !!facilityId,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const out: string[] = [];
      for (let off = 0; off < 3000; off += 200) {
        const j = await apiGet<any>(
          `/api/v1/facility/${encodeURIComponent(facilityId)}/activity_definition/?status=active&limit=200&offset=${off}`,
        ).catch(() => null);
        const rows = j?.results || [];
        out.push(...rows.map((x: any) => String(x.title || x.name || "")).filter(Boolean));
        if (rows.length < 200) break;
      }
      return out;
    },
  });

  // ---------- run the 233 rules on what the doctor has typed
  const text = useDebounced(useMemo(() => complaintText(formState), [formState]), 500);
  const result = useMemo(() => {
    const h = ENGINE.computeSignals(text, ctx?.vitals || {}, {
      ageMonths: ctx?.ageM,
      gender: ctx?.gender,
      facility: facilityId,
    });
    const r = ENGINE.rank(h);
    const T = ENGINE.TESTS as Record<string, any>;
    const all = (r.tests as string[])
      .filter((k) => T[k])
      .map((k) => {
        const hits = facTests.filter((n) => T[k].re.test(n) && !(T[k].not && T[k].not.test(n)));
        let hit = (T[k].prefer && hits.find((n) => T[k].prefer.test(n))) || hits[0];
        if (k === "XRAY") hit = xrayFor(h.text, hits);
        return { k, label: T[k].name as string, tier: (T[k].tier || "") as string, ad: (hit || null) as string | null };
      });
    const have = new Set(all.filter((t) => t.ad).map((t) => t.k));
    const covered = (t: { k: string }) => (t.k === "HB" && have.has("CBC")) || (t.k === "NS1" && have.has("DENGUE"));
    const tests = [...all.filter((t) => t.ad).slice(0, 8), ...all.filter((t) => !t.ad && !covered(t)).slice(0, 4)];
    return { h, ...r, tests } as any;
  }, [text, ctx, facTests, facilityId]);

  // Make room for the panel so it never covers the form (wide screens only).
  useEffect(() => {
    if (!encounterId) return;
    const wide = window.matchMedia("(min-width: 1100px)").matches;
    const prev = document.body.style.paddingRight;
    document.body.style.paddingRight = wide ? (open ? "21.5rem" : "0") : prev;
    return () => {
      document.body.style.paddingRight = prev;
    };
  }, [open, encounterId]);

  if (!encounterId) return null;

  // ---------- doctor's click: put the diagnosis straight into the form (saved only on Submit)
  async function addDiagnosis(r: Rule) {
    const key = `dx:${r.search}`;
    const where = findResponse(formState, (x) => x.structured_type === "diagnosis");
    if (!where) {
      setStatus((s) => ({ ...s, [key]: openAndSearch("Add Diagnosis", r.search) ? "typed in search" : "no diagnosis box" }));
      return;
    }
    setStatus((s) => ({ ...s, [key]: "…" }));
    const local = (SNOMED as Record<string, { code: string; display: string }>)[r.search.toLowerCase()];
    const code: CodeConcept | null = local
      ? { ...local, system: SNOMED_SYSTEM }
      : await searchCondition(r.search);
    if (!code) {
      setStatus((s) => ({ ...s, [key]: openAndSearch("Add Diagnosis", r.search) ? "typed in search" : "not found" }));
      return;
    }
    let dup = false;
    setFormState((forms) =>
      forms.map((f, fi) =>
        fi !== where.fi
          ? f
          : {
              ...f,
              responses: f.responses.map((resp, ri) => {
                if (ri !== where.ri) return resp;
                const cur = ((resp.values?.[0]?.value as any[]) || []).slice();
                if (cur.some((d) => d?.code?.code === code.code)) {
                  dup = true;
                  return resp;
                }
                cur.push({
                  code,
                  clinical_status: "active",
                  verification_status: "provisional",
                  severity: null,
                  category: "encounter_diagnosis",
                  onset: { onset_datetime: localDate() },
                  dirty: true,
                });
                return { ...resp, values: [{ type: "diagnosis", value: cur }] } as any;
              }),
            },
      ),
    );
    setStatus((s) => ({ ...s, [key]: dup ? "already added" : "added ✓" }));
  }

  function addAdvice(advice: string) {
    const key = `adv:${advice}`;
    const where = findResponse(formState, (_r, q) => !!q && ADVICE_Q.test(q.text || ""));
    if (!where) {
      try { navigator.clipboard.writeText(advice); } catch { /* ignore */ }
      setStatus((s) => ({ ...s, [key]: "no Advice box — copied" }));
      return;
    }
    let dup = false;
    setFormState((forms) =>
      forms.map((f, fi) =>
        fi !== where.fi
          ? f
          : {
              ...f,
              responses: f.responses.map((resp, ri) => {
                if (ri !== where.ri) return resp;
                const cur = String(resp.values?.[0]?.value ?? "");
                if (cur.toLowerCase().includes(advice.toLowerCase())) {
                  dup = true;
                  return resp;
                }
                const next = cur.trim() ? `${cur.trimEnd()}\n${advice}` : advice;
                return { ...resp, values: [{ type: "string", value: next }] } as any;
              }),
            },
      ),
    );
    setStatus((s) => ({ ...s, [key]: dup ? "already in Advice" : "added to Advice ✓" }));
  }

  const v = ctx?.vitals || {};
  const urgentVitals: string[] = CVW_T.urgent(v, ctx?.ageM ?? null);
  const hasAny = result.top.length || result.urgent.length || result.symptoms.length || result.vitals.length;

  const DxCard = ({ r, tone }: { r: Rule; tone: "u" | "n" | "s" }) => {
    const adv = adviceOf(r);
    const st = status[`dx:${r.search}`];
    const ast = status[`adv:${adv}`];
    return (
      <div
        className={`rounded-md border p-2 ${tone === "u" ? "border-red-300 bg-red-50" : tone === "s" ? "border-gray-200 bg-white" : "border-teal-200 bg-white"}`}
      >
        <div className="text-sm font-semibold text-gray-900">{r.dx}</div>
        {r.dx !== r.search && <div className="text-xs text-gray-500">CARE: {r.search}</div>}
        {r.why?.length > 0 && <div className="mt-0.5 text-xs text-gray-600">{r.why.join(", ")}</div>}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => addDiagnosis(r)}
            className="rounded bg-teal-700 px-2 py-0.5 text-xs font-medium text-white hover:bg-teal-800"
          >
            {st || "+ Diagnosis"}
          </button>
          {adv && (
            <button
              type="button"
              onClick={() => addAdvice(adv)}
              className="rounded border border-teal-700 px-2 py-0.5 text-xs font-medium text-teal-800 hover:bg-teal-50"
              title={adv}
            >
              {ast || "+ Advice"}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <aside
      id="opd-saathi"
      className="fixed right-3 top-16 z-40 flex max-h-[calc(100vh-5rem)] w-80 flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-lg"
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between bg-teal-800 px-3 py-2 text-left text-white"
      >
        <span className="text-sm font-semibold">OPD Saathi <span className="ml-1 rounded bg-white/20 px-1 text-[10px] font-normal">CARE plugin · prototype</span></span>
        <span className="text-xs">{open ? "—" : "▢"}</span>
      </button>
      {open && (
        <div className="space-y-3 overflow-y-auto p-3">
          {/* Vitals */}
          <section>
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="text-xs font-bold tracking-wide text-gray-500">VITALS</h3>
              <span className="text-[11px] text-gray-500">{[ageLabel(ctx?.ageM ?? null), ctx?.gender === "male" ? "M" : ctx?.gender === "female" ? "F" : ""].filter(Boolean).join(" · ")}</span>
            </div>
            {urgentVitals.length > 0 && (
              <div className="mb-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
                {urgentVitals.map((u) => <div key={u}>⚠ {u}</div>)}
              </div>
            )}
            <div className="grid grid-cols-2 gap-1">
              {VITAL_ROWS.filter(([k]) => v[k]).map(([k, label]) => {
                const x = v[k];
                const f = CVW_T.flag(k, x, ctx?.ageM ?? null);
                const val = k === "bp" ? `${x.sys}/${x.dia}` : `${x.v}`;
                const unit = k === "bp" ? "mmHg" : x.u || "";
                return (
                  <div key={k} className={`rounded bg-white px-2 py-1 text-xs ${f === "hi" ? "text-red-700" : f === "lo" ? "text-blue-700" : "text-gray-800"}`}>
                    <span className="text-gray-500">{label}{f === "hi" ? " ▲" : f === "lo" ? " ▼" : ""}</span>{" "}
                    <b>{val}</b> <span className="text-gray-400">{unit}</span>
                  </div>
                );
              })}
              {!Object.keys(v).length && <div className="col-span-2 text-xs text-gray-500">No vitals for this visit yet.</div>}
            </div>
          </section>

          {/* Suggestions */}
          <section className="space-y-2">
            <h3 className="text-xs font-bold tracking-wide text-gray-500">SUGGESTIONS</h3>
            {!hasAny && (
              <div className="text-xs text-gray-500">
                {text.trim().length < 3 ? "Start typing the complaint — suggestions appear here." : "No suggestion for this complaint yet."}
              </div>
            )}
            {result.urgent.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-red-700">URGENT — ACT FIRST</div>
                {result.urgent.map((r: Rule) => <DxCard key={r.dx} r={r} tone="u" />)}
              </div>
            )}
            {result.top.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-gray-600">Possible cause</div>
                {result.top.map((r: Rule) => <DxCard key={r.dx} r={r} tone="n" />)}
              </div>
            )}
            {result.vitals.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-gray-600">From vitals</div>
                {result.vitals.map((r: Rule) => <DxCard key={r.dx} r={r} tone="n" />)}
              </div>
            )}
            {result.symptoms.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-gray-600">Symptom (as diagnosis)</div>
                {result.symptoms.map((r: Rule) => <DxCard key={r.dx} r={r} tone="s" />)}
              </div>
            )}
          </section>

          {/* Tests */}
          {result.tests.length > 0 && (
            <section>
              <h3 className="mb-1 text-xs font-bold tracking-wide text-gray-500">SUGGESTED TESTS</h3>
              <div className="flex flex-wrap gap-1.5">
                {result.tests.map((t: any) =>
                  t.ad ? (
                    <button
                      key={t.k}
                      type="button"
                      onClick={() => openAndSearch("Select Activity Definition", t.ad)}
                      className="rounded-full border border-teal-300 bg-white px-2 py-0.5 text-xs text-teal-900 hover:bg-teal-50"
                    >
                      {t.ad}
                    </button>
                  ) : (
                    <span key={t.k} className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500" title={t.tier ? `usually at ${t.tier}` : ""}>
                      {t.label} · not set up here
                    </span>
                  ),
                )}
              </div>
            </section>
          )}

          <p className="border-t pt-2 text-[10.5px] leading-snug text-gray-500">
            Rule-based (ICMR STW, national programmes), no AI. Draft rules, need clinician review. Clicks only fill this form; nothing is saved until the doctor submits.
          </p>
        </div>
      )}
    </aside>
  );
}
