import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { STAMP_REASONS } from '../services/stampGuard';
import { useTranslation } from 'react-i18next';

/** Asks why a stamp is being added outside the normal customer-scan flow. */
export function StampReasonModal({
  customerName, atCap, stampsToday, cap, onConfirm, onCancel,
}: {
  customerName: string; atCap: boolean; stampsToday: number; cap: number;
  onConfirm: (reason: string) => Promise<void> | void; onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [choice, setChoice] = useState<string>(STAMP_REASONS[0]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const reason = choice === 'Other (explained below)' ? note.trim() : choice;
    if (!reason) return;
    setBusy(true);
    try { await onConfirm(reason); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-2xl border notion-border w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t('dash.reason.title', { defaultValue: 'Why this stamp?' })}</h2>

        {atCap && (
          <div className="flex gap-2 items-start text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
            <span>
              <b>{customerName}</b> {t(`dash.reason.capMain${stampsToday === 1 ? 'One' : 'Other'}`, { count: stampsToday, defaultValue: stampsToday === 1 ? 'already has {{count}} stamp today' : 'already has {{count}} stamps today' })}{cap > 0 && <>{t('dash.reason.capLimit', { cap, defaultValue: ' (daily limit: {{cap}})' })}</>}{t('dash.reason.capEnd', { defaultValue: '. This will be recorded as an override.' })}
            </span>
          </div>
        )}

        <div className="space-y-1.5">
          {STAMP_REASONS.map((r, i) => (
            <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="reason" checked={choice === r} onChange={() => setChoice(r)} className="accent-[#37352F]" />
              {t(`dash.reason.opt${i}`, { defaultValue: r })}
            </label>
          ))}
        </div>

        {choice === 'Other (explained below)' && (
          <input
            autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('dash.reason.notePh', { defaultValue: 'Briefly, what happened?' })}
            className="w-full bg-[#F7F7F5] border notion-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        )}

        <p className="text-xs text-gray-400">{t('dash.reason.savedNote', { defaultValue: 'This is saved with your name in the activity log.' })}</p>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-md border notion-border text-sm hover:bg-[#F7F7F5]">{t('dash.reason.cancel', { defaultValue: 'Cancel' })}</button>
          <button onClick={submit} disabled={busy}
            className="flex-1 py-2.5 rounded-md bg-[#37352F] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} {t('dash.reason.addStamp', { defaultValue: 'Add stamp' })}
          </button>
        </div>
      </div>
    </div>
  );
}
