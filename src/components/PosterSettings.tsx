import { useState, useMemo } from 'react';
import { Palette, Check, Loader2, Lock, Sparkles } from 'lucide-react';
import type { Campaign } from '../types';
import { updateCampaign } from '../lib/db';
import { downloadInstagramPng, downloadTableQrPng } from '../services/posterImage';
import { buildPosterHtml } from '../services/posterGenerator';
import { toPng } from 'html-to-image';
import { useToast } from './ToastProvider';
import { ProLockOverlay } from './ProLockOverlay';
import { logMerchantActivity } from '../lib/db';
import { useTranslation } from 'react-i18next';

interface PosterSettingsProps {
  campaign: Campaign;
  onUpdated: (campaign: Campaign) => void;
  /** Custom poster branding is Pro-only; free posters use a plain white background. */
  isPro: boolean;
  onUpgrade: () => void;
}

/**
 * Three named presets the merchant can pick with one click. Each is a
 * solid hex; readable on white text, looks intentional in print.
 */
const PRESETS: Array<{ id: string; label: string; value: string }> = [
  { id: 'blue',  label: 'Royal Blue',  value: '#1E40AF' },
  { id: 'green', label: 'Forest',      value: '#16A34A' },
  { id: 'red',   label: 'Crimson',     value: '#DC2626' },
];

/**
 * Default starting colors for the custom gradient picker. Picked to
 * give a pleasant default if the merchant hasn't touched it yet.
 */
const GRAD_DEFAULTS = { from: '#1E40AF', to: '#7C3AED', angle: 135 };

/**
 * Settings panel that controls poster appearance.
 *
 * Three modes the merchant can choose:
 *   1. "Match my card" - posterColor is null, posters render with primaryColor
 *   2. A preset solid color - posterColor stores the hex (e.g. '#1E40AF')
 *   3. Custom gradient - posterColor stores a CSS gradient string
 *
 * On save, we just write to campaign.poster_color. The renderer in
 * posterGenerator.ts drops the value straight into `background:`, so
 * solids and gradients are treated identically.
 */
