import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coffee, PlayIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { useScheduleResourceFromPath } from "@/components/Schedule/useScheduleResource";
import { TokenStatus } from "@/types/tokens/token/token";
import tokenApi from "@/types/tokens/token/tokenApi";
import {
  TokenSubQueueRead,
  TokenSubQueueStatus,
} from "@/types/tokens/tokenSubQueue/tokenSubQueue";
import tokenSubQueueApi from "@/types/tokens/tokenSubQueue/tokenSubQueueApi";
import { callApi } from "@/Utils/request/query";

/**
 * Sets a service point on/off break. Going on break sends a token that was
 * called to it (but not yet being served) back to the waiting list, keeping
 * its place, so the TV stops announcing it. A service point on break is
 * inactive: the TV shows it as "On break" when breaks are shown there.
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
      if (onBreak) {
        const { results: called } = await callApi(tokenApi.list, {
          pathParams: { facility_id: facilityId, queue_id: queueId },
          queryParams: {
            status: TokenStatus.CREATED,
            sub_queue: servicePoint.id,
          },
        });
        for (const token of called) {
          await callApi(tokenApi.update, {
            pathParams: {
              facility_id: facilityId,
              queue_id: queueId,
              id: token.id,
            },
            body: {
              status: TokenStatus.CREATED,
              note: token.note,
              sub_queue: null,
            },
          });
        }
      }
      return callApi(tokenSubQueueApi.update, {
        pathParams: { facility_id: facilityId, id: servicePoint.id },
        body: {
          name: servicePoint.name,
          status: onBreak
            ? TokenSubQueueStatus.INACTIVE
            : TokenSubQueueStatus.ACTIVE,
        },
      });
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
      queryClient.invalidateQueries({
        queryKey: ["infinite-tokens", facilityId, queueId],
      });
    },
  });
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
}: {
  facilityId: string;
  queueId: string;
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
          </div>
          <Button
            variant="primary"
            size="sm"
            disabled={isPending}
            onClick={() => mutate({ servicePoint, onBreak: false })}
          >
            <PlayIcon />
            {t("i_am_back")}
          </Button>
        </div>
      ))}
    </div>
  );
}
