import { useState } from 'react';
import { updateCampaign } from '../lib/db';
import type { Campaign } from '../types';
import { Loader2, Check, Link as LinkIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Keep these keys in sync with the wallet functions (generate-apple-pass /
// sync-wallet-object) which read the same keys from campaign.social_links.
const LINK_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: 'website',   label: 'Website',      placeholder: 'yourbusiness.com' },
  { key: 'googleReview', label: 'Leave a review', placeholder: 'Your Google review link' },
  { key: 'order',     label: 'Order online', placeholder: 'order.yourbusiness.com' },
  { key: 'delivery',  label: 'Delivery',     placeholder: 'Lieferando / Uber Eats / DoorDash link' },
  { key: 'instagram', label: 'Instagram',    placeholder: 'instagram.com/yourbusiness' },
  { key: 'facebook',  label: 'Facebook',     placeholder: 'facebook.com/yourbusiness' },
  { key: 'tiktok',    label: 'TikTok',       placeholder: 'tiktok.com/@yourbusiness' },
  { key: 'linkedin',  label: 'LinkedIn',     placeholder: 'linkedin.com/company/yourbusiness' },
];

/** Adds https:// to a bare domain so the link is tappable in the wallet. */
function normalize(v: string): string {
  const t = v.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t) || /^(mailto:|tel:)/i.test(t)) return t;
  return `https://${t}`;
}

export function LinksSettings({
  campaign,
  onUpdated,
}: {
  campaign: Campaign;
  onUpdated: (c: Campaign) => void;
}) {
  const { t } = useTranslation();
  const [links, setLinks] = useState<Record<string, string>>(campaign.socialLinks ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    setSaving(true);
    try {
      const cleaned: Record<string, string> = {};
      for (const f of LINK_FIELDS) {
        const v = normalize(links[f.key] ?? '');
        if (v) cleaned[f.key] = v;
      }
      const updated = await updateCampaign(campaign.id, { socialLinks: cleaned });
      onUpdated(updated);
      setLinks(cleaned);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('dash.links.errSave', { defaultValue: 'Could not save your links' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-xl">
      <p className="text-xs text-gray-400">
        {t('dash.links.descA', { defaultValue: 'Fill in any of these — each one appears as a tappable link on the' })} <b>{t('dash.links.descBold', { defaultValue: 'back' })}</b> {t('dash.links.descB', { defaultValue: "of the customer's Apple Wallet card (tap the ••• button) and in the Google Wallet card details. Leave the rest blank." })}
      </p>

      <div className="space-y-3">
        {LINK_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <label className="text-xs font-bold uppercase text-gray-400 tracking-wider">{t(`dash.links.${f.key}`, { defaultValue: f.label })}</label>
            <input
              type="url"
              inputMode="url"
              value={links[f.key] ?? ''}
              onChange={(e) => setLinks((p) => ({ ...p, [f.key]: e.target.value }))}
              placeholder={t(`dash.links.${f.key}Ph`, { defaultValue: f.placeholder })}
              className="w-full bg-[#F7F7F5] border notion-border rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#37352F]/20"
            />
          </div>
        ))}
      </div>

      {err && <div className="text-xs text-red-600 bg-red-50 border border-red-100 p-2 rounded">{err}</div>}

      <button
        onClick={save}
        disabled={saving}
        className="bg-[#37352F] text-white text-sm px-4 py-2 rounded-md hover:bg-opacity-90 transition disabled:opacity-50 flex items-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
        {saved ? t('dash.links.saved', { defaultValue: 'Saved' }) : t('dash.links.save', { defaultValue: 'Save links' })}
      </button>

      <p className="text-[11px] text-gray-400">
        {t('dash.links.footer', { defaultValue: 'Existing cardholders get the new links automatically the next time their pass refreshes.' })}
      </p>
    </div>
  );
}
