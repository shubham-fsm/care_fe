import careConfig from "@careConfig";

import CreateEncounterForm from "@/components/Encounter/CreateEncounterForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EncounterRead,
  EncounterStatus,
} from "@/types/emr/encounter/encounter";
import encounterApi from "@/types/emr/encounter/encounterApi";
import facilityOrganizationApi from "@/types/facilityOrganization/facilityOrganizationApi";
import { AppointmentStatus } from "@/types/scheduling/schedule";
import scheduleApi from "@/types/scheduling/scheduleApi";
import {
  renderTokenNumber,
  TokenRetrieve,
  TokenStatus,
} from "@/types/tokens/token/token";
import tokenApi from "@/types/tokens/token/tokenApi";
import mutate from "@/Utils/request/mutate";
import query, { callApi } from "@/Utils/request/query";
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

  const isCalled =
    !!token &&
    ((token.status === TokenStatus.CREATED && !!token.sub_queue) ||
      token.status === TokenStatus.IN_PROGRESS);
  if (!token || !isCalled) {
    return null;
  }

  const markInConsultation = () => {
    // The patient has arrived: the TV moves the token from "Now calling" to
    // "In consultation".
    if (token.status === TokenStatus.CREATED) {
      callApi(tokenApi.update, {
        pathParams: { facility_id: facilityId, queue_id: queueId, id: tokenId },
        body: {
          status: TokenStatus.IN_PROGRESS,
          note: token.note,
          sub_queue: token.sub_queue?.id ?? null,
        },
        silent: true,
      }).finally(() => {
        queryClient.invalidateQueries({
          queryKey: ["infinite-tokens", facilityId, queueId],
        });
      });
    }
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
      <QuickStartConsultation
        facilityId={facilityId}
        token={token}
        onStart={onStart}
        label={label}
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

const ENCOUNTER_DEPARTMENTS_FAVORITE_LIST = "encounter_departments";

// Queue visits are outpatient visits unless the deployment sets a default.
const QUEUE_ENCOUNTER_CLASS =
  careConfig.defaultEncounterType ??
  (careConfig.encounterClasses.includes("amb")
    ? "amb"
    : careConfig.encounterClasses[0]);

/**
 * One tap: creates the in-progress encounter for the called patient with the
 * doctor's starred encounter departments and opens it. Without starred
 * departments, the usual encounter form opens once; starring a department
 * there makes the next start one tap.
 */
function QuickStartConsultation({
  facilityId,
  token,
  onStart,
  label,
}: {
  facilityId: string;
  token: TokenRetrieve;
  onStart: () => void;
  label: React.ReactNode;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const patient = token.patient!;
  const booking = token.booking!;

  const { data: preferredDepartments, isLoading } = useQuery({
    queryKey: [
      "facilityOrganization-favorites",
      facilityId,
      ENCOUNTER_DEPARTMENTS_FAVORITE_LIST,
    ],
    queryFn: query(facilityOrganizationApi.list, {
      pathParams: { facilityId },
      queryParams: { favorite_list: ENCOUNTER_DEPARTMENTS_FAVORITE_LIST },
    }),
  });

  const { mutate: createEncounter, isPending } = useMutation({
    mutationFn: mutate(encounterApi.create),
    onSuccess: (encounter: EncounterRead) => {
      toast.success(t("encounter_created"));
      queryClient.invalidateQueries({ queryKey: ["encounters", patient.id] });
      onStart();
      navigate(
        `/facility/${facilityId}/patient/${patient.id}/encounter/${encounter.id}/updates`,
      );
    },
  });

  const departments = preferredDepartments?.results.map(({ id }) => id) ?? [];

  if (!isLoading && departments.length === 0) {
    return (
      <CreateEncounterForm
        patientId={patient.id}
        facilityId={facilityId}
        patientName={patient.name}
        appointment={booking.id}
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

  return (
    <Button
      variant="primary"
      size="lg"
      className="sm:flex-1"
      disabled={isLoading || isPending}
      onClick={() =>
        createEncounter({
          patient: patient.id,
          facility: facilityId,
          status: EncounterStatus.IN_PROGRESS,
          encounter_class: QUEUE_ENCOUNTER_CLASS,
          priority: "routine",
          organizations: departments,
          period: { start: new Date().toISOString() },
          appointment: booking.id,
          tags: [],
        })
      }
    >
      {label}
    </Button>
  );
}
