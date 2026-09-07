import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { signOut } from '../lib/auth';
import { deleteMyAccount } from '../lib/db';
import type { MerchantBilling } from '../types';
import { useTranslation } from 'react-i18next';

/**
 * Settings → Danger Zone. Lets the merchant permanently delete their
 * own account (GDPR Article 17 right to erasure).
 *
 * UX guards (two-step confirmation):
 *   1. Click "Delete my account" → reveals a confirmation box
 *   2. Type the business name to confirm intent
 *   3. Click final "Delete forever" button
 *
 * Backend guard: delete_my_account() RPC refuses if the merchant's
 * Stripe subscription is still active. We surface that as a clear
 * message with a link to billing settings.
 */
export function DangerZonePanel({
  businessName,
  billing,
  onGoToBilling,
}: {
  businessName: string;
  billing: MerchantBilling;
  onGoToBilling: () => void;
}) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Best-effort client-side check. The backend re-checks authoritatively.
  // We treat 'pro' plan with any active sub status as blocking.
  const hasActiveSubscription = billing.plan === 'pro' && !!billing.stripeSubscriptionId;

  const handleDelete = async () => {
    if (typedName !== businessName) {
      setError(t('dash.danger.typeToConfirm', { name: businessName, defaultValue: 'Please type "{{name}}" exactly to confirm.' }));
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteMyAccount();
      if (!result.success) {
        // Backend blocked (e.g. subscription still active despite client check)
        setError(result.message ?? t('dash.danger.couldNotDelete', { defaultValue: 'Could not delete account.' }));
        setDeleting(false);
        return;
      }
      // Sign out and redirect to home. The merchant's row is now status='deleted'.
      await signOut();
      window.location.href = '/';
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dash.danger.couldNotDelete', { defaultValue: 'Could not delete account.' }));
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border-2 border-red-200 p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-5 h-5" /> {t('dash.danger.title', { defaultValue: 'Danger zone' })}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {t('dash.danger.sub', { defaultValue: 'Permanently delete your Stampfix account. This action is irreversible.' })}
        </p>
      </div>

      {hasActiveSubscription ? (
        // Subscription block — must cancel first.
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
          <p className="text-sm text-amber-900 font-medium mb-2">
            {t('dash.danger.activeSubTitle', { defaultValue: 'You have an active Pro subscription.' })}
          </p>
          <p className="text-xs text-amber-700 mb-3">
            {t('dash.danger.activeSubBody', { defaultValue: "Please cancel your subscription before deleting your account. Otherwise you'll continue to be charged." })}
          </p>
          <button
            onClick={onGoToBilling}
            className="bg-white border border-amber-300 text-amber-900 text-xs font-medium px-3 py-1.5 rounded hover:bg-amber-100 transition"
          >
            {t('dash.danger.goToBilling', { defaultValue: 'Go to billing settings' })}
          </button>
        </div>
      ) : !confirmOpen ? (
        // Free plan: show the initial delete trigger.
        <button
          onClick={() => setConfirmOpen(true)}
          className="border border-red-300 text-red-700 text-sm font-medium px-4 py-2 rounded hover:bg-red-50 transition"
        >
          {t('dash.danger.deleteAccount', { defaultValue: 'Delete my account' })}
        </button>
      ) : (
        // Confirmation form: type business name to proceed.
        <div className="bg-red-50 border border-red-200 rounded-md p-4 space-y-3">
          <div className="text-sm text-red-900 space-y-1">
            <p className="font-semibold">{t('dash.danger.willDelete', { defaultValue: 'This will permanently delete:' })}</p>
            <ul className="list-disc list-inside text-xs text-red-700 space-y-0.5 ml-1">
              <li>{t('dash.danger.li1', { defaultValue: 'Your account and all settings' })}</li>
              <li>{t('dash.danger.li2', { defaultValue: 'Your campaign and all locations' })}</li>
              <li>{t('dash.danger.li3', { defaultValue: 'All customer loyalty cards and their stamps' })}</li>
              <li>{t('dash.danger.li4', { defaultValue: 'All activity history and insights' })}</li>
            </ul>
            <p className="text-xs text-red-700 italic pt-1">
              {t('dash.danger.customersLose', { defaultValue: 'Your customers will lose access to their cards. This cannot be undone.' })}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-red-900 block">
              {t('dash.danger.typeA', { defaultValue: 'Type' })} <strong className="font-mono">{businessName}</strong> {t('dash.danger.typeB', { defaultValue: 'to confirm:' })}
            </label>
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={businessName}
              className="w-full bg-white border border-red-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              disabled={deleting}
            />
          </div>
          {error && (
            <div className="text-xs text-red-700 bg-white border border-red-200 rounded p-2">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { setConfirmOpen(false); setTypedName(''); setError(null); }}
              disabled={deleting}
              className="text-sm px-3 py-1.5 rounded border notion-border hover:bg-white text-gray-600 disabled:opacity-50"
            >
              {t('dash.danger.cancel', { defaultValue: 'Cancel' })}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting || typedName !== businessName}
              className="bg-red-600 text-white text-sm font-medium px-4 py-1.5 rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t('dash.danger.deleteForever', { defaultValue: 'Delete forever' })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
