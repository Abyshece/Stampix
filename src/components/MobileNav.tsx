import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface NavLink {
  href: string;
  label: string;
}

/**
 * Mobile-only hamburger menu. On phones the inline nav links don't fit, so
 * they live here behind a burger on the top right. The first link is treated
 * as primary (bolded) — pass "My loyalty card" first.
 *
 * The drawer is rendered through a portal into document.body. This is
 * required: the nav bar uses `backdrop-blur`, and a backdrop-filter ancestor
 * becomes the containing block for fixed-position descendants — which would
 * otherwise clip this full-screen overlay to the nav's height.
 */
export function MobileNav({ links }: { links: NavLink[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const drawer = (
    <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px] animate-in fade-in duration-200"
        onClick={close}
      />
      <div className="absolute right-0 top-0 bottom-0 w-72 max-w-[82%] bg-white shadow-xl flex flex-col animate-in slide-in-from-right-4 fade-in duration-200">
        <div className="flex items-center justify-between px-5 h-16 border-b notion-border shrink-0">
          <span className="font-semibold text-[#37352F]">{t('dash.mobilenav.menu', { defaultValue: 'Menu' })}</span>
          <button
            type="button"
            onClick={close}
            aria-label={t('dash.mobilenav.close', { defaultValue: 'Close menu' })}
            className="p-2 -mr-2 rounded-md hover:bg-gray-100 text-gray-500 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex flex-col p-2 overflow-y-auto">
          {links.map((l, i) => (
            <a
              key={l.href + l.label}
              href={l.href}
              onClick={close}
              className={`px-3 py-3.5 rounded-lg text-[15px] transition hover:bg-[#F7F7F5] ${
                i === 0 ? 'font-medium text-[#37352F]' : 'text-gray-700'
              }`}
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('dash.mobilenav.open', { defaultValue: 'Open menu' })}
        className="p-2 -mr-1 text-[#37352F] hover:bg-gray-100 rounded-md transition"
      >
        <Menu className="w-6 h-6" />
      </button>
      {open && typeof document !== 'undefined' && createPortal(drawer, document.body)}
    </div>
  );
}
