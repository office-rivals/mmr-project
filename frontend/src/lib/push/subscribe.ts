import { env as publicEnv } from '$env/dynamic/public';

export type PushSupportState =
  | 'unsupported'
  | 'denied'
  | 'default'
  | 'subscribed'
  | 'unsubscribed';

export interface PushPermissionSnapshot {
  state: PushSupportState;
  permission: NotificationPermission | 'unsupported';
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPermissionSnapshot(): PushPermissionSnapshot {
  if (!isPushSupported()) {
    return { state: 'unsupported', permission: 'unsupported' };
  }
  const permission = Notification.permission;
  if (permission === 'denied') return { state: 'denied', permission };
  if (permission === 'granted') return { state: 'subscribed', permission };
  return { state: 'default', permission };
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  return navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; ++i) {
    buffer[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

export async function subscribe(): Promise<PushSubscription | null> {
  const registration = await ensureServiceWorker();
  if (!registration) throw new Error('Push notifications are not supported in this browser');

  const vapidKey = publicEnv.PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) throw new Error('VAPID public key is not configured');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted');
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Browser produced a malformed push subscription');
  }

  await fetch('/api/v3/me/push/subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256DH: json.keys.p256dh, auth: json.keys.auth },
      userAgent: navigator.userAgent,
    }),
  });

  return subscription;
}

export async function unsubscribe(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration('/service-worker.js');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  await fetch(`/api/v3/me/push/subscription?endpoint=${encodeURIComponent(endpoint)}`, {
    method: 'DELETE',
  });
}

export async function checkSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration('/service-worker.js');
  return Boolean(await registration?.pushManager.getSubscription());
}