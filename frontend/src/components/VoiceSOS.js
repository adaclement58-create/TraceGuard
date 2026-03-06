import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Volume2, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';

const WAKE_PHRASE = 'help me traceguard';
const WAKE_PHRASE_ALT = ['help me', 'emergency', 'help traceguard'];
const CONFIDENCE_THRESHOLD = 0.6;

const VoiceSOS = ({ onSOSTriggered, disabled = false }) => {
  const [isListening, setIsListening] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, listening, triggered, error
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);
  const timeoutRef = useRef(null);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      console.warn('Speech Recognition not supported in this browser');
    }
  }, []);

  // Initialize speech recognition
  const initRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      console.log('[VoiceSOS] Recognition started');
      setIsListening(true);
      setStatus('listening');
    };

    recognition.onend = () => {
      console.log('[VoiceSOS] Recognition ended');
      setIsListening(false);
      
      // Restart if still enabled
      if (isEnabled && !disabled) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            console.error('[VoiceSOS] Failed to restart:', e);
          }
        }, 500);
      } else {
        setStatus('idle');
      }
    };

    recognition.onerror = (event) => {
      console.error('[VoiceSOS] Recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setStatus('error');
        setIsEnabled(false);
      }
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.toLowerCase().trim();
        
        if (result.isFinal) {
          finalTranscript += text;
        } else {
          interimTranscript += text;
        }
      }

      const currentTranscript = finalTranscript || interimTranscript;
      setTranscript(currentTranscript);

      // Check for wake phrase
      const detected = checkWakePhrase(currentTranscript);
      if (detected && status !== 'triggered') {
        triggerSOS();
      }
    };

    return recognition;
  }, [isEnabled, disabled, status]);

  // Check if wake phrase is detected
  const checkWakePhrase = (text) => {
    const normalized = text.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    
    // Check main wake phrase
    if (normalized.includes(WAKE_PHRASE)) {
      console.log('[VoiceSOS] Wake phrase detected:', WAKE_PHRASE);
      return true;
    }
    
    // Check alternative phrases
    for (const phrase of WAKE_PHRASE_ALT) {
      if (normalized.includes(phrase)) {
        console.log('[VoiceSOS] Alternative phrase detected:', phrase);
        return true;
      }
    }
    
    return false;
  };

  // Trigger SOS
  const triggerSOS = useCallback(() => {
    console.log('[VoiceSOS] SOS TRIGGERED!');
    setStatus('triggered');
    
    // Vibrate if supported
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }
    
    // Play alert sound
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      setTimeout(() => oscillator.stop(), 500);
    } catch (e) {
      console.warn('[VoiceSOS] Could not play alert sound');
    }
    
    // Call the SOS handler
    if (onSOSTriggered) {
      onSOSTriggered();
    }
    
    // Reset after 5 seconds
    timeoutRef.current = setTimeout(() => {
      setStatus('listening');
      setTranscript('');
    }, 5000);
  }, [onSOSTriggered]);

  // Start/stop listening
  useEffect(() => {
    if (isEnabled && !disabled && supported) {
      recognitionRef.current = initRecognition();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error('[VoiceSOS] Failed to start:', e);
        }
      }
    } else if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore stop errors
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isEnabled, disabled, supported, initRecognition]);

  // Toggle voice SOS
  const toggleVoiceSOS = () => {
    if (!supported) {
      alert('Voice recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }
    setIsEnabled(!isEnabled);
  };

  if (!supported) {
    return (
      <div className="tg-card p-4 opacity-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MicOff className="w-5 h-5 text-zinc-500" />
            <div>
              <p className="font-medium text-zinc-400">Voice SOS</p>
              <p className="text-xs text-zinc-600">Not supported in this browser</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`tg-card p-4 transition-all ${
        status === 'triggered' 
          ? 'bg-tg-danger/20 border-tg-danger/50 animate-pulse' 
          : status === 'listening' 
            ? 'bg-tg-safe/10 border-tg-safe/30' 
            : ''
      }`}
      data-testid="voice-sos-card"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            status === 'triggered' 
              ? 'bg-tg-danger/20' 
              : status === 'listening' 
                ? 'bg-tg-safe/20' 
                : 'bg-zinc-800'
          }`}>
            {status === 'triggered' ? (
              <AlertTriangle className="w-5 h-5 text-tg-danger animate-pulse" />
            ) : isListening ? (
              <Mic className="w-5 h-5 text-tg-safe animate-pulse" />
            ) : (
              <MicOff className="w-5 h-5 text-zinc-500" />
            )}
          </div>
          <div>
            <p className="font-medium">Voice-Activated SOS</p>
            <p className="text-xs text-zinc-500">
              {status === 'triggered' 
                ? 'SOS TRIGGERED!' 
                : status === 'listening'
                  ? 'Say "Help me TRACEGUARD"'
                  : 'Enable to use voice commands'
              }
            </p>
          </div>
        </div>
        
        <Switch
          checked={isEnabled}
          onCheckedChange={toggleVoiceSOS}
          disabled={disabled}
          data-testid="voice-sos-toggle"
        />
      </div>

      {/* Status indicator */}
      {isEnabled && (
        <div className="mt-3 pt-3 border-t border-zinc-800">
          <div className="flex items-center gap-2">
            {status === 'listening' && (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tg-safe opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-tg-safe"></span>
                </span>
                <span className="text-xs text-tg-safe">Listening...</span>
              </>
            )}
            {status === 'triggered' && (
              <>
                <AlertTriangle className="w-4 h-4 text-tg-danger" />
                <span className="text-xs text-tg-danger font-bold">Emergency SOS Activated!</span>
              </>
            )}
          </div>
          
          {/* Show transcript for debugging (can be hidden in production) */}
          {transcript && (
            <div className="mt-2 p-2 bg-zinc-800/50 rounded text-xs text-zinc-500 font-mono">
              Heard: "{transcript}"
            </div>
          )}
        </div>
      )}

      {/* Help text */}
      <div className="mt-3 text-xs text-zinc-600">
        <p>Voice commands: "Help me TRACEGUARD", "Help me", "Emergency"</p>
      </div>
    </div>
  );
};

export default VoiceSOS;
