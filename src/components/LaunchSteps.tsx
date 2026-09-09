import { WalletPass } from './HeroCardLoop';
import { useTranslation } from 'react-i18next';

/** Stampfix ▪●✕ mark. */
function Mark({ className, fill = '#37352F' }: { className?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 290 90" className={className} fill={fill} aria-hidden="true">
      <rect x="8" y="12" width="66" height="66" rx="4" />
      <circle cx="140" cy="45" r="34" />
      <rect x="195" y="36" width="90" height="18" rx="9" transform="rotate(45 240 45)" />
      <rect x="195" y="36" width="90" height="18" rx="9" transform="rotate(-45 240 45)" />
    </svg>
  );
}

/** Small QR glyph (decorative). */
function QrMini({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 74 74" className={className} fill="#37352F" aria-hidden="true">
      <rect x="0" y="0" width="20" height="20" rx="3" /><rect x="4" y="4" width="12" height="12" rx="1" fill="#F7F7F5" /><rect x="8" y="8" width="4" height="4" />
      <rect x="54" y="0" width="20" height="20" rx="3" /><rect x="58" y="4" width="12" height="12" rx="1" fill="#F7F7F5" /><rect x="62" y="8" width="4" height="4" />
      <rect x="0" y="54" width="20" height="20" rx="3" /><rect x="4" y="58" width="12" height="12" rx="1" fill="#F7F7F5" /><rect x="8" y="62" width="4" height="4" />
      <rect x="28" y="6" width="6" height="6" /><rect x="40" y="18" width="6" height="6" /><rect x="10" y="30" width="6" height="6" /><rect x="30" y="34" width="6" height="6" /><rect x="52" y="40" width="6" height="6" /><rect x="60" y="60" width="6" height="6" /><rect x="34" y="58" width="6" height="6" /><rect x="24" y="46" width="6" height="6" />
    </svg>
  );
}