export function PosterSettings({ campaign, onUpdated, isPro, onUpgrade }: PosterSettingsProps) {
  const { t } = useTranslation();
  const stored = campaign.posterColor;

  // Detect what kind of value is currently saved.
  const initialMode: 'white' | 'preset' | 'gradient' =
    !stored ? 'white'
    : stored.startsWith('linear-gradient') ? 'gradient'
    : 'preset';

  const [mode, setMode] = useState<'white' | 'preset' | 'gradient'>(initialMode);
  const [presetValue, setPresetValue] = useState<string>(
    initialMode === 'preset' ? stored! : PRESETS[0].value,
  );
  const [gradFrom, setGradFrom] = useState<string>(parseGradient(stored)?.from ?? GRAD_DEFAULTS.from);
  const [gradTo,   setGradTo]   = useState<string>(parseGradient(stored)?.to   ?? GRAD_DEFAULTS.to);
  const [gradAngle, setGradAngle] = useState<number>(parseGradient(stored)?.angle ?? GRAD_DEFAULTS.angle);

  const [saving, setSaving] = useState(false);
  const [cardColor, setCardColor] = useState<string>(''); // '' = auto (contrast-based)
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const toast = useToast();

  /** The computed value we'll save, derived from the current mode. */
  const computedValue: string | null = useMemo(() => {
    if (mode === 'white') return null;
    if (mode === 'preset') return presetValue;
    return `linear-gradient(${gradAngle}deg, ${gradFrom} 0%, ${gradTo} 100%)`;
  }, [mode, presetValue, gradFrom, gradTo, gradAngle]);

  /** What the poster background actually IS right now (white by default). */
  const previewBg = computedValue ?? '#FFFFFF';
  // Readable text colour for the preview (dark on light, white on dark).
  const previewInk = pickInk(previewBg);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateCampaign(campaign.id, { posterColor: computedValue });
      onUpdated(updated);
      setSavedAt(Date.now());
      toast.success(t('dash.poster.toastSaved', { defaultValue: 'Poster appearance saved' }));
      setTimeout(() => setSavedAt(null), 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('dash.poster.errSave', { defaultValue: 'Could not save poster color' });
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  /** Render the selected poster to a PNG and download it directly. */
  const handlePreview = async (size: 'card' | 'pamphlet' | 'poster' | 'instagram' | 'table' | 'sticker' | 'selfscan' | 'loyalty') => {
    const html = buildPosterHtml({
      campaign,
      size,
      posterBgOverride: previewBg,
      cardColorOverride: cardColor || undefined,
    });
    // Pull the styles + the specific format element out of the generated
    // document and render just that element off-screen, then snapshot it.
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const styleText = Array.from(doc.querySelectorAll('style')).map((s) => s.textContent || '').join('\n');
    const posterEl = doc.querySelector('.size-' + size) as HTMLElement | null;
    if (!posterEl) return;

    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;';
    const styleEl = document.createElement('style');
    styleEl.textContent = styleText;
    holder.appendChild(styleEl);
    const clone = posterEl.cloneNode(true) as HTMLElement;
    clone.style.margin = '0';
    holder.appendChild(clone);
    document.body.appendChild(holder);

    try {
      // Wait for the QR image(s) and web fonts before snapshotting.
      const imgs = Array.from(clone.querySelectorAll('img'));
      await Promise.all(imgs.map((img) =>
        img.complete && img.naturalWidth
          ? Promise.resolve()
          : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); }),
      ));
      if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch { /* ignore */ } }
      await new Promise((r) => setTimeout(r, 120));

      const dataUrl = await toPng(clone, { pixelRatio: 2, cacheBust: true, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `stampfix-${size}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('[poster png]', err);
      alert(t('dash.poster.errPng', { defaultValue: 'Could not generate the PNG — please try again.' }));
    } finally {
      document.body.removeChild(holder);
    }
  };

  return (
    <ProLockOverlay locked={!isPro} title={t('dash.poster.proTitle', { defaultValue: 'Custom poster colours are a Pro feature' })} onUpgrade={onUpgrade}>
    <div className="bg-white rounded-lg border notion-border p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Palette className="w-5 h-5 text-gray-500" /> {t('dash.poster.title', { defaultValue: 'Poster appearance' })}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {t('dash.poster.sub', { defaultValue: 'Pick the background color for the printable posters customers see at your counter.' })}
        </p>
      </div>

      {/* Live preview swatch — shows the user what they're saving */}
      <div
        className="rounded-lg h-24 border notion-border flex items-center justify-center font-serif-display text-2xl font-semibold tracking-wide shadow-inner"
        style={{ background: previewBg, color: previewInk }}
      >
        {t('dash.poster.scanSave', { defaultValue: 'SCAN & SAVE' })}
      </div>

      {/* Mode selector */}
      <div className="space-y-3">
        <ModeRow
          active={mode === 'white'}
          onClick={() => setMode('white')}
          label={t('dash.poster.white', { defaultValue: 'White (default)' })}
          hint={t('dash.poster.whiteHint', { defaultValue: 'Clean white background — recommended for print.' })}
          swatch="#FFFFFF"
        />
        <ModeRow
          active={mode === 'preset'}
          onClick={() => setMode('preset')}
          label={t('dash.poster.preset', { defaultValue: 'Pick a preset' })}
          hint={t('dash.poster.presetHint', { defaultValue: 'Three brand-friendly solid colors.' })}
        >
          {mode === 'preset' && (
            <div className="flex gap-3 pt-3">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPresetValue(p.value)}
                  className={`flex-1 rounded-lg h-14 border-2 transition flex items-center justify-center ${
                    presetValue === p.value ? 'border-[#37352F] ring-2 ring-[#37352F]/20' : 'border-transparent'
                  }`}
                  style={{ background: p.value }}
                  aria-label={t(`dash.poster.preset_${p.id}`, { defaultValue: p.label })}
                >
                  {presetValue === p.value && <Check className="w-5 h-5 text-white" strokeWidth={3} />}
                </button>
              ))}
            </div>
          )}
        </ModeRow>
        <ModeRow
          active={mode === 'gradient'}
          onClick={() => setMode('gradient')}
          label={t('dash.poster.gradient', { defaultValue: 'Custom gradient' })}
          hint={t('dash.poster.gradientHint', { defaultValue: 'Pick any two colors and an angle.' })}
        >
          {mode === 'gradient' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
              <ColorPicker label={t('dash.poster.from', { defaultValue: 'From' })} value={gradFrom} onChange={setGradFrom} />
              <ColorPicker label={t('dash.poster.to', { defaultValue: 'To' })} value={gradTo} onChange={setGradTo} />
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium text-gray-600 flex justify-between">
                  <span>{t('dash.poster.angle', { defaultValue: 'Angle' })}</span>
                  <span className="text-gray-400">{gradAngle}°</span>
                </label>
                <input
                  type="range" min={0} max={360} step={5}
                  value={gradAngle}
                  onChange={(e) => setGradAngle(Number(e.target.value))}
                  className="w-full accent-[#37352F]"
                />
              </div>
            </div>
          )}
        </ModeRow>
      </div>

      {/* Wallet card colour on the poster */}
      <div className="space-y-2 pt-3 border-t notion-border">
        <label className="text-sm font-medium">{t('dash.poster.cardColour', { defaultValue: 'Wallet card colour' })}</label>
        <p className="text-xs text-gray-400 -mt-1">{t('dash.poster.cardColourHint', { defaultValue: 'The sample loyalty card shown on the poster. Auto uses a white card on a coloured background, and a black card on a white one.' })}</p>
        <div className="flex gap-2 pt-1">
          {([['', t('dash.poster.auto', { defaultValue: 'Auto' })], ['#FFFFFF', t('dash.poster.cardWhite', { defaultValue: 'White' })], ['#111318', t('dash.poster.cardBlack', { defaultValue: 'Black' })]] as const).map(([val, label]) => (
            <button
              key={label}
              onClick={() => setCardColor(val)}
              className={`flex-1 rounded-md h-11 border-2 text-xs font-medium transition flex items-center justify-center gap-2 ${cardColor === val ? 'border-[#37352F] ring-2 ring-[#37352F]/20' : 'border-gray-200 hover:border-gray-300'}`}
            >
              {val && <span className="w-4 h-4 rounded border border-black/10" style={{ background: val }} />}
              {label}
            </button>
          ))}
        </div>
        <div className="pt-1">
          <ColorPicker label={t('dash.poster.customCardColour', { defaultValue: 'Or a custom card colour' })} value={/^#[0-9a-fA-F]{6}$/.test(cardColor) ? cardColor : '#FFFFFF'} onChange={setCardColor} />
        </div>
      </div>

      {/* Preview links */}
      <div className="flex flex-wrap gap-2 pt-2 border-t notion-border">
        <span className="text-xs text-gray-400 self-center mr-2">{t('dash.poster.downloadPng', { defaultValue: 'Download as PNG:' })}</span>
        <button
          onClick={() => handlePreview('card')}
          className="text-xs px-3 py-1.5 rounded-md border notion-border hover:bg-[#F7F7F5] transition"
        >
          {t('dash.poster.businessCard', { defaultValue: 'Business card' })}
        </button>
        <button
          onClick={() => handlePreview('loyalty')}
          className="text-xs px-3 py-1.5 rounded-md border notion-border hover:bg-[#F7F7F5] transition"
        >
          {t('dash.poster.pamphlet', { defaultValue: 'Pamphlet' })}
        </button>
        <button
          onClick={() => handlePreview('selfscan')}
          className="text-xs px-3 py-1.5 rounded-md border notion-border hover:bg-[#F7F7F5] transition"
        >
          {t('dash.poster.selfScan', { defaultValue: 'Self-scan poster' })}
        </button>
        <button
          onClick={() => handlePreview('sticker')}
          className="text-xs px-3 py-1.5 rounded-md border notion-border hover:bg-[#F7F7F5] transition"
        >
          {t('dash.poster.stickerSheet', { defaultValue: 'Sticker sheet (A4)' })}
        </button>
        <button
          onClick={() => { downloadInstagramPng(campaign, previewBg); logMerchantActivity('poster_downloaded', { type: 'instagram' }); }}
          className="text-xs px-3 py-1.5 rounded-md bg-[#37352F] text-white hover:opacity-90 transition"
        >
          {t('dash.poster.instagramPng', { defaultValue: '⬇ Instagram PNG' })}
        </button>
        <button
          onClick={() => downloadTableQrPng(campaign, previewBg)}
          className="text-xs px-3 py-1.5 rounded-md bg-[#37352F] text-white hover:opacity-90 transition"
        >
          {t('dash.poster.tableQrPng', { defaultValue: '⬇ Table QR PNG' })}
        </button>
      </div>

      {/* Save */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs">
          {savedAt ? (
            <span className="text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" /> {t('dash.poster.saved', { defaultValue: 'Saved' })}
            </span>
          ) : (
            <span className="text-gray-400">{t('dash.poster.changesApply', { defaultValue: 'Changes apply next time you download a poster.' })}</span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#37352F] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-opacity-90 transition disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {t('dash.poster.save', { defaultValue: 'Save' })}
        </button>
      </div>
    </div>
    </ProLockOverlay>
  );
}

// ---------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------

function ModeRow({
  active, onClick, label, hint, swatch, children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
  swatch?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`border rounded-lg p-3 transition ${
      active ? 'border-[#37352F]/30 bg-[#F7F7F5]' : 'notion-border bg-white'
    }`}>
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 text-left"
      >
        <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
          active ? 'border-[#37352F]' : 'border-gray-300'
        }`}>
          {active && <div className="w-2 h-2 rounded-full bg-[#37352F]" />}
        </div>
        {swatch && (
          <div className="w-6 h-6 rounded border notion-border flex-shrink-0" style={{ background: swatch }} />
        )}
        <div className="flex-1">
          <div className="text-sm font-medium">{label}</div>
          {hint && <div className="text-xs text-gray-500">{hint}</div>}
        </div>
      </button>
      {children}
    </div>
  );
}

