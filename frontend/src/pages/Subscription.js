import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Check, Crown, Users, Loader2, AlertTriangle, Building2, X } from 'lucide-react';
import { Button } from '../components/ui/button';

const plans = [
  {
    id: 'basic',
    name: 'Basic',
    price: 0,
    priceDisplay: 'Free',
    period: 'forever',
    description: 'Essential safety features for individuals',
    features: [
      { text: 'SOS emergency alerts', included: true },
      { text: 'Up to 3 trusted contacts', included: true },
      { text: 'Trip monitoring', included: true },
      { text: 'Basic incident tracking', included: true },
      { text: 'Safe zones (3 max)', included: true },
      { text: 'Evidence vault', included: false },
      { text: 'Unlimited contacts', included: false },
      { text: 'SMS fallback alerts', included: false },
      { text: 'Family dashboard', included: false },
      { text: 'Kidnap mode', included: false },
      { text: 'Auto evidence capture', included: false },
    ]
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 2500,
    priceDisplay: '₦2,500',
    period: '/month',
    description: 'Advanced protection for safety-conscious individuals',
    popular: true,
    features: [
      { text: 'Everything in Basic', included: true },
      { text: 'Unlimited trusted contacts', included: true },
      { text: 'Evidence vault storage', included: true },
      { text: 'SMS fallback alerts', included: true },
      { text: 'Unlimited safe zones', included: true },
      { text: 'Kidnap mode', included: true },
      { text: 'Auto evidence capture', included: true },
      { text: 'Priority support', included: true },
      { text: 'Advanced analytics', included: true },
      { text: 'Family dashboard', included: false },
      { text: 'Multi-member tracking', included: false },
    ]
  },
  {
    id: 'family',
    name: 'Family',
    price: 5000,
    priceDisplay: '₦5,000',
    period: '/month',
    description: 'Complete safety for your entire family',
    features: [
      { text: 'Everything in Premium', included: true },
      { text: 'Up to 5 family members', included: true },
      { text: 'Family dashboard', included: true },
      { text: 'Live location sharing', included: true },
      { text: 'Group safety monitoring', included: true },
      { text: 'Family incidents view', included: true },
      { text: 'Member status tracking', included: true },
      { text: 'Shared safe zones', included: true },
      { text: 'Family emergency alerts', included: true },
      { text: 'Dedicated family support', included: true },
    ]
  },
  {
    id: 'corporate',
    name: 'Corporate',
    price: 1500,
    priceDisplay: '₦1,500',
    period: '/employee/month',
    description: 'Enterprise safety for organizations',
    enterprise: true,
    features: [
      { text: 'Everything in Premium', included: true },
      { text: 'Unlimited employees', included: true },
      { text: 'Corporate dashboard', included: true },
      { text: 'Employee location tracking', included: true },
      { text: 'Organization-wide alerts', included: true },
      { text: 'Safety analytics & reports', included: true },
      { text: 'Role-based access control', included: true },
      { text: 'API access', included: true },
      { text: 'Dedicated account manager', included: true },
      { text: 'SLA guarantee', included: true },
    ]
  }
];

