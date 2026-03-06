import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Camera, Video, VideoOff, Square, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';

// SHA-256 hash function for evidence integrity
async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const EvidenceCapture = ({ 
  onEvidenceCapture, 
  autoStart = false,
  incidentId = null 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingType, setRecordingType] = useState(null); // 'audio' | 'video'
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [capturedItems, setCapturedItems] = useState([]);
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Auto-start audio recording if enabled
  useEffect(() => {
    if (autoStart && incidentId) {
      startAudioRecording();
    }
  }, [autoStart, incidentId]);

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleEvidenceBlob(blob, 'audio', duration);
      };

      mediaRecorder.start(1000); // Capture in 1-second chunks
      setIsRecording(true);
      setRecordingType('audio');
      setDuration(0);
      
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Failed to start audio recording:', error);
      alert('Could not access microphone. Please grant permission.');
    }
  };

  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: true 
      });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        await handleEvidenceBlob(blob, 'video', duration);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingType('video');
      setDuration(0);
      
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Failed to start video recording:', error);
      alert('Could not access camera. Please grant permission.');
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setIsRecording(false);
    setRecordingType(null);
  }, []);

  const handleEvidenceBlob = async (blob, type, recordedDuration) => {
    setUploading(true);
    try {
      // Generate SHA-256 hash
      const file = new File([blob], `evidence_${Date.now()}.webm`, { type: blob.type });
      const hash = await hashFile(file);
      
      // Create object URL for preview/upload
      const url = URL.createObjectURL(blob);
      
      const evidenceItem = {
        type,
        blob,
        url,
        hash,
        duration: recordedDuration,
        timestamp: new Date().toISOString()
      };
      
      setCapturedItems(prev => [...prev, evidenceItem]);
      
      if (onEvidenceCapture) {
        await onEvidenceCapture(evidenceItem);
      }
    } catch (error) {
      console.error('Failed to process evidence:', error);
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const hash = await hashFile(file);
      const url = URL.createObjectURL(file);
      
      const evidenceItem = {
        type: 'photo',
        blob: file,
        url,
        hash,
        duration: null,
        timestamp: new Date().toISOString()
      };
      
      setCapturedItems(prev => [...prev, evidenceItem]);
      
      if (onEvidenceCapture) {
        await onEvidenceCapture(evidenceItem);
      }
    } catch (error) {
      console.error('Failed to process photo:', error);
    } finally {
      setUploading(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="tg-card p-4" data-testid="evidence-capture">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Camera className="w-5 h-5 text-purple-400" />
        Evidence Capture
      </h3>

      {/* Recording Status */}
      {isRecording && (
        <div className="mb-4 p-3 bg-tg-danger/10 border border-tg-danger/30 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-tg-danger animate-pulse" />
            <span className="text-tg-danger font-medium">
              Recording {recordingType}...
            </span>
          </div>
          <span className="font-mono text-lg">{formatDuration(duration)}</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        {!isRecording ? (
          <>
            <Button
              onClick={startAudioRecording}
              className="bg-purple-600 hover:bg-purple-700"
              disabled={uploading}
              data-testid="start-audio-btn"
            >
              <Mic className="w-4 h-4 mr-2" />
              Record Audio
            </Button>
            
            <Button
              onClick={startVideoRecording}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={uploading}
              data-testid="start-video-btn"
            >
              <Video className="w-4 h-4 mr-2" />
              Record Video
            </Button>
            
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              disabled={uploading}
              data-testid="capture-photo-btn"
            >
              <Camera className="w-4 h-4 mr-2" />
              Take Photo
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoCapture}
              className="hidden"
            />
          </>
        ) : (
          <Button
            onClick={stopRecording}
            className="bg-tg-danger hover:bg-tg-danger/90"
            data-testid="stop-recording-btn"
          >
            <Square className="w-4 h-4 mr-2" />
            Stop Recording
          </Button>
        )}
        
        {uploading && (
          <div className="flex items-center gap-2 text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing...</span>
          </div>
        )}
      </div>

      {/* Captured Items */}
      {capturedItems.length > 0 && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <p className="text-sm text-zinc-400 mb-2">Captured Evidence ({capturedItems.length})</p>
          <div className="space-y-2">
            {capturedItems.map((item, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-2 bg-zinc-800/50 rounded-lg text-sm"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-tg-safe" />
                  <span className="capitalize">{item.type}</span>
                  {item.duration && <span className="text-zinc-500">({formatDuration(item.duration)})</span>}
                </div>
                <span className="text-xs text-zinc-500 font-mono">
                  {item.hash.slice(0, 12)}...
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <p className="text-xs text-zinc-500 mt-4">
        All evidence is SHA-256 hashed for forensic integrity verification.
      </p>
    </div>
  );
};

export default EvidenceCapture;
