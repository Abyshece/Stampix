import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';

/**
 * GDPR Art. 20 / PIPEDA Principle 9 data export button.
 *
 * Triggers a server RPC that aggregates all data attributable to the
 * current authenticated user, then downloads the result as a JSON file.
 *
 * Two variants — pick the right RPC depending on whether this is being
 * mounted on the customer-facing /my-card page or the merchant Settings
 * page. Identical UI for both.
 */
export function DownloadMyDataButton({
  variant,
  className = '',
}: {
  variant: 'customer' | 'merchant';
  className?: string;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    try {
      const rpcName = variant === 'customer'
        ? 'export_my_customer_data'
        : 'export_my_merchant_data';
      const { data, error: rpcErr } = await supabase.rpc(rpcName);
      if (rpcErr) throw rpcErr;
      if (!data) throw new Error('No data returned');

      // Build a downloadable JSON file. Filename includes ISO date so a
      // user can keep multiple exports without overwriting.
      const today = new Date().toISOString().split('T')[0];
      const filename = variant === 'customer'
        ? `stampfix-my-data-${today}.json`
        : `stampfix-merchant-export-${today}.json`;

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dash.data.errDownload', { defaultValue: 'Download failed' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <button
        onClick={handleDownload}
        disabled={loading}
        className="inline-flex items-center gap-2 text-sm border notion-border bg-white rounded-md px-3 py-1.5 hover:bg-[#F7F7F5] disabled:opacity-60 transition"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        {t('dash.data.download', { defaultValue: 'Download my data' })}
      </button>
      {error && (
        <div className="mt-2 text-xs text-red-600">{error}</div>
      )}
    </div>
  );
}