const Subscription = () => {
  const { api, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const fetchSubscription = useCallback(async () => {
    try {
      const response = await api.get('/subscription');
      setSubscription(response.data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Handle payment callback
  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    if (reference && !verifying) {
      setVerifying(true);
      api.get(`/subscription/verify/${reference}`)
        .then(response => {
          if (response.data.status === 'success') {
            fetchSubscription();
            window.history.replaceState({}, '', '/subscription');
          }
        })
        .catch(console.error)
        .finally(() => setVerifying(false));
    }
  }, [searchParams, api, fetchSubscription, verifying]);

  const handleSubscribe = async (planId) => {
    if (planId === 'basic') return;
    if (planId === 'corporate') {
      window.location.href = '/corporate';
      return;
    }
    
    setProcessing(planId);

    try {
      const callbackUrl = `${window.location.origin}/subscription`;
      const response = await api.post('/subscription/initialize', {
        plan: planId,
        callback_url: callbackUrl
      });

      if (response.data.authorization_url) {
        window.location.href = response.data.authorization_url;
      }
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to initialize payment');
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You will lose access to premium features.')) {
      return;
    }

    try {
      await api.post('/subscription/cancel');
      fetchSubscription();
    } catch (error) {
      alert('Failed to cancel subscription');
    }
  };

  const currentPlan = subscription?.plan || 'basic';

  if (loading || verifying) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          {verifying && <p className="text-zinc-400">Verifying payment...</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6" data-testid="subscription-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tg-heading tracking-tight flex items-center gap-3">
          <CreditCard className="w-7 h-7 text-tg-safe" />
          Subscription Plans
        </h1>
        <p className="text-zinc-500 mt-1">Choose the plan that's right for you</p>
      </div>

      {/* Current Plan Status */}
      <div className="tg-card p-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${currentPlan !== 'basic' ? 'bg-tg-safe/10' : 'bg-zinc-800'}`}>
            <Crown className={`w-6 h-6 ${currentPlan !== 'basic' ? 'text-tg-safe' : 'text-zinc-500'}`} />
          </div>
          <div>
            <p className="text-sm text-zinc-500">Current Plan</p>
            <p className="text-xl font-bold capitalize">{currentPlan}</p>
          </div>
        </div>
        {subscription?.period_end && currentPlan !== 'basic' && (
          <div className="text-right">
            <p className="text-sm text-zinc-500">Renews on</p>
            <p className="font-medium">{new Date(subscription.period_end).toLocaleDateString()}</p>
          </div>
        )}
      </div>

      {/* Plans Grid */}
      <div className="grid gap-6 lg:grid-cols-4 md:grid-cols-2">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan === plan.id;
          const isDowngrade = (currentPlan === 'family' && ['basic', 'premium'].includes(plan.id)) ||
                             (currentPlan === 'premium' && plan.id === 'basic');

          return (
            <div
              key={plan.id}
              className={`tg-card p-6 relative flex flex-col ${
                plan.popular ? 'border-tg-safe/50 ring-1 ring-tg-safe/30' : 
                plan.enterprise ? 'border-tg-warning/50' : ''
              }`}
              data-testid={`plan-${plan.id}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="badge badge-safe px-3">Most Popular</span>
                </div>
              )}
              {plan.enterprise && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="badge badge-warning px-3">Enterprise</span>
                </div>
              )}

              <div className="text-center mb-6">
                <div className="mb-2">
                  {plan.enterprise ? (
                    <Building2 className="w-8 h-8 mx-auto text-tg-warning" />
                  ) : plan.id === 'family' ? (
                    <Users className="w-8 h-8 mx-auto text-purple-400" />
                  ) : (
                    <Crown className={`w-8 h-8 mx-auto ${plan.popular ? 'text-tg-safe' : 'text-zinc-500'}`} />
                  )}
                </div>
                <h3 className="text-xl font-bold tg-heading">{plan.name}</h3>
                <p className="text-xs text-zinc-500 mt-1">{plan.description}</p>
                <div className="mt-4">
                  <span className="text-3xl font-bold">{plan.priceDisplay}</span>
                  <span className="text-zinc-500 text-sm">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    {feature.included ? (
                      <Check className="w-4 h-4 text-tg-safe flex-shrink-0 mt-0.5" />
                    ) : (
                      <X className="w-4 h-4 text-zinc-600 flex-shrink-0 mt-0.5" />
                    )}
                    <span className={feature.included ? '' : 'text-zinc-600'}>{feature.text}</span>
                  </li>
                ))}
              </ul>

              {isCurrentPlan ? (
                <Button className="w-full" variant="outline" disabled>
                  Current Plan
                </Button>
              ) : plan.id === 'basic' ? (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={currentPlan === 'basic'}
                >
                  {currentPlan === 'basic' ? 'Current Plan' : 'Downgrade'}
                </Button>
              ) : plan.enterprise ? (
                <Button
                  className="w-full bg-tg-warning hover:bg-tg-warning/90 text-black"
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={processing === plan.id}
                  data-testid={`subscribe-${plan.id}`}
                >
                  {processing === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Contact Sales'
                  )}
                </Button>
              ) : (
                <Button
                  className={`w-full ${plan.popular ? 'bg-tg-safe hover:bg-tg-safe/90 text-black' : ''}`}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={processing === plan.id || isDowngrade}
                  data-testid={`subscribe-${plan.id}`}
                >
                  {processing === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isDowngrade ? (
                    'Contact Support'
                  ) : (
                    'Subscribe'
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Family Members (if on family plan) */}
      {currentPlan === 'family' && (
        <div className="tg-card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-tg-safe" />
            Family Members
          </h2>
          <p className="text-zinc-500 text-sm mb-4">
            Manage your family members from the Family Safety page.
          </p>
          <a href="/family" className="btn btn-outline inline-flex">
            Manage Family
          </a>
        </div>
      )}

      {/* Payment Info */}
      <div className="tg-card p-4 bg-zinc-800/30">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-zinc-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-zinc-500">
            <p className="font-medium text-zinc-400 mb-1">Payment Information</p>
            <ul className="space-y-1">
              <li>• Payments processed securely via Paystack</li>
              <li>• Subscriptions renew automatically every 30 days</li>
              <li>• Cancel anytime from this page</li>
              <li>• Contact support for refunds within 7 days</li>
              <li>• Corporate plans billed per employee</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Subscription;
