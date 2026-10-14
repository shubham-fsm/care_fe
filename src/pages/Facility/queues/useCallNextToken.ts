import { usePreferredServicePointCategoryIds } from "@/pages/Facility/queues/usePreferredServicePointCategory";
import { TokenRead } from "@/types/tokens/token/token";
import tokenQueueApi from "@/types/tokens/tokenQueue/tokenQueueApi";
import mutate from "@/Utils/request/mutate";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Calls the next waiting token of a queue to a service point (sub queue),
 * respecting the service point's preferred token category, if one is set.
 */
export function useCallNextToken({
  facilityId,
  queueId,
  silent = false,
}: {
  facilityId: string;
  queueId: string;
  silent?: boolean;
}) {
  const queryClient = useQueryClient();
  const preferredCategoryIds = usePreferredServicePointCategoryIds();

  const mutation = useMutation({
    mutationFn: mutate(tokenQueueApi.setNextTokenToSubQueue, {
      pathParams: { facility_id: facilityId, id: queueId },
      silent,
    }),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["infinite-tokens", facilityId, queueId],
      });
      queryClient.invalidateQueries({
        queryKey: ["token-queue-summary", facilityId, queueId],
      });
    },
  });

  const callNext = (
    subQueueId: string,
    options?: {
      onSuccess?: (token: TokenRead) => void;
      onError?: () => void;
    },
  ) =>
    mutation.mutate(
      {
        sub_queue: subQueueId,
        category: preferredCategoryIds[subQueueId] || undefined,
      },
      {
        onSuccess: (token) => options?.onSuccess?.(token),
        onError: () => options?.onError?.(),
      },
    );

  return { callNext, isPending: mutation.isPending };
}
