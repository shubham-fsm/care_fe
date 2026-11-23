import { useQueries, useQuery } from "@tanstack/react-query";
import { ExternalLink, Lock, RefreshCw } from "lucide-react";
import { Link } from "raviger";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import Page from "@/components/Common/Page";

import query from "@/Utils/request/query";
import { EncounterRead } from "@/types/emr/encounter/encounter";
import medicationAdministrationApi from "@/types/emr/medicationAdministration/medicationAdministrationApi";
import medicationRequestApi from "@/types/emr/medicationRequest/medicationRequestApi";
import serviceRequestApi from "@/types/emr/serviceRequest/serviceRequestApi";
import { LocationRead } from "@/types/location/location";
import locationApi from "@/types/location/locationApi";

import {
  buildMedRows,
  buildTests,
  CellKind,
  countDue,
  currentRound,
  ROUND_LABELS,
  ROUNDS,
} from "./wardBoardUtils";

const REFRESH_MS = 60_000;

const CELL_STYLE: Record<CellKind, string> = {
  done: "bg-green-50 text-green-800",
  not_given: "bg-red-100 text-red-800 font-medium",
  missed: "bg-red-100 text-red-800 font-medium",
  partial_missed: "bg-red-100 text-red-800 font-medium",
  due: "bg-yellow-100 text-yellow-900 font-medium",
  partial_due: "bg-yellow-100 text-yellow-900 font-medium",
  stat: "bg-red-600 text-white font-semibold",
  upcoming: "text-gray-400",
  blank: "",
};

interface Props {
  facilityId: string;
  locationId: string;
}

