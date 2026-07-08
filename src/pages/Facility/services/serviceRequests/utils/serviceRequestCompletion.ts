import { Classification } from "@/types/emr/activityDefinition/activityDefinition";
import { DiagnosticReportStatus } from "@/types/emr/diagnosticReport/diagnosticReport";
import {
  EDITABLE_SERVICE_REQUEST_STATUSES,
  ServiceRequestReadSpec,
  Status,
} from "@/types/emr/serviceRequest/serviceRequest";

// Mirrors ServiceRequestShow.tsx's CLASSIFICATIONS_CAN_BE_MARKED_AS_COMPLETE — kept
// in sync manually since that page isn't touched by the dashboard's completion actions.
const CLASSIFICATIONS_CAN_BE_MARKED_AS_COMPLETE = [
  Classification.surgical_procedure,
  Classification.counselling,
];

/**
 * Same predicate as ServiceRequestShow.tsx's `canShowMarkAsCompleteFootBar`:
 * true once the request's diagnostic report is final (or its classification
 * doesn't require one) and the request is still in an editable status.
 */
export function canMarkServiceRequestComplete(
  request: ServiceRequestReadSpec,
): boolean {
  const isFinal =
    request.diagnostic_reports?.[0]?.status === DiagnosticReportStatus.final;
  const canMarkAsComplete =
    isFinal ||
    CLASSIFICATIONS_CAN_BE_MARKED_AS_COMPLETE.includes(request.category);
  const disableEdit = !EDITABLE_SERVICE_REQUEST_STATUSES.includes(
    request.status,
  );
  return canMarkAsComplete && !disableEdit;
}

/** Same payload shape ServiceRequestShow.tsx sends to mark a request complete. */
export function buildServiceRequestCompletePayload(
  request: ServiceRequestReadSpec,
) {
  return {
    status: Status.completed,
    note: request.note,
    locations: request.locations.map((location) => location.id),
  };
}
