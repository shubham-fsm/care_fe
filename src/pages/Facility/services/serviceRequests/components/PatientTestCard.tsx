import { useQuery } from "@tanstack/react-query";
import { navigate } from "raviger";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import CareIcon from "@/CAREUI/icons/CareIcon";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import query from "@/Utils/request/query";
import activityDefinitionApi from "@/types/emr/activityDefinition/activityDefinitionApi";
import { DiagnosticReportStatus } from "@/types/emr/diagnosticReport/diagnosticReport";
import {
  EDITABLE_SERVICE_REQUEST_STATUSES,
  SERVICE_REQUEST_PRIORITY_COLORS,
  SERVICE_REQUEST_STATUS_COLORS,
} from "@/types/emr/serviceRequest/serviceRequest";
import serviceRequestApi from "@/types/emr/serviceRequest/serviceRequestApi";
import { SpecimenStatus } from "@/types/emr/specimen/specimen";

import { useCompleteServiceRequest } from "@/pages/Facility/services/serviceRequests/hooks/useCompleteServiceRequest";
import {
  buildServiceRequestCompletePayload,
  canMarkServiceRequestComplete,
} from "@/pages/Facility/services/serviceRequests/utils/serviceRequestCompletion";

import { DiagnosticReportForm } from "./DiagnosticReportForm";
import { DiagnosticReportReview } from "./DiagnosticReportReview";

interface PatientTestCardProps {
  facilityId: string;
  serviceRequestId: string;
  patientId: string;
  locationId?: string;
}

export function PatientTestCard({
  facilityId,
  serviceRequestId,
  patientId,
  locationId,
}: PatientTestCardProps) {
  const { t } = useTranslation();
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);

  const { mutate: completeServiceRequest, isPending: isCompleting } =
    useCompleteServiceRequest(facilityId, serviceRequestId, patientId);

  const { data: request, isLoading: isLoadingRequest } = useQuery({
    queryKey: ["serviceRequest", facilityId, serviceRequestId],
    queryFn: query(serviceRequestApi.retrieveServiceRequest, {
      pathParams: { facilityId, serviceRequestId },
    }),
  });

  const activityDefinitionSlug = request?.activity_definition?.slug;

  const { data: activityDefinition, isLoading: isLoadingActivityDefinition } =
    useQuery({
      queryKey: ["activityDefinition", activityDefinitionSlug],
      queryFn: query(activityDefinitionApi.retrieveActivityDefinition, {
        pathParams: {
          facilityId,
          activityDefinitionSlug: activityDefinitionSlug || "",
        },
      }),
      enabled: !!activityDefinitionSlug,
    });

  const handleSeeDetails = () => {
    const baseUrl = locationId
      ? `/facility/${facilityId}/locations/${locationId}/service_requests`
      : `/facility/${facilityId}/service_requests`;
    navigate(`${baseUrl}/${serviceRequestId}`);
  };

  if (
    isLoadingRequest ||
    !request ||
    (!!activityDefinitionSlug && isLoadingActivityDefinition) ||
    !activityDefinition
  ) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const disableEdit = !EDITABLE_SERVICE_REQUEST_STATUSES.includes(
    request.status,
  );
  const specimenRequirements = activityDefinition?.specimen_requirements ?? [];
  const observationRequirements =
    activityDefinition?.observation_result_requirements ?? [];
  const collectedSpecimenCount = specimenRequirements.filter((requirement) =>
    request.specimens.some(
      (specimen) =>
        specimen.specimen_definition?.id === requirement.id &&
        specimen.status === SpecimenStatus.available,
    ),
  ).length;
  const diagnosticReports = request.diagnostic_reports || [];
  const canComplete = canMarkServiceRequestComplete(request);

  return (
    <Card className="shadow-none border-gray-300 rounded-lg">
      <CardHeader className="p-4 pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="text-base font-semibold text-gray-950">
            {request.title || activityDefinition?.title || "-"}
          </div>
          {request.code?.display && (
            <div className="text-xs text-gray-500">{request.code.display}</div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={SERVICE_REQUEST_STATUS_COLORS[request.status]}>
            {t(request.status)}
          </Badge>
          <Badge variant={SERVICE_REQUEST_PRIORITY_COLORS[request.priority]}>
            {t(request.priority)}
          </Badge>
          {specimenRequirements.length > 0 && (
            <Badge
              variant={
                collectedSpecimenCount === specimenRequirements.length
                  ? "green"
                  : "orange"
              }
            >
              {t("specimen")}: {collectedSpecimenCount}/
              {specimenRequirements.length}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleSeeDetails}>
            <CareIcon icon="l-edit" />
            {t("see_details")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-4">
        {(!diagnosticReports.length ||
          diagnosticReports[0]?.status !== DiagnosticReportStatus.final) && (
          <DiagnosticReportForm
            patientId={patientId}
            facilityId={facilityId}
            serviceRequestId={serviceRequestId}
            observationDefinitions={observationRequirements}
            diagnosticReports={diagnosticReports}
            activityDefinition={activityDefinition}
            specimens={request.specimens || []}
            disableEdit={disableEdit}
          />
        )}
        {diagnosticReports.length > 0 && (
          <DiagnosticReportReview
            facilityId={facilityId}
            patientId={patientId}
            serviceRequestId={serviceRequestId}
            diagnosticReports={diagnosticReports}
            disableEdit={disableEdit}
          />
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0 justify-end">
        <Button
          variant="primary"
          size="sm"
          disabled={!canComplete || isCompleting}
          onClick={() => setIsCompleteDialogOpen(true)}
        >
          <CareIcon icon="l-check" />
          {t("mark_as_complete")}
        </Button>
      </CardFooter>

      <AlertDialog
        open={isCompleteDialogOpen}
        onOpenChange={setIsCompleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("mark_as_complete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("mark_service_request_as_complete_confirmation")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCompleting}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "primary" })}
              disabled={isCompleting}
              onClick={(e) => {
                e.preventDefault();
                completeServiceRequest(
                  buildServiceRequestCompletePayload(request),
                  { onSuccess: () => setIsCompleteDialogOpen(false) },
                );
              }}
            >
              {t("mark_as_complete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
