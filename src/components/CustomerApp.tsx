import { PhoneField } from './PhoneField';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, LogOut, Info } from 'lucide-react';
import type { Campaign, UserCard } from '../types';
import { useAuth, signUpOrInCustomer, signOut } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getCampaignById, getCardForCustomer, createCard } from '../lib/db';
import { WalletCard } from './WalletCard';
import { WelcomeModal } from './WelcomeModal';
import { AddToAppleWalletButton } from './AddToAppleWalletButton';
import { Turnstile } from './Turnstile';
import { verifyTurnstile } from '../services/turnstile';
import { logConsent, CONSENT_VERSIONS } from '../lib/consent';
import { useTranslation } from 'react-i18next';

interface CustomerAppProps {
  campaignId: string;
  /** Optional: location id from `?location=` URL param. When set, the
   *  customer's card is tagged with the branch they joined at, so the
   *  merchant can see which location drove the signup. */
  joinedLocationId?: string | null;
  onExit: () => void;
}

/**
 * Customer-facing flow:
 *
 *  - Load the campaign by id (public read allowed by RLS)
 *  - If not signed in     -> magic-link signup form
 *  - If signed in but no card on this campaign -> auto-create one, then show wallet
 *  - If signed in and has card -> show wallet
 *
 * Magic link flow: user enters email, we call signInWithOtp, Supabase
 * sends them an email with a link back to `?campaign=<id>`. When they
 * click it, they land here authenticated.
 */
