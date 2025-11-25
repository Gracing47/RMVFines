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
}

// Global window extension
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export class VoiceAssistant {
  recognition: SpeechRecognition | null = null;
  isListening = false;
  onResult: (text: string) => void;
  onStart: () => void;
  onEnd: () => void;
  onError: (error: any) => void;
  timeoutId: any = null;

  constructor(
    onResult: (text: string) => void,
    onStart: () => void = () => {},
    onEnd: () => void = () => {},
    onError: (error: any) => void = () => {}
  ) {
    this.onResult = onResult;
    this.onStart = onStart;
    this.onEnd = onEnd;
    this.onError = onError;
    this.initRecognition();
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = "de-DE";
      this.recognition.continuous = false;
      this.recognition.interimResults = false;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.onStart();
        // Safety timeout: stop after 8 seconds if no result
        this.timeoutId = setTimeout(() => {
          if (this.isListening) {
            this.stop();
          }
        }, 8000);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (this.timeoutId) clearTimeout(this.timeoutId);
        this.onEnd();
      };

      this.recognition.onerror = (event) => {
        this.isListening = false;
        if (this.timeoutId) clearTimeout(this.timeoutId);
        this.onError(event);
      };

      this.recognition.onresult = (event) => {
        if (this.timeoutId) clearTimeout(this.timeoutId);
        const transcript = event.results[0][0].transcript;
        this.onResult(transcript);
      };
    } else {
      console.error("Speech recognition not supported in this browser.");
    }
  }


  start() {
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
      } catch (e) {
        console.error("Failed to start recognition", e);
      }
    }
  }

  stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  speak(text: string) {
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
    // If only destination is given, assume "from here" if context implies it, 
    // but for safety we'll explicitly look for "von hier" in the whole text if it wasn't caught above
    // Actually, for a voice assistant, "Nach Wiesbaden" usually implies "From here".
    // Let's set a flag or just return to. The UI can decide to default to current location if from is missing.
    // For this specific request "von hier nach mainz", it should be caught by pattern 1.
    
    return { to };
  }

  return {};
}
