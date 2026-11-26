import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, PillIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { formatMedicationLine } from "@/components/Medicine/utils";
import { ADMISSION_ADVICE_CODE } from "@/components/Questionnaire/structured/handlers";

import query, { callApi } from "@/Utils/request/query";
import { formatDateTime, formatName } from "@/Utils/utils";
import { useEncounter } from "@/pages/Encounters/utils/EncounterProvider";
import {
  MedicationRequestRead,
  displayMedicationName,
} from "@/types/emr/medicationRequest/medicationRequest";
import medicationRequestApi from "@/types/emr/medicationRequest/medicationRequestApi";
import { PrescriptionStatus } from "@/types/emr/prescription/prescription";
import { Question } from "@/types/questionnaire/question";
import { QuestionnaireResponse } from "@/types/questionnaire/questionnaireResponse";
import questionnaireResponseApi from "@/types/questionnaire/questionnaireResponseApi";

// Name given to the IP prescription created from the advice, so the card
// can tell that the medicines were already started.
const ADMISSION_PRESCRIPTION_NAME = "Admission advice from OPD";

// Questions coded as admission advice, or inside a group coded that way.
const admissionQuestions = (
  questions: Question[] = [],
  inGroup = false,
): Question[] =>
  questions.flatMap((q) => {
    const coded = inGroup || q.code?.code === ADMISSION_ADVICE_CODE;
    if (q.type === "group") return admissionQuestions(q.questions, coded);
    return coded ? [q] : [];
  });

const answersOf = (response?: QuestionnaireResponse) => {
  if (!response) return [];
  return admissionQuestions(response.questionnaire?.questions)
    .filter((q) => q.type !== "structured")
    .map((q) => {
      const r = response.responses.find((res) => res.question_id === q.id);
      const value = (r?.values ?? [])
        .map((v) => displayValue(v.coding?.display ?? v.value))
        .filter(Boolean)
        .join(", ");
      return { label: q.text.trim(), value };
    })
    .filter((a) => a.value);
};

const displayValue = (value: unknown): string => {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "object" && value && "display" in value) {
    return String((value as { display?: string }).display ?? "");
  }
  return String(value);
};

/**
 * Shows the admission advice the OPD/Emergency doctor wrote, inside the new IP
 * encounter, and lets the ward nurse start the advised medicines here under the
 * ordering doctor's name (no re-typing from the BHT).
 */
