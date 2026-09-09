import type { ReactNode } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ProLockOverlayProps {
  /** When true, the children are blurred/disabled and the upgrade overlay shows. */
  locked: boolean;
  /** Short line describing what's locked, e.g. "Card colour is a Pro feature". */
  title: string;
  /** Opens the upgrade/checkout modal. */
  onUpgrade: () => void;
  children: ReactNode;
}

/**
 * Wraps a settings section and, on the free plan, overlays a lock + one-tap
 * "Upgrade to Pro" call to action. The underlying controls are kept visible
 * (blurred, non-interactive) so the merchant can see what they'd unlock.
 *
 * Pro merchants get the children untouched — zero visual change.
 */
export function ProLockOverlay({ locked, title, onUpgrade, children }: ProLockOverlayProps) {
  const { t } = useTranslation();
  if (!locked) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-40 blur-[1.5px]" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-6 bg-white/50 backdrop-blur-[1px] rounded-lg">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200 flex items-center justify-center mb-3 shadow-sm">
          <Lock className="w-5 h-5 text-amber-600" />
        </div>
        <p className="text-sm font-semibold text-[#37352F] mb-1">{title}</p>
        <p className="text-xs text-gray-500 mb-4 max-w-xs">
          {t('dash.prolock.unlock', { defaultValue: 'Upgrade to Stampfix Pro to unlock this.' })}
        </p>
        <button
          onClick={onUpgrade}
          className="inline-flex items-center gap-2 bg-[#37352F] text-white px-4 py-2 rounded-lg font-medium text-xs hover:bg-opacity-90 transition shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5" /> {t('dash.prolock.upgradePro', { defaultValue: 'Upgrade to Pro' })}
        </button>
      </div>
    </div>
  );
}
