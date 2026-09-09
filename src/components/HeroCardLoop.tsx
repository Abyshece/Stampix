import { useEffect, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { useTranslation } from 'react-i18next';

/**
 * Hero card loop.
 *
 * A straight horizontal rail of live Apple-Wallet-style loyalty cards that
 * scrolls forever and wraps seamlessly. Click a card and it springs up out of
 * the line; the rail pauses while it's up. Click again (or anywhere else in
 * the strip) to put it back.
 *
 * The cards are real DOM + SVG — no images — so they stay crisp at any size
 * and cost nothing to download. Colours mirror the real Apple Wallet passes.
 */

export interface CardSpec {
  bg: string;      // pass background
  mark: string;    // Stampfix brand mark
  text: string;    // text + stamp colour
  name: string;
  reward: string;
  stamps: number;  // stamps collected (of MAX_STAMPS)
}

const MAX_STAMPS = 6;

/** Intrinsic card size. The rail scales this with a transform, so it stays sharp. */
const CARD_W = 268;
const CARD_H = 374;

const CARDS: CardSpec[] = [
  { bg: '#75FBFD', mark: '#1A1A1A', text: '#223355', name: 'Bloom Coffee',    reward: 'Buy 6, get 1 free',        stamps: 2 },
  { bg: '#DB2F20', mark: '#FFFFFF', text: '#FFFFFF', name: 'Fade Barbers',    reward: '6 cuts, 7th on us',        stamps: 4 },
  { bg: '#F7CE46', mark: '#1A1A1A', text: '#000000', name: 'Rise Bakery',     reward: 'Free pastry at 6 stamps',  stamps: 5 },
  { bg: '#1132F5', mark: '#FFFFFF', text: '#FFFFFF', name: 'Nori Sushi',      reward: 'Free miso every 6 visits', stamps: 3 },
  { bg: '#F0A479', mark: '#1A1A1A', text: '#1A1A1A', name: 'Lush Nail Bar',   reward: 'Free file & polish',       stamps: 5 },
  { bg: '#000000', mark: '#FFFFFF', text: '#FFFFFF', name: 'Iron Gym',        reward: '6 sessions, 1 free',       stamps: 1 },
  { bg: '#510AF5', mark: '#FFFFFF', text: '#FCFF54', name: 'Pulp Juice',      reward: 'Free juice, every 6th',    stamps: 6 },
  { bg: '#75FBE2', mark: '#1A1A1A', text: '#1A1A1A', name: 'Green Grocer',    reward: 'Free tote at 6 stamps',    stamps: 2 },
  { bg: '#CD2CA0', mark: '#FFFFFF', text: '#FFFFFF', name: 'Sprinkle Donuts', reward: 'Free donut, every 6th',    stamps: 3 },
  { bg: '#EFECE2', mark: '#1A1A1A', text: '#1A1A1A', name: 'Paper & Bind',    reward: 'Free bookmark at 6',       stamps: 4 },
  { bg: '#ABC2C2', mark: '#1A1A1A', text: '#223355', name: 'Wash & Fold',     reward: '7th wash free',            stamps: 1 },
  { bg: '#FFFFFF', mark: '#1A1A1A', text: '#000000', name: 'Piccolo Pizza',   reward: 'Free slice at 6 stamps',   stamps: 4 },
];

/** One stamp slot. Cycles the Stampfix square / circle / cross marks. */
function Stamp({ index, filled, color }: { index: number; filled: boolean; color: string }) {
  const kind = index % 3;

  if (kind === 0) {
    return filled
      ? <div className="w-[26px] h-[26px] rounded-[7px]" style={{ background: color }} />
      : <div className="w-[26px] h-[26px] rounded-[7px] border-2" style={{ borderColor: color, opacity: 0.4 }} />;
  }
  if (kind === 1) {
    return filled
      ? <div className="w-[26px] h-[26px] rounded-full" style={{ background: color }} />
      : <div className="w-[26px] h-[26px] rounded-full border-2" style={{ borderColor: color, opacity: 0.4 }} />;
  }
  return (
    <svg viewBox="0 0 24 24" className="w-[28px] h-[28px]" style={{ opacity: filled ? 1 : 0.35 }} aria-hidden="true">
      <rect x="2" y="9" width="20" height="6" rx="3" fill={color} transform="rotate(45 12 12)" />
      <rect x="2" y="9" width="20" height="6" rx="3" fill={color} transform="rotate(-45 12 12)" />
    </svg>
  );
}

/** A single wallet pass, drawn to match the real Apple Wallet card. */
export function WalletPass({ spec }: { spec: CardSpec }) {
  const { t } = useTranslation();
  const left = MAX_STAMPS - spec.stamps;

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-[22px] px-4 pt-4 pb-4"
      style={{ width: CARD_W, height: CARD_H, background: spec.bg, color: spec.text }}
    >
      {/* Header: brand mark + business, stamps remaining */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <svg viewBox="0 0 290 90" className="h-[13px] w-auto shrink-0" fill={spec.mark} aria-hidden="true">
            <rect x="8" y="12" width="66" height="66" rx="4" />
            <circle cx="140" cy="45" r="34" />
            <rect x="195" y="36" width="90" height="18" rx="9" transform="rotate(45 240 45)" />
            <rect x="195" y="36" width="90" height="18" rx="9" transform="rotate(-45 240 45)" />
          </svg>
          <span className="text-[12px] font-bold leading-none truncate">{spec.name}</span>
        </div>
        <div className="text-right shrink-0 pl-2">
          <div className="text-[7px] font-bold uppercase tracking-[0.12em] leading-none">{t('landing.hero.stampsLeft', { defaultValue: 'Stamps left' })}</div>
          <div className="text-[19px] font-medium leading-none mt-1.5">{left}</div>
        </div>
      </div>

      {/* Stamp grid */}
      <div className="mt-6 grid grid-cols-3 gap-y-3.5 place-items-center px-2">
        {Array.from({ length: MAX_STAMPS }).map((_, i) => (
          <Stamp key={i} index={i} filled={i < spec.stamps} color={spec.text} />
        ))}
      </div>

      {/* Member / reward */}
      <div className="mt-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[6.5px] font-bold uppercase tracking-[0.14em] leading-none">{t('landing.hero.member', { defaultValue: 'Member' })}</div>
          <div className="text-[12px] leading-tight mt-1 truncate">Lucky Müller</div>
        </div>
        <div className="text-right min-w-0">
          <div className="text-[6.5px] font-bold uppercase tracking-[0.14em] leading-none">{t('landing.hero.reward', { defaultValue: 'Reward' })}</div>
          <div className="text-[12px] leading-tight mt-1">
            {left === 0 ? t('landing.hero.redeemNow', { defaultValue: 'Redeem your free reward now' }) : spec.reward}
          </div>
        </div>
      </div>

      {/* QR */}
      <div className="mt-auto mx-auto flex flex-col items-center rounded-[6px] bg-white px-2 pt-2 pb-1">
        <QRCode value="https://stampfix.app" size={86} level="L" bgColor="#FFFFFF" fgColor="#000000" />
        <div className="mt-1 text-[8px] font-medium tracking-wide text-black">SF00108</div>
      </div>
    </div>
  );
}

export function HeroCardLoop() {
  const { t } = useTranslation();
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const pickedRef = useRef<number | null>(null);
  const hoverRef = useRef(false);

  useEffect(() => { pickedRef.current = picked; }, [picked]);

  useEffect(() => {
    const N = CARDS.length;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const CRUISE = reduced ? 0 : 0.62;   // cards travelled per second — tune speed here

    // Cache viewport-dependent sizing rather than reading layout every frame.
    let scale = 1;
    let gap = 0;
    const measure = () => {
      scale = window.innerWidth < 768 ? 0.68 : 1;
      gap = (CARD_W + 30) * scale;       // straight rail: cards sit side by side, no overlap
    };
    measure();
    window.addEventListener('resize', measure);

    // Cards sit slightly below centre so the click-lift has headroom to rise
    // into without the strip's overflow clipping the top of the card.
    const REST_DROP = 24;   // px below centre at rest
    const LIFT = 48;        // px the card rises when picked
    const LIFT_SCALE = 0.05;

    // Per-card spring state for the click-lift, and an eased dim for the rest.
    const lift = CARDS.map(() => ({ x: 0, v: 0 }));
    const dim = CARDS.map(() => 0);

    let t = 0;
    let vel = CRUISE;
    let last = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Rail speed: stop while a card is up, drift while hovered, else cruise.
      const want = pickedRef.current !== null ? 0 : hoverRef.current ? CRUISE * 0.25 : CRUISE;
      vel += (want - vel) * Math.min(1, dt * 5);
      t += vel * dt;

      for (let i = 0; i < N; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;

        // Signed distance from centre, wrapped to [-N/2, N/2) → seamless loop.
        let s = (i - t) % N;
        if (s > N / 2) s -= N;
        if (s < -N / 2) s += N;

        // Spring the lift (slight overshoot is what makes it feel alive).
        const L = lift[i];
        const target = pickedRef.current === i ? 1 : 0;
        L.v += ((target - L.x) * 200 - L.v * 20) * dt;
        L.x += L.v * dt;

        // Straight horizontal path: x is the ONLY travel. y moves only on lift.
        const x = s * gap;
        const y = (REST_DROP - LIFT * L.x) * scale;
        const sc = scale * (1 + LIFT_SCALE * L.x);

        el.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), 0) scale(${sc})`;
        el.style.zIndex = String(100 + Math.round(L.x * 900));

        // Ease the dimming of the non-selected cards.
        const dTarget = pickedRef.current !== null && pickedRef.current !== i ? 1 : 0;
        dim[i] += (dTarget - dim[i]) * Math.min(1, dt * 6);
        el.style.filter = dim[i] > 0.01
          ? `brightness(${1 - 0.12 * dim[i]}) saturate(${1 - 0.2 * dim[i]})`
          : '';
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <section
      className="relative h-[360px] md:h-[470px] overflow-hidden"
      onMouseEnter={() => { hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; }}
      onClick={() => setPicked(null)}
      style={{
        WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%)',
        maskImage: 'linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%)',
      }}
    >
      {/* Colour wash picked up from the cards themselves */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 blur-3xl opacity-50 -z-10"
        style={{
          background:
            'radial-gradient(closest-side, #EA33B6, transparent) 0% 60%/30% 70% no-repeat,' +
            'radial-gradient(closest-side, #F0A479, transparent) 25% 70%/30% 70% no-repeat,' +
            'radial-gradient(closest-side, #75FBFD, transparent) 50% 62%/30% 72% no-repeat,' +
            'radial-gradient(closest-side, #510AF5, transparent) 75% 70%/30% 70% no-repeat,' +
            'radial-gradient(closest-side, #EA3323, transparent) 100% 60%/30% 70% no-repeat',
        }}
      />

      {CARDS.map((spec, i) => (
        <button
          key={spec.name}
          type="button"
          ref={(el) => { cardRefs.current[i] = el; }}
          onClick={(e) => {
            e.stopPropagation();
            setPicked((p) => (p === i ? null : i));
          }}
          aria-label={t('landing.hero.cardAria', { name: spec.name, defaultValue: '{{name}} loyalty card' })}
          className={`absolute left-1/2 top-1/2 rounded-[22px] p-0 border-0 bg-transparent cursor-pointer
            transition-shadow duration-300 will-change-transform
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#37352F] focus-visible:ring-offset-4
            ${picked === i
              ? 'shadow-[0_44px_64px_-22px_rgba(20,20,30,0.5)]'
              : 'shadow-[0_16px_36px_-14px_rgba(20,20,30,0.35)]'}`}
        >
          <WalletPass spec={{ ...spec, reward: t(`landing.hero.r${i}`, { defaultValue: spec.reward }) }} />
        </button>
      ))}
    </section>
  );
}
