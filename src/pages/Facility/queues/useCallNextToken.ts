import { usePreferredServicePointCategoryIds } from "@/pages/Facility/queues/usePreferredServicePointCategory";
import {
  renderTokenNumber,
  TokenRead,
  TokenStatus,
} from "@/types/tokens/token/token";
import tokenApi from "@/types/tokens/token/tokenApi";
import {
  CallPriority,
  callPriorityOf,
} from "@/types/tokens/tokenCategory/tokenCategory";
import { callApi } from "@/Utils/request/query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type CallNextResult =
  | { kind: "called"; token: TokenRead }
  | { kind: "already_called"; token: TokenRead }
  | { kind: "none_waiting"; onlyCategory?: boolean };

const RANK: Record<CallPriority, number> = {
  emergency: 0,
  high: 1,
  normal: 2,
};

/** Call order of a token's category: emergency, then high, then normal. */
export function categoryRank(category: TokenRead["category"]) {
  return RANK[callPriorityOf(category)];
}

/** Highest-priority waiting token; oldest first within the same priority. */
function pickNextToken(waiting: TokenRead[]) {
  let best: TokenRead | undefined;
  for (const token of waiting) {
    if (!best || categoryRank(token.category) < categoryRank(best.category)) {
      best = token;
    }
  }
  return best;
}

/**
 * Calls the next waiting token of a queue to a service point (sub queue),
 * respecting the service point's preferred token category, if one is set.
 * Emergency tokens are called first, then other priority groups (senior
 * citizens, pregnant women, ...), then the rest, each in order of arrival.
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
      const { results: waiting } = await callApi(tokenApi.list, {
        pathParams: { facility_id: facilityId, queue_id: queueId },
        queryParams: {
          status: TokenStatus.CREATED,
          sub_queue_is_null: true,
          ordering: "created_date",
          limit: 200, // the API page size limit
          ...(category ? { category } : {}),
        },
      });
      const pathFor = (id: string) => ({
        facility_id: facilityId,
        queue_id: queueId,
        id,
      });
      const skipped = new Set<string>();
      // Two rooms can press Serve Next at the same moment: re-check the
      // patient right before calling, and once more after, so a patient is
      // never announced for two rooms. The room that loses takes the next.
      for (let attempt = 0; attempt < 5; attempt++) {
        const next = pickNextToken(waiting.filter((t) => !skipped.has(t.id)));
        if (!next) {
          return { kind: "none_waiting", onlyCategory: !!category };
        }
        skipped.add(next.id);
        const fresh = await callApi(tokenApi.get, {
          pathParams: pathFor(next.id),
        });
        if (fresh.status !== TokenStatus.CREATED || fresh.sub_queue) {
          continue;
        }
        const token = await callApi(tokenApi.update, {
          pathParams: pathFor(next.id),
          body: {
            status: TokenStatus.CREATED,
            note: fresh.note,
            sub_queue: subQueueId,
          },
        });
        await new Promise((resolve) => setTimeout(resolve, 400));
        const after = await callApi(tokenApi.get, {
          pathParams: pathFor(next.id),
        });
        if (after.sub_queue?.id === subQueueId) {
          return { kind: "called", token };
        }
      }
      return { kind: "none_waiting" };
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
          toast.info(
            t(
              result.kind === "none_waiting" && result.onlyCategory
                ? "no_patient_of_room_category_waiting"
                : "no_patient_is_waiting",
            ),
          );
        }
      })
      .catch(() => options?.onError?.());

  return { callNext, isPending: mutation.isPending };
}
