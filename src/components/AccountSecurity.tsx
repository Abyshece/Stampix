import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, Loader2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Msg = { ok: boolean; text: string } | null;

/**
 * Login & security settings — lets the merchant change the email address and
 * password they sign in with. Both go through Supabase Auth on the current
 * session; the email change is confirmed via a link Supabase emails out.
 */
export function AccountSecurity({ currentEmail }: { currentEmail: string }) {
  const { t } = useTranslation();
  const [newEmail, setNewEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<Msg>(null);

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<Msg>(null);

  const changeEmail = async () => {
    setEmailMsg(null);
    const email = newEmail.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setEmailMsg({ ok: false, text: t('dash.security.validEmail', { defaultValue: 'Please enter a valid email address.' }) });
      return;
    }
    if (email.toLowerCase() === currentEmail.toLowerCase()) {
      setEmailMsg({ ok: false, text: t('dash.security.alreadyEmail', { defaultValue: "That's already your email." }) });
      return;
    }
    setEmailBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      setEmailMsg({
        ok: true,
        text: t('dash.security.emailSent', { email, current: currentEmail, defaultValue: "Almost done — we've emailed a confirmation link to {{email}} (and to your current address). Click it to finish switching. You stay signed in with {{current}} until then." }),
      });
      setNewEmail('');
    } catch (err) {
      setEmailMsg({ ok: false, text: err instanceof Error ? err.message : t('dash.security.errEmail', { defaultValue: 'Could not update your email.' }) });
    } finally {
      setEmailBusy(false);
    }
  };

  const changePassword = async () => {
    setPwMsg(null);
    if (pw.length < 8) {
      setPwMsg({ ok: false, text: t('dash.security.pwMin', { defaultValue: 'Password must be at least 8 characters.' }) });
      return;
    }
    if (pw !== pw2) {
      setPwMsg({ ok: false, text: t('dash.security.pwMismatch', { defaultValue: 'The two passwords do not match.' }) });
      return;
    }
    setPwBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setPwMsg({ ok: true, text: t('dash.security.pwUpdated', { defaultValue: 'Password updated. Use it next time you sign in.' }) });
      setPw('');
      setPw2('');
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : t('dash.security.errPw', { defaultValue: 'Could not update your password.' }) });
    } finally {
      setPwBusy(false);
    }
  };

  const inputCls =
    'w-full bg-[#F7F7F5] border notion-border rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#37352F]/20';
  const btnCls =
    'bg-[#37352F] text-white text-sm px-4 py-2 rounded-md hover:bg-opacity-90 transition disabled:opacity-50 flex items-center gap-2';

  return (
    <div className="space-y-8 max-w-xl">
      {/* Email */}
      <div className="space-y-3">
        <div>
          <h3 className="font-medium flex items-center gap-2"><Mail className="w-4 h-4" /> {t('dash.security.emailAddress', { defaultValue: 'Email address' })}</h3>
          <p className="text-xs text-gray-400 mt-1">
            {t('dash.security.signedInAs', { defaultValue: "You're signed in as" })} <span className="font-medium text-gray-600">{currentEmail || '—'}</span>.
          </p>
        </div>
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder={t('dash.security.newEmailPh', { defaultValue: 'new@email.com' })}
          autoComplete="email"
          className={inputCls}
        />
        {emailMsg && <p className={`text-xs ${emailMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{emailMsg.text}</p>}
        <button onClick={changeEmail} disabled={emailBusy || !newEmail.trim()} className={btnCls}>
          {emailBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t('dash.security.updateEmail', { defaultValue: 'Update email' })}
        </button>
      </div>

      {/* Password */}
      <div className="space-y-3 pt-6 border-t notion-border">
        <h3 className="font-medium flex items-center gap-2"><Lock className="w-4 h-4" /> {t('dash.security.password', { defaultValue: 'Password' })}</h3>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder={t('dash.security.newPwPh', { defaultValue: 'New password (at least 8 characters)' })}
          autoComplete="new-password"
          className={inputCls}
        />
        <input
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          placeholder={t('dash.security.confirmPwPh', { defaultValue: 'Confirm new password' })}
          autoComplete="new-password"
          className={inputCls}
        />
        {pwMsg && <p className={`text-xs ${pwMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{pwMsg.text}</p>}
        <button onClick={changePassword} disabled={pwBusy || !pw || !pw2} className={btnCls}>
          {pwBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t('dash.security.updatePw', { defaultValue: 'Update password' })}
        </button>
      </div>
    </div>
  );
}
