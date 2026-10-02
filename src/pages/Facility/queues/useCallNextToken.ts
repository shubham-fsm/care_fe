import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import { TokenRead } from "@/types/tokens/token/token";
import { TokenCategoryRead } from "@/types/tokens/tokenCategory/tokenCategory";
import tokenQueueApi from "@/types/tokens/tokenQueue/tokenQueueApi";
import { callApi } from "@/Utils/request/query";
import { HTTPError } from "@/Utils/request/types";

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
 * Calls the next waiting token in the queue to the given service point,
 * trying each category in `categoryOrder` until one has a waiting token.
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
  for (const category of categoryOrder) {
    try {
      return await callApi(tokenQueueApi.setNextTokenToSubQueue, {
        pathParams: { facility_id: facilityId, id: queueId },
        body: { sub_queue: subQueueId, category },
        silent: true,
      });
    } catch (error) {
      // The backend responds with 400 when no token is waiting in the
      // requested category; try the next category in the order.
      if (error instanceof HTTPError && error.status === 400) {
        continue;
      }
      throw error;
    }
  }
  return null;
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
