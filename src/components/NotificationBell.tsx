import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { listMerchantNotifications, markNotificationsRead, type NotificationRow } from '../lib/db';

export function NotificationBell() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listMerchantNotifications()
      .then(({ items, readIds }) => { setItems(items); setReadIds(readIds); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const unread = items.filter((i) => !readIds.has(i.id)).length;

  const toggle = async () => {
    const wasOpen = open;
    setOpen(!wasOpen);
    if (!wasOpen && unread > 0 && user) {
      const ids = items.filter((i) => !readIds.has(i.id)).map((i) => i.id);
      setReadIds(new Set([...readIds, ...ids])); // optimistic
      try { await markNotificationsRead(ids, user.id); } catch { /* ignore */ }
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative p-2 rounded-md border notion-border bg-white hover:bg-[#F7F7F5] transition" aria-label={t('dash.notif.ariaLabel', { defaultValue: 'Notifications' })}>
        <Bell className="w-4 h-4 text-gray-600" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 md:left-auto md:right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] max-h-96 overflow-y-auto rounded-xl border notion-border bg-white shadow-lg z-50">
          <div className="px-4 py-2.5 border-b notion-border text-xs font-bold uppercase tracking-wider text-gray-500">{t('dash.notif.title', { defaultValue: 'Notifications' })}</div>
          {items.length === 0 && <div className="px-4 py-6 text-sm text-gray-400 text-center">{t('dash.notif.empty', { defaultValue: 'Nothing new right now.' })}</div>}
          {items.map((n) => (
            <div key={n.id} className="px-4 py-3 border-b notion-border last:border-0">
              <div className="text-sm font-semibold text-[#37352F]">{n.title}</div>
              <div className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{n.body}</div>
              <div className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
