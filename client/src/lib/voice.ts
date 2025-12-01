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

export function speak(text: string, onEnd?: () => void) {
  if ('speechSynthesis' in window) {
    // Cancel any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';

    if (onEnd) {
      utterance.onend = onEnd;
    }

    // Function to select the best German voice
    const selectBestVoice = () => {
      const voices = window.speechSynthesis.getVoices();

      // Priority order for better quality voices:
      // 1. Google voices (usually highest quality)
      // 2. Microsoft voices (good quality)
      // 3. Any other German voice
      // 4. Fallback to any voice

      const googleVoice = voices.find(voice =>
        voice.lang.includes('de') && voice.name.includes('Google')
      );

      const microsoftVoice = voices.find(voice =>
        voice.lang.includes('de') && (voice.name.includes('Microsoft') || voice.name.includes('Hedda'))
      );

      const anyGermanVoice = voices.find(voice =>
        voice.lang.includes('de')
      );

      return googleVoice || microsoftVoice || anyGermanVoice || voices[0];
    };

    // Function to speak with the best voice
    const speakWithVoice = () => {
      const bestVoice = selectBestVoice();
      if (bestVoice) {
        utterance.voice = bestVoice;
      }

      // Optimize speech parameters for more natural sound
      utterance.rate = 0.95;  // Slightly slower than default (1.0) for clarity
      utterance.pitch = 1.0;  // Normal pitch
      utterance.volume = 0.9; // Slightly lower volume for comfort

      window.speechSynthesis.speak(utterance);
    };

    // Ensure voices are loaded before speaking
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      speakWithVoice();
    } else {
      // Wait for voices to load
      window.speechSynthesis.onvoiceschanged = () => {
        speakWithVoice();
        window.speechSynthesis.onvoiceschanged = null; // Clean up
      };
    }
    if (onEnd) onEnd();
  }
}

export function cancelSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function parseIntent(text: string): { from?: string; to?: string; time?: Date } {
  let cleanText = text.toLowerCase();
  let time: Date | undefined;

  // 1. Parse relative time "in X minutes"
  const relativeTimeMatch = cleanText.match(/in\s+(\d+)\s+min(?:uten)?/i);
  if (relativeTimeMatch) {
    const minutes = parseInt(relativeTimeMatch[1], 10);
    time = new Date();
    time.setMinutes(time.getMinutes() + minutes);
    // Remove the time part from text so it doesn't mess up location parsing
    cleanText = cleanText.replace(relativeTimeMatch[0], "").trim();
  }

  // 2. Parse absolute time "um HH:MM" or "um HH Uhr"
  const absoluteTimeMatch = cleanText.match(/um\s+(\d{1,2})(?::(\d{2}))?(?:\s*uhr)?/i);
  if (absoluteTimeMatch) {
    const hours = parseInt(absoluteTimeMatch[1], 10);
    const minutes = absoluteTimeMatch[2] ? parseInt(absoluteTimeMatch[2], 10) : 0;

    time = new Date();
    time.setHours(hours);
    time.setMinutes(minutes);
    time.setSeconds(0);

    // If the resulting time is significantly in the past (e.g. > 2 hours ago), 
    // the user probably means tomorrow (e.g. at 23:00 saying "um 8 Uhr")
    // But for simplicity, let's assume today for now unless explicitly stated otherwise.

    cleanText = cleanText.replace(absoluteTimeMatch[0], "").trim();
  }

  // Use cleanText for location parsing
  const lowerText = cleanText;
  let from: string | undefined, to: string | undefined;

  // Pattern 0: "hier nach B" oder "von hier nach B" - prioritize this pattern
  const patternHier = /^(?:von\s+)?hier\s+(?:nach|zu)\s+(.+)/i;
  const matchHier = lowerText.match(patternHier);

  if (matchHier) {
    from = "CURRENT_LOCATION";
    to = matchHier[1].trim();
    return { from, to, time };
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

    return { from, to, time };
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

    return { from, to, time };
  }

  // Pattern 3: "A nach B" (implicit from) - e.g. "Mainz nach Wiesbaden"
  // Must be checked before the fallback "nach B"
  const patternImplicit = /^(.+?)\s+(?:nach|zu)\s+(.+)/i;
  const matchImplicit = lowerText.match(patternImplicit);

  if (matchImplicit) {
    from = matchImplicit[1].trim();
    to = matchImplicit[2].trim();

    // Filter out common prefixes that aren't stations
    const ignorePrefixes = ["ich will", "ich möchte", "bitte", "fahre", "verbindung", "suche"];
    if (ignorePrefixes.some(p => from?.startsWith(p))) {
      return { to, time };
    }

    return { from, to, time };
  }

  // Fallback: "Ich will nach B" (assume current location or ask for from? For now just return to)
  const pattern3 = /(?:nach|zu)\s+(.+)/i;
  const match3 = lowerText.match(pattern3);

  if (match3) {
    to = match3[1].trim();
    return { to, time };
  }

  return { time };
}
