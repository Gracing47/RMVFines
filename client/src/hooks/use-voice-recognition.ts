import { useState, useEffect, useCallback, useRef } from "react";

interface UseVoiceRecognitionProps {
    onResult?: (transcript: string) => void;
    onError?: (error: string) => void;
}

export function useVoiceRecognition({ onResult, onError }: UseVoiceRecognitionProps = {}) {
    const [isListening, setIsListening] = useState(false);
    const [isReceivingAudio, setIsReceivingAudio] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setError("Speech recognition is not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = "de-DE";
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onstart = () => {
            setIsListening(true);
            setError(null);
        };

        recognition.onend = () => {
            setIsListening(false);
            setIsReceivingAudio(false);
        };

        // Use type assertion or ignore for non-standard events if needed, 
        // but since we typed recognitionRef as any, we can assign these to the instance.
        recognition.onsoundstart = () => {
            setIsReceivingAudio(true);
        };

        recognition.onsoundend = () => {
            setIsReceivingAudio(false);
        };

        recognition.onerror = (event: any) => {
            setIsListening(false);
            setIsReceivingAudio(false);
            const errorMessage = event.error || "Unknown error";

            // Ignore 'no-speech' if we actually got a result (sometimes happens in parallel)
            if (errorMessage === 'no-speech' && transcript) {
                return;
            }

            setError(errorMessage);
            if (onError) onError(errorMessage);
        };

        recognition.onresult = (event: any) => {
            let finalTranscript = "";
            let interimTranscript = "";

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            const currentTranscript = finalTranscript || interimTranscript;
            setTranscript(currentTranscript);

            // Only trigger onResult for final results
            if (finalTranscript && onResult) {
                onResult(finalTranscript);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [onResult, onError]);

    const startListening = useCallback(() => {
        if (recognitionRef.current && !isListening) {
            try {
                setTranscript("");
                setError(null);
                recognitionRef.current.start();
            } catch (err) {
                console.error("Failed to start recognition:", err);
            }
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
        }
    }, [isListening]);

    const reset = useCallback(() => {
        setTranscript("");
        setError(null);
        setIsListening(false);
        setIsReceivingAudio(false);
    }, []);

    return {
        isListening,
        isReceivingAudio,
        transcript,
        error,
        startListening,
        stopListening,
        reset
    };
}
