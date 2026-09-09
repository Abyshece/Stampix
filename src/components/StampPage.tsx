import { useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { selfServeStamp } from '../lib/db';
import { playScanSound } from '../lib/scanSounds';
import { useTranslation } from 'react-i18next';

type Phase = 'locating' | 'stamping' | 'success' | 'need_identity' | 'ask_more' | 'pick_count' | 'ask_code' | 'error';

const ERR: Record<string, string> = {
  self_serve_off: "This shop isn't using self-serve stamps right now.",
  too_far: "Hmm, that didn't work. Please try again, or ask a staff member if it keeps happening.",
  no_location: "This shop hasn't set its location yet, so we can't confirm you're here.",
  daily_cap: "You've already collected your stamp for today. See you next time!",
  cooldown: "You just got a stamp — please wait a little before the next one.",
  card_inactive: "This card isn't active.",
  card_full: "Your card is already full — show it at the counter to claim your reward!",
  not_found: "We couldn't find this shop.",
  card_not_found: "We couldn't find your card.",
  invalid: "This stamp link is invalid.",
  no_geo: "Your browser can't share location, which is needed to get a stamp.",
  denied: "Please allow location access — it confirms you're at the shop.",
  network: "Couldn't reach the server. Check your connection and try again.",
};

const CONFETTI_COLORS = ['#EA3323', '#F7CE46', '#1132F5', '#75FBFD', '#EA33B6', '#510AF5', '#75FBE2', '#F0A479'];

/** Same confetti rain as the merchant scan celebration; runs for 8 seconds. */
function StampConfetti() {
  const pieces = useMemo(
    () => Array.from({ length: 80 }, (_, i) => {
      const duration = 2.3 + Math.random() * 1.9;
      return {
        id: i, left: Math.random() * 100, delay: -(Math.random() * duration), duration,
        size: 7 + Math.random() * 9, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: Math.random() * 360, round: Math.random() > 0.5,
      };
    }),
    [],
  );
  const [on, setOn] = useState(true);
  useEffect(() => { const t = setTimeout(() => setOn(false), 8000); return () => clearTimeout(t); }, []);
  if (!on) return null;
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-50">
      <style>{`@keyframes stamp-fall { 0%{transform:translateY(-14vh) rotate(0);opacity:0} 8%{opacity:1} 100%{transform:translateY(112vh) rotate(720deg);opacity:1} }`}</style>
      {pieces.map((p) => (
        <span key={p.id} style={{ position: 'absolute', top: 0, left: `${p.left}%`, width: p.size, height: p.size, background: p.color, borderRadius: p.round ? '50%' : 2, transform: `rotate(${p.rotate}deg)`, animation: `stamp-fall ${p.duration}s linear ${p.delay}s infinite` }} />
      ))}
    </div>
  );
}

function CountWheel({ max, value, onChange }: { max: number; value: number; onChange: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const ITEM = 56;
  const nums = useMemo(() => Array.from({ length: Math.max(max, 1) }, (_, i) => i + 1), [max]);
  const onScroll = () => {
    const el = ref.current; if (!el) return;
    const n = Math.min(Math.max(max, 1), Math.max(1, Math.round(el.scrollTop / ITEM) + 1));
    if (n !== value) onChange(n);
  };
  return (
    <div className="relative h-[168px] w-28 mx-auto">
      <style>{`.cw::-webkit-scrollbar{display:none}`}</style>
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-14 rounded-xl bg-[#F7F7F5] pointer-events-none" />
      <div ref={ref} onScroll={onScroll} className="cw h-full overflow-y-scroll snap-y snap-mandatory relative" style={{ scrollbarWidth: 'none' }}>
        <div style={{ height: ITEM }} />
        {nums.map((n) => (
          <div key={n} style={{ height: ITEM }} className={`snap-center flex items-center justify-center text-3xl font-bold ${n === value ? 'text-[#37352F]' : 'text-gray-300'}`}>{n}</div>
        ))}
        <div style={{ height: ITEM }} />
      </div>
    </div>
  );
}

function StampShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FBFBFA] flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex items-center gap-2 mb-8 text-[#37352F]">
        <span className="w-3 h-3 bg-[#37352F]" />
        <span className="w-3 h-3 bg-[#37352F] rounded-full" />
        <span className="font-bold text-lg leading-none">&#10005;</span>
      </div>
      {children}
    </div>
  );
}

