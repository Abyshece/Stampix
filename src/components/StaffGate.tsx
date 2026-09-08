import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { verifyStaffPin, verifyStaffPinFor, setStaffSession, ownerPinIsSet, verifyOwnerPin } from '../services/staff';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';

/** PIN prompt shown after the shop logs in: "who's at the till?" */
export function StaffGate({ campaignId, onDone, onSkip, staffId, staffName }: {
  campaignId: string; onDone: () => void; onSkip?: () => void;
  /** When set, the PIN must belong to this person (they picked their name first). */
  staffId?: string; staffName?: string;
}) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Owner mode: the skip is protected by an owner PIN once one has been set.
  const [ownerMode, setOwnerMode] = useState(false);
  const [ownerLocked, setOwnerLocked] = useState(false);
  useEffect(() => { ownerPinIsSet(campaignId).then(setOwnerLocked).catch(() => setOwnerLocked(false)); }, [campaignId]);

  const submitOwner = async () => {
    if (!/^\d{4,8}$/.test(pin)) { setErr(t('cust.staffgate.errOwnerPin', { defaultValue: 'Enter the owner PIN.' })); return; }
    setBusy(true); setErr(null);
    try {
      const ok = await verifyOwnerPin(campaignId, pin);
      if (!ok) { setErr(t('cust.staffgate.errOwnerWrong', { defaultValue: 'That owner PIN is not correct.' })); setPin(''); return; }
      onSkip?.();
    } catch { setErr(t('cust.staffgate.errCheck', { defaultValue: 'Could not check that PIN.' })); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    if (!/^\d{4,8}$/.test(pin)) { setErr(t('cust.staffgate.errPin', { defaultValue: 'Enter your 4-8 digit PIN.' })); return; }
    setBusy(true); setErr(null);
    try {
      const s = staffId
        ? await verifyStaffPinFor(campaignId, staffId, pin)
        : await verifyStaffPin(campaignId, pin);
      if (!s) {
        setErr(staffName ? t('cust.staffgate.errNoMatch', { name: staffName, defaultValue: 'That PIN doesn\u2019t match {{name}}.' }) : t('cust.staffgate.errNotRecognised', { defaultValue: 'That PIN wasn\u2019t recognised.' }));
        setPin(''); return;
      }
      setStaffSession(s); onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : t('cust.staffgate.errCheck', { defaultValue: 'Could not check that PIN.' })); }
    finally { setBusy(false); }
  };

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    window.location.href = '/';
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-md flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-2xl border notion-border w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#37352F]" />
          <h2 className="text-lg font-semibold">{ownerMode ? t('cust.staffgate.ownerOverride', { defaultValue: 'Owner override' }) : staffName ? t('cust.staffgate.signInAs', { name: staffName, defaultValue: 'Sign in as {{name}}' }) : t('cust.staffgate.whoOnShift', { defaultValue: 'Who\u2019s on shift?' })}</h2>
        </div>
        <p className="text-sm text-gray-500">{ownerMode
            ? t('cust.staffgate.ownerSub', { defaultValue: 'Enter the owner PIN to continue without signing in as staff.' })
            : t('cust.staffgate.staffSub', { defaultValue: 'Enter your staff ID (PIN) to start your shift. Everything you stamp today is recorded under your name.' })}</p>
        <input
          autoFocus type="password" inputMode="numeric" autoComplete="one-time-code" name="sf-otp" value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="&bull;&bull;&bull;&bull;"
          className="w-full text-center tracking-[0.5em] text-lg bg-[#F7F7F5] border notion-border rounded-md px-3 py-3 focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
        {err && <p className="text-xs text-red-600">{err}</p>}
        <button onClick={ownerMode ? submitOwner : submit} disabled={busy}
          className="w-full py-2.5 rounded-md bg-[#37352F] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {t('cust.staffgate.continue', { defaultValue: 'Continue' })}
        </button>
        {onSkip && !ownerMode && (
          <button
            onClick={() => { if (ownerLocked) { setOwnerMode(true); setPin(''); setErr(null); } else { onSkip(); } }}
            className="w-full py-2.5 rounded-md border notion-border text-sm font-medium text-[#37352F] hover:bg-[#F7F7F5] transition"
          >
            {ownerLocked ? t('cust.staffgate.enterOwnerPin', { defaultValue: 'Enter owner PIN' }) : t('cust.staffgate.iAmOwner', { defaultValue: 'I am the owner' })}
          </button>
        )}
        {ownerMode && (
          <button onClick={() => { setOwnerMode(false); setPin(''); setErr(null); }} className="w-full py-2.5 rounded-md border notion-border text-sm font-medium text-[#37352F] hover:bg-[#F7F7F5] transition">
            {t('cust.staffgate.backToStaff', { defaultValue: 'Back to staff sign-in' })}
          </button>
        )}
        <div className="pt-3 border-t notion-border text-center">
          <p className="text-xs text-gray-400 mb-1">{t('cust.staffgate.forgotPin', { defaultValue: 'Forgot the PIN, or not on shift?' })}</p>
          <button onClick={handleLogout} className="text-xs font-medium text-red-600 hover:underline">
            {t('cust.staffgate.logoutHome', { defaultValue: 'Log out and go back to the home screen' })}
          </button>
        </div>
      </div>
    </div>
  );
}
