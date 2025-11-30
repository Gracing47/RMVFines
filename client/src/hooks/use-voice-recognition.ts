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
    const retryCountRef = useRef(0);
    const maxRetries = 1;

    // Use refs for callbacks to prevent effect re-execution
    const onResultRef = useRef(onResult);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onResultRef.current = onResult;
        onErrorRef.current = onError;
    }, [onResult, onError]);

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

        recognition.onsoundstart = () => {
            setIsReceivingAudio(true);
        };

        recognition.onsoundend = () => {
            setIsReceivingAudio(false);
        };

        recognition.onerror = (event: any) => {
            const errorMessage = event.error || "Unknown error";
            console.error("Speech Recognition Error:", errorMessage);

            // Ignore 'no-speech' if we actually got a result
            if (errorMessage === 'no-speech' && transcript) {
                setIsListening(false);
                setIsReceivingAudio(false);
                return;
            }

            // Retry on network error
            if (errorMessage === 'network' && retryCountRef.current < maxRetries) {
                console.log("Network error detected, retrying speech recognition...");
                retryCountRef.current++;
                setIsListening(false);
                setIsReceivingAudio(false);

                setTimeout(() => {
                    try {
                        recognition.start();
                    } catch (err) {
                        console.error("Failed to restart recognition:", err);
                        setIsListening(false);
                        setError(errorMessage);
                        if (onErrorRef.current) onErrorRef.current(errorMessage);
                    }
                }, 300);
                return;
            }

            setIsListening(false);
            setIsReceivingAudio(false);

            setError(errorMessage);
            if (onErrorRef.current) onErrorRef.current(errorMessage);
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

            if (finalTranscript && onResultRef.current) {
                onResultRef.current(finalTranscript);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []); // Empty dependency array - only initialize once

    const startListening = useCallback(async () => {
        if (recognitionRef.current && !isListening) {
            try {
                // Explicitly request microphone access to trigger prompt/check permission
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                // If successful, we stop the stream immediately as SpeechRecognition handles its own stream
                stream.getTracks().forEach(track => track.stop());

                retryCountRef.current = 0;
                setTranscript("");
                setError(null);
                recognitionRef.current.start();
            } catch (err: any) {
                console.error("Microphone permission failed:", err);
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    setError("not-allowed");
                    if (onErrorRef.current) onErrorRef.current("not-allowed");
                } else {
                    setError(err.message || "Microphone error");
                    if (onErrorRef.current) onErrorRef.current(err.message || "Microphone error");
                }
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
