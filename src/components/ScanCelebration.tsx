import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

export interface CelebrationData {
  customerName: string;
  currentStamps: number;
  maxStamps: number;
  offerTitle: string;
  /** True when this scan redeemed the reward (card reset to 0). */
  redeemed: boolean;
}

const COLORS = ['#EA3323', '#F7CE46', '#1132F5', '#75FBFD', '#EA33B6', '#510AF5', '#75FBE2', '#F0A479'];

/**
 * Celebratory pop-up shown after a successful scan. White card on a blurred
 * backdrop, confetti rain, animated stamp dots, and a state-aware message —
 * "one more to go", "reward unlocked", "reward redeemed". Auto-dismisses after
 * 5 seconds (restarting the timer on each fresh scan) and on tap.
 */
export function ScanCelebration({ data, onClose }: { data: CelebrationData; onClose: () => void }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const t = setTimeout(() => closeRef.current(), 5000);
    return () => clearTimeout(t);
  }, [data]);

  const stampsLeft = Math.max(0, data.maxStamps - data.currentStamps);
  const redeemed = data.redeemed;
  const unlocked = !redeemed && data.maxStamps > 0 && data.currentStamps >= data.maxStamps;
  const oneMore = !redeemed && !unlocked && stampsLeft === 1;
  const big = redeemed || unlocked;

  const pieces = useMemo(
    () =>
      Array.from({ length: big ? 90 : 60 }, (_, i) => {
        const duration = 2.3 + Math.random() * 1.9;
        return {
          id: i,
          left: Math.random() * 100,
          // Negative delay starts each piece partway through its fall, so the
          // confetti is dense from the first frame and keeps raining evenly for
          // the full 5 seconds (the animation loops infinitely below).
          delay: -(Math.random() * duration),
          duration,
          size: 7 + Math.random() * 9,
          color: COLORS[i % COLORS.length],
          rotate: Math.random() * 360,
          round: Math.random() > 0.5,
        };
      }),
    [big],
  );

  const { t } = useTranslation();
  const emoji = redeemed ? '🎁' : unlocked ? '🎉' : oneMore ? '🔥' : '✨';
  const headline = redeemed
    ? t('cust.celebrate.hRedeemed', { defaultValue: 'Reward redeemed!' })
    : unlocked
    ? t('cust.celebrate.hUnlocked', { defaultValue: 'Reward unlocked!' })
    : oneMore
    ? t('cust.celebrate.hOneMore', { defaultValue: 'One more to go!' })
    : t('cust.celebrate.hStamp', { defaultValue: 'Stamp added!' });
  const sub = redeemed
    ? t('cust.celebrate.sRedeemed', { name: data.customerName, offer: data.offerTitle, defaultValue: '{{name}} just enjoyed “{{offer}}”' })
    : unlocked
    ? t('cust.celebrate.sUnlocked', { name: data.customerName, offer: data.offerTitle, defaultValue: '{{name}} earned “{{offer}}”' })
    : oneMore
    ? t('cust.celebrate.sOneMore', { name: data.customerName, defaultValue: '{{name}} needs just 1 more stamp' })
    : t('cust.celebrate.sNice', { name: data.customerName, defaultValue: 'Nice one, {{name}}!' });

  const total = Math.min(data.maxStamps || 0, 12);
  const filled = redeemed ? total : Math.min(data.currentStamps, total);

  const pill = redeemed
    ? t('cust.celebrate.pFresh', { defaultValue: 'Fresh card — back to zero ✨' })
    : unlocked
    ? t('cust.celebrate.pComplete', { defaultValue: 'Card complete 🎯' })
    : t(`cust.celebrate.pLeft${stampsLeft === 1 ? 'One' : 'Other'}`, { count: stampsLeft, defaultValue: stampsLeft === 1 ? '{{count}} stamp left to get a reward' : '{{count}} stamps left to get a reward' });

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 cursor-pointer"
      style={{ background: 'rgba(15,15,20,0.45)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
    >
      <style>{`
        @keyframes sc-fall { 0%{transform:translateY(-14vh) rotate(0);opacity:0} 8%{opacity:1} 100%{transform:translateY(112vh) rotate(720deg);opacity:1} }
        @keyframes sc-pop { 0%{transform:scale(.6);opacity:0} 60%{transform:scale(1.06);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes sc-emoji { 0%{transform:scale(0) rotate(-30deg)} 55%{transform:scale(1.3) rotate(10deg)} 100%{transform:scale(1) rotate(0)} }
        @keyframes sc-dot { 0%{transform:scale(0)} 60%{transform:scale(1.25)} 100%{transform:scale(1)} }
        @keyframes sc-glow { 0%,100%{box-shadow:0 24px 60px -20px rgba(0,0,0,.45)} 50%{box-shadow:0 24px 90px -8px rgba(234,51,182,.5)} }
      `}</style>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((p) => (
          <span
            key={p.id}
            style={{
              position: 'absolute',
              top: 0,
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              background: p.color,
              borderRadius: p.round ? '50%' : 2,
              transform: `rotate(${p.rotate}deg)`,
              animation: `sc-fall ${p.duration}s linear ${p.delay}s infinite`,
            }}
          />
        ))}
      </div>

      <div
        className="relative w-full max-w-sm bg-white rounded-3xl px-8 py-9 text-center shadow-2xl"
        style={{
          animation: big
            ? 'sc-pop .5s cubic-bezier(.2,.8,.2,1.2) both, sc-glow 1.6s ease-in-out .5s infinite'
            : 'sc-pop .5s cubic-bezier(.2,.8,.2,1.2) both',
        }}
      >
        <div className="text-6xl mb-3 select-none" style={{ animation: 'sc-emoji .6s cubic-bezier(.2,.8,.2,1.4) both' }}>
          {emoji}
        </div>
        <h2 className="text-3xl font-serif-display font-semibold text-[#37352F] leading-tight">{headline}</h2>
        <p className="mt-2 text-sm text-gray-500">{sub}</p>

        {total > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {Array.from({ length: total }).map((_, i) => {
              const on = i < filled;
              return (
                <span
                  key={i}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: on ? COLORS[i % COLORS.length] : 'transparent',
                    border: on ? 'none' : '2px solid #E7E7E4',
                    animation: on ? `sc-dot .4s ease ${0.2 + i * 0.05}s both` : 'none',
                  }}
                />
              );
            })}
          </div>
        )}

        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#F7F7F5] px-4 py-2 text-sm font-medium text-[#37352F]">
          {pill}
        </div>
        {!big && data.offerTitle && (
          <p className="mt-2 text-[11px] text-gray-400">{data.offerTitle}</p>
        )}

        <p className="mt-5 text-[11px] text-gray-300">{t('cust.celebrate.tapDismiss', { defaultValue: 'tap anywhere to dismiss' })}</p>
      </div>
    </div>,
    document.body,
  );
}
