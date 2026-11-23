import { MedicationAdministrationRead } from "@/types/emr/medicationAdministration/medicationAdministration";
import { MedicationRequestRead } from "@/types/emr/medicationRequest/medicationRequest";
import { ServiceRequestReadSpec } from "@/types/emr/serviceRequest/serviceRequest";

/** Nursing rounds on the paper MAR sheet: 0 = 12–6 AM, 1 = 6 AM–12 PM, 2 = 12–6 PM, 3 = 6 PM–12 AM */
export const ROUNDS = [0, 1, 2, 3] as const;
export const ROUND_LABELS = ["12–6 AM", "6 AM–12 PM", "12–6 PM", "6 PM–12 AM"];

export type CellKind =
  | "done"
  | "not_given"
  | "missed"
  | "due"
  | "partial_due"
  | "partial_missed"
  | "stat"
  | "upcoming"
  | "blank";

export interface Cell {
  kind: CellKind;
  text: string;
}

export interface MedRow {
  id: string;
  name: string;
  label: string;
  isStat: boolean;
  cells: Cell[];
}

const slotOf = (d: Date) => Math.floor(d.getHours() / 6);
const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysBetween = (a: Date, b: Date) =>
  Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);

export const currentRound = (now = new Date()) => slotOf(now);

function rounds(
  freq: string,
  display: string,
  perDay: number,
  ageDays: number,
) {
  const d = display.toLowerCase();
  if (freq === "QOD" && ageDays % 2 !== 0) return [];
  if (freq === "WK" && ageDays % 7 !== 0) return [];
  if (freq === "MO" && ageDays % 30 !== 0) return [];
  if (["AM", "QD", "QOD", "WK", "MO"].includes(freq)) return [1];
  if (freq === "NOON") return [2];
  if (["PM", "HS", "BED"].includes(freq)) return [3];
  if (freq === "BID" && d.includes("morning and noon")) return [1, 2];
  if (freq === "BID" && d.includes("noon and night")) return [2, 3];
  if (["BID", "BD", "Q12H"].includes(freq)) return [1, 3];
  if (["TID", "TDS", "AC", "PC", "Q8H"].includes(freq)) return [1, 2, 3];
  if (["QID", "Q6H", "Q4H", "Q3H", "Q2H", "Q1H"].includes(freq))
    return [0, 1, 2, 3];
  if (perDay === 1) return [1];
  if (perDay === 2) return [1, 3];
  if (perDay === 3) return [1, 2, 3];
  if (perDay >= 4) return [0, 1, 2, 3];
  return [];
}

function frequencyLabel(freq: string, display: string, isSos: boolean) {
  const d = display.toLowerCase();
  if (isSos) return "SOS";
  const fixed: Record<string, string> = {
    AM: "1-0-0",
    NOON: "0-1-0",
    PM: "0-0-1",
    TID: "1-1-1",
    TDS: "1-1-1",
    QID: "1-1-1-1",
    QD: "once a day",
    QOD: "alternate days",
    WK: "weekly",
    HS: "bedtime",
    BED: "bedtime",
  };
  if (freq === "BID" && d.includes("morning and noon")) return "1-1-0";
  if (freq === "BID" && d.includes("noon and night")) return "0-1-1";
  if (freq === "BID" || freq === "BD") return "1-0-1";
  const q = freq.match(/^Q(\d+)H$/);
  if (q) return `every ${q[1]} h`;
  return fixed[freq] ?? freq;
}

