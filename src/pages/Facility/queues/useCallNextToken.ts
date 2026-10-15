import { usePreferredServicePointCategoryIds } from "@/pages/Facility/queues/usePreferredServicePointCategory";
import { TokenRead, TokenStatus } from "@/types/tokens/token/token";
import tokenApi from "@/types/tokens/token/tokenApi";
import { callApi } from "@/Utils/request/query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

class NoTokenWaitingError extends Error {}

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
  const queryClient = useQueryClient();
  const preferredCategoryIds = usePreferredServicePointCategoryIds();

  const mutation = useMutation({
    mutationFn: async (subQueueId: string): Promise<TokenRead> => {
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
        throw new NoTokenWaitingError();
      }
      return callApi(tokenApi.update, {
        pathParams: { facility_id: facilityId, queue_id: queueId, id: next.id },
        body: {
          status: TokenStatus.CREATED,
          note: next.note,
          sub_queue: subQueueId,
        },
      });
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
      .then((token) => options?.onSuccess?.(token))
      .catch(() => options?.onError?.());

  return { callNext, isPending: mutation.isPending };
}
