import { useEffect, useState } from 'react';
import { UserPlus, Loader2, KeyRound, Trash2, LogIn, AlertTriangle, ShieldCheck } from 'lucide-react';
import {
  listStaff, createStaff, setStaffActive, setStaffPin, deleteStaff,
  listStaffLogins, getStaffSession, clearStaffSession, setStaffSections, STAFF_HIDEABLE_SECTIONS,
  type StaffMember, type StaffLogin,
} from '../services/staff';
import { detectAnomalies, type Flag } from '../services/anomalies';
import { InfoHint } from './InfoHint';
import { useTranslation } from 'react-i18next';
import { getDailyCap, setDailyCap } from '../services/stampGuard';
import { ownerPinIsSet, setOwnerPin } from '../services/staff';

const SEV: Record<Flag['severity'], { label: string; cls: string }> = {
  high:   { label: 'High',   cls: 'bg-red-50 border-red-200 text-red-700' },
  medium: { label: 'Medium', cls: 'bg-amber-50 border-amber-200 text-amber-800' },
  low:    { label: 'Low',    cls: 'bg-blue-50 border-blue-200 text-blue-700' },
};

/** Merchant-facing staff management, sign-in log, and fraud alerts. */
export function StaffPanel({ campaignId, onSwitchStaff }: { campaignId: string; onSwitchStaff: () => void }) {
  const { t } = useTranslation();
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [logins, setLogins] = useState<StaffLogin[]>([]);
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cap, setCap] = useState<number | null>(null);
  const [ownerSet, setOwnerSet] = useState<boolean | null>(null);
  const [ownerPin, setOwnerPinValue] = useState('');
  const current = getStaffSession(campaignId);

  const refresh = () => {
    listStaff(campaignId).then(setStaff).catch(() => setStaff([]));
    listStaffLogins(campaignId).then(setLogins).catch(() => setLogins([]));
    detectAnomalies(campaignId).then(setFlags).catch(() => setFlags([]));
    getDailyCap(campaignId).then(setCap).catch(() => setCap(1));
    ownerPinIsSet(campaignId).then(setOwnerSet).catch(() => setOwnerSet(false));
  };
  useEffect(refresh, [campaignId]);

  const add = async () => {
    setErr(null);
    if (!name.trim()) { setErr(t('dash.staff.errName', { defaultValue: 'Enter a name.' })); return; }
    if (!/^\d{4,8}$/.test(pin)) { setErr(t('dash.staff.errPin', { defaultValue: 'PIN must be 4-8 digits.' })); return; }
    setBusy(true);
    try { await createStaff(campaignId, name, pin); setName(''); setPin(''); refresh(); }
    catch (e) { setErr(e instanceof Error ? e.message : t('dash.staff.errAdd', { defaultValue: 'Could not add staff member.' })); }
    finally { setBusy(false); }
  };

  const changePin = async (s: StaffMember) => {
    const p = window.prompt(t('dash.staff.pinPrompt', { name: s.name, defaultValue: 'New PIN for {{name}} (4-8 digits)' }));
    if (!p) return;
    try { await setStaffPin(s.id, p); alert(t('dash.staff.pinUpdated', { defaultValue: 'PIN updated.' })); }
    catch (e) { alert(e instanceof Error ? e.message : t('dash.staff.errPinUpdate', { defaultValue: 'Could not update PIN.' })); }
  };

  const remove = async (s: StaffMember) => {
    if (!window.confirm(t('dash.staff.confirmRemove', { name: s.name, defaultValue: 'Remove {{name}}? Their past activity stays in the log.' }))) return;
    await deleteStaff(s.id); refresh();
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-serif-display font-semibold">{t('dash.staff.title', { defaultValue: 'Staff' })}</h2> <InfoHint text={t('dash.staff.info', { defaultValue: "Staff share the shop's login, then identify themselves with a personal PIN. Every stamp, redemption and sign-in is recorded against the person who did it, so problems can be traced to a name." })} label="staff" />
        <p className="text-gray-500 mt-1">
          {t('dash.staff.sub', { defaultValue: 'Give each team member their own PIN. Every stamp and redemption is recorded against the person who did it.' })}
        </p>
      </header>

      <div className="p-4 rounded-lg border notion-border bg-[#F7F7F5] flex items-center justify-between gap-4 flex-wrap">
        <div className="text-sm">
          {current
            ? <>{t('dash.staff.atTill', { defaultValue: 'Currently at the till:' })} <span className="font-semibold text-[#37352F]">{current.name}</span></>
            : <span className="text-gray-500">{t('dash.staff.noneSignedIn', { defaultValue: 'No staff member signed in on this device.' })}</span>}
        </div>
        <button onClick={() => { clearStaffSession(); onSwitchStaff(); }}
          className="text-xs px-3 py-1.5 rounded-md bg-[#37352F] text-white hover:opacity-90 transition">
          {current ? t('dash.staff.switchStaff', { defaultValue: 'Switch staff' }) : t('dash.staff.signInStaff', { defaultValue: 'Sign in staff' })}
        </button>
      </div>

      {/* Setup row: add staff + the two guardrails, side by side */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {/* Add a staff member */}
        <div className="p-5 rounded-lg border notion-border bg-white flex flex-col">
          <h3 className="font-semibold flex items-center gap-2"><UserPlus className="w-4 h-4" /> {t('dash.staff.addStaff', { defaultValue: 'Add staff' })}</h3>
          <p className="text-xs text-gray-400 mt-1 mb-3">{t('dash.staff.addStaffHint', { defaultValue: 'They sign in with the shop login, then enter their own PIN — no email needed.' })}</p>
          <div className="space-y-2 mt-auto">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('dash.staff.namePh', { defaultValue: 'Name (e.g. Martina)' })}
              className="w-full bg-[#F7F7F5] border notion-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder={t('dash.staff.pinPh', { defaultValue: 'PIN (4-8 digits)' })} inputMode="numeric"
              className="w-full bg-[#F7F7F5] border notion-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
            {err && <p className="text-xs text-red-600">{err}</p>}
            <button onClick={add} disabled={busy}
              className="w-full px-4 py-2 rounded-md bg-[#37352F] text-white text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} {t('dash.staff.addStaffBtn', { defaultValue: 'Add staff member' })}
            </button>
          </div>
        </div>

        {/* Owner PIN */}
        <div className="p-5 rounded-lg border notion-border bg-white flex flex-col">
          <div className="flex items-center gap-1.5"><h3 className="font-semibold">{t('dash.staff.ownerPin', { defaultValue: 'Owner PIN' })}</h3> <InfoHint text={t('dash.staff.ownerInfo', { defaultValue: "Locks the ‘I’m the owner — skip’ button on the staff sign-in screen. Without it, anyone can skip identification and work unattributed." })} label="owner PIN" /></div>
          <p className="text-xs text-gray-400 mt-1">{t('dash.staff.ownerDesc', { defaultValue: 'Locks the “I’m the owner — skip” button on staff sign-in.' })}</p>
          <p className="text-xs mt-1 mb-3">
            {ownerSet === false && <span className="text-amber-700 font-medium">{t('dash.staff.ownerNotSet', { defaultValue: 'Not set — skip is open to anyone.' })}</span>}
            {ownerSet === true && <span className="text-green-700 font-medium">{t('dash.staff.ownerIsSet', { defaultValue: 'Owner PIN is set.' })}</span>}
          </p>
          <div className="space-y-2 mt-auto">
            <input
              value={ownerPin}
              onChange={(e) => setOwnerPinValue(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder={ownerSet ? t('dash.staff.ownerNewPh', { defaultValue: 'New owner PIN' }) : t('dash.staff.ownerSetPh', { defaultValue: 'Set a PIN (4-8 digits)' })}
              inputMode="numeric"
              className="w-full bg-[#F7F7F5] border notion-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!/^\d{4,8}$/.test(ownerPin)) { alert(t('dash.staff.ownerErrDigits', { defaultValue: 'Owner PIN must be 4-8 digits.' })); return; }
                  try { await setOwnerPin(campaignId, ownerPin); setOwnerPinValue(''); setOwnerSet(true); alert(t('dash.staff.ownerSaved', { defaultValue: 'Owner PIN saved.' })); }
                  catch (e) { alert(e instanceof Error ? e.message : t('dash.staff.ownerErrSave', { defaultValue: 'Could not save the owner PIN.' })); }
                }}
                className="flex-1 px-4 py-2 rounded-md bg-[#37352F] text-white text-sm hover:opacity-90"
              >
                {ownerSet ? t('dash.staff.change', { defaultValue: 'Change' }) : t('dash.staff.setPin', { defaultValue: 'Set PIN' })}
              </button>
              {ownerSet && (
                <button
                  onClick={async () => {
                    if (!window.confirm(t('dash.staff.ownerConfirmRemove', { defaultValue: 'Remove the owner PIN? Anyone will be able to skip staff sign-in again.' }))) return;
                    try { await setOwnerPin(campaignId, null); setOwnerSet(false); }
                    catch (e) { alert(e instanceof Error ? e.message : t('dash.staff.ownerErrRemove', { defaultValue: 'Could not remove the owner PIN.' })); }
                  }}
                  className="px-3 py-2 rounded-md border notion-border text-sm text-red-600 hover:bg-red-50"
                >
                  {t('dash.staff.remove', { defaultValue: 'Remove' })}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Daily stamp limit */}
        <div className="p-5 rounded-lg border notion-border bg-white flex flex-col">
          <div className="flex items-center gap-1.5"><h3 className="font-semibold">{t('dash.staff.dailyLimit', { defaultValue: 'Daily stamp limit' })}</h3> <InfoHint text={t('dash.staff.dailyInfo', { defaultValue: 'The maximum stamps one customer can collect in a day. Set to 1 so a visit earns a stamp, not a purchase. Staff can exceed it, but must give a reason and it is flagged below.' })} label="daily stamp limit" /></div>
          <p className="text-xs text-gray-400 mt-1 mb-3">{t('dash.staff.dailyDesc', { defaultValue: 'Max stamps one customer can earn per day. Keep at 1 for “one visit, one stamp.” Staff can override with a reason.' })}</p>
          <div className="mt-auto">
            <select
              value={cap ?? 1}
              onChange={(e) => { const v = Number(e.target.value); setCap(v); setDailyCap(campaignId, v).catch(() => alert(t('dash.staff.errLimit', { defaultValue: 'Could not save the limit.' }))); }}
              className="w-full bg-[#F7F7F5] border notion-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              <option value={1}>{t('dash.staff.cap1', { defaultValue: '1 per day (recommended)' })}</option>
              <option value={2}>{t('dash.staff.cap2', { defaultValue: '2 per day' })}</option>
              <option value={3}>{t('dash.staff.cap3', { defaultValue: '3 per day' })}</option>
              <option value={5}>{t('dash.staff.cap5', { defaultValue: '5 per day' })}</option>
              <option value={0}>{t('dash.staff.capNone', { defaultValue: 'No limit' })}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Team */}
      <div>
        <h3 className="font-semibold mb-3">{t('dash.staff.yourTeam', { defaultValue: 'Your team' })}</h3>
        {staff === null ? (
          <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> {t('dash.staff.loading', { defaultValue: 'Loading…' })}</div>
        ) : staff.length === 0 ? (
          <p className="text-sm text-gray-400">{t('dash.staff.noStaff', { defaultValue: 'No staff yet. Add your first team member above.' })}</p>
        ) : (
          <div className="border notion-border rounded-lg divide-y notion-border overflow-hidden">
            {staff.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 p-3 bg-white flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {s.name}
                    {!s.active && <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t('dash.staff.inactive', { defaultValue: 'inactive' })}</span>}
                  </div>
                  <div className="text-xs text-gray-400">
                    {s.lastLoginAt ? t('dash.staff.lastSignedIn', { date: s.lastLoginAt.toLocaleString(), defaultValue: 'Last signed in {{date}}' }) : t('dash.staff.neverSignedIn', { defaultValue: 'Never signed in' })}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => changePin(s)} className="text-xs px-2.5 py-1.5 rounded-md border notion-border hover:bg-[#F7F7F5] flex items-center gap-1">
                    <KeyRound className="w-3 h-3" /> PIN
                  </button>
                  <button onClick={() => setStaffActive(s.id, !s.active).then(refresh)} className="text-xs px-2.5 py-1.5 rounded-md border notion-border hover:bg-[#F7F7F5]">
                    {s.active ? t('dash.staff.deactivate', { defaultValue: 'Deactivate' }) : t('dash.staff.activate', { defaultValue: 'Activate' })}
                  </button>
                  <button onClick={() => remove(s)} className="text-xs px-2.5 py-1.5 rounded-md border notion-border text-red-600 hover:bg-red-50 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="w-full mt-1 pt-2 border-t notion-border">
                  <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">{t('dash.staff.canSee', { name: s.name, defaultValue: 'What {{name}} can see (tap to hide/show)' })}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {STAFF_HIDEABLE_SECTIONS.map((sec) => {
                      const hidden = s.hiddenSections.includes(sec.key);
                      return (
                        <button
                          key={sec.key}
                          onClick={() => {
                            const next = hidden ? s.hiddenSections.filter((k) => k !== sec.key) : [...s.hiddenSections, sec.key];
                            setStaffSections(s.id, next).then(refresh).catch(() => alert(t('dash.staff.errAccess', { defaultValue: 'Could not update access.' })));
                          }}
                          className={`text-[11px] px-2 py-1 rounded-md border transition ${hidden ? 'bg-gray-50 text-gray-400 border-gray-200 line-through' : 'bg-[#37352F] text-white border-[#37352F]'}`}
                          title={hidden ? t('dash.staff.hiddenFrom', { name: s.name, defaultValue: 'Hidden from {{name}}' }) : t('dash.staff.visibleTo', { name: s.name, defaultValue: 'Visible to {{name}}' })}
                        >
                          {sec.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity — moved to the bottom */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {t('dash.staff.unusual', { defaultValue: 'Unusual activity' })}</h3> <InfoHint text={t('dash.staff.unusualInfo', { defaultValue: 'Patterns from the last 7 days that are worth a second look: rapid bursts of stamps, one customer stamped many times in a day, repeated limit overrides, activity at odd hours, and heavy manual stamping.' })} label="unusual activity" />
        {flags === null ? (
          <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> {t('dash.staff.checking', { defaultValue: 'Checking…' })}</div>
        ) : flags.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
            <ShieldCheck className="w-4 h-4" /> {t('dash.staff.nothingUnusual', { defaultValue: 'Nothing unusual in the last 7 days.' })}
          </div>
        ) : (
          <div className="space-y-2">
            {flags.map((f) => (
              <div key={f.id} className={`rounded-lg border p-3 ${SEV[f.severity].cls}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{f.title}</div>
                    <div className="text-xs opacity-80 mt-0.5">{f.detail}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-semibold">{f.staffName}</div>
                    <div className="text-[11px] opacity-70">{f.at.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sign-in log */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2"><LogIn className="w-4 h-4" /> {t('dash.staff.signInLog', { defaultValue: 'Sign-in log' })}</h3>
        {logins.length === 0 ? (
          <p className="text-sm text-gray-400">{t('dash.staff.noSignIns', { defaultValue: 'No staff sign-ins recorded yet.' })}</p>
        ) : (
          <div className="border notion-border rounded-lg divide-y notion-border overflow-hidden max-h-80 overflow-y-auto">
            {logins.map((l) => (
              <div key={l.id} className="flex items-center justify-between p-2.5 bg-white text-sm">
                <span className="font-medium">{l.staffName}</span>
                <span className="text-xs text-gray-400">{l.at.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
