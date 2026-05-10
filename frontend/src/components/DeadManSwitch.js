import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Timer, AlertTriangle, CheckCircle2, Clock, Settings,
  Vibrate, Volume2, Bell, Shield, Loader2, Play, Pause, X
} from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

// Dead Man's Switch - Automatic check-in system for troops
// Works 100% OFFLINE using local timers and notifications

const STORAGE_KEY = 'traceguard_deadman_switch';

const DeadManSwitch = ({ onAlert, onSOSTriggered, className = '' }) => {
  const [isActive, setIsActive] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [missedCheckIns, setMissedCheckIns] = useState(0);
  const [maxMissedBeforeAlert, setMaxMissedBeforeAlert] = useState(3);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [lastCheckIn, setLastCheckIn] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [alertLevel, setAlertLevel] = useState('safe'); // safe, warning, danger, critical
  const [settings, setSettings] = useState({
    vibrationAlert: true,
    soundAlert: true,
    autoSOS: true,
    notifyContacts: true,
    duressCode: 'AMBER', // If user says this word, trigger silent SOS
  });

  const timerRef = useRef(null);
  const countdownRef = useRef(null);

  // Load saved state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        setIntervalMinutes(data.intervalMinutes || 30);
        setMaxMissedBeforeAlert(data.maxMissedBeforeAlert || 3);
        setSettings(data.settings || settings);
        
        // Check if was active and calculate missed check-ins
        if (data.isActive && data.lastCheckIn) {
          const lastTime = new Date(data.lastCheckIn).getTime();
          const now = Date.now();
          const elapsed = (now - lastTime) / 1000 / 60; // minutes
          const missed = Math.floor(elapsed / data.intervalMinutes);
          
          if (missed > 0) {
            setMissedCheckIns(Math.min(missed, data.maxMissedBeforeAlert + 1));
            setLastCheckIn(new Date(data.lastCheckIn));
            setIsActive(true);
            
            // Immediate alert if too many missed
            if (missed >= data.maxMissedBeforeAlert) {
              triggerEmergencyAlert();
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to load dead man switch state:', e);
    }
  }, []);

  // Save state to localStorage
  const saveState = useCallback((active, lastCheck, missed) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        isActive: active,
        lastCheckIn: lastCheck?.toISOString(),
        missedCheckIns: missed,
        intervalMinutes,
        maxMissedBeforeAlert,
        settings
      }));
    } catch (e) {
      console.error('Failed to save dead man switch state:', e);
    }
  }, [intervalMinutes, maxMissedBeforeAlert, settings]);

  // Start the check-in timer
  const startTimer = useCallback(() => {
    // Clear existing timers
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    const now = new Date();
    setLastCheckIn(now);
    setMissedCheckIns(0);
    setTimeRemaining(intervalMinutes * 60);
    setAlertLevel('safe');
    saveState(true, now, 0);

    // Countdown timer (updates every second)
    countdownRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          return intervalMinutes * 60; // Reset for next cycle
        }
        return prev - 1;
      });
    }, 1000);

    // Check-in timer (fires at interval)
    timerRef.current = setInterval(() => {
      setMissedCheckIns(prev => {
        const newMissed = prev + 1;
        
        // Update alert level
        if (newMissed >= maxMissedBeforeAlert) {
          setAlertLevel('critical');
          triggerEmergencyAlert();
        } else if (newMissed >= maxMissedBeforeAlert - 1) {
          setAlertLevel('danger');
          playWarningAlert();
        } else if (newMissed >= 1) {
          setAlertLevel('warning');
          playReminderAlert();
        }

        saveState(true, lastCheckIn, newMissed);
        return newMissed;
      });
    }, intervalMinutes * 60 * 1000);

  }, [intervalMinutes, maxMissedBeforeAlert, saveState, lastCheckIn]);

  // Stop the timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setIsActive(false);
    setMissedCheckIns(0);
    setAlertLevel('safe');
    setTimeRemaining(0);
    saveState(false, null, 0);
  }, [saveState]);

  // Check in (reset timer)
  const checkIn = useCallback(() => {
    const now = new Date();
    setLastCheckIn(now);
    setMissedCheckIns(0);
    setTimeRemaining(intervalMinutes * 60);
    setAlertLevel('safe');
    saveState(true, now, 0);

    // Restart the interval timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setMissedCheckIns(prev => {
        const newMissed = prev + 1;
        if (newMissed >= maxMissedBeforeAlert) {
          setAlertLevel('critical');
          triggerEmergencyAlert();
        } else if (newMissed >= maxMissedBeforeAlert - 1) {
          setAlertLevel('danger');
          playWarningAlert();
        } else if (newMissed >= 1) {
          setAlertLevel('warning');
          playReminderAlert();
        }
        return newMissed;
      });
    }, intervalMinutes * 60 * 1000);

    // Confirmation feedback
    if (settings.vibrationAlert && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  }, [intervalMinutes, maxMissedBeforeAlert, settings, saveState]);

  // Play reminder alert (1 missed)
  const playReminderAlert = () => {
    if (settings.vibrationAlert && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
    if (settings.soundAlert) {
      playTone(440, 0.3, 0.2); // A4 note
    }
  };

  // Play warning alert (2 missed)
  const playWarningAlert = () => {
    if (settings.vibrationAlert && navigator.vibrate) {
      navigator.vibrate([300, 100, 300, 100, 300]);
    }
    if (settings.soundAlert) {
      playTone(880, 0.5, 0.3); // A5 note - higher pitch
    }
  };

  // Trigger emergency alert (max missed)
  const triggerEmergencyAlert = async () => {
    console.log('[DeadManSwitch] EMERGENCY ALERT TRIGGERED');
    
    if (settings.vibrationAlert && navigator.vibrate) {
      navigator.vibrate([500, 200, 500, 200, 500, 200, 500]);
    }
    
    if (settings.soundAlert) {
      // Play urgent alarm
      for (let i = 0; i < 3; i++) {
        setTimeout(() => playTone(1000, 0.5, 0.5), i * 600);
      }
    }

    // Get location
    let lat = null, lng = null;
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch (e) {
      console.log('[DeadManSwitch] Location unavailable');
    }

    // Trigger SOS if enabled
    if (settings.autoSOS && onSOSTriggered) {
      onSOSTriggered({
        type: 'dead_man_switch',
        latitude: lat,
        longitude: lng,
        missedCheckIns: missedCheckIns + 1,
        lastCheckIn: lastCheckIn?.toISOString()
      });
    }

    // Call alert handler
    if (onAlert) {
      onAlert({
        type: 'dead_man_switch',
        severity: 'critical',
        message: `No check-in for ${(missedCheckIns + 1) * intervalMinutes} minutes`,
        latitude: lat,
        longitude: lng
      });
    }
  };

  // Play audio tone
  const playTone = (frequency, duration, volume) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      gainNode.gain.value = volume;
      
      oscillator.start();
      setTimeout(() => oscillator.stop(), duration * 1000);
    } catch (e) {
      console.warn('[DeadManSwitch] Could not play audio');
    }
  };

  // Format time remaining
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get alert color
  const getAlertColor = () => {
    switch (alertLevel) {
      case 'warning': return 'border-yellow-500/50 bg-yellow-500/10';
      case 'danger': return 'border-orange-500/50 bg-orange-500/10';
      case 'critical': return 'border-red-500/50 bg-red-500/20 animate-pulse';
      default: return 'border-zinc-700';
    }
  };

  // Toggle active state
  const toggleActive = () => {
    if (isActive) {
      stopTimer();
    } else {
      setIsActive(true);
      startTimer();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  return (
    <>
      <div 
        className={`tg-card p-4 transition-all ${getAlertColor()} ${className}`}
        data-testid="dead-man-switch"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              alertLevel === 'critical' ? 'bg-red-500/30' :
              alertLevel === 'danger' ? 'bg-orange-500/20' :
              alertLevel === 'warning' ? 'bg-yellow-500/20' :
              isActive ? 'bg-tg-safe/20' : 'bg-zinc-800'
            }`}>
              {alertLevel === 'critical' ? (
                <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
              ) : isActive ? (
                <Timer className="w-5 h-5 text-tg-safe" />
              ) : (
                <Clock className="w-5 h-5 text-zinc-500" />
              )}
            </div>
            <div>
              <p className="font-medium">Dead Man's Switch</p>
              <p className="text-xs text-zinc-500">
                {alertLevel === 'critical' 
                  ? 'EMERGENCY: No response detected!'
                  : isActive 
                    ? `Check in every ${intervalMinutes} min`
                    : 'Auto-alert if no response'
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
              checked={isActive}
              onCheckedChange={toggleActive}
              data-testid="dead-man-switch-toggle"
            />
          </div>
        </div>

        {/* Active Status */}
        {isActive && (
          <div className="mt-4 space-y-3">
            {/* Timer Display */}
            <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
              <div>
                <p className="text-xs text-zinc-500">Next check-in</p>
                <p className={`text-2xl font-mono font-bold ${
                  alertLevel === 'critical' ? 'text-red-400' :
                  alertLevel === 'danger' ? 'text-orange-400' :
                  alertLevel === 'warning' ? 'text-yellow-400' :
                  'text-tg-safe'
                }`}>
                  {formatTime(timeRemaining)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500">Missed</p>
                <p className={`text-2xl font-bold ${
                  missedCheckIns >= maxMissedBeforeAlert ? 'text-red-400' :
                  missedCheckIns > 0 ? 'text-yellow-400' : 'text-zinc-400'
                }`}>
                  {missedCheckIns}/{maxMissedBeforeAlert}
                </p>
              </div>
            </div>

            {/* Check-In Button */}
            <Button
              onClick={checkIn}
              className={`w-full h-14 text-lg font-bold ${
                alertLevel === 'critical' 
                  ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                  : 'bg-tg-safe hover:bg-tg-safe/90'
              } text-black`}
              data-testid="check-in-btn"
            >
              <CheckCircle2 className="w-6 h-6 mr-2" />
              {alertLevel === 'critical' ? "I'M OK - CANCEL ALERT" : "CHECK IN"}
            </Button>

            {/* Status Messages */}
            {alertLevel === 'warning' && (
              <p className="text-sm text-yellow-400 text-center">
                ⚠️ Missed 1 check-in - Please confirm you're OK
              </p>
            )}
            {alertLevel === 'danger' && (
              <p className="text-sm text-orange-400 text-center">
                ⚠️ Missed 2 check-ins - Alert will trigger soon!
              </p>
            )}
            {alertLevel === 'critical' && (
              <p className="text-sm text-red-400 text-center font-bold">
                🚨 EMERGENCY ALERT SENT - Check in to cancel
              </p>
            )}
          </div>
        )}

        {/* Instructions when inactive */}
        {!isActive && (
          <div className="mt-3 text-xs text-zinc-600">
            <p>Enable before patrol. Auto-alerts contacts if you don't check in.</p>
          </div>
        )}
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-tg-safe" />
              Dead Man's Switch Settings
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Check-in Interval */}
            <div>
              <label className="text-sm font-medium mb-2 block">Check-in Interval</label>
              <Select
                value={intervalMinutes.toString()}
                onValueChange={(v) => setIntervalMinutes(parseInt(v))}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="5">Every 5 minutes</SelectItem>
                  <SelectItem value="10">Every 10 minutes</SelectItem>
                  <SelectItem value="15">Every 15 minutes</SelectItem>
                  <SelectItem value="30">Every 30 minutes</SelectItem>
                  <SelectItem value="60">Every 1 hour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Max Missed Before Alert */}
            <div>
              <label className="text-sm font-medium mb-2 block">Alert after missed check-ins</label>
              <Select
                value={maxMissedBeforeAlert.toString()}
                onValueChange={(v) => setMaxMissedBeforeAlert(parseInt(v))}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="1">1 missed (immediate)</SelectItem>
                  <SelectItem value="2">2 missed</SelectItem>
                  <SelectItem value="3">3 missed</SelectItem>
                  <SelectItem value="5">5 missed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Alert Options */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Vibrate className="w-4 h-4 text-zinc-500" />
                  <span>Vibration alerts</span>
                </div>
                <Switch
                  checked={settings.vibrationAlert}
                  onCheckedChange={(v) => setSettings({...settings, vibrationAlert: v})}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-zinc-500" />
                  <span>Sound alerts</span>
                </div>
                <Switch
                  checked={settings.soundAlert}
                  onCheckedChange={(v) => setSettings({...settings, soundAlert: v})}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-zinc-500" />
                  <span>Auto-trigger SOS</span>
                </div>
                <Switch
                  checked={settings.autoSOS}
                  onCheckedChange={(v) => setSettings({...settings, autoSOS: v})}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-zinc-500" />
                  <span>Notify contacts</span>
                </div>
                <Switch
                  checked={settings.notifyContacts}
                  onCheckedChange={(v) => setSettings({...settings, notifyContacts: v})}
                />
              </div>
            </div>

            {/* How it works */}
            <div className="pt-4 border-t border-zinc-800">
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <h4 className="font-medium text-sm mb-2">How it works:</h4>
                <ol className="text-xs text-zinc-400 space-y-1 list-decimal list-inside">
                  <li>Enable before entering hostile area</li>
                  <li>Press "CHECK IN" at each interval</li>
                  <li>If you miss {maxMissedBeforeAlert} check-ins, auto-alert triggers</li>
                  <li>Your last known location is sent to contacts</li>
                  <li>Works completely offline</li>
                </ol>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DeadManSwitch;
