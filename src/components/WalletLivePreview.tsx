/**
 * Live wallet preview.
 *
 * Two faithful, real-size cards driven by the in-progress settings draft:
 *  - Apple Wallet — the same store-card design as the landing hero (WalletPass)
 *    and the real pass: brand mark + name, 3-column stamp grid, centred QR.
 *  - Google Wallet — the real Android loyalty layout: circular logo + name,
 *    divider, big title, "Stamps X/Y" + "Rewards earned", big QR, code below.
 *
 * Colours come from the merchant's settings. Note the platform difference we
 * surface in the UI: the text colour applies to Apple only; Google auto-picks
 * text colour for contrast, so the Google card ignores cardTextColor.
 */
import QRCode from 'react-qr-code';
import { useTranslation } from 'react-i18next';

interface PreviewSettings {
  businessName: string;
  offerTitle: string;
  maxStamps: number;
  backgroundColor?: string | null;
  cardTextColor?: string | null;
  logoColor?: string | null;
  logoText?: string | null;
  logoImage?: string | null;
  logoMode?: 'stampfix' | 'custom' | 'none';
}

const isDark = (hex?: string | null) => {
  const h = (hex || '').replace('#', '');
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
};

function Mark({ color, className }: { color: string; className: string }) {
  return (
    <svg viewBox="0 0 290 90" className={className} fill={color} aria-hidden="true">
      <rect x="8" y="12" width="66" height="66" rx="4" />
      <circle cx="140" cy="45" r="34" />
      <rect x="195" y="36" width="90" height="18" rx="9" transform="rotate(45 240 45)" />
      <rect x="195" y="36" width="90" height="18" rx="9" transform="rotate(-45 240 45)" />
    </svg>
  );
}

/** One Apple stamp slot — cycles square / circle / cross. */
function Stamp({ index, filled, color }: { index: number; filled: boolean; color: string }) {
  const kind = index % 3;
  if (kind === 2) {
    return (
      <svg viewBox="0 0 24 24" className="w-[28px] h-[28px]" style={{ opacity: filled ? 1 : 0.35 }} aria-hidden="true">
        <rect x="2" y="9" width="20" height="6" rx="3" fill={color} transform="rotate(45 12 12)" />
        <rect x="2" y="9" width="20" height="6" rx="3" fill={color} transform="rotate(-45 12 12)" />
      </svg>
    );
  }
  const shape = kind === 1 ? 'rounded-full' : 'rounded-[7px]';
  return filled
    ? <div className={`w-[26px] h-[26px] ${shape}`} style={{ background: color }} />
    : <div className={`w-[26px] h-[26px] ${shape} border-2`} style={{ borderColor: color, opacity: 0.4 }} />;
}

