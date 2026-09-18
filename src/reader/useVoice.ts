// f03 s04: the app's one piece of voice state, lifted into App so the reader and the Settings
// picker agree on which voice speaks (FR-C4, FR-I1).

import { useCallback, useEffect, useMemo, useState } from "react";
import { chooseVoice, prewarm, readStoredVoiceURI, storeVoiceURI } from "./speech";

export type VoiceState = {
  voices: SpeechSynthesisVoice[];
  voice: SpeechSynthesisVoice | null;
  select: (voiceURI: string) => void;
  supported: boolean;
};

export function useVoice(): VoiceState {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [savedURI, setSavedURI] = useState<string | null>(readStoredVoiceURI);

  useEffect(() => {
    if (!supported) return;
    // Android Chrome returns [] from the first getVoices() and fills in later. The spike listened
    // for voiceschanged and polled alongside it, because the event does not always arrive.
    const load = () => setVoices(speechSynthesis.getVoices());
    load();
    speechSynthesis.addEventListener("voiceschanged", load);
    let polls = 0;
    const timer = setInterval(() => {
      if (speechSynthesis.getVoices().length > 0 || ++polls > 20) clearInterval(timer);
      else load();
    }, 250);
    return () => {
      speechSynthesis.removeEventListener("voiceschanged", load);
      clearInterval(timer);
    };
  }, [supported]);

  const voice = useMemo(() => chooseVoice(voices, savedURI), [voices, savedURI]);

  // Spend the ~1 s warm-up as soon as a voice is settled on, so the first tap is not the one
  // that pays for it (mp01).
  useEffect(() => {
    prewarm(voice);
  }, [voice]);

  const select = useCallback((voiceURI: string) => {
    setSavedURI(voiceURI);
    storeVoiceURI(voiceURI);
  }, []);

  return { voices, voice, select, supported };
}