export default function WardBoard({ facilityId, locationId }: Props) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  // CARE only returns this ward if the user belongs to a team linked to it.
  const ward = useQuery({
    queryKey: ["location", facilityId, locationId],
    queryFn: query(locationApi.get, {
      pathParams: { facility_id: facilityId, id: locationId },
      silent: true,
    }),
    retry: false,
  });

  const beds = useQuery({
    queryKey: ["ward_board_beds", facilityId, locationId],
    queryFn: query(locationApi.list, {
      pathParams: { facility_id: facilityId },
      queryParams: { parent: locationId, mode: "instance", limit: 100 },
    }),
    enabled: ward.isSuccess,
    refetchInterval: REFRESH_MS,
  });

  const occupied = (beds.data?.results ?? [])
    .filter((b): b is LocationRead & { current_encounter: EncounterRead } =>
      Boolean(b.current_encounter),
    )
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const meds = useEncounterQueries("meds", occupied, (e) =>
    query(medicationRequestApi.list, {
      pathParams: { patientId: e.patient.id },
      queryParams: { encounter: e.id, status: "active", limit: 100 },
    }),
  );
  const mar = useEncounterQueries("mar", occupied, (e) =>
    query(medicationAdministrationApi.list, {
      pathParams: { patientId: e.patient.id },
      queryParams: { encounter: e.id, limit: 500 },
    }),
  );
  const tests = useEncounterQueries("tests", occupied, (e) =>
    query(serviceRequestApi.listServiceRequest, {
      pathParams: { facilityId },
      queryParams: { encounter: e.id, limit: 100 },
    }),
  );

  const refetchAll = () => {
    beds.refetch();
    [...meds, ...mar, ...tests].forEach((q) => q.refetch());
    setNow(new Date());
  };

  if (ward.isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (ward.isError) {
    return (
      <Page title={t("ward_board")} hideTitleOnPage>
        <Card className="max-w-xl mx-auto mt-16">
          <CardContent className="flex flex-col items-center text-center gap-3 p-8">
            <Lock className="size-10 text-gray-400" />
            <h2 className="text-lg font-semibold">
              {t("ward_board_no_access")}
            </h2>
            <p className="text-sm text-gray-600">
              {t("ward_board_no_access_description")}
            </p>
          </CardContent>
        </Card>
      </Page>
    );
  }

  const cur = currentRound(now);
  const patients = occupied.map((bed, i) => {
    const rows = buildMedRows(
      (meds[i]?.data?.results ?? []) as never,
      (mar[i]?.data?.results ?? []) as never,
      now,
    );
    return {
      bed,
      encounter: bed.current_encounter,
      rows,
      tests: buildTests((tests[i]?.data?.results ?? []) as never, now),
      loading: meds[i]?.isLoading || mar[i]?.isLoading,
      ...countDue(rows, now),
    };
  });

  const totals = patients.reduce(
    (acc, p) => ({
      due: acc.due + p.due,
      missed: acc.missed + p.missed,
      tests: acc.tests + p.tests.filter((x) => !x.done).length,
    }),
    { due: 0, missed: 0, tests: 0 },
  );
  const lastUpdated = beds.dataUpdatedAt
    ? new Date(beds.dataUpdatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <Page title={t("ward_board")} hideTitleOnPage>
      <div className="space-y-4 p-1">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              {ward.data?.name} · {t("ward_board")}
            </h1>
            <p className="text-sm text-gray-600">
              {t("ward_board_subtitle", {
                round: ROUND_LABELS[cur],
                time: lastUpdated,
              })}
            </p>
          </div>
          <Button variant="outline" onClick={refetchAll}>
            <RefreshCw className="size-4" />
            {t("refresh")}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label={t("ward_board_patients")} value={patients.length} />
          <Stat
            label={t("ward_board_doses_due")}
            value={totals.due}
            tone="yellow"
          />
          <Stat
            label={t("ward_board_missed_today")}
            value={totals.missed}
            tone="red"
          />
          <Stat
            label={t("ward_board_tests_pending")}
            value={totals.tests}
            tone="blue"
          />
        </div>

        {beds.isLoading && <Skeleton className="h-64 w-full" />}
        {!beds.isLoading && patients.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-gray-600">
              {t("ward_board_empty")}
            </CardContent>
          </Card>
        )}

        {patients.map((p) => (
          <Card key={p.bed.id} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-gray-50 px-4 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="primary">{p.bed.name}</Badge>
                <span className="font-semibold">
                  {p.encounter.patient.name}
                </span>
                <span className="text-sm text-gray-600">
                  {[
                    p.encounter.patient.gender,
                    p.encounter.period?.start &&
                      t("ward_board_day", {
                        day:
                          Math.floor(
                            (now.getTime() -
                              new Date(p.encounter.period.start).setHours(
                                0,
                                0,
                                0,
                                0,
                              )) /
                              86400000,
                          ) + 1,
                      }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {p.due > 0 && (
                  <Badge variant="yellow">
                    {t("ward_board_due_count", { count: p.due })}
                  </Badge>
                )}
                {p.missed > 0 && (
                  <Badge variant="danger">
                    {t("ward_board_missed_count", { count: p.missed })}
                  </Badge>
                )}
              </div>
              <Link
                href={`/facility/${facilityId}/patient/${p.encounter.patient.id}/encounter/${p.encounter.id}/medicines`}
                className="flex items-center gap-1 text-sm text-primary-700 hover:underline"
              >
                {t("ward_board_open_record")}
                <ExternalLink className="size-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-4 py-2 font-medium w-[34%]">
                      {t("medicine")}
                    </th>
                    {ROUNDS.map((r) => (
                      <th
                        key={r}
                        className={cn(
                          "px-2 py-2 font-medium",
                          r === cur && "bg-primary-50 text-primary-800",
                        )}
                      >
                        {ROUND_LABELS[r]}
                        {r === cur && ` · ${t("now")}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.loading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-3">
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  )}
                  {!p.loading && p.rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-gray-500">
                        {t("ward_board_no_medicines")}
                      </td>
                    </tr>
                  )}
                  {p.rows.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-4 py-2">
                        <span className="font-medium">{row.name}</span>
                        <span className="ml-1 text-gray-500">
                          ({row.label})
                        </span>
                      </td>
                      {row.cells.map((c, r) => (
                        <td key={r} className="px-1 py-1">
                          <div
                            className={cn(
                              "rounded px-2 py-1 leading-snug",
                              CELL_STYLE[c.kind],
                            )}
                          >
                            {c.text}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {p.tests.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2">
                <span className="text-xs font-medium text-gray-500">
                  {t("ward_board_tests")}
                </span>
                {p.tests.map((x) => (
                  <Badge
                    key={x.id}
                    variant={x.done ? "green" : x.overdue ? "danger" : "blue"}
                  >
                    {x.done ? "✓ " : "⏳ "}
                    {x.title}
                    {!x.done && x.overdue && ` · ${t("ward_board_over_24h")}`}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </Page>
  );
}

function useEncounterQueries(
  key: string,
  beds: { current_encounter: EncounterRead }[],
  fn: (e: EncounterRead) => (ctx: { signal: AbortSignal }) => Promise<unknown>,
) {
  return useQueries({
    queries: beds.map((b) => ({
      queryKey: ["ward_board", key, b.current_encounter.id],
      queryFn: fn(b.current_encounter),
      refetchInterval: REFRESH_MS,
    })),
  }) as {
    data?: { results: unknown[] };
    isLoading: boolean;
    refetch: () => void;
  }[];
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "yellow" | "red" | "blue";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-gray-500">{label}</p>
        <p
          className={cn(
            "text-3xl font-semibold",
            tone === "yellow" && value > 0 && "text-yellow-700",
            tone === "red" && value > 0 && "text-red-700",
            tone === "blue" && value > 0 && "text-blue-700",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
