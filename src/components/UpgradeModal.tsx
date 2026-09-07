import { PRO_FEATURES } from '../lib/pricing';
import { useEffect, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { X, Check, Sparkles, Loader2 } from 'lucide-react';
import { createCheckoutSession } from '../services/billing';
import { useTranslation } from 'react-i18next';

import { proPrice } from '../lib/pricing';

interface UpgradeModalProps {
  country?: 'DE' | 'CA' | null;
  onClose: () => void;
}

// Stripe.js is loaded lazily and cached. The publishable key is safe in
// the frontend bundle; it's designed to be public. Reads from Vite env
// at build time.
const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = stripeKey ? loadStripe(stripeKey) : Promise.resolve(null);
  }
  return stripePromise;
}

/**
 * Pricing modal with embedded Stripe Checkout.
 *
 * Flow:
 *  1. Modal opens on the "pricing/features" screen.
 *  2. User clicks "Upgrade now" -> we call create-checkout-session
 *     which gives us a clientSecret.
 *  3. We swap to the embedded checkout form rendered inside this same
 *     modal — they never leave stampfix.app visually.
 *  4. On success Stripe handles the redirect (return_url in the session).
 *
 * If VITE_STRIPE_PUBLISHABLE_KEY isn't set (e.g. local dev without
 * keys configured), we fall back to a "contact us" message so the
 * modal isn't broken.
 */
export function UpgradeModal({ country, onClose }: UpgradeModalProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<'pricing' | 'checkout'>('pricing');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Price shown in the currency the merchant is actually billed (see
  // create-checkout-session): CA → CAD, DE → EUR (incl. USt.).
  const pricing = proPrice(country);
  const price = pricing.amount;
  const currencyNote = pricing.note;

  const handleStartCheckout = async () => {
    setError(null);
    setLoading(true);
    try {
      const secret = await createCheckoutSession();
      setClientSecret(secret);
      setView('checkout');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dash.upgrade.errCheckout', { defaultValue: 'Could not start checkout' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full relative overflow-hidden flex flex-col max-h-[95vh] ${
          view === 'checkout' ? 'max-w-2xl' : 'max-w-md'
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-[#37352F] transition p-1 z-20"
          aria-label={t('dash.upgrade.close', { defaultValue: 'Close' })}
        >
          <X className="w-5 h-5" />
        </button>

        {view === 'pricing' && (
          <PricingView
            price={price}
            currencyNote={currencyNote}
            loading={loading}
            error={error}
            stripeAvailable={!!stripeKey}
            onUpgrade={handleStartCheckout}
          />
        )}

        {view === 'checkout' && clientSecret && (
          <CheckoutView clientSecret={clientSecret} onBack={() => setView('pricing')} />
        )}
      </div>
    </div>
  );
}

function PricingView({
  price, currencyNote, loading, error, stripeAvailable, onUpgrade,
}: {
  price: string;
  currencyNote: string;
  loading: boolean;
  error: string | null;
  stripeAvailable: boolean;
  onUpgrade: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="overflow-y-auto">
      <div className="bg-gradient-to-br from-[#37352F] to-[#1a1918] text-white px-8 pt-10 pb-12 text-center">
        <div className="w-12 h-12 bg-white/10 rounded-full mx-auto flex items-center justify-center mb-4">
          <Sparkles className="w-6 h-6 text-amber-300" />
        </div>
        <h2 id="upgrade-title" className="text-2xl font-serif-display font-semibold mb-1">
          {t('dash.upgrade.title', { defaultValue: 'Upgrade to Pro' })}
        </h2>
        <p className="text-sm text-gray-300">{t('dash.upgrade.subtitle', { defaultValue: 'Unlimited customers, no limits.' })}</p>
      </div>

      <div className="px-8 -mt-6">
        <div className="bg-white border notion-border rounded-xl p-5 shadow-md text-center">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold">{price}</span>
            <span className="text-gray-500 text-sm">{t('pricing.month', { defaultValue: '/month' })}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">{currencyNote}</p>
        </div>
      </div>

      <div className="px-8 py-8 space-y-3">
        {PRO_FEATURES.slice(0, 8).map((feature, i) => (
          <div key={feature} className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-3 h-3 text-green-600" strokeWidth={3} />
            </div>
            <span className="text-sm text-[#37352F]">{t(`dash.billing.feat${i}`, { defaultValue: feature })}</span>
          </div>
        ))}
        <p className="text-xs text-gray-400 m-0 pl-[30px]">{t('dash.upgrade.andMore', { count: PRO_FEATURES.length - 8, defaultValue: 'and {{count}} more — see the full list in Settings → Billing.' })}</p>
      </div>

      <div className="px-8 pb-8 space-y-3">
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 p-3 rounded">
            {error}
          </div>
        )}
        {!stripeAvailable ? (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800 text-center">
            <p className="font-semibold mb-1">{t('dash.upgrade.almostReady', { defaultValue: 'Almost ready!' })}</p>
            <p>
              {t('dash.upgrade.dropLineA', { defaultValue: 'Drop us a line at' })} <strong>hello@stampfix.app</strong> {t('dash.upgrade.dropLineB', { defaultValue: "and we'll personally set you up with the Pro plan today." })}
            </p>
          </div>
        ) : (
          <button
            onClick={onUpgrade}
            disabled={loading}
            className="w-full bg-[#37352F] text-white py-3 rounded-lg font-medium hover:bg-opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>{t('dash.upgrade.upgradeNowPrice', { price, defaultValue: 'Upgrade now — {{price}}/mo' })} <Sparkles className="w-4 h-4" /></>
            )}
          </button>
        )}
        <p className="text-[11px] text-center text-gray-400">
          {t('dash.upgrade.securePayment', { defaultValue: 'Secure payment via Stripe. Cancel anytime from Settings.' })}
        </p>
      </div>
    </div>
  );
}

function CheckoutView({
  clientSecret, onBack,
}: { clientSecret: string; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b notion-border flex items-center justify-between bg-white sticky top-0 z-10">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-[#37352F] transition"
        >
          ← {t('dash.upgrade.backToPlans', { defaultValue: 'Back to plans' })}
        </button>
        <h3 className="font-semibold">{t('dash.upgrade.complete', { defaultValue: 'Complete your upgrade' })}</h3>
        <div className="w-12" />
      </div>
      <div className="overflow-y-auto">
        <EmbeddedCheckoutProvider
          stripe={getStripe()}
          options={{ clientSecret }}
        >
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </div>
  );
}
