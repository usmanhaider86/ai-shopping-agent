import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface UseSpeechRecognitionOptions {
  /** Called on every result event with the full session transcript (final + interim). */
  onResult?: (sessionText: string) => void;
  onError?: (message: string) => void;
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  start: () => void;
  stop: () => void;
  error: string | null;
}

/** How long to wait after the last result before auto-stopping. */
const SILENCE_MS = 3000;

/** Max restarts allowed inside RESTART_WINDOW_MS before we bail out. */
const MAX_RESTARTS = 5;
const RESTART_WINDOW_MS = 10_000;

/** Errors that should never trigger an automatic restart. */
const FATAL_ERRORS = new Set([
  "not-allowed",
  "service-not-allowed",
  "audio-capture",
  "network",
]);

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const optionsRef = useRef<UseSpeechRecognitionOptions>(options);

  /** true from start() until stop() or a fatal error. */
  const wantListeningRef = useRef<boolean>(false);
  /** Whether at least one result was received in this session. */
  const hasRecognizedRef = useRef<boolean>(false);
  /** Silence auto-stop timer. */
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Timestamps of recent restarts for loop detection. */
  const restartTimesRef = useRef<number[]>([]);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    }
  }, []);

  // ── helpers ──────────────────────────────────────────────────────

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const reportError = useCallback((message: string) => {
    setError(message);
    if (optionsRef.current.onError) {
      optionsRef.current.onError(message);
    }
  }, []);

  const teardown = useCallback(() => {
    clearSilenceTimer();
    wantListeningRef.current = false;
    hasRecognizedRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {
        // ignore
      }
    }
    setIsListening(false);
  }, [clearSilenceTimer]);

  // ── stop (user-initiated) ──────────────────────────────────────

  const stop = useCallback(() => {
    teardown();
  }, [teardown]);

  // ── start ──────────────────────────────────────────────────────

  const start = useCallback(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setIsSupported(false);
      return;
    }

    if (wantListeningRef.current) {
      return;
    }

    setError(null);
    clearSilenceTimer();
    restartTimesRef.current = [];
    hasRecognizedRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (_) {
        // ignore
      }
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Build the full session transcript (final + interim)
        let sessionText = "";
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (res && res[0]) {
            sessionText += res[0].transcript;
          }
        }

        hasRecognizedRef.current = true;

        if (optionsRef.current.onResult) {
          optionsRef.current.onResult(sessionText);
        }

        // Reset silence timer
        clearSilenceTimer();
        silenceTimerRef.current = setTimeout(() => {
          // Normal silence stop — no error
          teardown();
        }, SILENCE_MS);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        const code = event.error;

        if (code === "no-speech") {
          // If nothing was recognized yet, show a friendly message and stop.
          // If something was already recognized, just stop quietly.
          if (!hasRecognizedRef.current) {
            reportError("I didn't hear anything. Please try again.");
          }
          teardown();
          return;
        }

        if (FATAL_ERRORS.has(code)) {
          let message = "Voice input failed. Please try again.";
          if (code === "not-allowed" || code === "service-not-allowed") {
            message = "Microphone access is blocked. Allow it in your browser settings.";
          } else if (code === "audio-capture") {
            message = "No microphone was found.";
          } else if (code === "network") {
            message = "Voice service needs an internet connection.";
          }
          reportError(message);
          teardown();
          return;
        }

        // For non-fatal errors (e.g. "aborted"), just let onend handle restart.
      };

      recognition.onend = () => {
        if (!wantListeningRef.current) {
          setIsListening(false);
          return;
        }

        // Guard against restart loops
        const now = Date.now();
        restartTimesRef.current.push(now);
        // Keep only timestamps within the window
        restartTimesRef.current = restartTimesRef.current.filter(
          (t) => now - t < RESTART_WINDOW_MS,
        );
        if (restartTimesRef.current.length > MAX_RESTARTS) {
          reportError("Voice input failed. Please try again.");
          teardown();
          return;
        }

        // Auto-restart: browser ended recognition but we still want to listen
        try {
          recognition.start();
          // Keep isListening = true so the UI doesn't flicker
        } catch (_) {
          // InvalidStateError or similar — stop gracefully
          teardown();
        }
      };

      recognitionRef.current = recognition;
      wantListeningRef.current = true;
      recognition.start();
      setIsListening(true);
    } catch (_) {
      const fallbackMsg = "Voice input failed. Please try again.";
      reportError(fallbackMsg);
      teardown();
    }
  }, [clearSilenceTimer, teardown, reportError]);

  // ── cleanup on unmount ─────────────────────────────────────────

  useEffect(() => {
    return () => {
      clearSilenceTimer();
      wantListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {
          // ignore
        }
      }
    };
  }, [clearSilenceTimer]);

  return {
    isSupported,
    isListening,
    start,
    stop,
    error,
  };
}
