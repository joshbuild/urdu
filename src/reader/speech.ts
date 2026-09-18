// f03 s04: speech (FR-C4). Ported from spikes/speech/, which measured this on the sponsor's phone
// (mp01): ~1 s warm-up for the first utterance of a voice and then 13-60 ms, and Android Chrome
// queues utterances unless you cancel first.

// The structural shape this module needs. Keeping it narrower than SpeechSynthesisVoice lets the
// resolution ladder be tested in the node project, where that DOM type does not exist.
export type VoiceLike = {
  name: string;
  lang: string;
  voiceURI: string;
};

// Android reports "ur_PK"; the spec says "ur-PK". Compare on one spelling.
function normalizeLang(lang: string): string {
  return lang.toLowerCase().replaceAll("_", "-");
}

export function isUrdu(voice: VoiceLike): boolean {
  return normalizeLang(voice.lang).startsWith("ur");
}

export function urduVoices<V extends VoiceLike>(voices: readonly V[]): V[] {
  return voices.filter(isUrdu);
}

// FR-C4's ladder: the saved choice, else ur-PK, else any Urdu voice, else nothing. Never the
// browser default — on the sponsor's phone that is Assamese, which mp01 found reads Urdu as noise.
// Returning null is honest: the caller reports that no Urdu voice is installed rather than
// speaking gibberish.
export function chooseVoice<V extends VoiceLike>(
  voices: readonly V[],
  savedURI?: string | null,
): V | null {
  const saved = savedURI ? voices.find((voice) => voice.voiceURI === savedURI) : undefined;
  if (saved) return saved;

  const urdu = urduVoices(voices);
  return urdu.find((voice) => normalizeLang(voice.lang) === "ur-pk") ?? urdu[0] ?? null;
}

const VOICE_KEY = "urdu.voice";

export function readStoredVoiceURI(): string | null {
  try {
    return localStorage.getItem(VOICE_KEY);
  } catch {
    return null;
  }
}

export function storeVoiceURI(voiceURI: string | null): void {
  try {
    if (voiceURI) localStorage.setItem(VOICE_KEY, voiceURI);
    else localStorage.removeItem(VOICE_KEY);
  } catch {
    // Non-fatal: the choice simply does not survive a reload on this device.
  }
}

// Voices that have already paid their ~1 s warm-up in this page's lifetime.
const warmed = new Set<string>();

export function speak(text: string, voice: SpeechSynthesisVoice | null): void {
  const trimmed = text.trim();
  if (!trimmed || typeof speechSynthesis === "undefined") return;

  // Android Chrome queues otherwise, so a run of quick taps would all speak in turn.
  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(trimmed);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
    warmed.add(voice.voiceURI);
  } else {
    utterance.lang = "ur-PK";
  }
  speechSynthesis.speak(utterance);
}

// The first utterance on a voice costs about a second (mp01). Spend it when the voice is chosen,
// on silence, so the first real tap is fast.
export function prewarm(voice: SpeechSynthesisVoice | null): void {
  if (!voice || typeof speechSynthesis === "undefined" || warmed.has(voice.voiceURI)) return;
  warmed.add(voice.voiceURI);
  const utterance = new SpeechSynthesisUtterance(" ");
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.volume = 0;
  speechSynthesis.speak(utterance);
}
