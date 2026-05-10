import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, ShieldCheck, ShieldAlert, AlertTriangle, 
  MapPin, Clock, Loader2, RefreshCw, ChevronDown, ChevronUp,
  Sun, Moon, Sunset, CheckCircle2, Info
} from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';

const SafetyScore = ({ className = '' }) => {
  const { userLocation, api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scoreData, setScoreData] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch safety score
  const fetchSafetyScore = useCallback(async () => {
    if (!userLocation) {
      setError('Location required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/safety-score', {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude
      });
      setScoreData(response.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Safety score error:', err);
      setError('Could not calculate safety score');
    } finally {
      setLoading(false);
    }
  }, [userLocation, api]);

  // Initial fetch
  useEffect(() => {
    if (userLocation) {
      fetchSafetyScore();
    }
  }, [userLocation, fetchSafetyScore]);

  // Get score color
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-tg-safe';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-tg-danger';
  };

  // Get score background gradient
  const getScoreGradient = (score) => {
    if (score >= 80) return 'from-tg-safe/20 to-tg-safe/5';
    if (score >= 60) return 'from-yellow-500/20 to-yellow-500/5';
    if (score >= 40) return 'from-orange-500/20 to-orange-500/5';
    return 'from-tg-danger/20 to-tg-danger/5';
  };

  // Get progress color
  const getProgressColor = (score) => {
    if (score >= 80) return 'bg-tg-safe';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-tg-danger';
  };

  // Get shield icon based on score
  const getShieldIcon = (score) => {
    if (score >= 80) return <ShieldCheck className="w-8 h-8 text-tg-safe" />;
    if (score >= 60) return <Shield className="w-8 h-8 text-yellow-500" />;
    if (score >= 40) return <ShieldAlert className="w-8 h-8 text-orange-500" />;
    return <AlertTriangle className="w-8 h-8 text-tg-danger" />;
  };

  // Get time icon
  const getTimeIcon = (period) => {
    switch (period) {
      case 'Day': return <Sun className="w-4 h-4 text-yellow-400" />;
      case 'Evening': return <Sunset className="w-4 h-4 text-orange-400" />;
      case 'Night': return <Moon className="w-4 h-4 text-blue-400" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className={`tg-card p-6 ${className}`}>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-tg-safe" />
          <span className="ml-2 text-zinc-500">Calculating safety score...</span>
        </div>
      </div>
    );
  }

  if (error || !scoreData) {
    return (
      <div className={`tg-card p-6 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-zinc-500" />
            <div>
              <p className="font-medium">Safety Score</p>
              <p className="text-sm text-zinc-500">{error || 'Enable location to see score'}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchSafetyScore}
            disabled={!userLocation}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`tg-card overflow-hidden ${className}`}
      data-testid="safety-score-widget"
    >
      {/* Main Score Display */}
      <div className={`p-6 bg-gradient-to-br ${getScoreGradient(scoreData.score)}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {getShieldIcon(scoreData.score)}
            <div>
              <h3 className="font-semibold">Safety Score</h3>
              <p className="text-sm text-zinc-500">Your current location</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={fetchSafetyScore}
            className="text-zinc-400 hover:text-white"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Score Circle */}
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24">
            {/* Background circle */}
            <svg className="w-24 h-24 transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="42"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-zinc-800"
              />
              <circle
                cx="48"
                cy="48"
                r="42"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${scoreData.score * 2.64} 264`}
                strokeLinecap="round"
                className={getScoreColor(scoreData.score)}
              />
            </svg>
            {/* Score number */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-3xl font-bold ${getScoreColor(scoreData.score)}`}>
                {scoreData.score}
              </span>
            </div>
          </div>

          <div className="flex-1">
            <div className={`text-xl font-bold ${getScoreColor(scoreData.score)}`}>
              {scoreData.risk_level} Risk
            </div>
            <div className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
              {getTimeIcon(scoreData.time_analysis?.period)}
              <span>{scoreData.time_analysis?.period} ({scoreData.time_analysis?.current_hour}:00)</span>
            </div>
            <div className="text-xs text-zinc-600 mt-2 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>
                {scoreData.breakdown?.incidents_nearby || 0} incidents nearby
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold">{scoreData.breakdown?.incidents_nearby || 0}</p>
            <p className="text-xs text-zinc-500">Incidents</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold">{scoreData.breakdown?.safe_zones_nearby || 0}</p>
            <p className="text-xs text-zinc-500">Safe Zones</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold">{scoreData.time_analysis?.is_high_risk_time ? '⚠️' : '✓'}</p>
            <p className="text-xs text-zinc-500">Time Risk</p>
          </div>
        </div>
      </div>

      {/* Expandable Details */}
      <div className="border-t border-zinc-800">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors"
        >
          <span className="text-sm font-medium">View Details & Recommendations</span>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-zinc-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-zinc-500" />
          )}
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-4">
            {/* Score Breakdown */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-zinc-400">Score Breakdown</h4>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-zinc-500">Incident Safety</span>
                  <span>{scoreData.breakdown?.incident_score || 0}/100</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${getProgressColor(scoreData.breakdown?.incident_score || 0)} transition-all`}
                    style={{ width: `${scoreData.breakdown?.incident_score || 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-zinc-500">Time Safety</span>
                  <span>{scoreData.breakdown?.time_score || 0}/100</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${getProgressColor(scoreData.breakdown?.time_score || 0)} transition-all`}
                    style={{ width: `${scoreData.breakdown?.time_score || 0}%` }}
                  />
                </div>
              </div>

              {scoreData.breakdown?.safe_zone_bonus > 0 && (
                <div className="flex items-center gap-2 text-sm text-tg-safe">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>+{scoreData.breakdown.safe_zone_bonus} bonus from Safe Zones</span>
                </div>
              )}
            </div>

            {/* Recommendations */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-zinc-400">Safety Recommendations</h4>
              <ul className="space-y-2">
                {scoreData.recommendations?.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-tg-safe mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* AI Insights */}
            {scoreData.ai_insights && (
              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">AI Analysis</span>
                </div>
                <p className="text-sm text-zinc-400">
                  {typeof scoreData.ai_insights === 'string' 
                    ? scoreData.ai_insights 
                    : JSON.stringify(scoreData.ai_insights)}
                </p>
              </div>
            )}

            {/* Last Updated */}
            {lastUpdated && (
              <p className="text-xs text-zinc-600 text-center">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SafetyScore;
