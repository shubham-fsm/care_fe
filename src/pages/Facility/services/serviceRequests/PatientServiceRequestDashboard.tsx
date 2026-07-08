import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCheck, Printer } from "lucide-react";
import { navigate } from "raviger";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

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
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import BackButton from "@/components/Common/BackButton";
import Page from "@/components/Common/Page";
import { CardListSkeleton } from "@/components/Common/SkeletonLoading";
import { PatientHeader } from "@/components/Patient/PatientHeader";

import mutate from "@/Utils/request/mutate";
import query from "@/Utils/request/query";
import { Status } from "@/types/emr/serviceRequest/serviceRequest";
import serviceRequestApi from "@/types/emr/serviceRequest/serviceRequestApi";
import { SpecimenRead } from "@/types/emr/specimen/specimen";

import { MultiQRCodePrintSheet } from "./components/MultiQRCodePrintSheet";
import { PatientTestCard } from "./components/PatientTestCard";
import { SpecimenCollectionGroup } from "./components/SpecimenCollectionGroup";
import { useServiceRequestsWithActivityDefinitions } from "./hooks/useServiceRequestsWithActivityDefinitions";
import {
  buildServiceRequestCompletePayload,
  canMarkServiceRequestComplete,
} from "./utils/serviceRequestCompletion";
import { groupPendingSpecimenRequirements } from "./utils/specimenGrouping";

interface PatientServiceRequestDashboardProps {
  facilityId: string;
  patientId: string;
  locationId?: string;
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <Card className="flex flex-col items-center justify-center p-8 text-center border-dashed">
      <div className="rounded-full bg-primary/10 p-3 mb-4">
        <CareIcon icon="l-folder-open" className="size-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-1">
        {t("no_service_requests_found")}
      </h3>
    </Card>
  );
}

export default function PatientServiceRequestDashboard({
  facilityId,
  patientId,
  locationId,
}: PatientServiceRequestDashboardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: response, isLoading } = useQuery({
    queryKey: ["serviceRequests", "patient", facilityId, patientId],
    queryFn: query(serviceRequestApi.listServiceRequest, {
      pathParams: { facilityId },
      queryParams: { patient: patientId, limit: 50 },
    }),
  });

  const requests = response?.results || [];
  const patient = requests[0]?.encounter.patient;

  const pendingCount = requests.filter(
    (r) => r.status === Status.draft || r.status === Status.active,
  ).length;
  const completedCount = requests.filter(
    (r) => r.status === Status.completed,
  ).length;

  const requestIds = useMemo(
    () => (response?.results ?? []).map((request) => request.id),
    [response?.results],
  );
  const { entries } = useServiceRequestsWithActivityDefinitions(
    facilityId,
    requestIds,
  );
  const specimenGroups = useMemo(
    () => groupPendingSpecimenRequirements(entries),
    [entries],
  );

  const eligibleForCompletion = useMemo(
    () =>
      entries.filter(
        (
          entry,
        ): entry is typeof entry & {
          request: NonNullable<typeof entry.request>;
        } => !!entry.request && canMarkServiceRequestComplete(entry.request),
      ),
    [entries],
  );

  const [printSheet, setPrintSheet] = useState<{
    open: boolean;
    specimens: SpecimenRead[];
  }>({ open: false, specimens: [] });

  const [isCompleteAllDialogOpen, setIsCompleteAllDialogOpen] = useState(false);
  const [isCompletingAll, setIsCompletingAll] = useState(false);

  const handleCompleteAll = async () => {
    setIsCompletingAll(true);
    const results = await Promise.allSettled(
      eligibleForCompletion.map((entry) =>
        mutate(serviceRequestApi.updateServiceRequest, {
          pathParams: { facilityId, serviceRequestId: entry.id },
        })(buildServiceRequestCompletePayload(entry.request)),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - succeeded;

    if (succeeded > 0) {
      toast.success(t("n_tests_marked_complete", { count: succeeded }));
    }
    if (failed > 0) {
      toast.error(t("n_tests_failed_to_complete", { count: failed }));
    }

    queryClient.invalidateQueries({
      queryKey: ["serviceRequests", "patient", facilityId, patientId],
    });
    for (const entry of eligibleForCompletion) {
      queryClient.invalidateQueries({
        queryKey: ["serviceRequest", facilityId, entry.id],
      });
    }

    setIsCompletingAll(false);
    setIsCompleteAllDialogOpen(false);
  };

  return (
    <Page title={t("patient_test_dashboard")} hideTitleOnPage>
      <div className="container mx-auto pb-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BackButton
            variant="outline"
            className="font-semibold border border-gray-400 text-gray-950 underline underline-offset-2"
          >
            <ArrowLeft />
            {t("back")}
          </BackButton>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              disabled={eligibleForCompletion.length === 0 || isCompletingAll}
              onClick={() => setIsCompleteAllDialogOpen(true)}
            >
              <CheckCheck className="size-4" />
              {t("complete_all")}
              {eligibleForCompletion.length > 0 &&
                ` (${eligibleForCompletion.length})`}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                navigate(
                  `/facility/${facilityId}/patient/${patientId}/diagnostic_reports/consolidated/print`,
                )
              }
            >
              <Printer className="size-4" />
              {t("print_consolidated_report")}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <CardListSkeleton count={3} />
        ) : requests.length === 0 || !patient ? (
          <EmptyState />
        ) : (
          <>
            <PatientHeader patient={patient} facilityId={facilityId} />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="text-sm text-gray-500">{t("total")}</div>
                <div className="text-2xl font-semibold text-gray-900">
                  {requests.length}
                </div>
              </div>
              <div className="rounded-lg bg-blue-50 p-3">
                <div className="text-sm text-blue-600">{t("pending")}</div>
                <div className="text-2xl font-semibold text-blue-700">
                  {pendingCount}
                </div>
              </div>
              <div className="rounded-lg bg-green-50 p-3">
                <div className="text-sm text-green-600">{t("completed")}</div>
                <div className="text-2xl font-semibold text-green-700">
                  {completedCount}
                </div>
              </div>
            </div>

            {specimenGroups.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  {t("specimen_collection")}
                </h2>
                <div className="flex flex-col gap-3">
                  {specimenGroups.map((group) => (
                    <SpecimenCollectionGroup
                      key={group.key}
                      facilityId={facilityId}
                      group={group}
                      onCollected={(specimens) =>
                        setPrintSheet({ open: true, specimens })
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4">
              {requests.map((request) => (
                <PatientTestCard
                  key={request.id}
                  facilityId={facilityId}
                  serviceRequestId={request.id}
                  patientId={patientId}
                  locationId={locationId}
                />
              ))}
            </div>
          </>
        )}

        <MultiQRCodePrintSheet
          specimens={printSheet.specimens}
          open={printSheet.open}
          onOpenChange={(open) => setPrintSheet((prev) => ({ ...prev, open }))}
        >
          <span className="hidden" />
        </MultiQRCodePrintSheet>

        <AlertDialog
          open={isCompleteAllDialogOpen}
          onOpenChange={setIsCompleteAllDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("complete_all")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("complete_all_confirmation", {
                  count: eligibleForCompletion.length,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isCompletingAll}>
                {t("cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                className={buttonVariants({ variant: "primary" })}
                disabled={isCompletingAll}
                onClick={(e) => {
                  e.preventDefault();
                  handleCompleteAll();
                }}
              >
                {t("complete_all")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Page>
  );
}
