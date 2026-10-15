import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coffee, PlayIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { useScheduleResourceFromPath } from "@/components/Schedule/useScheduleResource";
import {
  renderTokenNumber,
  TokenRead,
  TokenStatus,
} from "@/types/tokens/token/token";
import tokenApi from "@/types/tokens/token/tokenApi";
import {
  TokenSubQueueRead,
  TokenSubQueueStatus,
} from "@/types/tokens/tokenSubQueue/tokenSubQueue";
import tokenSubQueueApi from "@/types/tokens/tokenSubQueue/tokenSubQueueApi";
import { callApi } from "@/Utils/request/query";

/**
 * Sets a service point on/off break. A patient already called to it stays
 * called to it: the TV hides the call while the service point is on break
 * (shows "On break") and announces it again as "Now calling" when the doctor
 * is back. A service point on break is inactive.
 */
function useServicePointBreak(facilityId: string, queueId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      servicePoint,
      onBreak,
    }: {
      servicePoint: TokenSubQueueRead;
      onBreak: boolean;
    }) => {
      await callApi(tokenSubQueueApi.update, {
        pathParams: { facility_id: facilityId, id: servicePoint.id },
        body: {
          name: servicePoint.name,
          status: onBreak
            ? TokenSubQueueStatus.INACTIVE
            : TokenSubQueueStatus.ACTIVE,
        },
      });
      return calledTokenOf(facilityId, queueId, servicePoint.id);
    },
    onSuccess: (_, { servicePoint, onBreak }) => {
      toast.success(
        onBreak
          ? t("service_point_on_break", { name: servicePoint.name })
          : t("service_point_back_from_break", { name: servicePoint.name }),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["servicePoints"] });
      queryClient.invalidateQueries({ queryKey: ["tokenSubQueues"] });
      queryClient.invalidateQueries({ queryKey: ["servicePointsOnBreak"] });
      queryClient.invalidateQueries({ queryKey: ["heldToken"] });
      queryClient.invalidateQueries({
        queryKey: ["infinite-tokens", facilityId, queueId],
      });
    },
  });
}

/** The patient called to a service point who has not come in yet, if any. */
async function calledTokenOf(
  facilityId: string,
  queueId: string,
  servicePointId: string,
) {
  const { results } = await callApi(tokenApi.list, {
    pathParams: { facility_id: facilityId, queue_id: queueId },
    queryParams: {
      status: TokenStatus.CREATED,
      sub_queue: servicePointId,
      limit: 1,
    },
  });
  return results[0] as TokenRead | undefined;
}

/** One-tap "Go on break" for an active service point. */
export function GoOnBreakButton({
  facilityId,
  queueId,
  servicePoint,
}: {
  facilityId: string;
  queueId: string;
  servicePoint: TokenSubQueueRead;
}) {
  const { t } = useTranslation();
  const { mutate, isPending } = useServicePointBreak(facilityId, queueId);

  return (
    <Button
      variant="outline"
      size="sm"
      className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
      disabled={isPending}
      onClick={() => mutate({ servicePoint, onBreak: true })}
    >
      <Coffee />
      {t("break")}
    </Button>
  );
}

/** Service points of this resource that are on break, with "I'm back". */
export function ServicePointsOnBreak({
  facilityId,
  queueId,
  onBack,
}: {
  facilityId: string;
  queueId: string;
  /** Called with the patient who was called before the break, if any. */
  onBack?: (token: TokenRead) => void;
}) {
  const { t } = useTranslation();
  const { resourceType, resourceId } = useScheduleResourceFromPath();
  const { mutate, isPending } = useServicePointBreak(facilityId, queueId);

  const { data } = useQuery({
    queryKey: ["servicePointsOnBreak", facilityId, resourceType, resourceId],
    queryFn: () =>
      callApi(tokenSubQueueApi.list, {
        pathParams: { facility_id: facilityId },
        queryParams: {
          resource_type: resourceType,
          resource_id: resourceId,
          status: TokenSubQueueStatus.INACTIVE,
          limit: 100,
        },
      }),
  });

  if (!data?.results.length) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {data.results.map((servicePoint) => (
        <div
          key={servicePoint.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Coffee className="size-4 text-amber-800 shrink-0" />
            <span className="text-sm font-medium truncate">
              {servicePoint.name}
            </span>
            <span className="text-xs text-amber-900">{t("on_break")}</span>
            <HeldToken
              facilityId={facilityId}
              queueId={queueId}
              servicePointId={servicePoint.id}
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            disabled={isPending}
            onClick={() =>
              mutate(
                { servicePoint, onBreak: false },
                {
                  onSuccess: (token) => {
                    if (token) onBack?.(token);
                  },
                },
              )
            }
          >
            <PlayIcon />
            {t("i_am_back")}
          </Button>
        </div>
      ))}
    </div>
  );
}

/** "MED-005 waiting": the patient called just before the break. */
function HeldToken({
  facilityId,
  queueId,
  servicePointId,
}: {
  facilityId: string;
  queueId: string;
  servicePointId: string;
}) {
  const { t } = useTranslation();
  const { data: token } = useQuery({
    queryKey: ["heldToken", facilityId, queueId, servicePointId],
    queryFn: () => calledTokenOf(facilityId, queueId, servicePointId),
  });
  if (!token) {
    return null;
  }
  return (
    <span className="text-xs text-amber-900">
      ·{" "}
      {t("token_held_for_service_point", {
        token: renderTokenNumber(token),
      })}
    </span>
  );
}