export function CustomerApp({ campaignId, joinedLocationId, onExit }: CustomerAppProps) {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [card, setCard] = useState<UserCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Magic-link form state
  const [formData, setFormData] = useState({ firstName: '', surname: '', email: '', phone: '', code: '' });
  const [isSendingLink, setIsSendingLink] = useState(false);
  // Turnstile token gating the signup submit.
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Consent: required (terms + data processing) and optional (marketing).
  // Without termsAccepted = true, the submit button stays disabled.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => {
    if (card && (card.currentStamps ?? 0) === 0) {
      try { if (localStorage.getItem('sf_welcome_' + card.id) !== '1') setShowWelcome(true); }
      catch { setShowWelcome(true); }
    }
  }, [card]);
  const dismissWelcome = () => {
    setShowWelcome(false);
    if (card) { try { localStorage.setItem('sf_welcome_' + card.id, '1'); } catch { /* ignore */ } }
  };

  // 1) Load campaign on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const c = await getCampaignById(campaignId);
        if (mounted) setCampaign(c);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : t('cust.app.errLoadCampaign', { defaultValue: 'Could not load campaign' }));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [campaignId]);

  // 2) Once auth is resolved AND campaign loaded, look for the user's card.
  //    If none exists yet, create one using the form data we stashed in
  //    sessionStorage before sending the magic link.
  useEffect(() => {
    if (authLoading) return;
    if (!campaign) return;
    // Public enrollment is blocked until the merchant is approved. The owner
    // merchant (logged in) can still enroll a test card to try the flow.
    if (campaign.approvalStatus !== 'approved' && (!user || user.id !== campaign.merchantId)) {
      setLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        if (!user) {
          setCard(null);
          return;
        }
        let existing = await getCardForCustomer(campaign.id, user.id);
        if (!existing) {
          // Resolve signup details. Three sources, in priority order:
          //   1. sessionStorage (same-tab signup → magic link click)
          //   2. pending_customer_signups table (cross-tab, survives
          //      Gmail-app-opens-new-window flow)
          //   3. Auth user email/metadata as last-resort fallback
          let name = user.email?.split('@')[0] ?? 'Customer';
          let consentGiven = false;
          let marketing = false;
          let pendingRowId: string | null = null;
          let resolvedJoinedLocationId: string | null = joinedLocationId ?? null;

          const pendingRaw = sessionStorage.getItem('pending_customer_signup');
          if (pendingRaw) {
            try {
              const p = JSON.parse(pendingRaw);
              name = `${p.firstName} ${p.surname}`.trim() || name;
              consentGiven = p.termsAccepted === true;
              marketing = p.marketingOptIn === true;
            } catch {
              // ignore
            }
          } else if (user.email) {
            // Cross-tab fallback: look up pending signup by email + campaign.
            // RLS on the table is permissive enough that an authenticated user
            // can read their own pending row.
            const { data: pending } = await supabase
              .from('pending_customer_signups')
              .select('*')
              .ilike('email', user.email)
              .eq('campaign_id', campaign.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (pending) {
              pendingRowId = pending.id;
              name = `${pending.first_name ?? ''} ${pending.surname ?? ''}`.trim() || name;
              consentGiven = pending.terms_accepted === true;
              marketing = pending.marketing_opt_in === true;
              if (!resolvedJoinedLocationId && pending.joined_location_id) {
                resolvedJoinedLocationId = pending.joined_location_id;
              }
            }
          }

          existing = await createCard({
            campaignId: campaign.id,
            customerId: user.id,
            customerName: name,
            email: user.email ?? '',
            joinedAtLocationId: resolvedJoinedLocationId,
            customerConsentAt: consentGiven ? new Date().toISOString() : null,
            marketingOptIn: marketing,
          });
          // Consent audit trail (CASL/GDPR proof) + durable-medium welcome email.
          if (existing) {
            logConsent({ subjectType: 'cardholder', cardId: existing.id, document: 'cardholder_terms', version: CONSENT_VERSIONS.cardholder_terms, granted: consentGiven });
            if (marketing) logConsent({ subjectType: 'cardholder', cardId: existing.id, document: 'marketing_consent', version: CONSENT_VERSIONS.cardholder_terms, granted: true });
            void supabase.functions.invoke('send-welcome-email', { body: { email: user.email ?? '', name, businessName: campaign.businessName } });
          }
          sessionStorage.removeItem('pending_customer_signup');
          // Consume the pending row so it doesn't linger after card creation
          if (pendingRowId) {
            await supabase.from('pending_customer_signups').delete().eq('id', pendingRowId);
          }
        }
        if (mounted) setCard(existing);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : t('cust.app.errLoadCard', { defaultValue: 'Could not load card' }));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authLoading, campaign, user]);

  const handleSendLink = async () => {
    if (!formData.firstName || !formData.email || !/^\d{6}$/.test(formData.code)) return;
    if (!turnstileToken) {
      setError(t('cust.app.errSecurity', { defaultValue: 'Please complete the security check.' }));
      return;
    }
    setError(null);
    setIsSendingLink(true);
    try {
      const ok = await verifyTurnstile(turnstileToken);
      if (!ok) {
        setError(t('cust.app.errSecurityFailed', { defaultValue: 'Security check failed. Please try again.' }));
        setTurnstileToken(null);
        setIsSendingLink(false);
        return;
      }
      // Stash form + consent flags in BOTH sessionStorage (fast path for
      // Persist signup details so the card can be created with the right
      // name/age/consent after auth. Both sessionStorage (same-tab) and
      // the DB table (survives any reload) are written.
      sessionStorage.setItem('pending_customer_signup', JSON.stringify({
        ...formData,
        termsAccepted,
        marketingOptIn,
      }));

      try {
        const { error: pendingErr } = await supabase
          .from('pending_customer_signups')
          .upsert({
            email: formData.email.trim().toLowerCase(),
            campaign_id: campaignId,
            first_name: formData.firstName,
            surname: formData.surname || null,
            phone: formData.phone.trim() || null,
            recovery_code: formData.code,
            joined_location_id: joinedLocationId ?? null,
            terms_accepted: termsAccepted,
            marketing_opt_in: marketingOptIn,
          }, { onConflict: 'email,campaign_id' });
        if (pendingErr) console.warn('[signup] could not persist pending row:', pendingErr);
      } catch (e) {
        console.warn('[signup] pending persist threw:', e);
      }

      // Frictionless: create the account (or sign in if returning) and log
      // the customer in immediately. No email, no code. The component then
      // re-renders into the signed-in branch, which creates/loads the card.
      await signUpOrInCustomer(formData.email.trim().toLowerCase(), campaignId, formData.phone);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('cust.app.errSignIn', { defaultValue: 'Could not sign you in' }));
    } finally {
      setIsSendingLink(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onExit();
  };

  // ----- Loading -----
  if (!campaign && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (error || !campaign) {
    // Special-case the free-tier limit error so it doesn't look like a
    // bug. This is a "soft" block — the merchant just needs to upgrade.
    const isLimitError = error?.toLowerCase().includes('currently full')
                       || error?.toLowerCase().includes('free-tier');
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-6 text-center">
        <div className="max-w-md space-y-5">
          {isLimitError ? (
            <>
              <div className="text-5xl">🎉</div>
              <h2 className="text-2xl font-serif-display font-semibold">{t('cust.app.popularTitle', { defaultValue: 'This program is popular!' })}</h2>
              <p className="text-gray-600 leading-relaxed">
                {t('cust.app.popularBody', { defaultValue: 'The loyalty program is currently at capacity. Please ask the staff to upgrade their Stampfix account so you can join.' })}
              </p>
              <p className="text-xs text-gray-500">
                {t('cust.app.popularExisting', { defaultValue: 'Existing customers can still collect stamps as normal.' })}
              </p>
            </>
          ) : (
            <p className="text-gray-500">{error || t('cust.app.noCampaign', { defaultValue: 'No campaign found for this link.' })}</p>
          )}
          <button onClick={onExit} className="text-blue-600 hover:underline">{t('cust.app.returnHome', { defaultValue: 'Return Home' })}</button>
        </div>
      </div>
    );
  }

  // ----- Merchant not yet approved: block public enrollment (owner can test) -----
  const isOwner = !!user && user.id === campaign.merchantId;
  if (campaign.approvalStatus !== 'approved' && !isOwner) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-[#37352F] text-center">
        <button onClick={onExit} aria-label={t('cust.app.goBack', { defaultValue: 'Go back' })} className="absolute top-6 left-6 text-gray-500 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <div className="max-w-sm w-full space-y-3">
          <div className="w-12 h-12 bg-[#F7F7F5] rounded-md mx-auto flex items-center justify-center text-xl border notion-border mb-2">
            {campaign.customIcon || '⏳'}
          </div>
          <h1 className="text-2xl font-serif-display font-semibold">{t('cust.app.almostReady', { defaultValue: 'Almost ready' })}</h1>
          <p className="text-gray-500 text-sm">
            {t('cust.app.notApproved', { name: campaign.businessName, defaultValue: "{{name}}'s loyalty card isn't live just yet. They're finishing setup, so please check back soon." })}
          </p>
        </div>
      </div>
    );
  }

  // ----- Not authenticated: signup form -----
  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-[#37352F]">
        <button onClick={onExit} aria-label={t('cust.app.goBack', { defaultValue: 'Go back' })} className="absolute top-6 left-6 text-gray-500 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <div className="max-w-sm w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-[#F7F7F5] rounded-md mx-auto flex items-center justify-center text-xl border notion-border mb-4">
              {campaign.customIcon || '👋'}
            </div>
            <h1 className="text-2xl font-serif-display font-semibold">{t('cust.app.join', { name: campaign.businessName, defaultValue: 'Join {{name}}' })}</h1>
            <p className="text-gray-500 text-sm">{campaign.offerTitle}</p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="sf-firstname" className="text-[11px] font-bold uppercase text-gray-500 tracking-wider">{t('cust.app.firstName', { defaultValue: 'First Name' })}</label>
                <input
                  id="sf-firstname"
                  value={formData.firstName}
                  maxLength={60}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full bg-[#F7F7F5] border notion-border rounded-md px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-gray-400 placeholder-gray-400"
                  placeholder={t('cust.app.firstNamePh', { defaultValue: 'Jane' })}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="sf-surname" className="text-[11px] font-bold uppercase text-gray-500 tracking-wider">{t('cust.app.surname', { defaultValue: 'Surname' })}</label>
                <input
                  id="sf-surname"
                  value={formData.surname}
                  maxLength={60}
                  onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                  className="w-full bg-[#F7F7F5] border notion-border rounded-md px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-gray-400 placeholder-gray-400"
                  placeholder={t('cust.app.surnamePh', { defaultValue: 'Doe' })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="sf-email" className="text-[11px] font-bold uppercase text-gray-500 tracking-wider">{t('cust.app.emailAddress', { defaultValue: 'Email Address' })}</label>
              <input
                id="sf-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-[#F7F7F5] border notion-border rounded-md px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-gray-400 placeholder-gray-400"
                placeholder={t('cust.app.emailPh', { defaultValue: 'jane@example.com' })}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="sf-phone" className="text-[11px] font-bold uppercase text-gray-500 tracking-wider">{t('cust.app.phoneNumber', { defaultValue: 'Phone Number' })} <span className="font-normal normal-case text-gray-400">{t('cust.app.optional', { defaultValue: '(optional)' })}</span></label>
              <PhoneField id="sf-phone" onChange={(v) => setFormData({ ...formData, phone: v })} />
              <p className="text-[11px] text-gray-500 leading-relaxed">
                {t('cust.app.phoneHint', { name: campaign.businessName, defaultValue: 'Recommended so {{name}} can reach you about your rewards and reach your card if you lose access to your email.' })}
              </p>
            </div>
            <div className="space-y-1">
              <label htmlFor="sf-code" className="text-[11px] font-bold uppercase text-gray-500 tracking-wider">{t('cust.app.recoveryCode', { defaultValue: 'Card recovery code (6 digits)' })}</label>
              <input
                id="sf-code"
                type="text" inputMode="numeric" maxLength={6}
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                className="w-full bg-[#F7F7F5] border notion-border rounded-md px-3 py-2.5 font-mono tracking-[0.3em] focus:outline-none focus:ring-1 focus:ring-gray-400 placeholder-gray-400"
                placeholder="••••••"
              />
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-[11px] text-blue-700 leading-relaxed">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{t('cust.app.codeInfo', { defaultValue: 'Keep this recovery code safe. If you added a phone number, the two together let you recover your card — either way you can always sign back in with your email.' })}</span>
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 p-2 rounded">{error}</div>
            )}

            {/* Consent — required by GDPR. Customer must explicitly tick this. */}
            <div className="space-y-2.5 pt-2 border-t notion-border">
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#37352F] flex-shrink-0"
                />
                <span className="text-xs text-gray-600 leading-relaxed">
                  {t('cust.app.agreeA', { defaultValue: 'I agree to' })}{' '}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setShowPrivacyNotice(true); }}
                    className="underline text-[#37352F] font-medium"
                  >
                    {t('cust.app.privacyNoticeLink', { name: campaign.businessName, defaultValue: "{{name}}'s privacy notice" })}
                  </button>
                  {' '}{t('cust.app.agreeAnd', { defaultValue: 'and' })}{' '}
                  <a href="/terms" target="_blank" rel="noreferrer" className="underline text-[#37352F] font-medium">
                    {t('cust.app.termsLink', { defaultValue: "Stampfix's terms" })}
                  </a>
                  {t('cust.app.agreeEnd', { defaultValue: '.' })}
                </span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={(e) => setMarketingOptIn(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#37352F] flex-shrink-0"
                />
                <span className="text-xs text-gray-500 leading-relaxed">
                  {t('cust.app.marketing', { name: campaign.businessName, defaultValue: 'Send me marketing emails from {{name}} (optional).' })}
                </span>
              </label>
            </div>

            <Turnstile
              onVerify={setTurnstileToken}
              onError={() => setTurnstileToken(null)}
            />

            <button
              onClick={handleSendLink}
              disabled={!formData.firstName || !formData.email || !/^\d{6}$/.test(formData.code) || !turnstileToken || !termsAccepted || isSendingLink}
              className="w-full bg-[#37352F] text-white py-3 rounded-md font-medium hover:bg-opacity-90 transition disabled:opacity-50 shadow-sm flex items-center justify-center gap-2 mt-2"
            >
              {isSendingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>{t('cust.app.joinNow', { defaultValue: 'Join now' })} <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
            <p className="text-[10px] text-gray-500 text-center">
              {t('cust.app.noPassword', { defaultValue: "No password needed — you'll get your card right away." })}
            </p>
          </div>
        </div>

        {/* Privacy notice modal */}
        {showPrivacyNotice && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowPrivacyNotice(false)}>
            <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b notion-border px-5 py-3 flex items-center justify-between">
                <h3 className="font-semibold">{campaign.businessName} — {t('cust.app.privacyNoticeTitle', { defaultValue: 'Privacy notice' })}</h3>
                <button onClick={() => setShowPrivacyNotice(false)} aria-label={t('cust.app.close', { defaultValue: 'Close' })} className="text-gray-500 hover:text-[#37352F] text-xl leading-none"><span aria-hidden="true">&times;</span></button>
              </div>
              <div className="px-5 py-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {campaign.customerPrivacyNotice ?? (
                  <>
                    <p>{t('cust.app.genericP1', { name: campaign.businessName, defaultValue: '{{name}} collects your name and email to operate their loyalty program. They use this information solely for the purpose of tracking your stamps, sending reward notifications, and (with your consent) sending marketing communications.' })}</p>
                    <p className="mt-3">{t('cust.app.genericP2a', { name: campaign.businessName, defaultValue: "{{name}} has not yet published a custom privacy notice. For Stampfix's general data handling practices, see our" })} <a href="/privacy" className="underline">{t('cust.app.genericP2link', { defaultValue: 'platform privacy policy' })}</a>.</p>
                    <p className="mt-3">{t('cust.app.genericP3', { defaultValue: 'You can request deletion of your data at any time from the "My Card" page.' })}</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ----- Authenticated, loading card -----
  if (loading || !card) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  // ----- Wallet view -----
  return (
    <div className="min-h-screen bg-[#F7F7F5] flex flex-col font-sans text-[#37352F]">
      <header className="bg-white border-b notion-border px-6 py-4 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <div className="w-6 h-6 rounded text-white flex items-center justify-center text-xs"
            style={{ backgroundColor: campaign.primaryColor }}>
            {campaign.businessName.charAt(0)}
          </div>
          <span>{campaign.businessName}</span>
        </div>
        <button onClick={handleSignOut} className="text-xs text-gray-500 hover:text-red-500 transition flex items-center gap-1">
          <LogOut className="w-3 h-3" /> {t('cust.app.signOut', { defaultValue: 'Sign out' })}
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start pt-12 p-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 overflow-y-auto">
        {showWelcome && <WelcomeModal onDismiss={dismissWelcome} />}
        <div className="text-center mb-8 space-y-2">
          <h1 className="text-3xl font-serif-display font-semibold">{t('cust.app.yourDigitalCard', { defaultValue: 'Your Digital Card' })}</h1>
          <p className="text-gray-500 text-sm max-w-xs mx-auto">
            {t('cust.app.saveToWallet', { defaultValue: "Save your card to your phone's wallet for quick access." })}
          </p>
        </div>

        <div className="w-full max-w-[340px]">
          <WalletCard campaign={campaign} card={card} />
        </div>

        <div className="w-full max-w-[340px] mt-4">
          <AddToAppleWalletButton cardId={card.id} />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-[340px] text-center">
          <div className="bg-white p-4 rounded-lg border notion-border shadow-sm">
            <div className="font-bold text-2xl mb-1 text-[#37352F]">{card.currentStamps}</div>
            <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{t('cust.app.stamps', { defaultValue: 'Stamps' })}</div>
          </div>
          <div className="bg-white p-4 rounded-lg border notion-border shadow-sm">
            <div className="font-bold text-2xl mb-1 text-[#37352F]">{campaign.maxStamps - card.currentStamps}</div>
            <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{t('cust.app.toGo', { defaultValue: 'To Go' })}</div>
          </div>
        </div>

        <div className="mt-8 text-center max-w-xs">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">{t('cust.app.instructions', { defaultValue: 'Instructions' })}</p>
          <p className="text-xs text-gray-500">
            {t('cust.app.instructionsA', { defaultValue: 'Present the QR code on your card to the cashier at' })} <strong>{campaign.businessName}</strong> {t('cust.app.instructionsB', { defaultValue: 'to collect stamps and redeem rewards.' })}
          </p>
        </div>

        <div className="mt-6 max-w-xs w-full bg-[#F7F7F5] border notion-border rounded-lg p-3 text-center">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1.5">{t('cust.app.comingBack', { defaultValue: 'Coming back later?' })}</p>
          <p className="text-xs text-gray-600 leading-relaxed">
            {t('cust.app.comingBackA', { defaultValue: 'Visit' })} <a href="/my-card" className="text-[#37352F] font-medium underline">stampfix.app/my-card</a> {t('cust.app.comingBackB', { defaultValue: 'and enter this same email to find your card again.' })}
          </p>
        </div>
      </main>
    </div>
  );
}
