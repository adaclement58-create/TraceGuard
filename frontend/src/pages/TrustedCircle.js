import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, Trash2, Phone, Mail, AlertTriangle, Crown, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const TrustedCircle = () => {
  const { api } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'contact',
    relationship: '',
    notification_preference: 'both'
  });

  const fetchData = useCallback(async () => {
    try {
      const [contactsRes, subRes] = await Promise.all([
        api.get('/contacts'),
        api.get('/subscription').catch(() => ({ data: { plan: 'basic' } }))
      ]);
      setContacts(contactsRes.data || []);
      setSubscription(subRes.data);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddContact = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await api.post('/contacts', newContact);
      setContacts([...contacts, response.data]);
      setNewContact({
        name: '',
        phone: '',
        email: '',
        role: 'contact',
        relationship: '',
        notification_preference: 'both'
      });
      setDialogOpen(false);
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to add contact');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (!window.confirm('Are you sure you want to remove this contact?')) return;
    setDeleting(contactId);

    try {
      await api.delete(`/contacts/${contactId}`);
      setContacts(contacts.filter(c => c.id !== contactId));
    } catch (error) {
      alert('Failed to delete contact');
    } finally {
      setDeleting(null);
    }
  };

  const plan = subscription?.plan || 'basic';
  const contactLimit = plan === 'basic' ? 3 : Infinity;
  const isAtLimit = contacts.length >= contactLimit;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="trusted-circle-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tg-heading tracking-tight flex items-center gap-3">
            <Users className="w-7 h-7 text-tg-safe" />
            Trusted Circle
          </h1>
          <p className="text-zinc-500 mt-1">Manage your emergency contacts</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-tg-safe hover:bg-tg-safe/90 text-black"
              disabled={isAtLimit}
              data-testid="add-contact-btn"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800">
            <DialogHeader>
              <DialogTitle>Add Trusted Contact</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddContact} className="space-y-4 pt-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Name *</label>
                <Input
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  placeholder="Contact name"
                  className="bg-zinc-800 border-zinc-700"
                  required
                  data-testid="contact-name-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Phone *</label>
                <Input
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  placeholder="+234 xxx xxx xxxx"
                  className="bg-zinc-800 border-zinc-700"
                  required
                  data-testid="contact-phone-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Email</label>
                <Input
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="contact@email.com"
                  className="bg-zinc-800 border-zinc-700"
                  data-testid="contact-email-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Role</label>
                <Select
                  value={newContact.role}
                  onValueChange={(value) => setNewContact({ ...newContact, role: value })}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contact">Contact</SelectItem>
                    <SelectItem value="family">Family</SelectItem>
                    <SelectItem value="friend">Friend</SelectItem>
                    <SelectItem value="medical">Medical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Notification Preference</label>
                <Select
                  value={newContact.notification_preference}
                  onValueChange={(value) => setNewContact({ ...newContact, notification_preference: value })}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">SMS Only</SelectItem>
                    <SelectItem value="push">Email Only</SelectItem>
                    <SelectItem value="both">Both SMS & Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-tg-safe hover:bg-tg-safe/90 text-black"
                  disabled={saving}
                  data-testid="save-contact-btn"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Contact'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Upgrade Banner */}
      {plan === 'basic' && (
        <div className="tg-card p-4 border-tg-warning/30 bg-tg-warning/5">
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 text-tg-warning" />
            <div className="flex-1">
              <p className="font-medium text-tg-warning">Free Plan Limit</p>
              <p className="text-sm text-zinc-400">
                {contacts.length}/{contactLimit} contacts used. Upgrade to Premium for unlimited contacts.
              </p>
            </div>
            <Button
              variant="outline"
              className="border-tg-warning text-tg-warning hover:bg-tg-warning/10"
              onClick={() => window.location.href = '/subscription'}
            >
              Upgrade
            </Button>
          </div>
        </div>
      )}

      {/* Contacts List */}
      {contacts.length === 0 ? (
        <div className="tg-card p-12 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
          <h3 className="text-lg font-semibold mb-2">No contacts yet</h3>
          <p className="text-zinc-500 mb-4">Add trusted contacts who will be notified in emergencies</p>
          <Button
            className="bg-tg-safe hover:bg-tg-safe/90 text-black"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Your First Contact
          </Button>
        </div>
      ) : (
        <div className="space-y-3" data-testid="trusted-circle-list">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="tg-card p-4 flex items-center gap-4 hover:border-zinc-700 transition-colors"
              data-testid={`contact-${contact.id}`}
            >
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-semibold text-zinc-300">
                  {contact.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{contact.name}</h3>
                  <span className="badge badge-safe text-xs">{contact.role}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-500 mt-1">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {contact.phone}
                  </span>
                  {contact.email && (
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3" />
                      {contact.email}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDeleteContact(contact.id)}
                disabled={deleting === contact.id}
                className="p-2 text-zinc-500 hover:text-tg-danger hover:bg-tg-danger/10 rounded-lg transition-colors"
                data-testid={`delete-contact-${contact.id}`}
              >
                {deleting === contact.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Info Card */}
      <div className="tg-card p-4 bg-blue-500/5 border-blue-500/20">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-400">How it works</p>
            <p className="text-sm text-zinc-400 mt-1">
              When you activate SOS, all your trusted contacts will receive immediate SMS and email notifications
              with your location and emergency details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrustedCircle;
