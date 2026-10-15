import { usePreferredServicePointCategoryIds } from "@/pages/Facility/queues/usePreferredServicePointCategory";
import {
  renderTokenNumber,
  TokenRead,
  TokenStatus,
} from "@/types/tokens/token/token";
import tokenApi from "@/types/tokens/token/tokenApi";
import { callApi } from "@/Utils/request/query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type CallNextResult =
  | { kind: "called"; token: TokenRead }
  | { kind: "already_called"; token: TokenRead }
  | { kind: "none_waiting" };

/**
 * Calls the next waiting token of a queue to a service point (sub queue),
 * respecting the service point's preferred token category, if one is set.
 *
 * The token becomes "Called" (still CREATED, now assigned to the service
 * point), so the waiting-area TV announces it as "Now calling" until the
 * patient arrives. It becomes "Now serving" when the consultation starts.
 */
export function useCallNextToken({
  facilityId,
  queueId,
}: {
  facilityId: string;
  queueId: string;
  silent?: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const preferredCategoryIds = usePreferredServicePointCategoryIds();

  const mutation = useMutation({
    mutationFn: async (subQueueId: string): Promise<CallNextResult> => {
      // Do not call a second patient to a room that already has one called
      // (e.g. Serve Next pressed twice): the TV would announce both.
      const { results: alreadyCalled } = await callApi(tokenApi.list, {
        pathParams: { facility_id: facilityId, queue_id: queueId },
        queryParams: {
          status: TokenStatus.CREATED,
          sub_queue: subQueueId,
          limit: 1,
        },
      });
      if (alreadyCalled[0]) {
        return { kind: "already_called", token: alreadyCalled[0] };
      }
      const category = preferredCategoryIds[subQueueId];
      const { results } = await callApi(tokenApi.list, {
        pathParams: { facility_id: facilityId, queue_id: queueId },
        queryParams: {
          status: TokenStatus.CREATED,
          sub_queue_is_null: true,
          ordering: "created_date",
          limit: 1,
          ...(category ? { category } : {}),
        },
      });
      const next = results[0];
      if (!next) {
        return { kind: "none_waiting" };
      }
      const token = await callApi(tokenApi.update, {
        pathParams: { facility_id: facilityId, queue_id: queueId, id: next.id },
        body: {
          status: TokenStatus.CREATED,
          note: next.note,
          sub_queue: subQueueId,
        },
      });
      return { kind: "called", token };
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["infinite-tokens", facilityId, queueId],
      });
      queryClient.invalidateQueries({
        queryKey: ["token-queue-summary", facilityId, queueId],
      });
    },
  });

  // mutateAsync, not per-call callbacks: the caller (e.g. the encounter
  // header) may unmount while the call is in flight, and the follow-up
  // (navigation) must still happen.
  const callNext = (
    subQueueId: string,
    options?: {
      onSuccess?: (token: TokenRead) => void;
      onError?: () => void;
    },
  ) =>
    mutation
      .mutateAsync(subQueueId)
      .then((result) => {
        if (result.kind === "called") {
          options?.onSuccess?.(result.token);
        } else if (result.kind === "already_called") {
          if (options?.onSuccess) {
            // e.g. Complete & Call Next: open the queue on the patient
            // already called to this room.
            options.onSuccess(result.token);
          } else {
            toast.info(
              t("token_already_called_to_service_point", {
                token: renderTokenNumber(result.token),
              }),
            );
          }
        } else if (options?.onError) {
          options.onError();
        } else {
          toast.info(t("no_patient_is_waiting"));
        }
      })
      .catch(() => options?.onError?.());

  return { callNext, isPending: mutation.isPending };
}
