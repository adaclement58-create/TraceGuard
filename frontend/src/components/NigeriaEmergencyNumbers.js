import React, { useState } from 'react';
import { Phone, Shield, Ambulance, Flame, Car, Building2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';

// Nigeria Emergency Numbers Database
const EMERGENCY_NUMBERS = {
  national: [
    { 
      id: 'police-112',
      name: 'Police Emergency', 
      number: '112', 
      icon: Shield, 
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      description: 'National emergency line'
    },
    { 
      id: 'police-199',
      name: 'Police (NPF)', 
      number: '199', 
      icon: Shield, 
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      description: 'Nigeria Police Force'
    },
    { 
      id: 'fire',
      name: 'Fire Service', 
      number: '199', 
      icon: Flame, 
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      description: 'Federal Fire Service'
    },
    { 
      id: 'frsc',
      name: 'Road Safety (FRSC)', 
      number: '122', 
      icon: Car, 
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      description: 'Federal Road Safety Corps'
    },
    { 
      id: 'nscdc',
      name: 'Civil Defence (NSCDC)', 
      number: '08077369669', 
      icon: Building2, 
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      description: 'Nigeria Security & Civil Defence'
    },
  ],
  lagos: [
    { 
      id: 'lagos-rrs',
      name: 'Lagos RRS', 
      number: '08063106356', 
      icon: Shield, 
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      description: 'Rapid Response Squad'
    },
    { 
      id: 'lagos-emergency',
      name: 'Lagos State Emergency', 
      number: '112', 
      icon: Phone, 
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      description: 'LASEMA - Lagos Emergency'
    },
    { 
      id: 'lagos-lastma',
      name: 'LASTMA', 
      number: '08129928545', 
      icon: Car, 
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      description: 'Traffic Management'
    },
    { 
      id: 'lagos-fire',
      name: 'Lagos Fire Service', 
      number: '08035809993', 
      icon: Flame, 
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      description: 'Lagos State Fire Service'
    },
  ],
  abuja: [
    { 
      id: 'abuja-emergency',
      name: 'FCT Emergency', 
      number: '112', 
      icon: Phone, 
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      description: 'FCT Emergency Services'
    },
    { 
      id: 'abuja-police',
      name: 'FCT Police Command', 
      number: '08032003913', 
      icon: Shield, 
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      description: 'Abuja Police Command'
    },
  ],
  rivers: [
    { 
      id: 'rivers-police',
      name: 'Rivers Police', 
      number: '08032003514', 
      icon: Shield, 
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      description: 'Rivers State Police Command'
    },
  ],
  kano: [
    { 
      id: 'kano-police',
      name: 'Kano Police', 
      number: '08032419754', 
      icon: Shield, 
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      description: 'Kano State Police Command'
    },
  ]
};

const NigeriaEmergencyNumbers = ({ className = '', compact = false }) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('national');

  const handleCall = (number) => {
    // Use tel: protocol to initiate call
    window.location.href = `tel:${number}`;
  };

  const regions = [
    { id: 'national', name: 'National' },
    { id: 'lagos', name: 'Lagos' },
    { id: 'abuja', name: 'Abuja (FCT)' },
    { id: 'rivers', name: 'Rivers' },
    { id: 'kano', name: 'Kano' },
  ];

  const currentNumbers = EMERGENCY_NUMBERS[selectedRegion] || EMERGENCY_NUMBERS.national;

  if (compact) {
    // Compact version - just top 3 national numbers
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-zinc-400">Emergency Numbers</h4>
          <span className="text-xs text-zinc-600">Tap to call</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {EMERGENCY_NUMBERS.national.slice(0, 3).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleCall(item.number)}
                className={`${item.bgColor} p-3 rounded-lg text-center hover:opacity-80 transition-opacity`}
                data-testid={`emergency-call-${item.id}`}
              >
                <Icon className={`w-5 h-5 mx-auto mb-1 ${item.color}`} />
                <p className="text-xs font-medium truncate">{item.name}</p>
                <p className={`text-sm font-bold ${item.color}`}>{item.number}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`tg-card ${className}`} data-testid="nigeria-emergency-numbers">
      {/* Header */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/20">
            <Phone className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold">Nigeria Emergency Numbers</h3>
            <p className="text-xs text-zinc-500">Tap any number to call directly</p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-zinc-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-zinc-500" />
        )}
      </div>

      {/* Quick Access - Always visible */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleCall('112')}
            className="bg-red-500/20 hover:bg-red-500/30 p-4 rounded-lg text-center transition-colors"
            data-testid="emergency-call-112"
          >
            <Phone className="w-6 h-6 mx-auto mb-2 text-red-400" />
            <p className="text-xs text-zinc-400">Emergency</p>
            <p className="text-lg font-bold text-red-400">112</p>
          </button>
          <button
            onClick={() => handleCall('199')}
            className="bg-blue-500/20 hover:bg-blue-500/30 p-4 rounded-lg text-center transition-colors"
            data-testid="emergency-call-199"
          >
            <Shield className="w-6 h-6 mx-auto mb-2 text-blue-400" />
            <p className="text-xs text-zinc-400">Police</p>
            <p className="text-lg font-bold text-blue-400">199</p>
          </button>
          <button
            onClick={() => handleCall('122')}
            className="bg-yellow-500/20 hover:bg-yellow-500/30 p-4 rounded-lg text-center transition-colors"
            data-testid="emergency-call-122"
          >
            <Car className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
            <p className="text-xs text-zinc-400">Road Safety</p>
            <p className="text-lg font-bold text-yellow-400">122</p>
          </button>
        </div>
      </div>

      {/* Expanded Section */}
      {expanded && (
        <div className="border-t border-zinc-800 p-4 space-y-4">
          {/* Region Selector */}
          <div className="flex flex-wrap gap-2">
            {regions.map((region) => (
              <button
                key={region.id}
                onClick={() => setSelectedRegion(region.id)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  selectedRegion === region.id
                    ? 'bg-tg-safe text-black font-medium'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {region.name}
              </button>
            ))}
          </div>

          {/* Numbers List */}
          <div className="space-y-2">
            {currentNumbers.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleCall(item.number)}
                  className={`w-full ${item.bgColor} hover:opacity-80 p-3 rounded-lg flex items-center justify-between transition-opacity`}
                  data-testid={`emergency-call-${item.id}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${item.color}`} />
                    <div className="text-left">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-zinc-500">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${item.color}`}>{item.number}</span>
                    <ExternalLink className="w-4 h-4 text-zinc-500" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-zinc-600 text-center">
            These numbers are for emergencies only. Misuse may be punishable by law.
          </p>
        </div>
      )}
    </div>
  );
};

export default NigeriaEmergencyNumbers;
