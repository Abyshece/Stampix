import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * "Add to Apple Wallet" button. Shown on iOS / Mac.
 *
 * iOS only adds a pass to Wallet when Safari downloads a real URL that
 * responds with Content-Type: application/vnd.apple.pkpass. Blob URLs
 * and fetch()+download do NOT trigger the Wallet sheet ("Safari cannot
 * download this file"). So we navigate the browser straight to the edge
 * function's GET endpoint, which streams the signed .pkpass with the
 * correct MIME type — iOS then shows the Add-to-Wallet sheet.
 *
 * The cardId is already public (it's encoded in the card's QR code), so
 * exposing it in the URL is not a sensitivity concern. The edge function
 * must have JWT verification disabled (it's a public pass-download URL).
 */
export function AddToAppleWalletButton({ cardId }: { cardId: string }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  // Only show on iOS / iPadOS / Mac (Apple Wallet platforms).
  const isApple = typeof navigator !== 'undefined'
    && /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);
  if (!isApple) return null;

  const handleAdd = () => {
    setLoading(true);
    const base = import.meta.env.VITE_SUPABASE_URL as string;
    const url = `${base}/functions/v1/generate-apple-pass?cardId=${encodeURIComponent(cardId)}`;
    // Direct navigation: Safari fetches the .pkpass and opens the Wallet sheet.
    window.location.href = url;
    setTimeout(() => setLoading(false), 3000);
  };

  return (
    <button
      onClick={handleAdd}
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 bg-black text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-900 disabled:opacity-60 transition w-full"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          <svg className="w-4 h-4" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
            <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
          </svg>
          {t('cust.wallet.addApple', { defaultValue: 'Add to Apple Wallet' })}
        </>
      )}
    </button>
  );
}
