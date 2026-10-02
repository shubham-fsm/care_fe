import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import { TokenRead, TokenStatus } from "@/types/tokens/token/token";
import tokenApi from "@/types/tokens/token/tokenApi";
import { TokenCategoryRead } from "@/types/tokens/tokenCategory/tokenCategory";
import { callApi } from "@/Utils/request/query";

import { usePreferredServicePointCategory } from "./usePreferredServicePointCategory";

const autoCallNextAtom = atomWithStorage<boolean>(
  "care_queues_auto_call_next",
  true,
  undefined,
  { getOnInit: true },
);

/**
 * Whether completing a token should automatically call the next waiting
 * token to the same service point. Stored per browser, enabled by default.
 */
export function useAutoCallNextPreference() {
  return useAtom(autoCallNextAtom);
}

const PRIORITY_CATEGORY_PATTERN = /emergency|priority|urgent|आपात/i;

/**
 * A token category is treated as priority when its metadata says so
 * (`metadata.priority === true`) or when its name suggests it
 * (e.g. "Emergency", "Priority").
 */
export function isPriorityCategory(category: TokenCategoryRead) {
  if (category.metadata?.priority === true) {
    return true;
  }
  return PRIORITY_CATEGORY_PATTERN.test(category.name);
}

/**
 * Order in which categories are tried when calling the next token:
 * - If the service point has a preferred category, only that category.
 * - Otherwise, priority categories first, then any category.
 */
export function getCategoryCallOrder(
  preferredCategoryId: string | undefined,
  categories: TokenCategoryRead[] | undefined,
): (string | undefined)[] {
  if (preferredCategoryId) {
    return [preferredCategoryId];
  }
  const priorityIds = (categories ?? [])
    .filter(isPriorityCategory)
    .map(({ id }) => id);
  return [...priorityIds, undefined];
}

/**
 * The oldest token still waiting in the queue (not yet called to any
 * service point), trying each category in `categoryOrder` in turn.
 */
async function findNextWaitingToken({
  facilityId,
  queueId,
  categoryOrder,
}: {
  facilityId: string;
  queueId: string;
  categoryOrder: (string | undefined)[];
}): Promise<TokenRead | null> {
  for (const category of categoryOrder) {
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
    if (results[0]) {
      return results[0];
    }
  }
  return null;
}

/**
 * Calls the next waiting token to a service point.
 *
 * The token is moved to "Called" (assigned to the service point, not yet
 * being served) so that the waiting-area display keeps announcing it until
 * the patient actually arrives. It becomes "Now serving" when the doctor
 * opens its encounter (see TokenEncounterRedirect) or marks it as serving.
 *
 * Resolves with the token that was called, or `null` when no token is waiting.
 */
async function callNextTokenToServicePoint({
  facilityId,
  queueId,
  subQueueId,
  categoryOrder,
}: {
  facilityId: string;
  queueId: string;
  subQueueId: string;
  categoryOrder: (string | undefined)[];
}): Promise<TokenRead | null> {
  const next = await findNextWaitingToken({
    facilityId,
    queueId,
    categoryOrder,
  });
  if (!next) {
    return null;
  }
  return callApi(tokenApi.update, {
    pathParams: { facility_id: facilityId, queue_id: queueId, id: next.id },
    body: {
      status: TokenStatus.CREATED,
      note: next.note,
      sub_queue: subQueueId,
    },
  });
}

/**
 * Returns a function that calls the next waiting token to a service point,
 * giving priority categories (e.g. Emergency) precedence over the rest, and
 * respecting the category the service point has been set to serve.
 */
export function useCallNextTokenFn({
  facilityId,
  queueId,
}: {
  facilityId: string;
  queueId: string;
}) {
  const { tokenCategories, preferredServicePointCategories } =
    usePreferredServicePointCategory({ facilityId });

  return (subQueueId: string) =>
    callNextTokenToServicePoint({
      facilityId,
      queueId,
      subQueueId,
      categoryOrder: getCategoryCallOrder(
        preferredServicePointCategories?.[subQueueId]?.id,
        tokenCategories,
      ),
    });
}

/**
 * Mutation that calls the next waiting token to a service point.
 * Resolves with the token that was called, or `null` when no token is waiting.
 */
export function useCallNextToken({
  facilityId,
  queueId,
}: {
  facilityId: string;
  queueId: string;
}) {
  const queryClient = useQueryClient();
  const callNextToken = useCallNextTokenFn({ facilityId, queueId });

  return useMutation({
    mutationFn: ({ subQueueId }: { subQueueId: string }) =>
      callNextToken(subQueueId),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["infinite-tokens", facilityId, queueId],
      });
      queryClient.invalidateQueries({
        queryKey: ["token-queue-summary", facilityId, queueId],
      });
    },
  });
}
