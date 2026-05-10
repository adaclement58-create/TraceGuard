import { useState, useEffect, useCallback } from 'react';

const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const API_URL = process.env.REACT_APP_BACKEND_URL;

// Helper to safely get token
const getStoredToken = () => {
  try {
    return localStorage.getItem('tg_token');
  } catch {
    return null;
  }
};

// Convert base64 to Uint8Array for VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [subscription, setSubscription] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState('default');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if push notifications are supported
  useEffect(() => {
    const checkSupport = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
        setIsSupported(true);
        setPermission(Notification.permission);

        // Check existing subscription
        try {
          const registration = await navigator.serviceWorker.ready;
          const existingSubscription = await registration.pushManager.getSubscription();
          if (existingSubscription) {
            setSubscription(existingSubscription);
            setIsSubscribed(true);
          }
        } catch (err) {
          console.error('Error checking subscription:', err);
        }
      }
    };

    checkSupport();
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError('Push notifications are not supported in this browser');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Request notification permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      setSubscription(pushSubscription);
      setIsSubscribed(true);

      // Send subscription to backend
      const token = getStoredToken();
      if (token) {
        await fetch(`${API_URL}/api/push/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            subscription: pushSubscription.toJSON()
          })
        });
      }

      return pushSubscription;
    } catch (err) {
      console.error('Error subscribing to push:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!subscription) return;

    setLoading(true);
    setError(null);

    try {
      await subscription.unsubscribe();
      setSubscription(null);
      setIsSubscribed(false);

      // Notify backend
      const token = getStoredToken();
      if (token) {
        await fetch(`${API_URL}/api/push/unsubscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (err) {
      console.error('Error unsubscribing:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [subscription]);

  // Send a local notification (for testing)
  const sendTestNotification = useCallback(async (title, options = {}) => {
    if (permission !== 'granted') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') return;
    }

    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body: options.body || 'Test notification from TRACEGUARD',
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: 'traceguard-test',
      requireInteraction: true,
      ...options
    });
  }, [permission]);

  return {
    isSupported,
    isSubscribed,
    permission,
    loading,
    error,
    subscribe,
    unsubscribe,
    sendTestNotification
  };
}

export default usePushNotifications;
