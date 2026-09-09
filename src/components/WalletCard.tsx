import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import type { Campaign, UserCard } from '../types';
import { getSaveToWalletUrl } from '../services/googleWallet';
import { issueStampToken } from '../services/stampToken';
import { effectiveLogoColor } from '../lib/colors';
import { Loader2, X, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface WalletCardProps {
  card: UserCard;
  campaign: Campaign;
  /** Disable the "Save to Google Wallet" button (e.g. in design previews). */
  disableSave?: boolean;
  /** Disable the rotating-token QR (use a static cardId QR). For previews
   *  and for callers that don't have a real authenticated session. */
  staticQR?: boolean;
}

export function WalletCard({ card, campaign, disableSave, staticQR }: WalletCardProps) {
  const { t } = useTranslation();
  // The card's snapshot drives what the customer sees. This way an
  // existing customer keeps showing their original offer even after
  // the merchant changes the campaign. Fallbacks to campaign for cards
  // created before the snapshot migration (those got backfilled to
  // campaign values anyway, so the fallback is just belt-and-braces).
  const effectiveMaxStamps = card.maxStampsSnapshot ?? campaign.maxStamps;
  const effectiveOfferTitle = card.offerTitleSnapshot ?? campaign.offerTitle;
  const effectiveIcon = card.customIconSnapshot ?? campaign.customIcon;
  const stamps = Array.from({ length: effectiveMaxStamps }, (_, i) => i + 1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Rotating stamp token. Refreshed every 30s while the wallet view is open.
  // We aim for a 60s token lifetime with 30s refresh interval so the
  // visible QR always has 30-60s left when scanned.
  const [tokenInfo, setTokenInfo] = useState<{ token: string; expiresAt: number } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (staticQR) return;
    let cancelled = false;

    const refresh = async () => {
      const fresh = await issueStampToken(card.id);
      if (cancelled) return;
      setTokenInfo(fresh);
    };

    refresh();
    const refreshTimer = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
    };
  }, [card.id, staticQR]);

  // Visible countdown — updated every second for the small "rotates in Ns" hint.
  useEffect(() => {
    if (!tokenInfo) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      const left = tokenInfo.expiresAt - Math.floor(Date.now() / 1000);
      setSecondsLeft(Math.max(0, left));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tokenInfo]);

  // QR payload: signed token when available; otherwise fall back to the
  // plain cardId so the card isn't useless if the token service is down
  // (the merchant scanner accepts both — older Google Wallet passes also
  // encode the plain cardId, and the merchant can still apply the stamp
  // via the older client path).
  const qrValue = !staticQR && tokenInfo
    ? tokenInfo.token
    : JSON.stringify({ cardId: card.id });

  const handleSaveToWallet = async () => {
    if (disableSave) return;
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const url = await getSaveToWalletUrl(card, campaign);
      // Open in a new tab; on Android this hands off to Google Wallet.
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : t('cust.card.errPass', { defaultValue: 'Could not generate wallet pass' }));
    } finally {
      setIsLoading(false);
    }
  };

  // Dynamic Styles based on branding
  const getPatternStyle = (): React.CSSProperties => {
    const patternColor = 'rgba(0,0,0,0.03)';
    if (campaign.cardPattern === 'dots') {
      return {
        backgroundImage: `radial-gradient(${patternColor} 1px, transparent 1px)`,
        backgroundSize: '16px 16px',
      };
    }
    if (campaign.cardPattern === 'grid') {
      return {
        backgroundImage: `linear-gradient(${patternColor} 1px, transparent 1px), linear-gradient(90deg, ${patternColor} 1px, transparent 1px)`,
        backgroundSize: '16px 16px',
      };
    }
    return {};
  };

  // Optimize Grid Layout based on stamp count to prevent elongation
  const getGridSettings = (count: number) => {
    if (count <= 6) return { cols: 'grid-cols-3', gap: 'gap-6', size: 'w-14 h-14', text: 'text-xl', icon: 'text-xl' };
    if (count <= 9) return { cols: 'grid-cols-3', gap: 'gap-4', size: 'w-12 h-12', text: 'text-lg', icon: 'text-lg' };
    return { cols: 'grid-cols-4', gap: 'gap-3', size: 'w-10 h-10', text: 'text-sm', icon: 'text-sm' };
  };

  const layout = getGridSettings(effectiveMaxStamps);

  return (
    <div className="w-full space-y-4">
      {/* Error modal */}
      {errorMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setErrorMsg(null)}></div>
          <div className="relative bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setErrorMsg(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center mb-4 border border-yellow-100">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Couldn't add to Google Wallet</h3>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">{errorMsg}</p>
            <button
              onClick={() => setErrorMsg(null)}
              className="w-full bg-[#37352F] text-white py-2.5 rounded-md font-medium text-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Card Container */}
      <div
        className="relative rounded-[20px] overflow-hidden shadow-xl transition-transform hover:scale-[1.01] duration-300 flex flex-col bg-white text-gray-900 border border-gray-200 h-[540px]"
      >
        <div className="absolute inset-0 pointer-events-none" style={getPatternStyle()} />

        {/* Header */}
        <div className="relative p-5 pb-2 flex justify-between items-start z-10 shrink-0">
          <div className="flex items-center gap-3">
            {/* Top-left branding, honouring the merchant's logo choice:
                their own uploaded logo, the Stampfix mark, or text only.
                Mirrors the settings live preview so the real card matches it. */}
            {campaign.logoMode === 'custom' && campaign.logoImage ? (
              <img src={campaign.logoImage} alt="" className="h-5 w-auto object-contain shrink-0" />
            ) : (campaign.logoMode ?? 'stampfix') === 'stampfix' ? (
              <svg viewBox="0 0 290 90" className="h-5 w-auto shrink-0" fill={effectiveLogoColor(campaign.logoColor, campaign.backgroundColor)} aria-hidden="true">
                <rect x="8" y="12" width="66" height="66" rx="4" />
                <circle cx="140" cy="45" r="34" />
                <rect x="195" y="36" width="90" height="18" rx="9" transform="rotate(45 240 45)" />
                <rect x="195" y="36" width="90" height="18" rx="9" transform="rotate(-45 240 45)" />
              </svg>
            ) : null}
            <h2 className="text-xs font-bold uppercase tracking-widest max-w-[140px] leading-tight text-gray-900">
              {campaign.businessName}
            </h2>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-gray-400 uppercase font-bold tracking-widest mb-0.5">Stamps</div>
            <div className="text-2xl font-bold leading-none tracking-tight">{card.currentStamps}</div>
          </div>
        </div>

        {/* Stamps Grid */}
        <div className="relative px-4 flex-1 z-10 flex flex-col justify-center items-center min-h-0">
          <div className={`grid ${layout.cols} ${layout.gap}`}>
            {stamps.map((num) => {
              const isStamped = num <= card.currentStamps;
              return (
                <div key={num} className="flex flex-col items-center justify-center">
                  <div className={`relative ${layout.size} flex items-center justify-center transition-all duration-300`}>
                    {/* Brand-mark stamp motif (square / circle / cross), cycled by
                        position to match the Apple Wallet pass exactly. Collected =
                        solid; remaining = faint outline (square/circle) or faint
                        fill (cross). No emoji, no numbers. */}
                    <svg
                      viewBox="0 0 100 100"
                      className={`w-full h-full ${isStamped ? 'animate-in zoom-in duration-300' : ''}`}
                      aria-hidden="true"
                    >
                      {(() => {
                        const shape = (num - 1) % 3;
                        const on = isStamped;
                        const solid = '#111827';
                        const faint = '#e5e7eb';
                        const sw = 7;
                        if (shape === 0) {
                          return (
                            <rect x="20" y="20" width="60" height="60" rx="12"
                              fill={on ? solid : 'none'}
                              stroke={on ? 'none' : faint} strokeWidth={sw} />
                          );
                        }
                        if (shape === 1) {
                          return (
                            <circle cx="50" cy="50" r="32"
                              fill={on ? solid : 'none'}
                              stroke={on ? 'none' : faint} strokeWidth={sw} />
                          );
                        }
                        const fill = on ? solid : faint;
                        return (
                          <g>
                            <rect x="13" y="40" width="74" height="20" rx="10" fill={fill} transform="rotate(45 50 50)" />
                            <rect x="13" y="40" width="74" height="20" rx="10" fill={fill} transform="rotate(-45 50 50)" />
                          </g>
                        );
                      })()}
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-center shrink-0">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100 truncate max-w-[200px]">
              {effectiveOfferTitle}
            </span>
          </div>
        </div>

        {/* Footer / QR */}
        <div className="relative bg-gray-50 border-t border-gray-100 px-5 py-5 z-10 shrink-0">
          <div className="mb-4 grid grid-cols-3 gap-2 items-end">
            <div>
              <label className="text-[9px] uppercase tracking-widest text-gray-400 font-bold block mb-1">{t('cust.card.holder', { defaultValue: 'Holder' })}</label>
              <div className="text-xs font-bold tracking-tight text-gray-900 truncate">{card.customerName}</div>
            </div>
            <div className="text-center">
              <label className="text-[9px] uppercase tracking-widest text-gray-400 font-bold block mb-1">{t('cust.card.id', { defaultValue: 'ID' })}</label>
              {/* SF00XXX code, always visible. Customers read this aloud to a
                  cashier when the QR can't be scanned (broken phone, dim
                  screen, scanner camera issue). Monospace + slight weight
                  so it's easy to read off a small screen. */}
              <div className="text-xs font-mono font-semibold tracking-wider text-gray-900">
                {card.customerCode ?? '—'}
              </div>
            </div>
            <div className="text-right">
              <label className="text-[9px] uppercase tracking-widest text-gray-400 font-bold block mb-1">{t('cust.card.joined', { defaultValue: 'Joined' })}</label>
              <div className="text-[10px] font-mono text-gray-500">{new Date(card.joinedAt).toLocaleDateString()}</div>
            </div>
          </div>

          <div className="bg-white p-2 rounded-lg shadow-sm border border-gray-200 mx-auto w-fit">
            <QRCode value={qrValue} size={100} fgColor="#000000" style={{ display: 'block' }} />
          </div>
          {!staticQR && (
            <div className="mt-2 text-center text-[9px] uppercase tracking-widest text-gray-400">
              {tokenInfo
                ? t('cust.card.rotates', { count: secondsLeft, defaultValue: 'Code rotates in {{count}}s' })
                : t('cust.card.loadingCode', { defaultValue: 'Loading secure code…' })}
            </div>
          )}
        </div>
      </div>

      {/* Platform-aware save UI. NOTE: the "Add to Apple Wallet" button is
       *  provided by the dedicated <AddToAppleWalletButton> component (used on
       *  the My Card page) — do NOT add an Apple button here too, or iOS shows
       *  two. Here we only show Google Wallet on Android and an
       *  Add-to-Home-Screen hint on iOS. */}
      {!disableSave && (() => {
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        const isIOS = /iPhone|iPad|iPod/i.test(ua);
        if (isIOS) {
          return (
            <div className="w-full bg-[#F7F7F5] border notion-border rounded-[12px] p-3 text-center">
              <div className="text-[11px] uppercase tracking-wider text-gray-400 font-medium mb-1">
                {t('cust.card.saveCard', { defaultValue: 'Save your card' })}
              </div>
              <div className="text-xs text-gray-600 leading-relaxed">
                {t('cust.card.iosA', { defaultValue: 'Tap' })} <strong>{t('cust.card.iosShare', { defaultValue: 'Share' })}</strong> {t('cust.card.iosThen', { defaultValue: 'in Safari, then' })} <strong>{t('cust.card.iosAddHome', { defaultValue: 'Add to Home Screen' })}</strong>{t('cust.card.iosB', { defaultValue: '. Your card stays one tap away.' })}
              </div>
            </div>
          );
        }
        return (
          <button
            onClick={handleSaveToWallet}
            disabled={isLoading}
            className="w-full bg-black text-white rounded-[12px] h-[48px] flex items-center justify-center gap-3 hover:bg-gray-800 transition shadow-lg active:scale-95 duration-150 disabled:opacity-60"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <GoogleGLogo className="w-5 h-5" />
            )}
            <div className="text-left leading-none">
              <div className="text-[8px] font-medium uppercase tracking-wide opacity-70">{t('cust.card.addTo', { defaultValue: 'Add to' })}</div>
              <div className="text-[13px] font-semibold tracking-tight">Google Wallet</div>
            </div>
          </button>
        );
      })()}
    </div>
  );
}

// Inline Google "G" logo as SVG so we don't depend on an external asset.
function GoogleGLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