/** Apple Wallet store card — matches the landing hero / real pass. */
function AppleCard({ s }: { s: PreviewSettings }) {
  const bg = s.backgroundColor || '#f0ece1';
  const ink = s.cardTextColor || (isDark(bg) ? '#FFFFFF' : '#1d3458');
  const MAX = s.maxStamps || 6;
  const filled = Math.min(2, MAX);
  const left = Math.max(0, MAX - filled);
  const mode = s.logoMode ?? 'stampfix';
  return (
    <div className="flex flex-col items-center">
      <div
        className="relative flex flex-col overflow-hidden rounded-[22px] px-4 pt-4 pb-4 shadow-[0_16px_36px_-14px_rgba(20,20,30,0.35)]"
        style={{ width: 268, minHeight: 374, background: bg, color: ink }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {mode === 'custom' && s.logoImage
              ? <img src={s.logoImage} alt="" className="h-[13px] w-auto max-w-[70px] object-contain shrink-0" />
              : mode === 'stampfix'
              ? <Mark color={s.logoColor || ink} className="h-[13px] w-auto shrink-0" />
              : null}
            <span className="text-[12px] font-bold leading-none truncate">{s.businessName || 'Your Business'}</span>
          </div>
          <div className="text-right shrink-0 pl-2">
            <div className="text-[7px] font-bold uppercase tracking-[0.12em] leading-none">Stamps left</div>
            <div className="text-[19px] font-medium leading-none mt-1.5">{left}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-y-3.5 place-items-center px-2">
          {Array.from({ length: Math.min(MAX, 12) }).map((_, i) => (
            <Stamp key={i} index={i} filled={i < filled} color={ink} />
          ))}
        </div>

        <div className="mt-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[6.5px] font-bold uppercase tracking-[0.14em] leading-none">Member</div>
            <div className="text-[12px] leading-tight mt-1 truncate">Lucky Müller</div>
          </div>
          <div className="text-right min-w-0">
            <div className="text-[6.5px] font-bold uppercase tracking-[0.14em] leading-none">Reward</div>
            <div className="text-[12px] leading-tight mt-1">{s.offerTitle || 'Buy 6, get 1 free'}</div>
          </div>
        </div>

        <div className="mt-auto mx-auto flex flex-col items-center rounded-[6px] bg-white px-2 pt-2 pb-1">
          <QRCode value="https://stampfix.app" size={86} level="L" bgColor="#FFFFFF" fgColor="#000000" />
          <div className="mt-1 text-[8px] font-medium tracking-wide text-black">SF00108</div>
        </div>
      </div>
      <div className="text-[11px] text-gray-400 mt-2">Apple Wallet</div>
    </div>
  );
}

/** Google Wallet loyalty card — matches the real Android render. */
function GoogleCard({ s }: { s: PreviewSettings }) {
  const bg = s.backgroundColor || '#f0ece1';
  const ink = isDark(bg) ? '#FFFFFF' : '#202124';   // Google auto-picks for contrast
  const MAX = s.maxStamps || 6;
  const filled = Math.min(2, MAX);
  const mode = s.logoMode ?? 'stampfix';
  const div = isDark(bg) ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.14)';
  const label = { opacity: 0.75 };
  return (
    <div className="flex flex-col items-center">
      <div
        className="relative flex flex-col overflow-hidden rounded-[24px] px-5 pt-4 pb-6 shadow-[0_16px_36px_-14px_rgba(20,20,30,0.35)]"
        style={{ width: 300, background: bg, color: ink }}
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden" style={{ width: 34, height: 34, background: '#2E2E2E' }}>
            {mode === 'custom' && s.logoImage
              ? <img src={s.logoImage} alt="" className="w-full h-full object-cover" />
              : <Mark color="#F5F5F5" className="w-[22px] h-auto" />}
          </span>
          <span className="text-[14px] font-medium truncate">{s.businessName || 'Your Business'}</span>
        </div>

        <div className="h-px -mx-5 w-[calc(100%+2.5rem)] my-3" style={{ background: div }} />

        <div className="text-[22px] font-normal leading-tight truncate">{s.businessName || 'Your Business'}</div>

        <div className="mt-4 flex items-start justify-between">
          <div>
            <div className="text-[11px]" style={label}>Stamps</div>
            <div className="text-[16px] font-bold mt-0.5">{filled} / {MAX}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px]" style={label}>Rewards earned</div>
            <div className="text-[16px] font-bold mt-0.5">2</div>
          </div>
        </div>

        <div className="mt-5 mx-auto rounded-2xl bg-white p-3">
          <QRCode value="https://stampfix.app" size={150} level="M" bgColor="#FFFFFF" fgColor="#000000" />
        </div>
        <div className="text-[13px] text-center mt-3 tracking-wide">6b2b3e75</div>
      </div>
      <div className="text-[11px] text-gray-400 mt-2">Google Wallet</div>
    </div>
  );
}

export function WalletLivePreview({ settings }: { settings: PreviewSettings }) {
  const { t } = useTranslation();
  return (
    <div className="mb-6">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">{t('cust.card.livePreview', { defaultValue: 'Live preview' })}</p>
      <div className="flex flex-wrap gap-6 justify-center sm:justify-start items-start">
        <AppleCard s={settings} />
        <GoogleCard s={settings} />
      </div>
      <p className="text-xs text-gray-400 mt-3">Real Apple Wallet and Google Wallet layouts. Press Save to apply colours to real cards.</p>
    </div>
  );
}
