import careConfig from "@careConfig";
import {
  Headset,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react";
import { usePath } from "raviger";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

import { VoiceAgentAnswerCard } from "@/components/VoiceAgent/VoiceAgentAnswerCard";
import {
  useSpeechRecognition,
  useSpeechSynthesis,
} from "@/components/VoiceAgent/useSpeech";
import {
  VoiceAgentAnswer,
  askVoiceAgent,
  resetVoiceAgentSession,
} from "@/components/VoiceAgent/voiceAgentApi";

interface Turn {
  id: number;
  question: string;
  errorText?: string;
  answer?: VoiceAgentAnswer;
  error?: string;
}

/**
 * Floating CARE support assistant. Users ask by voice or text how to do
 * something or why they see an error; the agent answers from the CARE code
 * and says whether it is fixed by configuration or needs a code change.
 * Rendered only when REACT_VOICE_AGENT_URL is configured.
 */
export function VoiceAgent() {
  const { t, i18n } = useTranslation();
  const page = usePath() ?? "/";
  const language = i18n.language || "en";

  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [errorText, setErrorText] = useState("");
  const [showErrorInput, setShowErrorInput] = useState(false);
  const [status, setStatus] = useState<string>();
  const [pending, setPending] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const recognition = useSpeechRecognition(language);
  const synthesis = useSpeechSynthesis(language);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, status]);

  // Show what is being heard in the input while listening.
  useEffect(() => {
    if (recognition.listening) setQuestion(recognition.transcript);
  }, [recognition.listening, recognition.transcript]);

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    const turn: Turn = {
      id: Date.now(),
      question: trimmed,
      errorText: errorText.trim() || undefined,
    };
    setTurns((prev) => [...prev, turn]);
    setQuestion("");
    setErrorText("");
    setShowErrorInput(false);
    setPending(true);
    setStatus(t("voice_agent_thinking"));
    synthesis.cancel();
    try {
      const answer = await askVoiceAgent(
        {
          sessionId,
          question: trimmed,
          errorText: turn.errorText,
          page,
          language,
        },
        setStatus,
      );
      setTurns((prev) =>
        prev.map((item) => (item.id === turn.id ? { ...item, answer } : item)),
      );
      if (autoSpeak) {
        synthesis.speak(
          [answer.spoken_summary, answer.follow_up_question]
            .filter(Boolean)
            .join(" "),
        );
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("voice_agent_error");
      setTurns((prev) =>
        prev.map((item) =>
          item.id === turn.id ? { ...item, error: message } : item,
        ),
      );
    } finally {
      setPending(false);
      setStatus(undefined);
    }
  };

  // Ask as soon as the user stops talking.
  const wasListening = useRef(false);
  useEffect(() => {
    if (wasListening.current && !recognition.listening) {
      submit(recognition.transcript);
      recognition.setTranscript("");
    }
    wasListening.current = recognition.listening;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recognition.listening]);

  const toggleListening = () => {
    if (recognition.listening) {
      recognition.stop();
    } else {
      synthesis.cancel();
      recognition.start();
    }
  };

  const startOver = () => {
    synthesis.cancel();
    resetVoiceAgentSession(sessionId);
    setSessionId(crypto.randomUUID());
    setTurns([]);
  };

  if (!careConfig.voiceAgentUrl) return null;

  return (
    <>
      <Button
        size="icon"
        className="fixed bottom-4 right-4 z-40 size-12 rounded-full shadow-lg print:hidden"
        aria-label={t("voice_agent_open")}
        onClick={() => setOpen(true)}
      >
        <Headset className="size-6" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-gray-200 p-4">
            <SheetTitle>{t("voice_agent_title")}</SheetTitle>
            <SheetDescription>{t("voice_agent_description")}</SheetDescription>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (autoSpeak) synthesis.cancel();
                  setAutoSpeak(!autoSpeak);
                }}
              >
                {autoSpeak ? (
                  <Volume2 className="size-4" />
                ) : (
                  <VolumeX className="size-4" />
                )}
                {autoSpeak
                  ? t("voice_agent_voice_on")
                  : t("voice_agent_voice_off")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={startOver}
                disabled={pending || turns.length === 0}
              >
                <RotateCcw className="size-4" />
                {t("voice_agent_new_conversation")}
              </Button>
            </div>
          </SheetHeader>

          <div
            ref={scrollRef}
            className="flex-1 space-y-4 overflow-y-auto bg-gray-50 p-4"
          >
            {turns.length === 0 && (
              <div className="space-y-2 text-sm text-gray-600">
                <p>{t("voice_agent_empty_state")}</p>
                <ul className="list-disc pl-5">
                  <li>{t("voice_agent_example_1")}</li>
                  <li>{t("voice_agent_example_2")}</li>
                  <li>{t("voice_agent_example_3")}</li>
                </ul>
              </div>
            )}
            {turns.map((turn) => (
              <div key={turn.id} className="space-y-2">
                <div className="ml-auto w-fit max-w-[85%] rounded-lg bg-primary-100 px-3 py-2 text-sm text-primary-900">
                  <p>{turn.question}</p>
                  {turn.errorText && (
                    <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-xs opacity-80">
                      {turn.errorText}
                    </pre>
                  )}
                </div>
                {turn.answer && (
                  <VoiceAgentAnswerCard
                    answer={turn.answer}
                    onSpeak={synthesis.speak}
                  />
                )}
                {turn.error && (
                  <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">
                    {turn.error}
                  </p>
                )}
              </div>
            ))}
            {status && (
              <p className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="size-4 animate-spin" />
                {status}
              </p>
            )}
          </div>

          <form
            className="space-y-2 border-t border-gray-200 bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit(question);
            }}
          >
            {showErrorInput && (
              <Textarea
                value={errorText}
                onChange={(e) => setErrorText(e.target.value)}
                placeholder={t("voice_agent_error_placeholder")}
                className="max-h-32 font-mono text-xs"
              />
            )}
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(question);
                }
              }}
              placeholder={
                recognition.listening
                  ? t("voice_agent_listening")
                  : t("voice_agent_placeholder")
              }
              className="max-h-32"
              disabled={pending}
            />
            {recognition.error && (
              <p className="text-xs text-red-600">
                {recognition.error === "not-allowed"
                  ? t("microphone_permission_denied")
                  : t("voice_agent_mic_error", { error: recognition.error })}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="link"
                size="sm"
                className="px-0"
                onClick={() => setShowErrorInput(!showErrorInput)}
              >
                {showErrorInput
                  ? t("voice_agent_hide_error")
                  : t("voice_agent_add_error")}
              </Button>
              <div className="ml-auto flex gap-2">
                {recognition.supported && (
                  <Button
                    type="button"
                    variant={recognition.listening ? "destructive" : "outline"}
                    size="icon"
                    aria-label={
                      recognition.listening
                        ? t("voice_agent_stop_listening")
                        : t("voice_agent_start_listening")
                    }
                    onClick={toggleListening}
                    disabled={pending}
                  >
                    {recognition.listening ? (
                      <MicOff className="size-4" />
                    ) : (
                      <Mic className="size-4" />
                    )}
                  </Button>
                )}
                <Button
                  type="submit"
                  size="icon"
                  aria-label={t("voice_agent_send")}
                  disabled={pending || !question.trim()}
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
