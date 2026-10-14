import careConfig from "@careConfig";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ChevronDown, ChevronUp, HeartPulse } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { VitalsList } from "@/components/Patient/vitals/list";

import { cn } from "@/lib/utils";
import {
  ObservationListRead,
  ObservationPlotConfig,
} from "@/types/emr/observation/observation";
import observationApi from "@/types/emr/observation/observationApi";
import { PatientRead } from "@/types/emr/patient/patient";
import query from "@/Utils/request/query";
import { formatName, formatPatientAge } from "@/Utils/utils";

const CODES = {
  systolic: ["8480-6"],
  diastolic: ["8462-4"],
  bpPanel: ["85354-9"],
  pulse: ["8867-4"],
  temperature: ["8310-5"],
  respiratoryRate: ["9279-1"],
  spo2: ["2708-6", "59408-5", "20564-1"],
  grbs: ["2339-0"],
  weight: ["29463-7"],
  height: ["3137-7", "8302-2"],
} as const;

type VitalKey = keyof typeof CODES;

const ALL_CODES = Object.values(CODES).flat();

interface LatestValue {
  value: string;
  unit?: string;
  at: string;
}

const numeric = (value?: string | null) =>
  value === undefined || value === null || value === ""
    ? undefined
    : Number(value);

/** Latest value of each vital, from observations sorted newest first. */
function pickLatest(observations: ObservationListRead[]) {
  const latest: Partial<Record<VitalKey, LatestValue>> = {};
  const sorted = [...observations].sort(
    (a, b) =>
      new Date(b.effective_datetime).getTime() -
      new Date(a.effective_datetime).getTime(),
  );
  const keyOf = (code?: string) =>
    (Object.keys(CODES) as VitalKey[]).find((key) =>
      (CODES[key] as readonly string[]).includes(code ?? ""),
    );

  for (const obs of sorted) {
    const key = keyOf(obs.main_code?.code);
    if (!key) continue;
    if (key === "bpPanel") {
      // Blood pressure recorded as one panel with two components
      for (const component of obs.component ?? []) {
        const part = keyOf(component.code?.code);
        if (part && !latest[part] && component.value?.value) {
          latest[part] = {
            value: component.value.value,
            unit: component.value.unit?.code,
            at: obs.effective_datetime,
          };
        }
      }
      continue;
    }
    if (!latest[key] && obs.value?.value) {
      latest[key] = {
        value: obs.value.value,
        unit: obs.value.unit?.code,
        at: obs.effective_datetime,
      };
    }
  }
  return latest;
}

const isToday = (iso: string) => dayjs(iso).isSame(dayjs(), "day");

interface Props {
  patient: PatientRead;
  patientId: string;
  encounterId: string;
  className?: string;
}

/**
 * A compact, always-visible line with the patient's age/sex and the latest
 * vitals of the visit, shown above a form so the doctor does not have to go
 * back to the overview while filling it. Falls back to vitals recorded today
 * in another encounter (e.g. at the nursing station).
 */
