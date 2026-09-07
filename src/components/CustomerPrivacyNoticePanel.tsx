import { useState } from 'react';
import { Shield, Loader2, Check } from 'lucide-react';
import type { Campaign } from '../types';
import { updateCampaign } from '../lib/db';
import { useToast } from './ToastProvider';
import { useTranslation } from 'react-i18next';

interface CustomerPrivacyNoticeProps {
  campaign: Campaign;
  onUpdated: (campaign: Campaign) => void;
}

/**
 * Lets the merchant write their own customer-facing privacy notice.
 * This is what customers see at signup when they click "privacy notice".
 *
 * GDPR positions the merchant as the data controller for their customer
 * relationship — they're the ones collecting names/emails for their own
 * loyalty program. Stampfix is the processor. So the merchant needs
 * their own privacy notice, separate from Stampfix's platform policy.
 *
 * If the merchant leaves this blank, customers see a generic fallback
 * that points back to Stampfix's general privacy policy plus a brief
 * description of how their data is used.
 */
export function CustomerPrivacyNoticePanel({ campaign, onUpdated }: CustomerPrivacyNoticeProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(campaign.customerPrivacyNotice ?? '');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const toast = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateCampaign(campaign.id, {
        customerPrivacyNotice: text.trim() || null,
      });
      onUpdated(updated);
      setSavedAt(Date.now());
      toast.success(t('dash.privacyNotice.toastSaved', { defaultValue: 'Privacy notice saved' }));
      setTimeout(() => setSavedAt(null), 3000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('dash.privacyNotice.errSave', { defaultValue: 'Could not save' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border notion-border p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-gray-500" /> {t('dash.privacyNotice.title', { defaultValue: 'Customer privacy notice' })}
        </h3>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          {t('dash.privacyNotice.sub', { defaultValue: "This is YOUR privacy notice to your customers. Under GDPR, you're the data controller for the customers who join your loyalty program. They'll see this when they sign up. If left blank, customers see a generic notice pointing to Stampfix's general policy." })}
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('dash.privacyNotice.placeholder', { defaultValue: "Example:\n\nWe collect your name and email to operate our loyalty program. We use it to track your stamps, notify you when you've earned a reward, and (with your consent) send occasional marketing emails. We don't share your data with third parties. You can request deletion of your data at any time by emailing privacy@yourshop.com." })}
        rows={10}
        className="w-full bg-[#F7F7F5] border notion-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#37352F]/20 resize-none font-mono leading-relaxed"
      />

      <div className="text-xs text-gray-400 -mt-2">
        {text.length} {t('dash.privacyNotice.chars', { defaultValue: 'characters. Plain text. Links and line breaks are preserved.' })}
      </div>

      <div className="flex items-center justify-between pt-2 border-t notion-border">
        <div className="text-xs">
          {savedAt ? (
            <span className="text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" /> {t('dash.privacyNotice.saved', { defaultValue: 'Saved' })}
            </span>
          ) : (
            <span className="text-gray-400">{t('dash.privacyNotice.immediate', { defaultValue: 'Changes show to new customers immediately.' })}</span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#37352F] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-opacity-90 transition disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {t('dash.privacyNotice.save', { defaultValue: 'Save' })}
        </button>
      </div>
    </div>
  );
}
