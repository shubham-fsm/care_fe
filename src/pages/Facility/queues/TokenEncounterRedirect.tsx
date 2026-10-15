import Loading from "@/components/Common/Loading";
import { Button } from "@/components/ui/button";
import { SchedulableResourceType } from "@/types/scheduling/schedule";
import { TokenRead, TokenStatus } from "@/types/tokens/token/token";
import tokenApi from "@/types/tokens/token/tokenApi";
import { TokenSubQueueStatus } from "@/types/tokens/tokenSubQueue/tokenSubQueue";
import tokenSubQueueApi from "@/types/tokens/tokenSubQueue/tokenSubQueueApi";
import query, { callApi } from "@/Utils/request/query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DoorOpenIcon } from "lucide-react";
import { Redirect, useQueryParams } from "raviger";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * A token that has been called to a service point but not yet marked as
 * being served. Opening its encounter means the patient has arrived.
 */
function isCalledButNotServing(token: TokenRead) {
  return token.status === TokenStatus.CREATED && !!token.sub_queue;
}

/**
 * A token not in any room: still waiting, or missed and back at the door.
 * Opened with the queue page's "Encounter" button, the doctor is seeing the
 * patient now, in their room.
 */
function isNotInRoom(token: TokenRead) {
  return (
    !token.sub_queue &&
    [TokenStatus.CREATED, TokenStatus.UNFULFILLED].includes(token.status)
  );
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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [params] = useQueryParams();
  const startService = params.start_service === "1";
  const [chosenRoom, setChosenRoom] = useState<string | null | undefined>(
    params.room || undefined,
  );

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

  const needsRoom = !!token && startService && isNotInRoom(token);

  // No room given (several rooms on the doctor's screen): if the queue has a
  // single open room use it, else ask which room.
  const { data: rooms, isLoading: isRoomsLoading } = useQuery({
    queryKey: [
      "servicePoints",
      facilityId,
      params.resource_type,
      params.resource_id,
    ],
    queryFn: query(tokenSubQueueApi.list, {
      pathParams: { facility_id: facilityId },
      queryParams: {
        resource_type: params.resource_type as SchedulableResourceType,
        resource_id: params.resource_id,
        status: TokenSubQueueStatus.ACTIVE,
        limit: 100,
      },
    }),
    enabled:
      needsRoom &&
      chosenRoom === undefined &&
      !!params.resource_type &&
      !!params.resource_id,
  });
  const onlyRoom = rooms?.results.length === 1 ? rooms.results[0].id : null;
  const room = chosenRoom !== undefined ? chosenRoom : onlyRoom;
  const mustAskRoom =
    needsRoom &&
    chosenRoom === undefined &&
    !!rooms &&
    rooms.results.length > 1;

  // Opening the encounter means the patient is with the doctor: "Now
  // serving" in the room, so the waiting-area TV shows "In consultation"
  // instead of "Now calling" (or "Missed"). Redirect after the update.
  const serveIn = !token
    ? null
    : isCalledButNotServing(token)
      ? (token.sub_queue?.id ?? null)
      : needsRoom
        ? room
        : null;
  const waitingForRoom =
    needsRoom &&
    chosenRoom === undefined &&
    (isRoomsLoading || mustAskRoom) &&
    !!params.resource_id;
  const [startServiceDone, setStartServiceDone] = useState(false);
  const isStartingService = !!serveIn && !startServiceDone;
  useEffect(() => {
    if (!token || !serveIn || startServiceDone) {
      return;
    }
    callApi(tokenApi.update, {
      pathParams: { facility_id: facilityId, queue_id: queueId, id: tokenId },
      body: {
        status: TokenStatus.IN_PROGRESS,
        note: token.note,
        sub_queue: serveIn,
      },
      silent: true,
    })
      .then(() => {
        queryClient.invalidateQueries({
          queryKey: ["infinite-tokens", facilityId, queueId],
        });
        queryClient.invalidateQueries({
          queryKey: ["token-queue-summary", facilityId, queueId],
        });
      })
      .catch(() => undefined)
      .finally(() => setStartServiceDone(true));
  }, [
    token,
    serveIn,
    startServiceDone,
    facilityId,
    queueId,
    tokenId,
    queryClient,
  ]);

  if (mustAskRoom && rooms) {
    return (
      <div className="flex justify-center p-6">
        <div className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <DoorOpenIcon className="size-5 text-gray-700" />
            <h2 className="text-lg font-semibold">
              {t("which_room_is_patient_in")}
            </h2>
          </div>
          <p className="text-sm text-gray-600">
            {t("which_room_is_patient_in_description")}
          </p>
          <div className="flex flex-col gap-2">
            {rooms.results.map((servicePoint) => (
              <Button
                key={servicePoint.id}
                variant="outline"
                size="lg"
                onClick={() => setChosenRoom(servicePoint.id)}
              >
                {servicePoint.name}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => setChosenRoom(null)}>
              {t("skip_do_not_show_on_tv")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (
    isTokenLoading ||
    !token?.patient?.id ||
    isStartingService ||
    waitingForRoom
  ) {
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