export function StampPage() {
  const { t } = useTranslation();
  const params = new URLSearchParams(window.location.search);
  const campaignId = (params.get('campaign') ?? '').trim();
  const locationId = (params.get('location') ?? '').trim();

  const [phase, setPhase] = useState<Phase>('locating');
  const [errKey, setErrKey] = useState('');
  const [errExtra, setErrExtra] = useState('');
  const [result, setResult] = useState<{ currentStamps: number; maxStamps: number } | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [retry, setRetry] = useState(0);
  const [count, setCount] = useState(1);
  const [multiCode, setMultiCode] = useState('');
  const [codeError, setCodeError] = useState('');

  const attempt = useCallback(async (withIdentity: boolean) => {
    if (!coords) return;
    setPhase('stamping');
    setSubmitting(true);
    try {
      const r = await selfServeStamp(
        campaignId, locationId, coords.lat, coords.lng,
        withIdentity ? email.trim() : undefined,
      );
      if (r.ok) {
        setResult({ currentStamps: r.currentStamps ?? 0, maxStamps: r.maxStamps ?? 0 });
        setPhase('success'); playScanSound('stamp');
      } else if (r.error === 'card_not_found' && !withIdentity) {
        setPhase('need_identity');
      } else if (r.error === 'cooldown') {
        setResult({ currentStamps: r.currentStamps ?? 0, maxStamps: r.maxStamps ?? 0 }); setPhase('ask_more');
      } else {
        setErrKey(r.error ?? 'network');
        setErrExtra('');
        setPhase('error');
      }
    } catch (e) {
      setErrKey('network'); setErrExtra(e instanceof Error ? ': ' + e.message : ''); setPhase('error');
    } finally {
      setSubmitting(false);
    }
  }, [coords, campaignId, locationId, email]);

  const attemptMulti = async () => {
    if (!coords) return;
    setSubmitting(true); setCodeError('');
    try {
      const r = await selfServeStamp(campaignId, locationId, coords.lat, coords.lng, email.trim() || undefined, multiCode.trim(), count);
      if (r.ok || r.error === 'card_full') { setResult({ currentStamps: r.currentStamps ?? 0, maxStamps: r.maxStamps ?? 0 }); setPhase('success'); playScanSound(r.error === 'card_full' ? 'last' : 'stamp'); }
      else if (r.error === 'bad_code') { setCodeError(t('cust.stamp.badCode', { defaultValue: "That code isn't right — ask the cashier again." })); }
      else if (r.error === 'no_code_set') { setCodeError(t('cust.stamp.noCodeSet', { defaultValue: "This shop hasn't set a code yet." })); }
      else { setErrKey(r.error ?? 'network'); setErrExtra(''); setPhase('error'); }
    } catch (e) { setErrKey('network'); setErrExtra(e instanceof Error ? ': ' + e.message : ''); setPhase('error'); }
    finally { setSubmitting(false); }
  };
  const remaining = result ? Math.max(1, result.maxStamps - result.currentStamps) : 9;

  // Request GPS on mount and on each retry.
  useEffect(() => {
    if (!campaignId || !locationId) { setErrKey('invalid'); setPhase('error'); return; }
    if (!('geolocation' in navigator)) { setErrKey('no_geo'); setPhase('error'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { setErrKey('denied'); setPhase('error'); },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }, [campaignId, locationId, retry]);

  // Auto-attempt (signed-in path) once we have coordinates.
  useEffect(() => {
    if (coords && phase === 'locating') void attempt(false);
  }, [coords, phase, attempt]);

  const tryAgain = () => { setErrKey(''); setCoords(null); setPhase('locating'); setRetry((r) => r + 1); };

  if (phase === 'locating' || phase === 'stamping') {
    return (
      <StampShell>
        <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-[#37352F] rounded-full mb-4" />
        <p className="text-gray-500">{phase === 'locating' ? t('cust.stamp.locating', { defaultValue: "Checking you're at the shop…" }) : t('cust.stamp.stamping', { defaultValue: 'Adding your stamp…' })}</p>
      </StampShell>
    );
  }

  if (phase === 'success' && result) {
    const full = result.currentStamps >= result.maxStamps;
    const dots = Array.from({ length: Math.max(result.maxStamps, 1) }, (_, i) => i < result.currentStamps);
    return (
      <StampShell>
        <StampConfetti />
        <div className="text-6xl mb-2 animate-bounce">🎉</div>
        <h1 className="text-2xl font-serif-display font-semibold mb-1">{t('cust.stamp.added', { defaultValue: 'Stamp added!' })}</h1>
        <p className="text-gray-500 mb-5">{full ? t('cust.stamp.cardFull', { defaultValue: 'Your card is full — claim your reward!' }) : t('cust.stamp.ofStamps', { current: result.currentStamps, max: result.maxStamps, defaultValue: '{{current}} of {{max}} stamps' })}</p>
        <div className="flex flex-wrap justify-center gap-2 max-w-[240px] mb-8">
          {dots.map((f, i) => (
            <span key={i} className={`w-6 h-6 rounded-full border-2 ${f ? 'bg-[#37352F] border-[#37352F]' : 'border-gray-300'}`} />
          ))}
        </div>
        {(result && result.currentStamps < result.maxStamps) && (
          <button onClick={() => { setCount(1); setMultiCode(''); setCodeError(''); setPhase('pick_count'); }} className="text-sm text-[#37352F] underline mb-4">{t('cust.stamp.boughtMultiple', { defaultValue: 'Bought multiple orders? Add more stamps' })}</button>
        )}
        <a href={email.trim() ? `/my-card?e=${encodeURIComponent(email.trim())}` : '/my-card'} className="bg-[#37352F] text-white px-6 py-3 rounded-lg font-medium hover:bg-opacity-90 transition">{t('cust.stamp.viewSave', { defaultValue: 'View & save your card' })}</a>
        <p className="text-xs text-gray-400 mt-3 max-w-xs">{t('cust.stamp.saveHint', { defaultValue: 'Save it to Apple or Google Wallet so it updates on its own next time.' })}</p>
      </StampShell>
    );
  }

  if (phase === 'need_identity') {
    return (
      <StampShell>
        <h1 className="text-xl font-serif-display font-semibold mb-1">{t('cust.stamp.quickCheck', { defaultValue: 'One quick check' })}</h1>
        <p className="text-gray-500 mb-5 max-w-xs">{t('cust.stamp.confirmEmail', { defaultValue: 'Just confirm the email you signed up with to collect your stamp.' })}</p>
        <div className="w-full max-w-xs space-y-3">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={t('cust.stamp.emailPh', { defaultValue: 'you@email.com' })}
            className="w-full border notion-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300" />
          <button onClick={() => void attempt(true)} disabled={submitting || !email.trim()}
            className="w-full bg-[#37352F] text-white py-3 rounded-lg font-medium disabled:opacity-50 hover:bg-opacity-90 transition">
            {t('cust.stamp.getStamp', { defaultValue: 'Get my stamp' })}
          </button>
        </div>
      </StampShell>
    );
  }

  if (phase === 'ask_more') {
    return (
      <StampShell>
        <div className="text-5xl mb-3">🧾</div>
        <h1 className="text-xl font-serif-display font-semibold mb-1">{t('cust.stamp.alreadyStamped', { defaultValue: 'Already stamped' })}</h1>
        <p className="text-gray-500 mb-6 max-w-xs">{t('cust.stamp.boughtMoreQ', { defaultValue: 'Did you buy more than one? Add the extra stamps for this order.' })}</p>
        <div className="w-full max-w-xs space-y-2">
          <button onClick={() => { setCount(1); setMultiCode(''); setCodeError(''); setPhase('pick_count'); }} className="w-full bg-[#37352F] text-white py-3 rounded-lg font-medium">{t('cust.stamp.yesMultiple', { defaultValue: 'Yes, bought multiple' })}</button>
          <button onClick={() => setPhase('success')} className="w-full text-gray-500 py-2 text-sm">{t('cust.stamp.noThatsAll', { defaultValue: "No, that's all" })}</button>
        </div>
      </StampShell>
    );
  }

  if (phase === 'pick_count') {
    return (
      <StampShell>
        <h1 className="text-xl font-serif-display font-semibold mb-1">{t('cust.stamp.howManyMore', { defaultValue: 'How many more stamps?' })}</h1>
        <p className="text-gray-500 mb-4 max-w-xs">{t('cust.stamp.onePerItem', { defaultValue: 'One per item you bought in this order.' })}</p>
        <CountWheel max={remaining} value={count} onChange={setCount} />
        <button onClick={() => setPhase('ask_code')} className="mt-6 bg-[#37352F] text-white px-8 py-3 rounded-lg font-medium">{t('cust.stamp.next', { defaultValue: 'Next' })}</button>
      </StampShell>
    );
  }

  if (phase === 'ask_code') {
    return (
      <StampShell>
        <h1 className="text-xl font-serif-display font-semibold mb-1">{t('cust.stamp.askCode', { defaultValue: 'Ask the cashier for the code' })}</h1>
        <p className="text-gray-500 mb-5 max-w-xs">{t(`cust.stamp.enterCode${count > 1 ? 'Other' : 'One'}`, { count, defaultValue: count > 1 ? 'Enter the 4-digit code from the counter to add {{count}} stamps.' : 'Enter the 4-digit code from the counter to add {{count}} stamp.' })}</p>
        <div className="w-full max-w-xs space-y-3">
          <input value={multiCode} onChange={(e) => setMultiCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} inputMode="numeric" placeholder={t('cust.stamp.codePh', { defaultValue: '4-digit code' })} className="w-full border notion-border rounded-lg px-4 py-3 text-center text-2xl tracking-[0.4em]" />
          {codeError && <p className="text-xs text-red-600">{codeError}</p>}
          <button onClick={() => void attemptMulti()} disabled={submitting || multiCode.length !== 4} className="w-full bg-[#37352F] text-white py-3 rounded-lg font-medium disabled:opacity-40">{submitting ? t('cust.stamp.adding', { defaultValue: 'Adding…' }) : t('cust.stamp.addStamps', { defaultValue: 'Add stamps' })}</button>
          <button onClick={() => setPhase('pick_count')} className="w-full text-gray-500 py-2 text-sm">{t('cust.stamp.back', { defaultValue: 'Back' })}</button>
        </div>
      </StampShell>
    );
  }

  return (
    <StampShell>
      <div className="text-4xl mb-3">😕</div>
      <p className="text-gray-600 max-w-xs mb-6">{t(`cust.stamp.err.${errKey}`, { defaultValue: ERR[errKey] ?? t('cust.stamp.generic', { defaultValue: 'Something went wrong. Please try again.' }) }) + errExtra}</p>
      {(errKey === 'too_far' || errKey === 'denied' || errKey === 'network') && (
        <button onClick={tryAgain} className="bg-[#37352F] text-white px-6 py-3 rounded-lg font-medium hover:bg-opacity-90 transition">{t('cust.stamp.tryAgain', { defaultValue: 'Try again' })}</button>
      )}
    </StampShell>
  );
}
