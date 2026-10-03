import type { QuestionnaireFormState } from "@/components/Questionnaire/QuestionnaireForm";

import {
  QuestionnaireResponse,
  ResponseValue,
} from "@/types/questionnaire/form";
import { Question } from "@/types/questionnaire/question";
import { ScribeAnswer, ScribeQuestion } from "@/types/scribe/scribe";

const FILLABLE_TYPES = new Set([
  "string",
  "text",
  "integer",
  "decimal",
  "date",
  "boolean",
  "choice",
]);

function flatten(questions: Question[]): Question[] {
  return questions.flatMap((q) =>
    q.type === "group" ? flatten(q.questions ?? []) : [q],
  );
}

/** The questions of a form that the scribe can fill (plain, non-structured). */
export function scribeQuestions(questions: Question[]): ScribeQuestion[] {
  return flatten(questions)
    .filter((q) => FILLABLE_TYPES.has(q.type) && !q.read_only)
    .map((q) => ({
      link_id: q.link_id,
      text: q.text,
      type: q.type,
      multiple: !!q.repeats,
      options: (q.answer_option ?? []).map((o) => o.value),
    }));
}

function toResponseValues(question: Question, values: string[]) {
  switch (question.type) {
    case "integer":
    case "decimal":
      return values
        .map(Number)
        .filter((n) => !Number.isNaN(n))
        .map((n): ResponseValue => ({ type: "number", value: n }));
    case "date":
      return values
        .map((v) => new Date(v))
        .filter((d) => !Number.isNaN(d.getTime()))
        .map((d): ResponseValue => ({ type: "date", value: d }));
    case "boolean":
      return values.map((v): ResponseValue => ({
        type: "boolean",
        value: v === "true",
      }));
    case "choice":
      return values.map((v): ResponseValue => {
        const option = question.answer_option?.find((o) => o.value === v);
        return { type: "string", value: v, coding: option?.code ?? undefined };
      });
    default:
      return values.map((v): ResponseValue => ({ type: "string", value: v }));
  }
}

function isEmpty(response: QuestionnaireResponse) {
  return !response.values.some(
    (v) => v.value !== undefined && v.value !== null && v.value !== "",
  );
}

/**
 * Puts the scribe's answers into a form. Only empty fields are filled, so
 * anything the doctor already entered is kept. Returns the updated form and
 * the number of fields filled.
 */
export function applyScribeAnswers(
  form: QuestionnaireFormState,
  answers: ScribeAnswer[],
): { form: QuestionnaireFormState; filled: number } {
  const byLinkId = new Map(
    flatten(form.questionnaire.questions).map((q) => [q.link_id, q]),
  );
  const answerByLinkId = new Map(answers.map((a) => [a.link_id, a.values]));
  let filled = 0;
  const responses = form.responses.map((response) => {
    const question = byLinkId.get(response.link_id);
    const values = answerByLinkId.get(response.link_id);
    if (!question || !values?.length || !isEmpty(response)) {
      return response;
    }
    const newValues = toResponseValues(question, values);
    if (!newValues.length) {
      return response;
    }
    filled += 1;
    return { ...response, values: newValues };
  });
  return { form: { ...form, responses }, filled };
}
