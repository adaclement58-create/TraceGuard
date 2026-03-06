import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { FileVideo, Radio, Image, Download, Copy, Lock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const EvidenceVault = () => {
  const { api } = useAuth();
  const [evidence, setEvidence] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [copying, setCopying] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [evidenceRes, subRes] = await Promise.all([
        api.get('/evidence'),
        api.get('/subscription').catch(() => ({ data: { plan: 'basic' } }))
      ]);
      setEvidence(evidenceRes.data || []);
      setSubscription(subRes.data);
    } catch (error) {
      console.error('Error fetching evidence:', error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getEvidenceIcon = (type) => {
    switch (type) {
      case 'audio': return <Radio className="w-6 h-6 text-purple-400" />;
      case 'video': return <FileVideo className="w-6 h-6 text-blue-400" />;
      case 'photo': return <Image className="w-6 h-6 text-tg-safe" />;
      default: return <FileVideo className="w-6 h-6 text-zinc-400" />;
    }
  };

  const copySecureLink = async (evidenceItem) => {
    setCopying(evidenceItem.id);
    try {
      await navigator.clipboard.writeText(evidenceItem.file_url);
      setTimeout(() => setCopying(null), 2000);
    } catch (error) {
      alert('Failed to copy link');
      setCopying(null);
    }
  };

  const filteredEvidence = evidence.filter(item => {
    if (filter === 'all') return true;
    return item.evidence_type === filter;
  });

  const plan = subscription?.plan || 'basic';
  const isPremium = plan !== 'basic';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  // Feature gate for non-premium users
  if (!isPremium) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tg-heading tracking-tight flex items-center gap-3">
            <FileVideo className="w-7 h-7 text-purple-400" />
            Evidence Vault
          </h1>
          <p className="text-zinc-500 mt-1">Securely store emergency evidence</p>
        </div>

        <div className="tg-card p-12 text-center">
          <Lock className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
          <h3 className="text-xl font-semibold mb-2">Premium Feature</h3>
          <p className="text-zinc-500 mb-6 max-w-md mx-auto">
            Evidence Vault is available on Premium and Family plans. 
            Securely store audio recordings, photos, and videos captured during emergencies.
          </p>
          <a
            href="/subscription"
            className="btn btn-primary inline-flex"
          >
            Upgrade to Premium
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="evidence-vault-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tg-heading tracking-tight flex items-center gap-3">
          <FileVideo className="w-7 h-7 text-purple-400" />
          Evidence Vault
        </h1>
        <p className="text-zinc-500 mt-1">Securely stored emergency evidence with SHA-256 verification</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 p-1 bg-zinc-900 rounded-xl">
        {['all', 'audio', 'video', 'photo'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              filter === tab
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-500 hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Evidence List */}
      {filteredEvidence.length === 0 ? (
        <div className="tg-card p-12 text-center">
          <FileVideo className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
          <h3 className="text-lg font-semibold mb-2">No evidence</h3>
          <p className="text-zinc-500">
            {filter === 'all'
              ? 'Evidence captured during emergencies will appear here.'
              : `No ${filter} evidence found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvidence.map((item) => (
            <div
              key={item.id}
              className="tg-card p-5"
              data-testid={`evidence-${item.id}`}
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-800 rounded-xl">
                  {getEvidenceIcon(item.evidence_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold capitalize">{item.evidence_type}</h3>
                    {item.access_restricted && (
                      <Lock className="w-4 h-4 text-zinc-500" />
                    )}
                  </div>
                  <p className="text-sm text-zinc-500">
                    Captured {format(new Date(item.captured_at), 'MMM d, yyyy h:mm a')}
                  </p>
                  <p className="text-xs text-zinc-600 font-mono mt-1 truncate">
                    SHA-256: {item.sha256_hash?.slice(0, 32)}...
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copySecureLink(item)}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Copy link"
                  >
                    {copying === item.id ? (
                      <span className="text-tg-safe text-xs">Copied!</span>
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                  <a
                    href={item.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download className="w-5 h-5" />
                  </a>
                </div>
              </div>

              {item.duration && (
                <div className="mt-3 pt-3 border-t border-zinc-800 text-sm text-zinc-500">
                  Duration: {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="tg-card p-4 bg-purple-500/5 border-purple-500/20">
        <div className="flex gap-3">
          <Lock className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-purple-400">Secure Evidence Storage</p>
            <p className="text-sm text-zinc-400 mt-1">
              All evidence is SHA-256 hashed at capture time for forensic integrity verification.
              Files are access-restricted by default and can be shared via time-limited secure links.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvidenceVault;
