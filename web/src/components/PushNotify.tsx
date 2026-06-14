'use client';

import { useEffect } from 'react';
import { Bell } from 'lucide-react';

export default function PushNotify() {
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      new Notification('Shopping Assistant', {
        body: 'Vous recevrez des alertes de prix !',
        icon: '/favicon.ico',
      });
    }
  };

  return (
    <button
      type="button"
      onClick={requestPermission}
      className="btn-ghost !px-2 !py-1 text-xs"
      title="Activer les notifications d'alerte prix"
    >
      <Bell className="h-3 w-3" />
      Alertes
    </button>
  );
}