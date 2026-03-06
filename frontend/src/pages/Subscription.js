import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Check, Crown, Users, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/button';

const plans = [
  {
    id: 'basic',
    name: 'Basic',
    price: 0,
    period: 'Free forever',
    features: [
      'SOS emergency alerts',
      'Up to 3 trusted contacts',
      'Trip monitoring',
      'Basic incident tracking'
    ],
    notIncluded: [
      'Evidence vault',
      'Unlimited contacts',
      'SMS fallback',
      'Family dashboard'
    ]
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 2500,
    period: 'per month',
    popular: true,
    features: [
      'Everything in Basic',
      'Unlimited trusted contacts',
      'Evidence vault storage',
      'SMS fallback alerts',
      'Kidnap mode',
      'Auto evidence capture',
      'Priority support'
    ]
  },
  {
    id: 'family',
    name: 'Family',
    price: 5000,
    period: 'per month',
    features: [
      'Everything in Premium',
      'Up to 5 family members',
      'Family dashboard',
      'Live location sharing',
      'Group safety monitoring',
      'Family incidents view'
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
    <div className="max-w-5xl mx-auto space-y-6" data-testid="subscription-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tg-heading tracking-tight flex items-center gap-3">
          <CreditCard className="w-7 h-7 text-tg-safe" />
          Subscription
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
            <p className="text-lg font-semibold capitalize">{currentPlan}</p>
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
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan === plan.id;
          const isDowngrade = (currentPlan === 'family' && plan.id !== 'family') ||
                             (currentPlan === 'premium' && plan.id === 'basic');

          return (
            <div
              key={plan.id}
              className={`tg-card p-6 relative ${plan.popular ? 'border-tg-safe/50' : ''}`}
              data-testid={`plan-${plan.id}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="badge badge-safe px-3">Most Popular</span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold tg-heading">{plan.name}</h3>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    {plan.price === 0 ? 'Free' : `₦${plan.price.toLocaleString()}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-zinc-500 ml-2">{plan.period}</span>
                  )}
                </div>
                {plan.price === 0 && (
                  <p className="text-sm text-zinc-500 mt-1">{plan.period}</p>
                )}
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Check className="w-5 h-5 text-tg-safe flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
                {plan.notIncluded?.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-zinc-600">
                    <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">—</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {isCurrentPlan ? (
                <Button
                  className="w-full"
                  variant="outline"
                  disabled
                >
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
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Subscription;