export const AdmissionAdviceFromOpd = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    selectedEncounter: encounter,
    patientId,
    selectedEncounterId: encounterId,
    canWriteSelectedEncounter: canWrite,
  } = useEncounter();

  const isInpatient = encounter?.encounter_class === "imp";

  const { data: responses } = useQuery({
    queryKey: ["admission-advice", patientId],
    queryFn: query(questionnaireResponseApi.list, {
      pathParams: { patientId },
      queryParams: { only_unstructured: true, limit: 20 },
    }),
    enabled: isInpatient && !!patientId,
  });

  // Latest response from another encounter that carries admission advice.
  const advice = responses?.results?.find(
    (r) => r.encounter && r.encounter !== encounterId && answersOf(r).length,
  );
  const opEncounterId =
    advice?.encounter && advice.encounter !== encounterId
      ? advice.encounter
      : undefined;

  const { data: opMedicines } = useQuery({
    queryKey: ["admission-advice-medicines", patientId, opEncounterId],
    queryFn: query(medicationRequestApi.list, {
      pathParams: { patientId },
      queryParams: { encounter: opEncounterId, limit: 50 },
    }),
    enabled: !!opEncounterId,
  });

  // Medicines already started in this IP encounter from the advice.
  const { data: ipMedicines } = useQuery({
    queryKey: ["admission-advice-medicines", patientId, encounterId],
    queryFn: query(medicationRequestApi.list, {
      pathParams: { patientId },
      queryParams: { encounter: encounterId, limit: 50 },
    }),
    enabled: !!opEncounterId,
  });

  // Oldest first, in the order the doctor wrote them. They stay as drafts in
  // the OP encounter (never active there), which may already be completed.
  const proposed = (opMedicines?.results ?? [])
    .filter(
      (m) =>
        m.intent === "proposal" &&
        m.category === "inpatient" &&
        m.status === "draft",
    )
    .reverse();
  const started = (ipMedicines?.results ?? [])
    .filter((m) => m.prescription?.name === ADMISSION_PRESCRIPTION_NAME)
    .reverse();
  const pending = started.length ? [] : proposed;

  const { mutate: startMedicines, isPending } = useMutation({
    mutationFn: async (medicines: MedicationRequestRead[]) => {
      const now = new Date().toISOString();
      await callApi(medicationRequestApi.upsert, {
        pathParams: { patientId },
        body: {
          datapoints: medicines.map((m) => ({
            status: "active",
            intent: "order",
            category: "inpatient",
            priority: m.priority,
            do_not_perform: m.do_not_perform,
            medication: m.requested_product ? undefined : m.medication,
            requested_product: m.requested_product?.id,
            dosage_instruction: m.dosage_instruction,
            note: m.note,
            authored_on: now,
            encounter: encounterId,
            patient: patientId,
            // The order stays with the doctor who wrote the advice.
            requester: m.requester?.id,
            create_prescription: {
              status: PrescriptionStatus.active,
              alternate_identifier: `${encounterId}-admission-${now.replace(/[:.]/g, "-")}`,
              name: ADMISSION_PRESCRIPTION_NAME,
              note: t("admission_advice_prescription_note"),
            },
          })),
        },
      });
    },
    onSuccess: () => {
      toast.success(t("admission_advice_medicines_started"));
      queryClient.invalidateQueries({
        queryKey: ["admission-advice-medicines"],
      });
      queryClient.invalidateQueries({ queryKey: ["medication_requests"] });
      queryClient.invalidateQueries({ queryKey: ["medication_request"] });
    },
  });

  if (!isInpatient || !advice || !opEncounterId) return null;

  const answers = answersOf(advice);

  const doctor = advice.created_by;

  return (
    <Card className="border-primary-200 bg-primary-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="size-5 text-primary-600" />
          {t("admission_advice_from_opd")}
        </CardTitle>
        <CardDescription>
          {t("admission_advice_written_by", {
            doctor: formatName(doctor),
            time: formatDateTime(advice.created_date),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {answers.map((a) => (
            <div key={a.label}>
              <dt className="text-gray-500">{a.label}</dt>
              <dd className="font-medium text-gray-900">{a.value}</dd>
            </div>
          ))}
        </dl>

        {(proposed.length > 0 || started.length > 0) && (
          <div className="rounded-md border bg-white">
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <PillIcon className="size-4" />
                {t("admission_advice_medicines")}
              </span>
              {pending.length === 0 ? (
                <Badge variant="green">
                  {t("admission_advice_started_in_ip")}
                </Badge>
              ) : (
                <Badge variant="yellow">
                  {t("admission_advice_waiting_to_start")}
                </Badge>
              )}
            </div>
            <ul className="divide-y">
              {(pending.length ? pending : started).map((m) => (
                <li key={m.id} className="px-3 py-2 text-sm">
                  <div className="font-medium">{displayMedicationName(m)}</div>
                  <div className="text-gray-600">
                    {formatMedicationLine(m.dosage_instruction?.[0])}
                  </div>
                </li>
              ))}
            </ul>
            {canWrite && pending.length > 0 && (
              <div className="flex flex-col gap-2 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-gray-600">
                  {t("admission_advice_start_hint", {
                    doctor: formatName(pending[0].requester ?? doctor),
                  })}
                </span>
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() => startMedicines(pending)}
                  data-cy="start-admission-medicines"
                >
                  {t("admission_advice_start_medicines")}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
