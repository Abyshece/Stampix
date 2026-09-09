import { useEffect, useState } from 'react';
import { X, Tag } from 'lucide-react';
import { listActivePromoBanners, type PromoBanner } from '../services/admin';
import { useTranslation } from 'react-i18next';

/**
 * Top-of-page promo banner. Pulls active banners from the database
 * (RLS filters to within their date window). Shows ONE banner at a
 * time — if multiple are active, picks the most recent.
 *
 * Dismissible per-session via sessionStorage so a returning customer
 * doesn't get the same banner shoved in their face on every page.
 *
 * Variants map to colour. Red = sale/urgent, blue = announcement,
 * green = positive news, amber = warning/limited time.
 */
const VARIANT_STYLES: Record<PromoBanner['variant'], string> = {
  red: 'bg-red-600 text-white',
  blue: 'bg-blue-600 text-white',
  green: 'bg-green-600 text-white',
  amber: 'bg-amber-500 text-white',
};

export function PromoBannerBar() {
  const { t } = useTranslation();
  const [banner, setBanner] = useState<PromoBanner | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    listActivePromoBanners().then((banners) => {
      // Pick the most recent active banner (RLS already filtered to currently-visible)
      const active = banners.find((b) => b.is_active);
      if (active) {
        // Check session dismiss
        if (sessionStorage.getItem(`promo_dismissed_${active.id}`) === '1') {
          setDismissed(true);
        }
        setBanner(active);
      }
    });
  }, []);

  if (!banner || dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(`promo_dismissed_${banner.id}`, '1');
    setDismissed(true);
  };

  const Wrapper = banner.cta_url ? 'a' : 'div';
  const wrapperProps = banner.cta_url ? { href: banner.cta_url, target: '_blank', rel: 'noreferrer' } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`${VARIANT_STYLES[banner.variant]} px-4 py-2.5 flex items-center justify-between gap-3 text-sm relative ${
        banner.cta_url ? 'cursor-pointer hover:brightness-110 transition' : ''
      }`}
    >
      <div className="flex-1 flex items-center justify-center gap-2 flex-wrap text-center">
        <Tag className="w-3.5 h-3.5 opacity-80 flex-shrink-0" />
        <span className="font-medium">{banner.headline}</span>
        {banner.subtext && <span className="opacity-80 text-xs">· {banner.subtext}</span>}
        {banner.coupon_code && (
          <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-mono font-bold ml-1">
            {banner.coupon_code}
          </span>
        )}
      </div>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDismiss(); }}
        className="opacity-70 hover:opacity-100 flex-shrink-0 -mr-1"
        aria-label={t('dash.promo.dismissBanner', { defaultValue: 'Dismiss banner' })}
      >
        <X className="w-4 h-4" />
      </button>
    </Wrapper>
  );
}
