import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Smartphone, ShieldAlert, Volume2, VolumeX, Eye, EyeOff,
  Vibrate, AlertTriangle, CheckCircle2, Settings, X, Mic
} from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

// Configuration
const SHAKE_THRESHOLD = 25; // Acceleration threshold
const SHAKE_COUNT_THRESHOLD = 5; // Number of shakes needed
const SHAKE_TIMEOUT = 2000; // Time window for shakes (ms)
const COOLDOWN_PERIOD = 30000; // 30 seconds cooldown after trigger

const OneChanceMode = ({ onSOSTriggered, disabled = false }) => {
  const { api, user } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isTriggered, setIsTriggered] = useState(false);
  const [showFakeScreen, setShowFakeScreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [shakeCount, setShakeCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [settings, setSettings] = useState({
    shakeToTrigger: true,
    silentMode: true,
    autoRecord: true,
    fakeShutdown: true,
    vibrationFeedback: true
  });

  const lastShakeTime = useRef(0);
  const shakeCountRef = useRef(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const cooldownTimerRef = useRef(null);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('oneChanceSettings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load one-chance settings');
      }
    }
  }, []);

  // Save settings
  const saveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('oneChanceSettings', JSON.stringify(newSettings));
  };

  // Shake detection using DeviceMotion API
  useEffect(() => {
    if (!isEnabled || !settings.shakeToTrigger || disabled || cooldown) return;

    const handleMotion = (event) => {
      const { accelerationIncludingGravity } = event;
      if (!accelerationIncludingGravity) return;

      const { x, y, z } = accelerationIncludingGravity;
      const acceleration = Math.sqrt(x * x + y * y + z * z);

      const now = Date.now();

      if (acceleration > SHAKE_THRESHOLD) {
        // Reset count if too much time has passed
        if (now - lastShakeTime.current > SHAKE_TIMEOUT) {
          shakeCountRef.current = 0;
        }

        shakeCountRef.current++;
        lastShakeTime.current = now;
        setShakeCount(shakeCountRef.current);

        // Trigger if threshold reached
        if (shakeCountRef.current >= SHAKE_COUNT_THRESHOLD) {
          triggerOneChance();
          shakeCountRef.current = 0;
          setShakeCount(0);
        }
      }
    };

    // Request permission on iOS 13+
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      // Will need user interaction to request permission
    } else {
      window.addEventListener('devicemotion', handleMotion);
    }

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [isEnabled, settings.shakeToTrigger, disabled, cooldown]);

  // Request motion permission (iOS)
  const requestMotionPermission = async () => {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission === 'granted') {
          setIsEnabled(true);
        } else {
          alert('Motion permission denied. Shake detection will not work.');
        }
      } catch (error) {
        console.error('Motion permission error:', error);
      }
    } else {
      setIsEnabled(true);
    }
  };

  // Start audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadEvidence(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      console.log('[OneChance] Recording started');
    } catch (error) {
      console.error('[OneChance] Failed to start recording:', error);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log('[OneChance] Recording stopped');
    }
  };

  // Upload evidence to backend
  const uploadEvidence = async (audioBlob) => {
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, `one-chance-audio-${Date.now()}.webm`);
      formData.append('evidence_type', 'audio');
      formData.append('incident_type', 'one_chance');
      
      // Note: This would need a proper file upload endpoint
      console.log('[OneChance] Audio evidence captured, size:', audioBlob.size);
    } catch (error) {
      console.error('[OneChance] Failed to upload evidence:', error);
    }
  };

  // Trigger One-Chance mode
  const triggerOneChance = useCallback(async () => {
    if (cooldown || isTriggered) return;

    console.log('[OneChance] TRIGGERED!');
    setIsTriggered(true);
    setCooldown(true);

    // Vibration feedback (subtle, not alarming)
    if (settings.vibrationFeedback && navigator.vibrate) {
      navigator.vibrate([50, 50, 50]); // Quick subtle vibration
    }

    // Start silent recording
    if (settings.autoRecord) {
      await startRecording();
    }

    // Show fake shutdown screen
    if (settings.fakeShutdown) {
      setShowFakeScreen(true);
    }

    // Get location and trigger SOS
    let lat = null, lng = null;
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch (e) {
      console.log('[OneChance] Location unavailable');
    }

    // Trigger the SOS via API
    try {
      await api.post('/incidents', {
        incident_type: 'one_chance',
        severity: 'critical',
        latitude: lat,
        longitude: lng,
        silent: true
      });
      console.log('[OneChance] Silent SOS sent');
    } catch (error) {
      console.error('[OneChance] Failed to send SOS:', error);
      // Try SMS fallback if online SOS fails
      if (navigator.onLine === false) {
        // Queue for later
        localStorage.setItem('pendingOneChanceSOS', JSON.stringify({
          timestamp: Date.now(),
          latitude: lat,
          longitude: lng
        }));
      }
    }

    // Call parent handler
    if (onSOSTriggered) {
      onSOSTriggered({ type: 'one_chance', silent: true, lat, lng });
    }

    // Set cooldown timer
    cooldownTimerRef.current = setTimeout(() => {
      setCooldown(false);
    }, COOLDOWN_PERIOD);

  }, [api, settings, onSOSTriggered, cooldown, isTriggered]);

  // Deactivate One-Chance mode
  const deactivate = () => {
    setIsTriggered(false);
    setShowFakeScreen(false);
    stopRecording();
    
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
    }
    setCooldown(false);
  };

  // Toggle enabled state
  const toggleEnabled = () => {
    if (!isEnabled) {
      requestMotionPermission();
    } else {
      setIsEnabled(false);
      deactivate();
    }
  };

  // Fake shutdown screen
  if (showFakeScreen) {
    return (
      <div 
        className="fixed inset-0 bg-black z-[9999] flex items-center justify-center"
        onClick={(e) => {
          // Triple tap to exit fake screen
          if (e.detail === 3) {
            setShowFakeScreen(false);
          }
        }}
      >
        {/* Fake "Power Off" screen - looks like phone is off */}
        <div className="text-center opacity-0">
          {/* Completely black - nothing visible */}
          {/* Recording indicator hidden */}
          {isRecording && (
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 opacity-10" />
          )}
        </div>
        
        {/* Hidden exit hint - barely visible */}
        <div className="absolute bottom-4 text-zinc-900 text-[8px] opacity-5">
          Triple-tap to exit
        </div>
      </div>
    );
  }

  return (
    <>
      <div 
        className={`tg-card p-4 transition-all ${
          isTriggered 
            ? 'bg-red-900/30 border-red-500/50' 
            : isEnabled 
              ? 'bg-orange-500/10 border-orange-500/30' 
              : ''
        }`}
        data-testid="one-chance-mode-card"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isTriggered 
                ? 'bg-red-500/20' 
                : isEnabled 
                  ? 'bg-orange-500/20' 
                  : 'bg-zinc-800'
            }`}>
              {isTriggered ? (
                <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
              ) : (
                <Smartphone className="w-5 h-5 text-orange-400" />
              )}
            </div>
            <div>
              <p className="font-medium">One-Chance Mode</p>
              <p className="text-xs text-zinc-500">
                {isTriggered 
                  ? 'Silent SOS Active - Recording...' 
                  : isEnabled
                    ? 'Shake phone 5x to trigger silent SOS'
                    : 'Protection against vehicle robbery'
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(true)}
              className="text-zinc-500 hover:text-white"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Switch
              checked={isEnabled}
              onCheckedChange={toggleEnabled}
              disabled={disabled}
              data-testid="one-chance-toggle"
            />
          </div>
        </div>

        {/* Status indicators */}
        {isEnabled && (
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-4">
                <span className={`flex items-center gap-1 ${settings.shakeToTrigger ? 'text-orange-400' : 'text-zinc-600'}`}>
                  <Vibrate className="w-3 h-3" />
                  Shake {shakeCount > 0 ? `(${shakeCount}/${SHAKE_COUNT_THRESHOLD})` : ''}
                </span>
                <span className={`flex items-center gap-1 ${settings.silentMode ? 'text-orange-400' : 'text-zinc-600'}`}>
                  <VolumeX className="w-3 h-3" />
                  Silent
                </span>
                <span className={`flex items-center gap-1 ${settings.autoRecord ? 'text-orange-400' : 'text-zinc-600'}`}>
                  <Mic className="w-3 h-3" />
                  Record
                </span>
              </div>
              {isTriggered && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deactivate}
                  className="text-red-400 hover:text-red-300 text-xs h-6"
                >
                  Deactivate
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Manual trigger for testing (can be removed in production) */}
        {isEnabled && !isTriggered && (
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
              onClick={triggerOneChance}
              disabled={cooldown}
            >
              {cooldown ? 'Cooldown...' : 'Test Silent Trigger'}
            </Button>
          </div>
        )}
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-orange-400" />
              One-Chance Mode Settings
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Shake to Trigger</p>
                <p className="text-xs text-zinc-500">Shake phone 5 times quickly to trigger</p>
              </div>
              <Switch
                checked={settings.shakeToTrigger}
                onCheckedChange={(checked) => saveSettings({ ...settings, shakeToTrigger: checked })}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Silent Mode</p>
                <p className="text-xs text-zinc-500">No sounds or visible alerts</p>
              </div>
              <Switch
                checked={settings.silentMode}
                onCheckedChange={(checked) => saveSettings({ ...settings, silentMode: checked })}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto Record Audio</p>
                <p className="text-xs text-zinc-500">Secretly record audio when triggered</p>
              </div>
              <Switch
                checked={settings.autoRecord}
                onCheckedChange={(checked) => saveSettings({ ...settings, autoRecord: checked })}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Fake Shutdown Screen</p>
                <p className="text-xs text-zinc-500">Show black screen (triple-tap to exit)</p>
              </div>
              <Switch
                checked={settings.fakeShutdown}
                onCheckedChange={(checked) => saveSettings({ ...settings, fakeShutdown: checked })}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Vibration Feedback</p>
                <p className="text-xs text-zinc-500">Subtle vibration when triggered</p>
              </div>
              <Switch
                checked={settings.vibrationFeedback}
                onCheckedChange={(checked) => saveSettings({ ...settings, vibrationFeedback: checked })}
              />
            </div>

            <div className="pt-4 border-t border-zinc-800">
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                <h4 className="font-medium text-orange-400 text-sm mb-1">How it works:</h4>
                <ol className="text-xs text-zinc-400 space-y-1 list-decimal list-inside">
                  <li>Enable One-Chance Mode before entering vehicles</li>
                  <li>If in danger, shake your phone vigorously 5 times</li>
                  <li>Phone will appear "off" but silently sends SOS</li>
                  <li>Location and audio are recorded for evidence</li>
                  <li>Triple-tap black screen to exit fake shutdown</li>
                </ol>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OneChanceMode;
