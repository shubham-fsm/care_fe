import { Loader2, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import type { QuestionnaireFormState } from "@/components/Questionnaire/QuestionnaireForm";

import { ScribeResult } from "@/types/scribe/scribe";
import scribeApi from "@/types/scribe/scribeApi";
import { callApi } from "@/Utils/request/query";

import { applyScribeAnswers, scribeQuestions } from "./applyScribeAnswers";
import { toWav16kMono } from "./wav";

type Phase = "idle" | "recording" | "processing";

const MAX_RECORDING_SECONDS = 300;

/**
 * Records the doctor speaking, sends it to the scribe_lite backend plugin and
 * fills the empty fields of the form with what was understood. Nothing is
 * submitted: the doctor reviews the form and submits it as usual. Symptoms,
 * diagnoses and medicines need coded entries, so they are shown as
 * suggestions for the doctor to pick in the form.
 */
export function ScribeButton({
  form,
  onFormChange,
  disabled,
}: {
  form: QuestionnaireFormState;
  onFormChange: (form: QuestionnaireFormState) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<ScribeResult | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Latest form, so a result applied after a long call uses current answers.
  const formRef = useRef(form);
  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    if (phase !== "recording") return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase === "recording" && seconds >= MAX_RECORDING_SECONDS) {
      recorderRef.current?.stop();
    }
  }, [phase, seconds]);

  useEffect(() => () => recorderRef.current?.stop(), []);

  const process = async (recording: Blob) => {
    setPhase("processing");
    try {
      const wav = await toWav16kMono(recording);
      const body = new FormData();
      body.append("audio", wav, "consultation.wav");
      body.append(
        "questions",
        JSON.stringify(
          scribeQuestions(formRef.current.questionnaire.questions),
        ),
      );
      const data = await callApi(scribeApi.fill, { body, silent: true });
      const { form: updated, filled } = applyScribeAnswers(
        formRef.current,
        data.answers,
      );
      onFormChange(updated);
      setResult(data);
      setShowNotes(true);
      if (filled > 0) {
        toast.success(t("scribe_fields_filled", { count: filled }));
      } else {
        toast.info(t("scribe_no_fields_filled"));
      }
    } catch {
      toast.error(t("scribe_failed"));
    } finally {
      setPhase("idle");
    }
  };

  const start = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error(t("scribe_microphone_denied"));
      return;
    }
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      const recording = new Blob(chunksRef.current, {
        type: recorder.mimeType,
      });
      if (recording.size > 0) {
        void process(recording);
      } else {
        setPhase("idle");
      }
    };
    recorderRef.current = recorder;
    recorder.start();
    setSeconds(0);
    setPhase("recording");
  };

  const hasSuggestions =
    !!result &&
    (result.symptoms.length > 0 ||
      result.diagnoses.length > 0 ||
      result.medications.length > 0 ||
      result.investigations.length > 0);

  return (
    <>
      {phase === "recording" ? (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => recorderRef.current?.stop()}
        >
          <Square className="size-4" />
          {t("scribe_stop")} {Math.floor(seconds / 60)}:
          {String(seconds % 60).padStart(2, "0")}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={start}
          disabled={disabled || phase === "processing"}
        >
          {phase === "processing" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Mic className="size-4" />
          )}
          {phase === "processing" ? t("scribe_filling") : t("scribe")}
        </Button>
      )}
      {result && phase === "idle" && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowNotes(true)}
        >
          {t("scribe_notes")}
        </Button>
      )}
      <Sheet open={showNotes && !!result} onOpenChange={setShowNotes}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("scribe_review_title")}</SheetTitle>
            <SheetDescription>
              {t("scribe_review_description")}
            </SheetDescription>
          </SheetHeader>
          {result && (
            <div className="space-y-5 px-4 pb-6 text-sm">
              <section className="space-y-1">
                <h3 className="text-sm font-semibold">{t("scribe_transcript")}</h3>
                <p className="whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-gray-700">
                  {result.transcript || "—"}
                </p>
              </section>
              {hasSuggestions && (
                <p className="text-gray-600">{t("scribe_suggestions_hint")}</p>
              )}
              <SuggestionList title={t("symptoms")} items={result.symptoms} />
              <SuggestionList title={t("diagnoses")} items={result.diagnoses} />
              <SuggestionList
                title={t("medications")}
                items={result.medications.map((m) =>
                  [m.name, m.dose, m.frequency, m.duration, m.instructions]
                    .filter(Boolean)
                    .join(" · "),
                )}
              />
              <SuggestionList
                title={t("investigations")}
                items={result.investigations}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function SuggestionList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="list-disc space-y-0.5 pl-5 text-gray-700">
        {items.map((item, i) => (
          <li key={`${item}-${i}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