function Tick() {
  return (
    <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-[#37352F] flex items-center justify-center">
      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10" /></svg>
    </span>
  );
}

/** Charcoal device frame around the real wallet card. */
function DeviceCard({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation();
  const spec = { bg: '#75FBFD', mark: '#1A1A1A', text: '#223355', name: 'Bloom Coffee', reward: t('landing.demoReward', { defaultValue: 'Buy 6, get 1 free' }), stamps: 4 };
  return (
    <div className="inline-flex flex-col items-center">
      <div className="p-2.5 rounded-[30px] bg-[#37352F] shadow-2xl">
        <div className="rounded-[22px] overflow-hidden">
          <WalletPass spec={spec} />
        </div>
      </div>
      {children}
    </div>
  );
}

// ---- Per-step visuals ----
function VisualDesign() {
  return (
    <div className="relative">
      <DeviceCard />
      <div className="absolute -bottom-3 -right-2 w-16 h-16 rounded-full bg-[#37352F] shadow-lg flex items-center justify-center">
        <span className="grid grid-cols-2 gap-1">
          <span className="w-3 h-3 rounded-full" style={{ background: '#75FBFD' }} />
          <span className="w-3 h-3 rounded-full" style={{ background: '#EA3323' }} />
          <span className="w-3 h-3 rounded-full" style={{ background: '#F7CE46' }} />
          <span className="w-3 h-3 rounded-full" style={{ background: '#1132F5' }} />
        </span>
      </div>
    </div>
  );
}

function VisualPoster() {
  const { t } = useTranslation();
  return (
    <div className="w-56 bg-white rounded-xl border notion-border shadow-lg p-6 text-center">
      <Mark className="h-6 w-auto mx-auto" />
      <div className="mt-3 font-serif-display font-semibold text-lg text-[#37352F]">Bloom Coffee</div>
      <div className="text-xs text-gray-400 mt-1">{t('landing.steps.scanToCollect', { defaultValue: 'Scan to collect stamps' })}</div>
      <div className="mt-4 mx-auto w-28 h-28 bg-[#F7F7F5] rounded-lg flex items-center justify-center">
        <QrMini className="w-20 h-20" />
      </div>
      <div className="mt-4 inline-block bg-[#37352F] text-white text-xs font-semibold px-4 py-2 rounded-full">{t('landing.demoReward', { defaultValue: 'Buy 6, get 1 free' })}</div>
    </div>
  );
}

function VisualWallet() {
  const { t } = useTranslation();
  return (
    <DeviceCard>
      <div className="flex gap-2 mt-4">
        <div className="bg-black text-white rounded-lg px-3 py-1.5 text-[9px] leading-tight text-center">
          <div className="opacity-70">{t('landing.steps.addTo', { defaultValue: 'Add to' })}</div><div className="font-semibold">Apple Wallet</div>
        </div>
        <div className="bg-black text-white rounded-lg px-3 py-1.5 text-[9px] leading-tight text-center">
          <div className="opacity-70">{t('landing.steps.addTo', { defaultValue: 'Add to' })}</div><div className="font-semibold">Google Wallet</div>
        </div>
      </div>
    </DeviceCard>
  );
}

function VisualScan() {
  const { t } = useTranslation();
  return (
    <div className="w-56 rounded-[30px] bg-[#37352F] p-2.5 shadow-2xl">
      <div className="rounded-[22px] bg-[#F7F7F5] px-6 py-8 text-center">
        <div className="text-xs font-semibold text-gray-400">{t('landing.steps.scanDemo', { defaultValue: 'John Smith · 2 left' })}</div>
        <div className="my-6 mx-auto w-32 h-32 rounded-full bg-[#37352F] flex items-center justify-center text-white text-4xl font-extrabold">+1</div>
        <div className="flex justify-center gap-8">
          <span className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10" /></svg>
          </span>
          <span className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </span>
        </div>
      </div>
    </div>
  );
}

function VisualDashboard() {
  const { t } = useTranslation();
  return (
    <div className="w-72 bg-white rounded-xl border-[6px] border-[#37352F] shadow-xl overflow-hidden">
      <div className="bg-[#FAFAF9] p-4">
        <div className="text-xs font-bold text-[#37352F] mb-3">{t('landing.steps.insights', { defaultValue: 'Insights' })}</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border notion-border rounded-lg p-2 h-28">
            <svg viewBox="0 0 130 90" className="w-full h-full" fill="none">
              <polyline points="6,80 30,62 54,66 78,40 102,46 124,20" stroke="#2E8B57" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="bg-white border notion-border rounded-lg p-2 h-28">
            <svg viewBox="0 0 130 90" className="w-full h-full">
              <g fill="#75C6C8">
                <rect x="8" y="54" width="14" height="34" rx="3" /><rect x="32" y="38" width="14" height="50" rx="3" /><rect x="56" y="60" width="14" height="28" rx="3" /><rect x="80" y="28" width="14" height="60" rx="3" /><rect x="104" y="44" width="14" height="44" rx="3" />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  {
    n: 1,
    title: 'Design your card',
    desc: 'Customise your colours, logo and rewards in minutes — no design skills needed.',
    bullets: ['Live preview as you edit.', 'Change the design anytime.'],
    visual: <VisualDesign />,
  },
  {
    n: 2,
    title: 'Print your QR',
    desc: 'Download your poster and place it at the checkout counter or on tables.',
    bullets: ['Table, counter & A4 sizes.', 'High-res PNG, ready to print.'],
    visual: <VisualPoster />,
  },
  {
    n: 3,
    title: 'Straight to their wallet',
    desc: "The moment a customer fills in the quick form, their card opens right in the browser — ready to add to Apple or Google Wallet on the spot.",
    bullets: ['No app to download.', 'Ready instantly — nothing to wait for.'],
    visual: <VisualWallet />,
  },
  {
    n: 4,
    title: 'Scan & reward',
    desc: "Staff scan the customer's QR from any phone to add a stamp or grant a reward — the wallet pass updates automatically.",
    bullets: ['Any phone or tablet as the scanner.', 'Secure, staff-safe stamping.'],
    visual: <VisualScan />,
  },
  {
    n: 5,
    title: 'Track & grow',
    desc: 'See stamps, rewards, active cards and repeat visits — per location and per offer.',
    bullets: ['Clear charts & insights.', "Know what's working."],
    visual: <VisualDashboard />,
  },
];

export function LaunchSteps() {
  const { t } = useTranslation();
  return (
    <section className="bg-[#F7F7F5] border-y notion-border py-24">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-4xl font-serif-display font-semibold mb-4">{t('landing.steps.h2', { defaultValue: 'Launch in 5 steps' })}</h2>
          <p className="text-gray-500">{t('landing.steps.sub', { defaultValue: 'No developer required.' })}</p>
        </div>

        <div className="relative">
          {/* connecting spine (desktop only) */}
          <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-2 bottom-2 border-l-2 border-dashed border-[#37352F]/15" aria-hidden="true" />

          <div className="space-y-16 md:space-y-28">
            {STEPS.map((s, i) => {
              const flip = i % 2 === 1;
              return (
                <div key={s.n} className="relative grid md:grid-cols-2 gap-10 md:gap-20 items-center">
                  <div className={`flex justify-center ${flip ? 'md:order-2' : 'md:order-1'}`}>{s.visual}</div>
                  <div className={flip ? 'md:order-1' : 'md:order-2'}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="w-11 h-11 rounded-full bg-[#37352F] text-white font-bold flex items-center justify-center">{s.n}</span>
                      <span className="text-xs font-bold tracking-[0.2em] text-gray-400">{t('landing.steps.step', { defaultValue: 'STEP' })}</span>
                    </div>
                    <h3 className="text-2xl md:text-[2rem] font-serif-display font-semibold text-[#37352F] mb-3 leading-tight">{t(`landing.steps.t${i}`, { defaultValue: s.title })}</h3>
                    <p className="text-gray-500 leading-relaxed mb-5 max-w-md">{t(`landing.steps.d${i}`, { defaultValue: s.desc })}</p>
                    <ul className="space-y-2.5">
                      {s.bullets.map((b, bi) => (
                        <li key={b} className="flex items-start gap-3 text-[#37352F] font-medium"><Tick /><span>{t(`landing.steps.b${i}_${bi}`, { defaultValue: b })}</span></li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