export function LatestVitalsStrip({
  patient,
  patientId,
  encounterId,
  className,
}: Props) {
  const { t } = useTranslation();
  const [showHistory, setShowHistory] = useState(false);

  const { data: encounterObs, isLoading } = useQuery({
    queryKey: ["latest-vitals", patientId, encounterId],
    queryFn: query(observationApi.list, {
      pathParams: { patientId },
      queryParams: {
        encounter: encounterId,
        codes: ALL_CODES.join(","),
        limit: 100,
      },
    }),
  });

  const noEncounterVitals =
    !isLoading && (encounterObs?.results.length ?? 0) === 0;

  const { data: patientObs } = useQuery({
    queryKey: ["latest-vitals", patientId, "today"],
    queryFn: query(observationApi.list, {
      pathParams: { patientId },
      queryParams: { codes: ALL_CODES.join(","), limit: 100 },
      silent: true,
    }),
    enabled: noEncounterVitals,
  });

  const { data: plotsConfig } = useQuery<ObservationPlotConfig>({
    queryKey: ["plots-config"],
    queryFn: () => fetch(careConfig.plotsConfigUrl).then((res) => res.json()),
    enabled: showHistory,
  });

  const fromOtherEncounter = noEncounterVitals;
  const observations = fromOtherEncounter
    ? (patientObs?.results ?? []).filter((obs) =>
        isToday(obs.effective_datetime),
      )
    : (encounterObs?.results ?? []);
  const latest = pickLatest(observations);

  const recordedAt = Object.values(latest)
    .map((v) => v!.at)
    .sort()
    .pop();
  const recordedBy = observations.find(
    (obs) => obs.effective_datetime === recordedAt,
  )?.created_by;

  const weight = numeric(latest.weight?.value);
  const heightCm = numeric(latest.height?.value);
  const bmi =
    weight && heightCm ? (weight / (heightCm / 100) ** 2).toFixed(1) : null;

  const tempUnit =
    latest.temperature?.unit === "Cel" || latest.temperature?.unit === "[degC]"
      ? "°C"
      : "°F";

  const items: { label: string; value?: string; unit: string }[] = [
    {
      label: t("vitals_bp_short"),
      value:
        latest.systolic || latest.diastolic
          ? `${latest.systolic?.value ?? "–"}/${latest.diastolic?.value ?? "–"}`
          : undefined,
      unit: "mmHg",
    },
    { label: t("vitals_pulse"), value: latest.pulse?.value, unit: "/min" },
    {
      label: t("vitals_temperature"),
      value: latest.temperature?.value,
      unit: tempUnit,
    },
    {
      label: t("vitals_rr_short"),
      value: latest.respiratoryRate?.value,
      unit: "/min",
    },
    { label: "SpO₂", value: latest.spo2?.value, unit: "%" },
    { label: "GRBS", value: latest.grbs?.value, unit: "mg/dL" },
    { label: t("weight"), value: latest.weight?.value, unit: "kg" },
    { label: t("height"), value: latest.height?.value, unit: "cm" },
    { label: "BMI", value: bmi ?? undefined, unit: "" },
  ];
  const hasAny = items.some((item) => item.value);

  return (
    <div
      className={cn(
        "rounded-md border border-gray-200 bg-white shadow-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2">
        <div className="flex items-center gap-2 pr-4 sm:border-r border-gray-200">
          <HeartPulse className="size-4 text-primary-700" />
          <span className="text-sm font-semibold">
            {formatPatientAge(patient, true)}, {t(`GENDER__${patient.gender}`)}
          </span>
        </div>
        {isLoading ? (
          <span className="text-sm text-gray-500">{t("loading")}</span>
        ) : hasAny ? (
          items
            .filter((item) => item.value)
            .map((item) => (
              <div key={item.label} className="flex items-baseline gap-1">
                <span className="text-xs text-gray-600">{item.label}</span>
                <span className="text-sm font-semibold text-gray-950">
                  {item.value}
                </span>
                {item.unit && (
                  <span className="text-xs text-gray-600">{item.unit}</span>
                )}
              </div>
            ))
        ) : (
          <span className="text-sm text-gray-600">
            {t("no_vitals_recorded_for_visit")}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {hasAny && recordedAt && (
            <span className="text-xs text-gray-600">
              {fromOtherEncounter
                ? t("vitals_recorded_earlier_today", {
                    time: dayjs(recordedAt).format("hh:mm A"),
                  })
                : t("vitals_recorded_at", {
                    time: dayjs(recordedAt).format(
                      isToday(recordedAt) ? "hh:mm A" : "DD MMM, hh:mm A",
                    ),
                  })}
              {recordedBy && ` · ${formatName(recordedBy)}`}
            </span>
          )}
          {hasAny && !fromOtherEncounter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? <ChevronUp /> : <ChevronDown />}
              {t("history")}
            </Button>
          )}
        </div>
      </div>
      {showHistory && plotsConfig && (
        <div className="border-t border-gray-200 max-h-80 overflow-y-auto">
          <VitalsList
            patientId={patientId}
            encounterId={encounterId}
            codeGroups={
              plotsConfig.find((plot) => plot.id === "primary-parameters")
                ?.groups ?? []
            }
            className="shadow-none"
          />
        </div>
      )}
    </div>
  );
}
