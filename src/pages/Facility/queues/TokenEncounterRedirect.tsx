import Loading from "@/components/Common/Loading";
import { TokenRead, TokenStatus } from "@/types/tokens/token/token";
import tokenApi from "@/types/tokens/token/tokenApi";
import query, { callApi } from "@/Utils/request/query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "raviger";
import { useEffect, useState } from "react";

/**
 * A token that has been called to a service point but not yet marked as
 * being served. Opening its encounter means the patient has arrived.
 */
function isCalledButNotServing(token: TokenRead) {
  return token.status === TokenStatus.CREATED && !!token.sub_queue;
}

const TokenEncounterRedirect = ({
  facilityId,
  tokenId,
  queueId,
}: {
  facilityId: string;
  tokenId: string;
  queueId: string;
}) => {
  const queryClient = useQueryClient();
  const { data: token, isLoading: isTokenLoading } = useQuery({
    queryKey: ["token", tokenId],
    queryFn: query(tokenApi.get, {
      pathParams: {
        facility_id: facilityId,
        queue_id: queueId,
        id: tokenId,
      },
    }),
  });

  // When the doctor opens the encounter of a called token, the patient has
  // arrived: move the token to "Now serving" so the waiting-area display stops
  // showing it as "Now calling". Redirect only after the update is attempted.
  const needsStartService = !!token && isCalledButNotServing(token);
  const [startServiceDone, setStartServiceDone] = useState(false);
  const isStartingService = needsStartService && !startServiceDone;
  useEffect(() => {
    if (!token || !needsStartService) {
      return;
    }
    callApi(tokenApi.update, {
      pathParams: { facility_id: facilityId, queue_id: queueId, id: tokenId },
      body: {
        status: TokenStatus.IN_PROGRESS,
        note: token.note,
        sub_queue: token.sub_queue?.id ?? null,
      },
      silent: true,
    })
      .then(() => {
        queryClient.invalidateQueries({
          queryKey: ["infinite-tokens", facilityId, queueId],
        });
      })
      .catch(() => undefined)
      .finally(() => setStartServiceDone(true));
  }, [token, needsStartService, facilityId, queueId, tokenId, queryClient]);

  if (isTokenLoading || !token || isStartingService) {
    return <Loading />;
  }

  if (token.encounter?.id && token?.patient?.id) {
    return (
      <Redirect
        to={`/facility/${facilityId}/patient/${token.patient.id}/encounter/${token.encounter.id}/updates`}
      />
    );
  }

  if (token.booking && token?.patient?.id) {
    return (
      <Redirect
        to={`/facility/${facilityId}/patient/${token?.patient?.id}/appointments/${token.booking.id}?from_queue=true`}
      />
    );
  }

  if (!token.booking && token?.patient?.id) {
    return (
      <Redirect
        to={`/facility/${facilityId}/patients/home?${new URLSearchParams({
          phone_number: token.patient.phone_number,
          flow: "queue",
          year_of_birth: token.patient.year_of_birth?.toString() || "",
          partial_id: token.patient.id.slice(0, 5),
        }).toString()}`}
      />
    );
  }

  if (!token?.patient?.id) {
    return <Redirect to={`/facility/${facilityId}/patient/create`} />;
  }

  return <Loading />;
};

export default TokenEncounterRedirect;