/** Turns one patient's active orders and MAR entries into rows of the ward board. */
export function buildMedRows(
  requests: MedicationRequestRead[],
  administrations: MedicationAdministrationRead[],
  now = new Date(),
): MedRow[] {
  const cur = slotOf(now);
  const valid = administrations.filter((a) => a.status !== "entered_in_error");

  const rows: MedRow[] = [];
  for (const mr of requests) {
    if (mr.status !== "active") continue;
    const di = mr.dosage_instruction?.[0];
    const freq = di?.timing?.code?.code ?? "";
    const display = di?.timing?.code?.display ?? "";
    const perDay = Number(di?.timing?.repeat?.frequency ?? 0);
    const isStat = freq === "STAT";
    const isSos = !!di?.as_needed_boolean;
    const authored = new Date(mr.authored_on || mr.created_date);
    const ageDays = daysBetween(now, authored);
    const orderRound = slotOf(authored);

    const mine = valid.filter((a) => a.request === mr.id);
    const completed = mine.filter((a) => a.status === "completed");
    // a STAT already given on an earlier day is finished
    if (
      isStat &&
      completed.some(
        (a) => daysBetween(now, new Date(a.occurrence_period_start)) > 0,
      )
    )
      continue;
    const statDone = completed.length > 0;
    const today = mine.filter(
      (a) => daysBetween(now, new Date(a.occurrence_period_start)) === 0,
    );

    const slots = rounds(freq, display, perDay, ageDays);
    const q = freq.match(/^Q([1-4])H$/);
    const perRound = q ? Math.max(1, Math.floor(6 / Number(q[1]))) : 1;

    const cells: Cell[] = ROUNDS.map((slot) => {
      const inSlot = today
        .filter((a) => slotOf(new Date(a.occurrence_period_start)) === slot)
        .sort((a, b) =>
          a.occurrence_period_start.localeCompare(b.occurrence_period_start),
        );
      const done = inSlot.filter((a) => a.status === "completed");
      const notDone = inSlot.some((a) => a.status === "not_done");
      const nDone = done.length;
      const first =
        inSlot[0] && hhmm(new Date(inSlot[0].occurrence_period_start));
      const last =
        done.length > 0 &&
        hhmm(new Date(done[done.length - 1].occurrence_period_start));
      const scheduled = slots.includes(slot);
      const notYetOrdered = ageDays === 0 && slot < orderRound;

      if (perRound > 1) {
        if (nDone >= perRound)
          return { kind: "done", text: `✓ ${nDone}/${perRound} (${last})` };
        if (nDone > 0 && slot < cur)
          return {
            kind: "partial_missed",
            text: `! ${nDone}/${perRound} – ${perRound - nDone} missed`,
          };
        if (nDone > 0 && slot === cur)
          return {
            kind: "partial_due",
            text: `⏰ ${nDone}/${perRound} given – due`,
          };
        if (slot === cur && scheduled && !notYetOrdered)
          return { kind: "due", text: `⏰ due 0/${perRound}` };
      }
      if (nDone > 0)
        return {
          kind: "done",
          text: `✓ ${first}${nDone > 1 ? ` ×${nDone}` : ""}`,
        };
      if (notDone) return { kind: "not_given", text: "✗ not given" };
      if (isSos) return { kind: "blank", text: "" };
      if (isStat)
        return !statDone && slot === cur
          ? {
              kind: "stat",
              text: `⚡ STAT – give now (ordered ${hhmm(authored)})`,
            }
          : { kind: "blank", text: "" };
      if (!scheduled || notYetOrdered) return { kind: "blank", text: "" };
      if (slot < cur) return { kind: "missed", text: "! missed" };
      if (slot === cur) return { kind: "due", text: "⏰ due" };
      return { kind: "upcoming", text: "·" };
    });

    const name =
      mr.medication?.display || mr.requested_product?.name || "Medicine";
    rows.push({
      id: mr.id,
      name,
      label: frequencyLabel(freq, display, isSos),
      isStat,
      cells,
    });
  }
  return rows.sort(
    (a, b) =>
      Number(b.isStat) - Number(a.isStat) || a.name.localeCompare(b.name),
  );
}

export interface TestItem {
  id: string;
  title: string;
  done: boolean;
  overdue: boolean;
  orderedAt: string;
}

const PENDING = ["draft", "active", "on_hold"];

export function buildTests(
  requests: ServiceRequestReadSpec[],
  now = new Date(),
): TestItem[] {
  return requests
    .filter((sr) => sr.status === "completed" || PENDING.includes(sr.status))
    .map((sr) => {
      const created = new Date(sr.created_date);
      const done = sr.status === "completed";
      return {
        id: sr.id,
        title: sr.title,
        done,
        overdue: !done && now.getTime() - created.getTime() > 24 * 3600 * 1000,
        orderedAt: hhmm(created),
      };
    })
    .sort((a, b) => Number(a.done) - Number(b.done));
}

export function countDue(rows: MedRow[], now = new Date()) {
  const cur = slotOf(now);
  let due = 0;
  let missed = 0;
  for (const r of rows) {
    r.cells.forEach((c, slot) => {
      if (slot === cur && ["due", "partial_due", "stat"].includes(c.kind))
        due++;
      if (["missed", "partial_missed"].includes(c.kind)) missed++;
    });
  }
  return { due, missed };
}
