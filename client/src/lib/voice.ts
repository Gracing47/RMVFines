// Types for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  onsoundstart: () => void;
  onsoundend: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (event: Event) => void;
  onend: (event: Event) => void;
  onerror: (event: any) => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onspeechend: () => void;
}

// Global window extension
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function speak(text: string) {
  if ('speechSynthesis' in window) {
    // Cancel any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';

    // Try to select a German voice
    const voices = window.speechSynthesis.getVoices();
    const germanVoice = voices.find(voice => voice.lang.includes('de'));
    if (germanVoice) {
      utterance.voice = germanVoice;
    }

    window.speechSynthesis.speak(utterance);
  }
}

export function parseIntent(text: string): { from?: string; to?: string } {
  const lowerText = text.toLowerCase();
  let from: string | undefined, to: string | undefined;

  // Pattern 0: "hier nach B" oder "von hier nach B" - prioritize this pattern
  const patternHier = /^(?:von\s+)?hier\s+(?:nach|zu)\s+(.+)/i;
  const matchHier = lowerText.match(patternHier);

  if (matchHier) {
    from = "CURRENT_LOCATION";
    to = matchHier[1].trim();
    return { from, to };
  }

  // Pattern 1: "von A nach B"
  const pattern1 = /(?:von|ab)\s+(.+?)\s+(?:nach|zu)\s+(.+)/i;
  const match1 = lowerText.match(pattern1);

  if (match1) {
    from = match1[1].trim();
    to = match1[2].trim();

    // Check for "here" keywords in the "from" part
    if (["hier", "mir", "meinem standort", "aktuellem standort", "meiner position"].some(k => from?.includes(k))) {
      from = "CURRENT_LOCATION";
    }

    return { from, to };
  }

  // Pattern 2: "nach B von A"
  const pattern2 = /(?:nach|zu)\s+(.+?)\s+(?:von|ab)\s+(.+)/i;
  const match2 = lowerText.match(pattern2);

  if (match2) {
    to = match2[1].trim();
    from = match2[2].trim();

    if (["hier", "mir", "meinem standort", "aktuellem standort", "meiner position"].some(k => from?.includes(k))) {
      from = "CURRENT_LOCATION";
    }

    return { from, to };
  }

  // Fallback: "Ich will nach B" (assume current location or ask for from? For now just return to)
  const pattern3 = /(?:nach|zu)\s+(.+)/i;
  const match3 = lowerText.match(pattern3);

  if (match3) {
    to = match3[1].trim();
    return { to };
  }

  return {};
}
