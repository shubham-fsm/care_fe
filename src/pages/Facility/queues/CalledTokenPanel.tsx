import CreateEncounterForm from "@/components/Encounter/CreateEncounterForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EncounterStatus } from "@/types/emr/encounter/encounter";
import { AppointmentStatus } from "@/types/scheduling/schedule";
import scheduleApi from "@/types/scheduling/scheduleApi";
import {
  renderTokenNumber,
  TokenRetrieve,
  TokenStatus,
} from "@/types/tokens/token/token";
import tokenApi from "@/types/tokens/token/tokenApi";
import mutate from "@/Utils/request/mutate";
import query from "@/Utils/request/query";
import { formatPatientAge } from "@/Utils/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BringToFront, Megaphone, PlayIcon, XIcon } from "lucide-react";
import { Link, navigate } from "raviger";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface Props {
  facilityId: string;
  queueId: string;
  tokenId: string;
  onDismiss: () => void;
}

/**
 * Shown on the queue page right after "Complete & Call Next" on the encounter
 * page: the token that was just called, with a one-tap Start Consultation.
 */
export function CalledTokenPanel({
  facilityId,
  queueId,
  tokenId,
  onDismiss,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: token } = useQuery({
    queryKey: ["token", tokenId],
    queryFn: query(tokenApi.get, {
      pathParams: { facility_id: facilityId, queue_id: queueId, id: tokenId },
    }),
  });

  const { mutate: updateAppointment } = useMutation({
    mutationFn: mutate(scheduleApi.appointments.update, {
      pathParams: { facilityId, id: token?.booking?.id ?? "" },
    }),
  });

  const { mutate: moveToAwaitingRecall, isPending: isMoving } = useMutation({
    mutationFn: mutate(tokenApi.update, {
      pathParams: { facility_id: facilityId, queue_id: queueId, id: tokenId },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["infinite-tokens", facilityId, queueId],
      });
      queryClient.invalidateQueries({
        queryKey: ["token-queue-summary", facilityId, queueId],
      });
      toast.success(t("token_moved_to_awaiting_recall"));
      onDismiss();
    },
  });

  if (!token || token.status !== TokenStatus.IN_PROGRESS) {
    return null;
  }

  const markInConsultation = () => {
    const booking = token.booking;
    if (
      booking &&
      [AppointmentStatus.BOOKED, AppointmentStatus.CHECKED_IN].includes(
        booking.status,
      )
    ) {
      updateAppointment({
        status: AppointmentStatus.IN_CONSULTATION,
        note: booking.note,
      });
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border-2 border-primary-600 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <span className="rounded-md bg-gray-900 px-3 py-1 text-xl font-bold text-white">
            {renderTokenNumber(token)}
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-lg font-semibold truncate">
              {token.patient?.name ?? t("patient_not_linked")}
            </span>
            {token.patient && (
              <span className="text-sm text-gray-600">
                {formatPatientAge(token.patient, true)},{" "}
                {t(`GENDER__${token.patient.gender}`)}
                {token.sub_queue && ` · ${token.sub_queue.name}`}
              </span>
            )}
          </div>
          <Badge variant="yellow">{t("called_waiting_to_enter")}</Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("close")}
          onClick={onDismiss}
        >
          <XIcon />
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <StartConsultationAction
          facilityId={facilityId}
          queueId={queueId}
          token={token}
          onStart={markInConsultation}
        />
        <Button
          variant="outline"
          size="lg"
          disabled={isMoving}
          onClick={() =>
            moveToAwaitingRecall({
              status: TokenStatus.UNFULFILLED,
              note: token.note,
              sub_queue: null,
            })
          }
        >
          <BringToFront />
          {t("not_arrived_move_to_awaiting_recall")}
        </Button>
      </div>
      <span className="text-xs text-gray-600">
        {t("start_consultation_when_patient_arrives")}
      </span>
    </div>
  );
}

function StartConsultationAction({
  facilityId,
  queueId,
  token,
  onStart,
}: {
  facilityId: string;
  queueId: string;
  token: TokenRetrieve;
  onStart: () => void;
}) {
  const { t } = useTranslation();
  const label = (
    <>
      <PlayIcon />
      {t("start_consultation")}
    </>
  );

  // An encounter already exists (e.g. created at the nursing station).
  if (token.patient && token.encounter?.id) {
    const encounterPath = `/facility/${facilityId}/patient/${token.patient.id}/encounter/${token.encounter.id}/updates`;
    return (
      <Button
        variant="primary"
        size="lg"
        className="sm:flex-1"
        onClick={() => {
          onStart();
          navigate(encounterPath);
        }}
      >
        {label}
      </Button>
    );
  }

  if (token.patient && token.booking) {
    return (
      <CreateEncounterForm
        patientId={token.patient.id}
        facilityId={facilityId}
        patientName={token.patient.name}
        appointment={token.booking.id}
        defaultOpen={false}
        defaultStatus={EncounterStatus.IN_PROGRESS}
        onSuccess={onStart}
        trigger={
          <Button variant="primary" size="lg" className="sm:flex-1">
            {label}
          </Button>
        }
      />
    );
  }

  // No appointment linked: fall back to the existing token → encounter flow.
  return (
    <Button variant="primary" size="lg" className="sm:flex-1" asChild>
      <Link
        basePath="/"
        href={`/facility/${facilityId}/queue/${queueId}/token/${token.id}`}
      >
        <Megaphone />
        {t("open_token")}
      </Link>
    </Button>
  );
}
