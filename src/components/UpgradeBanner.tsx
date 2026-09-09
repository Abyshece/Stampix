import { Sparkles, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { FREE_TIER_CARD_LIMIT } from '../types';

import { proPrice } from '../lib/pricing';
import { useTranslation } from 'react-i18next';

interface UpgradeBannerProps {
  customerCount: number;
  /** Country drives the currency in the banner copy. */
  country?: 'DE' | 'CA' | null;
  /** Called when the merchant taps Upgrade. Parent decides what happens
   *  (open the upgrade page, start Stripe checkout, etc.) */
  onUpgrade: () => void;
  /** If set, shows a small "x" to dismiss the warning-state banner.
   *  At-limit banners cannot be dismissed — they reflect a real block. */
  onDismiss?: () => void;
}

/**
 * Smart upgrade banner. Three states:
 *
 *  - Hidden:  < 80% of limit (8 customers). Nothing shown.
 *  - Warning: 8 or 9 customers. Friendly nudge, dismissible.
 *  - Blocked: 10+ customers. Hard block, can't be dismissed, explains
 *             that NEW signups are blocked but existing customers still
 *             get stamps as normal.
 *
 * Sits above the scanner card so it's visible the moment the merchant
 * opens the dashboard.
 */
export function UpgradeBanner({ customerCount, country, onUpgrade, onDismiss }: UpgradeBannerProps) {
  const { t } = useTranslation();
  if (customerCount < 8) return null;
  const atLimit = customerCount >= FREE_TIER_CARD_LIMIT;

  const price = proPrice(country).perMonth;

  if (atLimit) {
    return (
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-lg p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-amber-900 flex items-center gap-2">
              {t('dash.upgradeBanner.limitReached', { defaultValue: "You've reached the free-tier limit" })}
            </h3>
            <p className="text-sm text-amber-800 mt-1 leading-relaxed">
              {t('dash.upgradeBanner.bodyA', { count: customerCount, defaultValue: 'Your existing {{count}} customers can keep collecting stamps as normal —' })} <strong>{t('dash.upgradeBanner.bodyBold', { defaultValue: 'nothing changes for them.' })}</strong> {t('dash.upgradeBanner.bodyB', { defaultValue: "But new customers can't sign up until you upgrade." })}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={onUpgrade}
                className="bg-amber-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-amber-700 transition flex items-center gap-2 shadow-sm"
              >
                <Sparkles className="w-4 h-4" /> {t('dash.upgradeBanner.upgradePrice', { price, defaultValue: 'Upgrade to Pro — {{price}}' })}
              </button>
              <span className="text-xs text-amber-700">{t('dash.upgradeBanner.unlimitedCancel', { defaultValue: 'Unlimited customers, cancel anytime' })}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Warning state
  const remaining = FREE_TIER_CARD_LIMIT - customerCount;
  return (
    <div className="bg-gradient-to-br from-[#F7F7F5] to-white border notion-border rounded-lg p-4 shadow-sm relative">
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-[#37352F] transition p-1"
          aria-label={t('dash.upgradeBanner.dismiss', { defaultValue: 'Dismiss' })}
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <div className="flex items-start gap-3 pr-6">
        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#37352F]">
            <strong>{t(`dash.upgradeBanner.slotsA${remaining === 1 ? 'One' : 'Other'}`, { count: remaining, defaultValue: remaining === 1 ? '{{count}} customer slot left on the free plan.' : '{{count}} customer slots left on the free plan.' })}</strong>{' '}
            <span className="text-gray-500">{t('dash.upgradeBanner.slotsB', { price, defaultValue: 'Upgrade to Pro for unlimited customers, {{price}}.' })}</span>
          </p>
          <button
            onClick={onUpgrade}
            className="mt-2 text-sm font-medium text-[#37352F] hover:underline inline-flex items-center gap-1"
          >
            {t('dash.upgradeBanner.seePro', { defaultValue: 'See Pro features' })} <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