function ColorPicker({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <div className="flex gap-2 items-center min-w-0">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-10 rounded border notion-border cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 bg-white border notion-border rounded-md px-2 py-1.5 text-xs font-mono uppercase"
          maxLength={7}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------

/**
 * Picks a readable text colour for a background — dark ink on light
 * backgrounds, white on dark ones. For gradients it reads the first stop.
 */
function pickInk(bg: string): string {
  const m = /#([0-9a-fA-F]{6})/.exec(bg || '');
  if (!m) return '#1A1A1A';
  const n = parseInt(m[1], 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? '#1A1A1A' : '#FFFFFF';
}

/**
 * Extracts the `from`, `to`, and `angle` from a stored gradient string.
 * Returns null if the stored value isn't a recognisable gradient.
 *
 * Supports the format we write: `linear-gradient(135deg, #1E40AF 0%, #7C3AED 100%)`.
 * Other gradient shapes return null and the picker shows defaults.
 */
function parseGradient(stored?: string | null): { from: string; to: string; angle: number } | null {
  if (!stored || !stored.startsWith('linear-gradient')) return null;
  const match = stored.match(/linear-gradient\(\s*(\d+)deg\s*,\s*(#[0-9a-f]{6})\s*0%\s*,\s*(#[0-9a-f]{6})\s*100%\s*\)/i);
  if (!match) return null;
  return {
    angle: parseInt(match[1], 10),
    from: match[2],
    to: match[3],
  };
}
