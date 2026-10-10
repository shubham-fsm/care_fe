import { useCallback, useEffect, useRef, useState } from "react";

// The Web Speech API is not in TypeScript's DOM lib, so declare what we use.
interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const getRecognitionConstructor = ():
  | SpeechRecognitionConstructor
  | undefined => {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

/** Maps an i18n language (en, hi, ml…) to a speech locale. */
export const toSpeechLocale = (language: string) =>
  language.includes("-") ? language : `${language}-IN`;

/** Speech-to-text with the browser's speech recognition. */
export function useSpeechRecognition(language: string) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string>();
  const supported =
    typeof window !== "undefined" && !!getRecognitionConstructor();

  const stop = useCallback(() => recognitionRef.current?.stop(), []);

  const start = useCallback(() => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) return;
    recognitionRef.current?.abort();
    const recognition = new Recognition();
    recognition.lang = toSpeechLocale(language);
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text);
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        setError(event.error);
      }
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setTranscript("");
    setError(undefined);
    setListening(true);
    recognition.start();
  }, [language]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return {
    supported,
    listening,
    transcript,
    setTranscript,
    error,
    start,
    stop,
  };
}

/** Text-to-speech with the browser's speech synthesis. */
export function useSpeechSynthesis(language: string) {
  const [speaking, setSpeaking] = useState(false);
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const locale = toSpeechLocale(language);
      utterance.lang = locale;
      const voice =
        window.speechSynthesis.getVoices().find((v) => v.lang === locale) ??
        window.speechSynthesis
          .getVoices()
          .find((v) => v.lang.startsWith(language.split("-")[0]));
      if (voice) utterance.voice = voice;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [language, supported],
  );

  useEffect(() => cancel, [cancel]);

  return { supported, speaking, speak, cancel };
}
