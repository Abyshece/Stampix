import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const WELCOME_COLORS = ['#EA3323', '#F7CE46', '#1132F5', '#75FBFD', '#EA33B6', '#510AF5'];

/** One-time welcome for a freshly-joined card: tells the customer to ask the
 *  counter to scan/tap the stamp QR, with a little confetti. */
export function WelcomeModal({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();
  const pieces = useMemo(
    () => Array.from({ length: 40 }, (_, i) => {
      const d = 2.2 + Math.random() * 1.8;
      return { id: i, left: Math.random() * 100, delay: -(Math.random() * d), duration: d, size: 6 + Math.random() * 8, color: WELCOME_COLORS[i % WELCOME_COLORS.length], rotate: Math.random() * 360, round: Math.random() > 0.5 };
    }),
    [],
  );
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-6">
      <style>{`@keyframes wm-fall{0%{transform:translateY(-10vh) rotate(0);opacity:0}8%{opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:1}}`}</style>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {pieces.map((p) => (
          <span key={p.id} style={{ position: 'absolute', top: 0, left: `${p.left}%`, width: p.size, height: p.size, background: p.color, borderRadius: p.round ? '50%' : 2, transform: `rotate(${p.rotate}deg)`, animation: `wm-fall ${p.duration}s linear ${p.delay}s infinite` }} />
        ))}
      </div>
      <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
        <div className="text-5xl mb-2">🎉</div>
        <h2 className="text-xl font-serif-display font-semibold mb-2">{t('cust.welcome.allSet', { defaultValue: "You're all set!" })}</h2>
        <p className="text-gray-600 text-sm mb-5">{t('cust.welcome.body', { defaultValue: "Your card is saved. To collect your first stamp, ask the staff at the counter — they'll show you the stamp QR to scan or tap. You'll earn a stamp on every order." })}</p>
        <button onClick={onDismiss} className="w-full bg-[#37352F] text-white py-3 rounded-lg font-medium hover:bg-opacity-90 transition">{t('cust.welcome.gotIt', { defaultValue: 'Got it' })}</button>
      </div>
    </div>
  );
}
