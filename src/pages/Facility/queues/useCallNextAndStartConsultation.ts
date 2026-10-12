import careConfig from "@careConfig";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { navigate } from "raviger";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { EncounterStatus } from "@/types/emr/encounter/encounter";
import encounterApi from "@/types/emr/encounter/encounterApi";
import { AppointmentStatus } from "@/types/scheduling/schedule";
import scheduleApis from "@/types/scheduling/scheduleApi";
import { renderTokenNumber } from "@/types/tokens/token/token";
import tokenApi from "@/types/tokens/token/tokenApi";
import tokenQueueApi from "@/types/tokens/tokenQueue/tokenQueueApi";
import { callApi } from "@/Utils/request/query";
import { dateQueryString } from "@/Utils/utils";

// Queue visits are outpatient visits unless the deployment sets a default.
const QUEUE_ENCOUNTER_CLASS =
  careConfig.defaultEncounterType ??
  (careConfig.encounterClasses.includes("amb")
    ? "amb"
    : careConfig.encounterClasses[0]);

const OPEN_ENCOUNTER_STATUSES = [
  EncounterStatus.PLANNED,
  EncounterStatus.IN_PROGRESS,
  EncounterStatus.ON_HOLD,
];

interface CallNextAndStartConsultationInput {
  subQueueId: string;
  category?: string;
  /** Departments for the encounter, when one has to be created. */
  organizations: string[];
}

/**
 * Calls the next token to a service point and opens the patient's encounter
 * in one step:
 *
 * 1. The next token is called to the service point (Now serving), which also
 *    updates the queue and the TV display.
 * 2. The token's encounter is opened. When there is none, an in-progress
 *    encounter is created for the patient (linked to the appointment, if the
 *    token has one) and opened. A walk-in patient's encounter opened today
 *    at this facility is reused instead of creating a duplicate.
 *
 * A token without a patient opens the token page, where the patient is
 * registered as usual.
 */
export function useCallNextAndStartConsultation({
  facilityId,
  queueId,
}: {
  facilityId: string;
  queueId: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subQueueId,
      category,
      organizations,
    }: CallNextAndStartConsultationInput) => {
      const called = await callApi(tokenQueueApi.setNextTokenToSubQueue, {
        pathParams: { facility_id: facilityId, id: queueId },
        body: { sub_queue: subQueueId, category },
      });

      // The queue has changed even if a later step fails.
      queryClient.invalidateQueries({
        queryKey: ["infinite-tokens", facilityId, queueId],
      });
      queryClient.invalidateQueries({
        queryKey: ["token-queue-summary", facilityId, queueId],
      });

      const tokenPage = `/facility/${facilityId}/queue/${queueId}/token/${called.id}`;
      try {
        return await openEncounter(called.id, tokenPage, organizations);
      } catch (error) {
        // The patient is already called: continue from the token page.
        navigate(tokenPage);
        throw error;
      }
    },
    onSuccess: ({ url, tokenNumber, result }) => {
      toast.success(
        {
          created: t("token_called_encounter_started", { token: tokenNumber }),
          opened: t("token_called_opening", { token: tokenNumber }),
          no_patient: t("token_called_register_patient", {
            token: tokenNumber,
          }),
        }[result],
      );
      navigate(url);
    },
  });

  async function openEncounter(
    tokenId: string,
    tokenPage: string,
    organizations: string[],
  ) {
    const token = await callApi(tokenApi.get, {
      pathParams: { facility_id: facilityId, queue_id: queueId, id: tokenId },
    });
    const tokenNumber = renderTokenNumber(token);

    const patientId = token.patient?.id;
    if (!patientId) {
      return { url: tokenPage, tokenNumber, result: "no_patient" as const };
    }

    const encounterPage = (encounterId: string) =>
      `/facility/${facilityId}/patient/${patientId}/encounter/${encounterId}/updates`;

    const startAppointment = async () => {
      if (!token.booking) return;
      if (token.booking.status === AppointmentStatus.IN_CONSULTATION) return;
      await callApi(scheduleApis.appointments.update, {
        pathParams: { facilityId, id: token.booking.id },
        body: {
          status: AppointmentStatus.IN_CONSULTATION,
          note: token.booking.note,
        },
        silent: true,
      }).catch(() => {
        // The encounter is what the doctor needs; the appointment status
        // can still be updated from the appointment page.
      });
    };

    if (token.encounter?.id) {
      await startAppointment();
      return {
        url: encounterPage(token.encounter.id),
        tokenNumber,
        result: "opened" as const,
      };
    }

    if (!token.booking) {
      const openEncounters = await callApi(encounterApi.list, {
        queryParams: {
          patient: patientId,
          facility: facilityId,
          status: OPEN_ENCOUNTER_STATUSES.join(","),
          // Only today's visit: an encounter left open on an earlier day is
          // a different visit.
          created_date_after: dateQueryString(new Date()),
          limit: 1,
        },
      });
      const openEncounter = openEncounters.results[0];
      if (openEncounter) {
        return {
          url: encounterPage(openEncounter.id),
          tokenNumber,
          result: "opened" as const,
        };
      }
    }

    const encounter = await callApi(encounterApi.create, {
      body: {
        patient: patientId,
        facility: facilityId,
        status: EncounterStatus.IN_PROGRESS,
        encounter_class: QUEUE_ENCOUNTER_CLASS,
        priority: "routine",
        organizations,
        period: { start: new Date().toISOString() },
        appointment: token.booking?.id,
      },
    });
    queryClient.invalidateQueries({ queryKey: ["encounters", patientId] });
    await startAppointment();
    return {
      url: encounterPage(encounter.id),
      tokenNumber,
      result: "created" as const,
    };
  }
}
