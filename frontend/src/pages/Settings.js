import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Shield, Bell, Lock, Save, Loader2, Eye, EyeOff, Trash2, BellRing, BellOff } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { usePushNotifications } from '../hooks/usePushNotifications';

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const Settings = () => {
  const { api, user, updateUser, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showDuressPin, setShowDuressPin] = useState(false);
  
  // Push notifications hook
  const { 
    isSupported: pushSupported, 
    isSubscribed: pushSubscribed, 
    permission: pushPermission,
    loading: pushLoading,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
    sendTestNotification
  } = usePushNotifications();

  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    blood_group: '',
    medical_conditions: '',
    emergency_note: '',
    resolution_pin: '',
    duress_pin: '',
    kidnap_mode: false,
    sms_fallback: true,
    auto_evidence_capture: false
  });

  const fetchData = useCallback(async () => {
    try {
      const [profileRes, subRes] = await Promise.all([
        api.get('/profile').catch(() => ({ data: null })),
        api.get('/subscription').catch(() => ({ data: { plan: 'basic' } }))
      ]);

      const profileData = profileRes.data?.status === 'no_profile' ? null : profileRes.data;
      setProfile(profileData);
      setSubscription(subRes.data);

      if (profileData) {
        setFormData({
          full_name: profileData.full_name || user?.full_name || '',
          phone_number: profileData.phone_number || '',
          blood_group: profileData.blood_group || '',
          medical_conditions: profileData.medical_conditions || '',
          emergency_note: profileData.emergency_note || '',
          resolution_pin: '',
          duress_pin: '',
          kidnap_mode: profileData.kidnap_mode || false,
          sms_fallback: profileData.sms_fallback ?? true,
          auto_evidence_capture: profileData.auto_evidence_capture || false
        });
      } else {
        setFormData(prev => ({
          ...prev,
          full_name: user?.full_name || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  }, [api, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);

    try {
      const updateData = { ...formData };
      // Only send PIN if it's been changed
      if (!updateData.resolution_pin) delete updateData.resolution_pin;
      if (!updateData.duress_pin) delete updateData.duress_pin;

      if (profile) {
        await api.put('/profile', updateData);
      } else {
        await api.post('/profile', {
          phone_number: formData.phone_number,
          blood_group: formData.blood_group,
          medical_conditions: formData.medical_conditions,
          emergency_note: formData.emergency_note
        });
      }

      // Update user name if changed
      if (formData.full_name !== user?.full_name) {
        updateUser({ full_name: formData.full_name });
      }

      // Clear PIN fields
      setFormData(prev => ({
        ...prev,
        resolution_pin: '',
        duress_pin: ''
      }));

      alert('Settings saved successfully');
      fetchData();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }
    if (!window.confirm('All your data will be permanently deleted. Continue?')) {
      return;
    }

    // In production, would call delete endpoint
    alert('Account deletion requested. Contact support to complete.');
  };

  const plan = subscription?.plan || 'basic';
  const isPremium = plan !== 'basic';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="settings-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tg-heading tracking-tight flex items-center gap-3">
          <User className="w-7 h-7 text-tg-safe" />
          Settings
        </h1>
        <p className="text-zinc-500 mt-1">Manage your profile and preferences</p>
      </div>

      {/* Personal Information */}
      <div className="tg-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-zinc-400" />
          Personal Information
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Full Name</label>
            <Input
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="bg-zinc-800 border-zinc-700"
              data-testid="settings-name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Phone Number</label>
            <Input
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              placeholder="+234 xxx xxx xxxx"
              className="bg-zinc-800 border-zinc-700"
              data-testid="settings-phone"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Blood Group</label>
            <Select
              value={formData.blood_group}
              onValueChange={(value) => setFormData({ ...formData, blood_group: value })}
            >
              <SelectTrigger className="bg-zinc-800 border-zinc-700">
                <SelectValue placeholder="Select blood group" />
              </SelectTrigger>
              <SelectContent>
                {bloodGroups.map((bg) => (
                  <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Medical Conditions</label>
            <Input
              value={formData.medical_conditions}
              onChange={(e) => setFormData({ ...formData, medical_conditions: e.target.value })}
              placeholder="e.g., Allergies, medications"
              className="bg-zinc-800 border-zinc-700"
              data-testid="settings-medical"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Emergency Note</label>
            <Input
              value={formData.emergency_note}
              onChange={(e) => setFormData({ ...formData, emergency_note: e.target.value })}
              placeholder="Additional info for responders"
              className="bg-zinc-800 border-zinc-700"
              data-testid="settings-note"
            />
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="tg-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-zinc-400" />
          Security
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Resolution PIN
              <span className="text-xs text-zinc-500 ml-2">(Used to resolve emergencies)</span>
            </label>
            <div className="relative">
              <Input
                type={showPin ? 'text' : 'password'}
                value={formData.resolution_pin}
                onChange={(e) => setFormData({ ...formData, resolution_pin: e.target.value })}
                placeholder={profile?.resolution_pin_hash ? '••••••' : 'Set a PIN'}
                className="bg-zinc-800 border-zinc-700 pr-10"
                data-testid="settings-pin"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
              >
                {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Duress PIN
              <span className="text-xs text-zinc-500 ml-2">(Silently escalates instead of resolving)</span>
            </label>
            <div className="relative">
              <Input
                type={showDuressPin ? 'text' : 'password'}
                value={formData.duress_pin}
                onChange={(e) => setFormData({ ...formData, duress_pin: e.target.value })}
                placeholder={profile?.duress_pin_hash ? '••••••' : 'Set a duress PIN'}
                className="bg-zinc-800 border-zinc-700 pr-10"
                data-testid="settings-duress-pin"
              />
              <button
                type="button"
                onClick={() => setShowDuressPin(!showDuressPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
              >
                {showDuressPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-tg-warning mt-2">
              If you're forced to resolve an emergency, use this PIN to secretly alert contacts.
            </p>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="tg-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-zinc-400" />
          Preferences
        </h2>

        <div className="space-y-4">
          <div className={`flex items-center justify-between p-4 rounded-xl ${!isPremium ? 'opacity-50' : ''} bg-zinc-800/50`}>
            <div>
              <p className="font-medium">Kidnap Mode</p>
              <p className="text-sm text-zinc-500">Minimal UI + adaptive location pings</p>
            </div>
            <Switch
              checked={formData.kidnap_mode}
              onCheckedChange={(checked) => setFormData({ ...formData, kidnap_mode: checked })}
              disabled={!isPremium}
            />
          </div>

          <div className={`flex items-center justify-between p-4 rounded-xl ${!isPremium ? 'opacity-50' : ''} bg-zinc-800/50`}>
            <div>
              <p className="font-medium">SMS Fallback</p>
              <p className="text-sm text-zinc-500">Send SMS when push notifications fail</p>
            </div>
            <Switch
              checked={formData.sms_fallback}
              onCheckedChange={(checked) => setFormData({ ...formData, sms_fallback: checked })}
              disabled={!isPremium}
            />
          </div>

          <div className={`flex items-center justify-between p-4 rounded-xl ${!isPremium ? 'opacity-50' : ''} bg-zinc-800/50`}>
            <div>
              <p className="font-medium">Auto Evidence Capture</p>
              <p className="text-sm text-zinc-500">Automatically record audio during SOS</p>
            </div>
            <Switch
              checked={formData.auto_evidence_capture}
              onCheckedChange={(checked) => setFormData({ ...formData, auto_evidence_capture: checked })}
              disabled={!isPremium}
            />
          </div>

          {!isPremium && (
            <p className="text-sm text-zinc-500 text-center">
              These features require <a href="/subscription" className="text-tg-safe hover:underline">Premium</a>
            </p>
          )}
        </div>
      </div>

      {/* Push Notifications */}
      <div className="tg-card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BellRing className="w-5 h-5 text-zinc-400" />
          Push Notifications
        </h2>

        <div className="space-y-4">
          {!pushSupported ? (
            <div className="p-4 bg-zinc-800/50 rounded-xl text-center">
              <BellOff className="w-8 h-8 mx-auto mb-2 text-zinc-500" />
              <p className="text-zinc-400">Push notifications are not supported in this browser</p>
              <p className="text-xs text-zinc-500 mt-1">Use Chrome, Edge, or Safari for push support</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-xl">
                <div>
                  <p className="font-medium">Enable Push Notifications</p>
                  <p className="text-sm text-zinc-500">
                    {pushPermission === 'denied' 
                      ? 'Permission denied - enable in browser settings'
                      : 'Receive alerts even when the app is closed'
                    }
                  </p>
                </div>
                <Switch
                  checked={pushSubscribed}
                  onCheckedChange={pushSubscribed ? unsubscribePush : subscribePush}
                  disabled={pushLoading || pushPermission === 'denied'}
                  data-testid="push-toggle"
                />
              </div>

              {pushSubscribed && (
                <Button
                  variant="outline"
                  onClick={() => sendTestNotification('Test Notification', { body: 'This is a test notification from TRACEGUARD' })}
                  className="w-full"
                  data-testid="test-push-btn"
                >
                  <BellRing className="w-4 h-4 mr-2" />
                  Send Test Notification
                </Button>
              )}

              <div className="text-xs text-zinc-500 space-y-1">
                <p>• You'll receive alerts when contacts trigger SOS</p>
                <p>• Trip overdue notifications</p>
                <p>• Safe zone entry/exit alerts</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-tg-safe hover:bg-tg-safe/90 text-black h-12"
        data-testid="save-settings"
      >
        {saving ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Save className="w-5 h-5 mr-2" />
            Save Changes
          </>
        )}
      </Button>

      {/* Danger Zone */}
      <div className="tg-card p-6 bg-tg-danger/5 border-tg-danger/20">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-tg-danger">
          <Lock className="w-5 h-5" />
          Danger Zone
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete Account</p>
              <p className="text-sm text-zinc-500">Permanently delete your account and data</p>
            </div>
            <Button
              variant="outline"
              className="border-tg-danger text-tg-danger hover:bg-tg-danger/10"
              onClick={handleDeleteAccount}
              data-testid="delete-account"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
