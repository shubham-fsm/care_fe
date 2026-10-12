import { useQuery } from "@tanstack/react-query";
import { Stethoscope } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useCallNextAndStartConsultation } from "@/pages/Facility/queues/useCallNextAndStartConsultation";
import { usePreferredServicePointCategory } from "@/pages/Facility/queues/usePreferredServicePointCategory";
import FacilityOrganizationSelector from "@/pages/Facility/settings/organizations/components/FacilityOrganizationSelector";
import facilityOrganizationApi from "@/types/facilityOrganization/facilityOrganizationApi";
import query from "@/Utils/request/query";

// Same list the "Create encounter" form uses for its default departments.
const ENCOUNTER_DEPARTMENTS_FAVORITE_LIST = "encounter_departments";

/**
 * Serves the next patient at a service point and opens their encounter in a
 * single click. The encounter's department comes from the user's preferred
 * encounter departments; when none are set, the user picks one once.
 */
export function CallNextAndStartConsultationButton({
  facilityId,
  queueId,
  subQueueId,
  ...props
}: {
  facilityId: string;
  queueId: string;
  subQueueId: string;
} & Omit<React.ComponentProps<typeof Button>, "onClick">) {
  const { t } = useTranslation();
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const { preferredServicePointCategories } = usePreferredServicePointCategory({
    facilityId,
  });

  const { data: preferredDepartments, isLoading: isLoadingDepartments } =
    useQuery({
      queryKey: [
        "facilityOrganization-favorites",
        facilityId,
        ENCOUNTER_DEPARTMENTS_FAVORITE_LIST,
      ],
      queryFn: query(facilityOrganizationApi.list, {
        pathParams: { facilityId },
        queryParams: { favorite_list: ENCOUNTER_DEPARTMENTS_FAVORITE_LIST },
      }),
    });

  const { mutate: callNextAndStart, isPending } =
    useCallNextAndStartConsultation({ facilityId, queueId });

  const start = (organizations: string[]) =>
    callNextAndStart({
      subQueueId,
      category: preferredServicePointCategories?.[subQueueId]?.id,
      organizations,
    });

  return (
    <>
      <Button
        {...props}
        disabled={props.disabled || isPending || isLoadingDepartments}
        onClick={() => {
          const preferred = preferredDepartments?.results.map(({ id }) => id);
          if (preferred?.length) {
            start(preferred);
          } else {
            setDepartmentDialogOpen(true);
          }
        }}
      />
      <Dialog
        open={departmentDialogOpen}
        onOpenChange={(open) => {
          setDepartmentDialogOpen(open);
          if (!open) setDepartments([]);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("select_department_for_encounter")}</DialogTitle>
            <DialogDescription>
              {t("select_department_for_encounter_description")}
            </DialogDescription>
          </DialogHeader>
          <FacilityOrganizationSelector
            facilityId={facilityId}
            value={departments}
            onChange={(value) => setDepartments(value ?? [])}
            favoriteList={ENCOUNTER_DEPARTMENTS_FAVORITE_LIST}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDepartmentDialogOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              disabled={!departments.length || isPending}
              onClick={() => {
                start(departments);
                setDepartmentDialogOpen(false);
              }}
            >
              <Stethoscope />
              {t("call_next_and_start_consultation")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
