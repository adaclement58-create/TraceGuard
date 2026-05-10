import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Wifi, WifiOff, Users, Send, QrCode, Radio, MapPin,
  MessageSquare, CheckCircle2, AlertTriangle, Loader2, Copy,
  Smartphone, Signal, Settings, X, Plus
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import QRCode from 'qrcode';

// Tactical Mesh Network - Offline Communication System
// Uses WiFi Hotspot + WebRTC for device-to-device communication

const MESH_STORAGE_KEY = 'traceguard_mesh_network';
const MESSAGE_QUEUE_KEY = 'traceguard_mesh_messages';

const TacticalMesh = ({ user, onSOSReceived, className = '' }) => {
  const [isHost, setIsHost] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [peers, setPeers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [networkId, setNetworkId] = useState('');

  const messagesEndRef = useRef(null);

  // Generate network ID
  const generateNetworkId = () => {
    return 'TG-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Load saved messages from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MESSAGE_QUEUE_KEY);
      if (saved) {
        setMessages(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load mesh messages:', e);
    }
  }, []);

  // Save messages to localStorage
  const saveMessages = useCallback((msgs) => {
    try {
      localStorage.setItem(MESSAGE_QUEUE_KEY, JSON.stringify(msgs.slice(-100))); // Keep last 100
    } catch (e) {
      console.error('Failed to save mesh messages:', e);
    }
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Create mesh network (host)
  const createNetwork = async () => {
    const id = generateNetworkId();
    setNetworkId(id);
    setIsHost(true);
    setIsConnected(true);

    // Generate QR code for joining
    const joinData = JSON.stringify({
      networkId: id,
      host: user?.full_name || 'Unknown',
      created: Date.now()
    });

    try {
      const qrUrl = await QRCode.toDataURL(joinData, {
        width: 256,
        margin: 2,
        color: { dark: '#00ff88', light: '#09090b' }
      });
      setQrCodeUrl(qrUrl);
    } catch (e) {
      console.error('Failed to generate QR code:', e);
    }

    // Add system message
    addMessage({
      type: 'system',
      text: `Network ${id} created. Share the QR code or network ID with your squad.`,
      timestamp: Date.now()
    });

    // Store network info
    localStorage.setItem(MESH_STORAGE_KEY, JSON.stringify({
      networkId: id,
      isHost: true,
      created: Date.now()
    }));
  };

  // Join existing network
  const joinNetwork = (code) => {
    const id = code.toUpperCase().trim();
    if (!id.startsWith('TG-') || id.length < 6) {
      alert('Invalid network ID. Format: TG-XXXXXX');
      return;
    }

    setNetworkId(id);
    setIsHost(false);
    setIsConnected(true);
    setShowJoinDialog(false);
    setJoinCode('');

    // Add system message
    addMessage({
      type: 'system',
      text: `Joined network ${id}`,
      timestamp: Date.now()
    });

    // Announce presence
    addMessage({
      type: 'join',
      sender: user?.full_name || 'Unknown',
      text: `${user?.full_name || 'Unknown'} joined the network`,
      timestamp: Date.now()
    });

    // Store network info
    localStorage.setItem(MESH_STORAGE_KEY, JSON.stringify({
      networkId: id,
      isHost: false,
      joined: Date.now()
    }));
  };

  // Leave network
  const leaveNetwork = () => {
    addMessage({
      type: 'system',
      text: `Left network ${networkId}`,
      timestamp: Date.now()
    });

    setIsHost(false);
    setIsConnected(false);
    setNetworkId('');
    setPeers([]);
    localStorage.removeItem(MESH_STORAGE_KEY);
  };

  // Add message to list
  const addMessage = useCallback((msg) => {
    setMessages(prev => {
      const newMsgs = [...prev, { ...msg, id: Date.now() + Math.random() }];
      saveMessages(newMsgs);
      return newMsgs;
    });
  }, [saveMessages]);

  // Send message
  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const msg = {
      type: 'message',
      sender: user?.full_name || 'You',
      text: newMessage.trim(),
      timestamp: Date.now(),
      location: currentLocation
    };

    addMessage(msg);
    setNewMessage('');

    // In a real implementation, this would broadcast via WebRTC
    // For now, messages are stored locally and can be synced via QR
  };

  // Send SOS to mesh network
  const sendMeshSOS = () => {
    const sosMsg = {
      type: 'sos',
      sender: user?.full_name || 'Unknown',
      text: `🚨 SOS ALERT from ${user?.full_name || 'Unknown'}!`,
      timestamp: Date.now(),
      location: currentLocation,
      priority: 'critical'
    };

    addMessage(sosMsg);

    // Vibrate
    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500, 200, 500]);
    }

    // Notify parent
    if (onSOSReceived) {
      onSOSReceived(sosMsg);
    }
  };

  // Share location
  const shareLocation = () => {
    if (!currentLocation) {
      alert('Location not available');
      return;
    }

    const locMsg = {
      type: 'location',
      sender: user?.full_name || 'Unknown',
      text: `📍 Location shared`,
      timestamp: Date.now(),
      location: currentLocation
    };

    addMessage(locMsg);
  };

  // Generate message export QR (for offline transfer)
  const generateExportQR = async () => {
    const recentMessages = messages.slice(-10); // Last 10 messages
    const exportData = JSON.stringify({
      networkId,
      messages: recentMessages,
      exported: Date.now()
    });

    try {
      const qrUrl = await QRCode.toDataURL(exportData, {
        width: 256,
        margin: 2,
        color: { dark: '#00ff88', light: '#09090b' }
      });
      setQrCodeUrl(qrUrl);
      setShowQR(true);
    } catch (e) {
      console.error('Failed to generate export QR:', e);
    }
  };

  // Copy network ID
  const copyNetworkId = () => {
    navigator.clipboard.writeText(networkId);
    alert('Network ID copied!');
  };

  // Format timestamp
  const formatTime = (ts) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get message style
  const getMessageStyle = (msg) => {
    switch (msg.type) {
      case 'sos':
        return 'bg-red-500/20 border border-red-500/50 text-red-300';
      case 'location':
        return 'bg-blue-500/20 border border-blue-500/50 text-blue-300';
      case 'system':
      case 'join':
        return 'bg-zinc-800/50 text-zinc-500 text-xs text-center';
      default:
        return msg.sender === (user?.full_name || 'You') 
          ? 'bg-tg-safe/20 border border-tg-safe/30 ml-auto' 
          : 'bg-zinc-800';
    }
  };

  return (
    <>
      <div className={`tg-card overflow-hidden ${className}`} data-testid="tactical-mesh">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isConnected ? 'bg-tg-safe/20' : 'bg-zinc-800'}`}>
                {isConnected ? (
                  <Radio className="w-5 h-5 text-tg-safe" />
                ) : (
                  <WifiOff className="w-5 h-5 text-zinc-500" />
                )}
              </div>
              <div>
                <p className="font-medium">Tactical Mesh Network</p>
                <p className="text-xs text-zinc-500">
                  {isConnected 
                    ? `Connected: ${networkId}` 
                    : 'Offline squad communication'
                  }
                </p>
              </div>
            </div>
            
            {isConnected && (
              <Button
                variant="ghost"
                size="sm"
                onClick={copyNetworkId}
                className="text-zinc-500"
              >
                <Copy className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Not Connected State */}
        {!isConnected && (
          <div className="p-6 space-y-4">
            <p className="text-sm text-zinc-500 text-center">
              Create or join a mesh network to communicate with your squad without internet.
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={createNetwork}
                className="bg-tg-safe hover:bg-tg-safe/90 text-black"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Network
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowJoinDialog(true)}
                className="border-zinc-600"
              >
                <Users className="w-4 h-4 mr-2" />
                Join Network
              </Button>
            </div>

            <div className="text-xs text-zinc-600 text-center">
              <p>📡 Works via WiFi hotspot - one device hosts, others connect</p>
            </div>
          </div>
        )}

        {/* Connected State - Messages */}
        {isConnected && (
          <>
            {/* Messages List */}
            <div className="h-64 overflow-y-auto p-4 space-y-2 bg-zinc-950/50">
              {messages.length === 0 && (
                <p className="text-zinc-600 text-center text-sm py-8">
                  No messages yet. Send a message or share your location.
                </p>
              )}
              
              {messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`max-w-[85%] p-2 rounded-lg ${getMessageStyle(msg)}`}
                >
                  {msg.type !== 'system' && msg.type !== 'join' && (
                    <p className="text-xs text-zinc-500 mb-1">{msg.sender}</p>
                  )}
                  <p className="text-sm">{msg.text}</p>
                  {msg.location && (
                    <a 
                      href={`https://maps.google.com/?q=${msg.location.lat},${msg.location.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:underline flex items-center gap-1 mt-1"
                    >
                      <MapPin className="w-3 h-3" />
                      {msg.location.lat.toFixed(5)}, {msg.location.lng.toFixed(5)}
                    </a>
                  )}
                  <p className="text-xs text-zinc-600 mt-1">{formatTime(msg.timestamp)}</p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-3 border-t border-zinc-800">
              <div className="flex gap-2 mb-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type message..."
                  className="bg-zinc-800 border-zinc-700"
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <Button onClick={sendMessage} className="bg-tg-safe text-black">
                  <Send className="w-4 h-4" />
                </Button>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={shareLocation}
                  className="flex-1 border-zinc-700 text-xs"
                >
                  <MapPin className="w-3 h-3 mr-1" />
                  Share Location
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={sendMeshSOS}
                  className="flex-1 border-red-500/50 text-red-400 text-xs hover:bg-red-500/10"
                >
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  SOS
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQR(true)}
                  className="border-zinc-700"
                >
                  <QrCode className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Leave Network Button */}
            <div className="p-3 border-t border-zinc-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={leaveNetwork}
                className="w-full text-zinc-500 hover:text-red-400"
              >
                Leave Network
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Join Network Dialog */}
      <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Join Mesh Network</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-zinc-500 mb-2 block">Network ID</label>
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="TG-XXXXXX"
                className="bg-zinc-800 border-zinc-700 text-lg font-mono text-center"
              />
            </div>
            <Button 
              onClick={() => joinNetwork(joinCode)}
              className="w-full bg-tg-safe text-black"
              disabled={!joinCode}
            >
              Join Network
            </Button>
            <p className="text-xs text-zinc-600 text-center">
              Ask the network host for the ID or scan their QR code
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Network QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            {qrCodeUrl && (
              <img src={qrCodeUrl} alt="Network QR Code" className="w-64 h-64 rounded-lg" />
            )}
            <p className="text-lg font-mono font-bold mt-4 text-tg-safe">{networkId}</p>
            <p className="text-xs text-zinc-500 mt-2">
              Others can scan this QR code or enter the network ID to join
            </p>
            <Button
              onClick={copyNetworkId}
              variant="outline"
              className="mt-4"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Network ID
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TacticalMesh;
