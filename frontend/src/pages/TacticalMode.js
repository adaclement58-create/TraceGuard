import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, Radio, Timer, QrCode, Map, Trash2, 
  Smartphone, AlertTriangle, ChevronDown, ChevronUp,
  Info, Settings
} from 'lucide-react';
import Layout from '../components/Layout';
import DeadManSwitch from '../components/DeadManSwitch';
import TacticalMesh from '../components/TacticalMesh';
import QREmergencyBeacon from '../components/QREmergencyBeacon';
import OfflineThreatMap from '../components/OfflineThreatMap';
import PanicWipe from '../components/PanicWipe';
import OneChanceMode from '../components/OneChanceMode';
import { Button } from '../components/ui/button';

const TacticalMode = () => {
  const { user, api } = useAuth();
  const [expandedSection, setExpandedSection] = useState(null);
  const [showInfo, setShowInfo] = useState(true);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Handle SOS triggered from any component
  const handleSOSTriggered = async (data) => {
    console.log('[TacticalMode] SOS Triggered:', data);
    
    try {
      await api.post('/incidents', {
        incident_type: data.type || 'tactical_sos',
        severity: 'critical',
        latitude: data.latitude || data.lat,
        longitude: data.longitude || data.lng,
        silent: data.silent || false,
        metadata: data
      });
    } catch (error) {
      console.error('Failed to create incident:', error);
      // Queue for offline sync
      const pending = JSON.parse(localStorage.getItem('pending_sos') || '[]');
      pending.push({ ...data, timestamp: Date.now() });
      localStorage.setItem('pending_sos', JSON.stringify(pending));
    }
  };

  const features = [
    {
      id: 'dead_man_switch',
      title: 'Dead Man\'s Switch',
      description: 'Auto-alert if you don\'t check in',
      icon: Timer,
      color: 'text-tg-safe',
      bgColor: 'bg-tg-safe/20',
      offline: true,
      component: <DeadManSwitch onSOSTriggered={handleSOSTriggered} />
    },
    {
      id: 'tactical_mesh',
      title: 'Tactical Mesh Network',
      description: 'Squad communication without internet',
      icon: Radio,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      offline: true,
      component: <TacticalMesh user={user} onSOSReceived={handleSOSTriggered} />
    },
    {
      id: 'qr_beacon',
      title: 'QR Emergency Beacon',
      description: 'Share location via QR code',
      icon: QrCode,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      offline: true,
      component: <QREmergencyBeacon user={user} />
    },
    {
      id: 'threat_map',
      title: 'Offline Threat Map',
      description: 'Download threat intel for offline use',
      icon: Map,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      offline: true,
      component: <OfflineThreatMap />
    },
    {
      id: 'one_chance',
      title: 'One-Chance Mode',
      description: 'Silent distress for vehicle robbery',
      icon: Smartphone,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      offline: true,
      component: <OneChanceMode onSOSTriggered={handleSOSTriggered} />
    },
    {
      id: 'panic_wipe',
      title: 'Panic Data Wipe',
      description: 'Emergency data destruction',
      icon: Trash2,
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      offline: true,
      component: <PanicWipe />
    }
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto pb-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30">
              <Shield className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Tactical Mode</h1>
              <p className="text-zinc-500">Advanced offline safety features</p>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        {showInfo && (
          <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-medium text-orange-400 mb-1">For High-Risk Operations</h3>
                <p className="text-sm text-zinc-400">
                  These features are designed for military personnel, security operatives, and civilians 
                  in hostile environments. All features work <strong className="text-orange-300">100% offline</strong> using 
                  local storage, Bluetooth, and WiFi hotspots.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-xs px-2 py-1 rounded-full bg-tg-safe/20 text-tg-safe">✓ No Internet Required</span>
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">✓ End-to-End Encrypted</span>
                  <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">✓ Mesh Networking</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInfo(false)}
                className="text-zinc-500 h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
          </div>
        )}

        {/* Feature Grid */}
        <div className="space-y-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            const isExpanded = expandedSection === feature.id;
            
            return (
              <div key={feature.id} className="tg-card overflow-hidden">
                {/* Feature Header */}
                <button
                  onClick={() => toggleSection(feature.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors"
                  data-testid={`tactical-feature-${feature.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${feature.bgColor}`}>
                      <Icon className={`w-5 h-5 ${feature.color}`} />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{feature.title}</p>
                      <p className="text-xs text-zinc-500">{feature.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {feature.offline && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                        OFFLINE
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-zinc-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-zinc-500" />
                    )}
                  </div>
                </button>

                {/* Feature Content */}
                {isExpanded && (
                  <div className="border-t border-zinc-800">
                    {feature.component}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Warning */}
        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-400">Security Notice</h4>
              <p className="text-xs text-zinc-500 mt-1">
                These features are for legitimate safety purposes only. Misuse for false alerts or 
                to interfere with military/police operations is a criminal offense. All SOS alerts 
                are logged and may be shared with authorities.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="tg-card p-4 text-center">
            <p className="text-2xl font-bold text-tg-safe">6</p>
            <p className="text-xs text-zinc-500">Offline Features</p>
          </div>
          <div className="tg-card p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">100%</p>
            <p className="text-xs text-zinc-500">No Internet</p>
          </div>
          <div className="tg-card p-4 text-center">
            <p className="text-2xl font-bold text-orange-400">E2E</p>
            <p className="text-xs text-zinc-500">Encrypted</p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TacticalMode;
