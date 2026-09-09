import { useEffect, useState } from 'react';
import { unsubscribeByToken } from '../lib/db';
import { useTranslation } from 'react-i18next';

/**
 * Public one-click unsubscribe target for marketing emails
 * (stampfix.app/unsubscribe?t=<token>). No login required — the token is the
 * authorisation. Suppresses future marketing for that card.
 */
export function Unsubscribe() {
  const { t } = useTranslation();
  const [state, setState] = useState<'loading' | 'done' | 'notfound' | 'error'>('loading');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('t');
    if (!token) { setState('notfound'); return; }
    unsubscribeByToken(token)
      .then((ok) => setState(ok ? 'done' : 'notfound'))
      .catch(() => setState('error'));
  }, []);

  const Mark = () => (
    <svg viewBox="0 0 290 90" className="h-6 w-auto mx-auto mb-6" fill="#37352F" aria-hidden="true">
      <rect x="8" y="12" width="66" height="66" rx="4" />
      <circle cx="140" cy="45" r="34" />
      <rect x="195" y="36" width="90" height="18" rx="9" transform="rotate(45 240 45)" />
      <rect x="195" y="36" width="90" height="18" rx="9" transform="rotate(-45 240 45)" />
    </svg>
  );

  const messages = {
    loading: { h: t('cust.unsubscribe.loadingH', { defaultValue: 'One moment…' }), p: t('cust.unsubscribe.loadingP', { defaultValue: 'Updating your preferences.' }) },
    done: { h: t('cust.unsubscribe.doneH', { defaultValue: 'You’re unsubscribed' }), p: t('cust.unsubscribe.doneP', { defaultValue: 'You will no longer receive marketing emails for this card. You’ll still get essential messages about your card. Changed your mind? Just sign up again next time you visit.' }) },
    notfound: { h: t('cust.unsubscribe.notfoundH', { defaultValue: 'Link not recognised' }), p: t('cust.unsubscribe.notfoundP', { defaultValue: 'This unsubscribe link is invalid or has expired. If you keep receiving emails you don’t want, reply to one of them and we’ll remove you.' }) },
    error: { h: t('cust.unsubscribe.errorH', { defaultValue: 'Something went wrong' }), p: t('cust.unsubscribe.errorP', { defaultValue: 'We couldn’t update your preferences just now. Please try again in a moment.' }) },
  }[state];

  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
      <div className="max-w-sm">
        <Mark />
        <h1 className="text-2xl font-serif-display font-semibold text-[#37352F]">{messages.h}</h1>
        <p className="mt-3 text-sm text-gray-500 leading-relaxed">{messages.p}</p>
        <a href="/" className="inline-block mt-6 text-sm underline text-[#37352F]">{t('cust.unsubscribe.backStampfix', { defaultValue: 'Back to Stampfix' })}</a>
      </div>
    </main>
  );
}
