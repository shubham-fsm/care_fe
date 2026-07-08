import { useQueries, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader } from "lucide-react";
import { useTranslation } from "react-i18next";

import PrintPreview from "@/CAREUI/misc/PrintPreview";

import PrintFooter from "@/components/Common/PrintFooter";

import useCurrentFacility from "@/pages/Facility/utils/useCurrentFacility";

import query from "@/Utils/request/query";
import { formatName, formatPatientAge } from "@/Utils/utils";
import {
  DiagnosticReportRead,
  DiagnosticReportStatus,
} from "@/types/emr/diagnosticReport/diagnosticReport";
import diagnosticReportApi from "@/types/emr/diagnosticReport/diagnosticReportApi";
import { ObservationStatus } from "@/types/emr/observation/observation";
import { PrintTemplateType } from "@/types/facility/printTemplate";
import { PatientIdentifierUse } from "@/types/patient/patientIdentifierConfig/patientIdentifierConfig";

import { DiagnosticReportResultsTable } from "./components/DiagnosticReportResultsTable";

function uniqueNames(
  reports: DiagnosticReportRead[],
  pick: (r: DiagnosticReportRead) => Parameters<typeof formatName>[0],
) {
  const names = reports.map((r) => formatName(pick(r))).filter(Boolean);
  return Array.from(new Set(names));
}

export default function ConsolidatedDiagnosticReportPrint({
  patientId,
}: {
  patientId: string;
}) {
  const { t } = useTranslation();
  const { facility } = useCurrentFacility();

  const { data: reportsResponse, isLoading: isLoadingList } = useQuery({
    queryKey: ["diagnosticReports", "patient", patientId],
    queryFn: query(diagnosticReportApi.listDiagnosticReports, {
      pathParams: { patient_external_id: patientId },
      queryParams: { limit: 100 },
    }),
  });

  const finalReportIds = (reportsResponse?.results || [])
    .filter((report) => report.status === DiagnosticReportStatus.final)
    .map((report) => report.id);

  const reportQueries = useQueries({
    queries: finalReportIds.map((id) => ({
      queryKey: ["diagnosticReport", id],
      queryFn: query(diagnosticReportApi.retrieveDiagnosticReport, {
        pathParams: { patient_external_id: patientId, external_id: id },
      }),
    })),
  });

  const isLoading = isLoadingList || reportQueries.some((q) => q.isLoading);

  const finalReports = reportQueries
    .map((q) => q.data)
    .filter((report): report is DiagnosticReportRead => !!report);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (finalReports.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">
          {t("no_final_reports_found")}
        </div>
      </div>
    );
  }

  const patient = finalReports[0].encounter.patient;
  const referringDoctors = uniqueNames(finalReports, (r) => r.requester);
  const reportDate = finalReports.reduce(
    (latest, report) =>
      new Date(report.created_date) > new Date(latest)
        ? report.created_date
        : latest,
    finalReports[0].created_date,
  );
  const allObservations = finalReports.flatMap((report) =>
    report.observations.filter(
      (obs) => obs.status !== ObservationStatus.ENTERED_IN_ERROR,
    ),
  );
  const technicians = uniqueNames(finalReports, (r) => r.created_by);
  const verifiers = uniqueNames(finalReports, (r) => r.updated_by);

  return (
    <div className="flex justify-center items-center">
      <PrintPreview
        title={`${t("consolidated_report")} - ${patient.name}`}
        facility={facility}
        templateSlug={PrintTemplateType.diagnostic_report}
      >
        <div>
          <h2 className="text-gray-500 uppercase text-sm tracking-wide font-semibold mb-2">
            {t("consolidated_report")}
          </h2>

          {/* Patient Details */}
          <div className="grid md:grid-cols-2 print:grid-cols-2 gap-x-6 gap-y-1 border-t border-gray-200 pt-2">
            <div className="grid grid-cols-[8rem_auto_1fr] items-center">
              <span className="text-gray-600">{t("patient")}</span>
              <span className="text-gray-600">:</span>
              <span className="font-semibold ml-2 wrap-break-word">
                {patient.name}
              </span>
            </div>
            {"instance_identifiers" in patient &&
              patient.instance_identifiers
                .filter(
                  ({ config }) =>
                    config.config.use === PatientIdentifierUse.official,
                )
                .map((identifier) => (
                  <div
                    key={identifier.config.id}
                    className="grid grid-cols-[8rem_auto_1fr] items-center"
                  >
                    <span className="text-gray-600">
                      {identifier.config.config.display}
                    </span>
                    <span className="text-gray-600">:</span>
                    <span className="font-semibold ml-2">
                      {identifier.value}
                    </span>
                  </div>
                ))}
            <div className="grid grid-cols-[8rem_auto_1fr] items-center">
              <span className="text-gray-600">
                {t("age")} / {t("sex")}
              </span>
              <span className="text-gray-600">:</span>
              <span className="font-semibold ml-2">
                {formatPatientAge(patient, true)} /
                <span className="capitalize ml-1">
                  {t(`GENDER__${patient.gender}`)}
                </span>
              </span>
            </div>
            <div className="grid grid-cols-[8rem_auto_1fr] items-center">
              <span className="text-gray-600">{t("referring_doctor")}</span>
              <span className="text-gray-600">:</span>
              <span className="font-semibold ml-2 wrap-break-word">
                {referringDoctors.join(", ") || "-"}
              </span>
            </div>
            <div className="grid grid-cols-[8rem_auto_1fr] items-center">
              <span className="text-gray-600">{t("report_date")}</span>
              <span className="text-gray-600">:</span>
              <span className="font-semibold ml-2">
                {format(new Date(reportDate), "dd-MM-yyyy")}
              </span>
            </div>
          </div>

          <div className="mt-8 space-y-8">
            <div>
              <h2 className="text-lg font-semibold mb-4">
                {t("test_results")}
              </h2>
              <DiagnosticReportResultsTable observations={allObservations} />
            </div>
          </div>

          {/* Sign-off */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="border-t border-gray-400 pt-1 text-sm">
                <span className="text-gray-600">{t("technicians")}: </span>
                <span className="font-semibold">
                  {technicians.join(", ") || "-"}
                </span>
              </div>
            </div>
            <div>
              <div className="border-t border-gray-400 pt-1 text-sm">
                <span className="text-gray-600">{t("verified_by")}: </span>
                <span className="font-semibold">
                  {verifiers.join(", ") || "-"}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <PrintFooter showPrintedBy className="mt-8 pt-4 border-t" />
        </div>
      </PrintPreview>
    </div>
  );
}
