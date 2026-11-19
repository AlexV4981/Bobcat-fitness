import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Browser Web Speech API dictation used by both workout screens.
 * Speech is appended to the current editable field, never submitted automatically.
 * Permission is requested only after the visitor clicks the microphone button.
 */
export function useVoiceDictation(onTranscript) {
  const recognizerRef = useRef(null);
  const transcriptCallbackRef = useRef(onTranscript);
  transcriptCallbackRef.current = onTranscript;

  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");

  useEffect(() => () => {
    const recognizer = recognizerRef.current;
    recognizerRef.current = null;
    if (recognizer) {
      recognizer.onstart = null;
      recognizer.onresult = null;
      recognizer.onerror = null;
      recognizer.onend = null;
      try { recognizer.abort(); } catch { /* already ended */ }
    }
  }, []);

  const toggleVoice = useCallback(() => {
    if (recognizerRef.current) {
      try { recognizerRef.current.stop(); } catch { /* already stopping */ }
      return;
    }

    const SpeechRecognition = typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

    if (!SpeechRecognition) {
      setVoiceError("Voice input is unavailable in this browser. Try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognizerRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) transcriptCallbackRef.current(transcript);
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      setVoiceError(event.error === "not-allowed"
        ? "Microphone access was denied. Check your browser permissions."
        : "Voice input was interrupted. Try again.");
    };
    recognition.onend = () => {
      if (recognizerRef.current === recognition) recognizerRef.current = null;
      setIsListening(false);
    };

    try {
      setVoiceError("");
      recognition.start();
    } catch {
      recognizerRef.current = null;
      setIsListening(false);
      setVoiceError("Could not start voice input.");
    }
  }, []);

  return { isListening, voiceError, toggleVoice };
}
