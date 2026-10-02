import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { EncounterRead } from "@/types/emr/encounter/encounter";
import { renderTokenNumber, TokenRead } from "@/types/tokens/token/token";
import tokenCategoryApi from "@/types/tokens/tokenCategory/tokenCategoryApi";
import { callApi } from "@/Utils/request/query";

import {
  callNextTokenToServicePoint,
  getCategoryCallOrder,
  useAutoCallNextPreference,
} from "./useCallNextToken";
import { usePreferredServicePointCategoryIds } from "./usePreferredServicePointCategory";

/**
 * Returns a function to run after the visit is completed from the encounter
 * page ("Complete" in the appointment header), which also completes the
 * patient's queue token. With auto-call on, it calls the next waiting patient
 * to the service point that token was at, the same as completing the token
 * from the queue page. Failures are silent: the visit is already complete.
 */
export function useCallNextAfterEncounterTokenClosed(encounter: EncounterRead) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [autoCallNext] = useAutoCallNextPreference();
  const preferredCategoryIds = usePreferredServicePointCategoryIds();

  const callNext = async (token: TokenRead) => {
    if (!token.sub_queue) {
      return null;
    }
    const facilityId = encounter.facility.id;
    // Categories are loaded only now: this runs outside the queue pages.
    const categories = await callApi(tokenCategoryApi.list, {
      pathParams: { facility_id: facilityId },
      queryParams: { limit: 100 },
      silent: true,
    });
    return callNextTokenToServicePoint({
      facilityId,
      queueId: token.queue.id,
      subQueueId: token.sub_queue.id,
      onlyIfNoneCalled: true,
      categoryOrder: getCategoryCallOrder(
        preferredCategoryIds[token.sub_queue.id],
        categories.results,
      ),
    });
  };

  return async () => {
    const token = encounter.appointment?.token;
    if (!token) {
      return;
    }
    const next = autoCallNext ? await callNext(token).catch(() => null) : null;
    queryClient.invalidateQueries({ queryKey: ["infinite-tokens"] });
    queryClient.invalidateQueries({ queryKey: ["token-queue-summary"] });
    if (next) {
      toast.success(t("token_called", { token: renderTokenNumber(next) }));
    }
  };
}
