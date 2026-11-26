import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload
} from 'firebase/messaging';
import { auth } from '../lib/firebase';
import firebaseApp, { firebaseConfig } from '../lib/firebase';
import type { RdrInAppNotification } from '../types';

const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
const vapidKey = String(import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim();

function requirePushConfiguration(): void {
  if (!apiBaseUrl) {
    throw new Error('The RDR API URL is not configured.');
  }
  if (!vapidKey) {
    throw new Error('Add VITE_FIREBASE_VAPID_KEY to the frontend environment before enabling notifications.');
  }
}

function firebaseConfigForWorker(): Record<string, string> {
  return {
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId
  };
}

async function getMessagingServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const config = firebaseConfigForWorker();
  const workerUrl = new URL('/sw.js', window.location.origin);
  workerUrl.searchParams.set('firebaseConfig', JSON.stringify(config));

  const registration = await navigator.serviceWorker.register(workerUrl.toString(), {
    scope: '/',
    updateViaCache: 'none'
  });

  const worker = registration.installing || registration.waiting;
  if (worker) {
    await new Promise<void>((resolve, reject) => {
      const checkState = () => {
        if (worker.state === 'activated') {
          worker.removeEventListener('statechange', checkState);
          resolve();
        } else if (worker.state === 'redundant') {
          worker.removeEventListener('statechange', checkState);
          reject(new Error('The RDR notification service worker could not be activated.'));
        }
      };

      worker.addEventListener('statechange', checkState);
      checkState();
    });
  }

  return registration;
}

async function sendTokenToBackend(method: 'POST' | 'DELETE', token: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sign in to RDR before enabling notifications.');
  }

  const idToken = await user.getIdToken();
  const response = await fetch(`${apiBaseUrl}/api/push-subscriptions`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({ token })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || 'RDR could not save the notification setting.');
  }
}

async function requestInAppNotifications<T>(
  path: string,
  method: 'GET' | 'POST' = 'GET'
): Promise<T> {
  if (!apiBaseUrl) throw new Error('The RDR API URL is not configured.');
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to RDR to view notifications.');

  const idToken = await user.getIdToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || 'RDR could not load your notifications.');
  }
  return result as T;
}

export async function getInAppNotifications(): Promise<RdrInAppNotification[]> {
  const result = await requestInAppNotifications<{ items?: RdrInAppNotification[] }>(
    '/api/notifications'
  );
  return Array.isArray(result.items) ? result.items : [];
}

export async function markInAppNotificationRead(notificationId: string): Promise<void> {
  await requestInAppNotifications(
    `/api/notifications/${encodeURIComponent(notificationId)}/read`,
    'POST'
  );
}

export async function markAllInAppNotificationsRead(): Promise<void> {
  await requestInAppNotifications('/api/notifications/read-all', 'POST');
}

export async function registerPushNotifications(): Promise<void> {
  requirePushConfiguration();

  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    throw new Error('This browser does not support RDR push notifications.');
  }
  if (Notification.permission !== 'granted') {
    throw new Error('Allow notifications in your browser before continuing.');
  }
  if (!(await isSupported())) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  const registration = await getMessagingServiceWorkerRegistration();
  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration
  });

  if (!token) {
    throw new Error('RDR could not create a notification subscription for this device.');
  }

  await sendTokenToBackend('POST', token);
}

export async function removePushNotifications(): Promise<void> {
  if (!vapidKey || !auth.currentUser || !('serviceWorker' in navigator)) return;

  let messaging: ReturnType<typeof getMessaging> | null = null;
  try {
    if (!(await isSupported())) return;
    const registration = await getMessagingServiceWorkerRegistration();
    messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration
    });

    if (token) {
      await sendTokenToBackend('DELETE', token);
    }
  } finally {
    if (messaging) {
      await deleteToken(messaging).catch(() => false);
    }
  }
}

export async function listenForForegroundPush(
  onNotification: (payload: MessagePayload) => void
): Promise<() => void> {
  if (!(await isSupported())) return () => undefined;
  return onMessage(getMessaging(firebaseApp), onNotification);
}
