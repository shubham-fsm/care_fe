import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import mutate from "@/Utils/request/mutate";
import serviceRequestApi from "@/types/emr/serviceRequest/serviceRequestApi";

/**
 * Same mutation ServiceRequestShow.tsx uses to mark a service request complete
 * (a PATCH via `serviceRequestApi.updateServiceRequest`), additionally
 * invalidating the patient dashboard's list query so its Pending/Completed
 * tiles and cards stay in sync.
 */
export function useCompleteServiceRequest(
  facilityId: string,
  serviceRequestId: string,
  patientId: string,
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutate(serviceRequestApi.updateServiceRequest, {
      pathParams: { facilityId, serviceRequestId },
    }),
    onSuccess: () => {
      toast.success(t("service_request_completed"));
      queryClient.invalidateQueries({
        queryKey: ["serviceRequest", facilityId, serviceRequestId],
      });
      queryClient.invalidateQueries({
        queryKey: ["serviceRequests", "patient", facilityId, patientId],
      });
    },
  });
}
