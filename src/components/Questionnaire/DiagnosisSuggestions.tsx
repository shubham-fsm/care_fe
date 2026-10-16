import { useQuery } from "@tanstack/react-query";
import { Lightbulb, Loader2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
  ComplaintInput,
  DiagnosisRule,
  recogniseComplaints,
  suggestDiagnoses,
} from "@/components/Questionnaire/diagnosisSuggestions";

import { Code } from "@/types/base/code/code";
import { DiagnosisRequest } from "@/types/emr/diagnosis/diagnosis";
import symptomApi from "@/types/emr/symptom/symptomApi";
import { QuestionnaireResponse } from "@/types/questionnaire/form";
import valueSetApi from "@/types/valueSet/valueSetApi";
import query, { callApi } from "@/Utils/request/query";

const CONDITION_VALUESET = "system-condition-code";

interface Props {
  patientId: string;
  encounterId: string;
  /** All answers of the form being filled (complaints may be among them) */
  questionnaireResponses: QuestionnaireResponse[];
  diagnoses: DiagnosisRequest[];
  onPick: (code: Code) => void;
  disabled?: boolean;
}

/**
 * Provisional diagnoses suggested from the presenting complaints of the
 * visit: symptoms picked in this form or saved earlier, and complaints typed
 * as text. One tap adds the diagnosis (as provisional); the doctor decides.
 */
export function DiagnosisSuggestions({
  patientId,
  encounterId,
  questionnaireResponses,
  diagnoses,
  onPick,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const [picking, setPicking] = useState<string | null>(null);

  // Symptoms already saved in this visit (e.g. by the nurse, or another form)
  const { data: savedSymptoms } = useQuery({
    queryKey: ["symptoms", patientId, encounterId],
    queryFn: query(symptomApi.listSymptoms, {
      pathParams: { patientId },
      queryParams: { limit: 100, encounter: encounterId },
    }),
    enabled: patientId !== "preview",
  });

  const suggestions = useMemo(() => {
    const inputs: ComplaintInput[] = [];
    for (const response of questionnaireResponses) {
      for (const value of response.values ?? []) {
        if (value.type === "symptom") {
          for (const symptom of value.value ?? []) {
            if (symptom.verification_status === "entered_in_error") continue;
            inputs.push({
              code: symptom.code?.code,
              text: symptom.code?.display,
            });
          }
        } else if (value.type === "string" && typeof value.value === "string") {
          inputs.push({ text: value.value });
        }
      }
    }
    for (const symptom of savedSymptoms?.results ?? []) {
      if (symptom.verification_status === "entered_in_error") continue;
      inputs.push({ code: symptom.code?.code, text: symptom.code?.display });
    }
    const already = diagnoses
      .filter((d) => d.verification_status !== "entered_in_error")
      .map((d) => d.code?.display?.toLowerCase() ?? "");
    const isAdded = (rule: DiagnosisRule) =>
      already.some(
        (display) =>
          display.includes(rule.term.toLowerCase()) ||
          display.includes(rule.label.toLowerCase()),
      );
    return suggestDiagnoses(recogniseComplaints(inputs), 8)
      .filter((suggestion) => !isAdded(suggestion.rule))
      .slice(0, 5);
  }, [questionnaireResponses, savedSymptoms, diagnoses]);

  if (suggestions.length === 0) {
    return null;
  }

  const pick = async (rule: DiagnosisRule) => {
    setPicking(rule.label);
    try {
      // The code comes from the diagnosis list itself, so it is always valid
      const { results } = await callApi(valueSetApi.expand, {
        pathParams: { slug: CONDITION_VALUESET },
        body: { search: rule.term, count: 10 },
      });
      const term = rule.term.toLowerCase();
      const match =
        results.find((r) => r.display.toLowerCase() === term) ??
        results.find((r) => r.display.toLowerCase().startsWith(term)) ??
        results[0];
      if (!match) {
        toast.error(t("diagnosis_suggestion_not_found", { name: rule.label }));
        return;
      }
      onPick({
        code: match.code,
        display: match.display,
        system: match.system,
      });
    } catch {
      // The request error is already shown
    } finally {
      setPicking(null);
    }
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-950">
        <Lightbulb className="size-4" />
        {t("suggested_from_complaints")}
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map(({ rule, basedOn }) => (
          <Button
            key={rule.label}
            type="button"
            variant="outline"
            size="sm"
            className="h-auto py-1.5 bg-white text-left"
            disabled={disabled || !!picking}
            onClick={() => pick(rule)}
            title={t("based_on_complaints", { complaints: basedOn.join(", ") })}
          >
            {picking === rule.label ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            <span className="flex flex-col items-start leading-tight">
              <span className="font-medium">{rule.label}</span>
              <span className="text-xs font-normal text-gray-600">
                {basedOn.join(", ")}
              </span>
            </span>
          </Button>
        ))}
      </div>
      <span className="text-xs text-amber-900">
        {t("diagnosis_suggestions_disclaimer")}
      </span>
    </div>
  );
}
