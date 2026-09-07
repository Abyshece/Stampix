import { PRO_FEATURES } from '../lib/pricing';
import { useState } from 'react';
import { CreditCard, Sparkles, Check, Loader2, ExternalLink } from 'lucide-react';
import type { MerchantBilling, UserCard } from '../types';
import { FREE_TIER_CARD_LIMIT } from '../types';
import { UpgradeModal } from './UpgradeModal';
import { openBillingPortal } from '../services/billing';
import { useTranslation } from 'react-i18next';

import { proPrice } from '../lib/pricing';

interface AccountBillingProps {
  billing: MerchantBilling;
  country?: 'DE' | 'CA' | null;
  cards: UserCard[];
}

/**
 * Account & Billing panel inside Settings. Shows current plan, usage
 * meter for free-tier merchants, and an Upgrade CTA. After Stripe Part B
 * ships, this also becomes where merchants manage their subscription
 * (cancel, update payment method, view invoices).
 */
export function AccountBilling({ billing, country, cards }: AccountBillingProps) {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const handleOpenPortal = async () => {
    setPortalError(null);
    setPortalLoading(true);
    try {
      await openBillingPortal();
      // openBillingPortal does window.location.href = ..., so this
      // function never returns in the success case.
    } catch (e) {
      setPortalError(e instanceof Error ? e.message : t('dash.billing.errPortal', { defaultValue: 'Could not open billing portal' }));
    } finally {
      setPortalLoading(false);
    }
  };

  const isPro = billing.plan === 'pro';
  const used = cards.length;
  const pct = Math.min(100, (used / FREE_TIER_CARD_LIMIT) * 100);
  const price = proPrice(country).perMonth;

  return (
    <div className="bg-white rounded-lg border notion-border p-6 space-y-5">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-gray-500" /> {t('dash.billing.title', { defaultValue: 'Account & Billing' })}
        </h3>
        <p className="text-sm text-gray-500 mt-1">{t('dash.billing.sub', { defaultValue: 'Your current plan and usage.' })}</p>
      </div>

      {/* Plan card */}
      <div className={`rounded-lg p-4 border ${
        isPro ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200'
              : 'bg-[#F7F7F5] notion-border'
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{t('dash.billing.currentPlan', { defaultValue: 'Current Plan' })}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-serif-display font-semibold">
                {isPro ? t('dash.billing.pro', { defaultValue: 'Pro' }) : t('dash.billing.free', { defaultValue: 'Free' })}
              </span>
              {isPro && <Sparkles className="w-4 h-4 text-amber-500" />}
            </div>
            {isPro && billing.planStartedAt && (
              <p className="text-xs text-gray-500 mt-1">
                {t('dash.billing.activeSince', { date: billing.planStartedAt.toLocaleDateString(), defaultValue: 'Active since {{date}}' })}
              </p>
            )}
          </div>
          {!isPro && (
            <button
              onClick={() => setShowModal(true)}
              className="bg-[#37352F] text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-opacity-90 transition"
            >
              {t('dash.billing.upgrade', { defaultValue: 'Upgrade' })}
            </button>
          )}
          {isPro && (
            <button
              onClick={handleOpenPortal}
              disabled={portalLoading}
              className="bg-white border notion-border text-[#37352F] px-4 py-2 rounded-md font-medium text-sm hover:bg-[#F7F7F5] transition flex items-center gap-2 disabled:opacity-50"
            >
              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" />
                : <><ExternalLink className="w-3.5 h-3.5" /> {t('dash.billing.manage', { defaultValue: 'Manage' })}</>}
            </button>
          )}
        </div>
      </div>
      {portalError && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 p-2 rounded">
          {portalError}
        </div>
      )}

      {/* Usage meter (free plan only) */}
      {!isPro && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{t('dash.billing.customerCards', { defaultValue: 'Customer cards' })}</span>
            <span className="text-gray-500">
              <strong className="text-[#37352F]">{used}</strong> {t('dash.billing.of', { defaultValue: 'of' })} {FREE_TIER_CARD_LIMIT}
            </span>
          </div>
          <div className="h-2 bg-[#F7F7F5] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                pct >= 100 ? 'bg-red-500'
                : pct >= 80 ? 'bg-amber-500'
                : 'bg-[#37352F]'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">
            {used >= FREE_TIER_CARD_LIMIT
              ? t('dash.billing.capHit', { defaultValue: "You've hit the free-tier cap. New customer signups are blocked until you upgrade. Existing customers can still earn stamps." })
              : t(`dash.billing.slotsLeft${FREE_TIER_CARD_LIMIT - used === 1 ? 'One' : 'Other'}`, { count: FREE_TIER_CARD_LIMIT - used, defaultValue: FREE_TIER_CARD_LIMIT - used === 1 ? '{{count}} customer slot left. Upgrade for unlimited.' : '{{count}} customer slots left. Upgrade for unlimited.' })}
          </p>
        </div>
      )}

      {/* What's included */}
      {!isPro && (
        <div className="bg-[#F7F7F5] border notion-border rounded-md p-4 space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">{t('dash.billing.proFeatures', { defaultValue: 'Pro features' })} — {price}</p>
          {PRO_FEATURES.map((feat, i) => (
            <div key={feat} className="flex items-center gap-2 text-sm">
              <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" strokeWidth={3} />
              <span>{t(`dash.billing.feat${i}`, { defaultValue: feat })}</span>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <UpgradeModal country={country ?? null} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
