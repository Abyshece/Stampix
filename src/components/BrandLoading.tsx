// src/components/BrandLoading.tsx
//
// Full-screen brand loading state: the Stampfix mark (square · circle · cross)
// with each shape pulsing in sequence. Shown while auth + campaign resolve so
// the app never flashes the landing or signup screens before it settles.

import { useTranslation } from 'react-i18next';

export function BrandLoading() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <style>{`
        @keyframes sfPulse { 0%, 72%, 100% { opacity: 0.18; } 36% { opacity: 1; } }
        .sf-shape { animation: sfPulse 1.4s ease-in-out infinite; }
        .sf-shape.sf-circle { animation-delay: 0.18s; }
        .sf-shape.sf-cross  { animation-delay: 0.36s; }
      `}</style>
      <svg
        viewBox="0 0 282 90"
        className="h-10 w-auto text-[#37352F]"
        fill="currentColor"
        role="img"
        aria-label={t('dash.loading.aria', { defaultValue: 'Loading' })}
      >
        <rect className="sf-shape sf-square" x="8" y="12" width="66" height="66" rx="4" />
        <circle className="sf-shape sf-circle" cx="140" cy="45" r="34" />
        <g className="sf-shape sf-cross">
          <rect x="195" y="36" width="90" height="18" rx="9" transform="rotate(45 240 45)" />
          <rect x="195" y="36" width="90" height="18" rx="9" transform="rotate(-45 240 45)" />
        </g>
      </svg>
    </div>
  );
}
