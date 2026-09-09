import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

export interface RejectionData {
  /** The merchant's business name, so staff know which card to ask for. */
  businessName: string;
}

/**
 * Shown when a scanned card belongs to a DIFFERENT business — the firm,
 * clearly-negative counterpart to the success celebration.
 *
 * Deliberately NOT confetti: a dark-red backdrop with slow-moving warning
 * stripes, a loyalty card that buzzes/shakes with a big red ✕ stamped on it,
 * and a blunt message. Stays up for 10 seconds (restarting on each fresh scan)
 * so the merchant can clearly see what went wrong, and dismisses on tap.
 */
export function ScanRejection({ data, onClose }: { data: RejectionData; onClose: () => void }) {
  const { t } = useTranslation();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const t = setTimeout(() => closeRef.current(), 10000);
    return () => clearTimeout(t);
  }, [data]);

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 cursor-pointer"
      style={{ background: 'rgba(38,8,8,0.55)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
    >
      <style>{`
        @keyframes sr-stripes { from { background-position: 0 0 } to { background-position: 56px 0 } }
        @keyframes sr-shake { 0%,100%{transform:translateX(0) rotate(-4deg)} 15%{transform:translateX(-10px) rotate(-8deg)} 35%{transform:translateX(9px) rotate(0deg)} 55%{transform:translateX(-7px) rotate(-7deg)} 75%{transform:translateX(6px) rotate(-1deg)} 90%{transform:translateX(-3px) rotate(-5deg)} }
        @keyframes sr-pop { 0%{transform:scale(.6);opacity:0} 60%{transform:scale(1.06);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes sr-pulse { 0%,100%{transform:scale(1);opacity:.45} 50%{transform:scale(1.18);opacity:.12} }
        @keyframes sr-xpop { 0%{transform:scale(0) rotate(-40deg)} 60%{transform:scale(1.28) rotate(10deg)} 100%{transform:scale(1) rotate(0)} }
      `}</style>

      {/* Slow-moving red hazard stripes — the "anti-confetti" motion */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.13]"
        style={{
          background: 'repeating-linear-gradient(45deg, #EA3323 0 28px, transparent 28px 56px)',
          animation: 'sr-stripes 0.85s linear infinite',
        }}
      />

      <div
        className="relative w-full max-w-sm bg-white rounded-3xl px-8 py-9 text-center shadow-2xl"
        style={{ animation: 'sr-pop .45s cubic-bezier(.2,.8,.2,1.2) both' }}
      >
        {/* Buzzing card + red ✕ badge */}
        <div className="relative mx-auto mb-6" style={{ width: 136, height: 88 }}>
          <div className="absolute -inset-4 rounded-[28px] bg-[#EA3323]" style={{ animation: 'sr-pulse 1.2s ease-in-out infinite' }} />
          <div
            className="absolute inset-0 rounded-2xl bg-[#ECECEA] border border-black/10 shadow-md flex items-center justify-center"
            style={{ animation: 'sr-shake 0.9s ease-in-out infinite' }}
          >
            <div className="flex items-center gap-1.5 opacity-40">
              <span className="block w-4 h-4 rounded-[3px] bg-[#37352F]" />
              <span className="block w-4 h-4 rounded-full bg-[#37352F]" />
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="#37352F" strokeWidth={3.5} strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
            </div>
          </div>
          <div
            className="absolute -right-3 -top-3 w-12 h-12 rounded-full bg-[#EA3323] text-white flex items-center justify-center shadow-lg ring-4 ring-white"
            style={{ animation: 'sr-xpop .5s cubic-bezier(.2,.8,.2,1.4) .1s both' }}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
          </div>
        </div>

        <h2 className="text-3xl font-serif-display font-semibold text-[#EA3323] leading-tight">{t('cust.reject.wrongCard', { defaultValue: 'Wrong card' })}</h2>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          {t('cust.reject.notFromA', { defaultValue: 'This card isn’t from' })} <span className="font-semibold text-[#37352F]">{data.businessName}</span>{t('cust.reject.notFromB', { defaultValue: '. It belongs to a different shop.' })}
        </p>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-red-50 text-red-700 px-4 py-2 text-sm font-medium">
          {t('cust.reject.askFor', { name: data.businessName, defaultValue: 'Ask for their {{name}} card — or sign them up' })}
        </div>

        <p className="mt-5 text-[11px] text-gray-300">{t('cust.reject.tapDismiss', { defaultValue: 'tap anywhere to dismiss' })}</p>
      </div>
    </div>,
    document.body,
  );
}
