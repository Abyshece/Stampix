import type { ReactNode } from 'react';
import { LegalPage, LegalH2 } from './legal/LegalPage';
import { useTranslation } from 'react-i18next';

/**
 * Customer-facing guide: how to refresh an Apple Wallet loyalty card.
 * Passes update over the air automatically; this shows how to force a refresh.
 * Android (Google Wallet) updates on its own, so this guide is iOS-only.
 *
 * Screenshots: drop 5 images into /public/wallet-guide as 01.png … 05.png.
 * The caption/alt on each step says which screenshot belongs where.
 */
function Step({ n, title, img, alt, children }: {
  n: number; title: string; img: string; alt: string; children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="pt-2">
      <LegalH2>{t('cust.guide.step', { n, title, defaultValue: 'Step {{n}} — {{title}}' })}</LegalH2>
      <p>{children}</p>
      <div className="mt-3 rounded-xl border notion-border bg-[#F7F7F5] overflow-hidden flex justify-center items-center min-h-[120px]">
        <img src={img} alt={alt} className="max-h-[520px] w-auto object-contain" loading="lazy" />
      </div>
    </div>
  );
}

export function AppleWalletGuide() {
  const { t } = useTranslation();
  return (
    <LegalPage title={t('cust.guide.title', { defaultValue: 'Updating your Apple Wallet card' })} lastUpdated={t('cust.guide.updated', { defaultValue: '28 June 2026' })}>
      <p>
        {t('cust.guide.introA', { defaultValue: 'Your Stampfix loyalty card updates' })} <strong>{t('cust.guide.introAuto', { defaultValue: 'automatically' })}</strong> {t('cust.guide.introB', { defaultValue: '— your stamp count usually refreshes within a minute of your last visit, even with your phone in your pocket. If your card ever looks out of date, you can refresh it by hand in a few seconds. These steps are for' })} <strong>{t('cust.guide.introIphone', { defaultValue: 'iPhone (Apple Wallet)' })}</strong> {t('cust.guide.introC', { defaultValue: '. On Android, Google Wallet updates on its own and needs no extra steps.' })}
      </p>

      <Step n={1} title={t('cust.guide.s1title', { defaultValue: 'Open Wallet and tap your card' })} img="/wallet-guide/01.png"
        alt={t('cust.guide.s1alt', { defaultValue: 'Apple Wallet showing the loyalty card in the list' })}>
        {t('cust.guide.s1a', { defaultValue: 'Open the' })} <strong>{t('cust.guide.s1wallet', { defaultValue: 'Wallet' })}</strong> {t('cust.guide.s1b', { defaultValue: 'app on your iPhone and tap your loyalty card to open it.' })}
      </Step>

      <Step n={2} title={t('cust.guide.s2title', { defaultValue: 'Open the card menu' })} img="/wallet-guide/02.png"
        alt={t('cust.guide.s2alt', { defaultValue: 'Pass menu with Pass Details, Notifications and Remove Pass' })}>
        {t('cust.guide.s2a', { defaultValue: 'Tap the' })} <strong>{t('cust.guide.s2more', { defaultValue: '•••' })}</strong> {t('cust.guide.s2b', { defaultValue: '(more) button in the top-right corner, then tap' })}{' '}
        <strong>{t('cust.guide.s2details', { defaultValue: 'Pass Details' })}</strong>{t('cust.guide.s2c', { defaultValue: '.' })}
      </Step>

      <Step n={3} title={t('cust.guide.s3title', { defaultValue: 'Turn on Automatic Updates' })} img="/wallet-guide/03.png"
        alt={t('cust.guide.s3alt', { defaultValue: 'Pass details with the Automatic Updates toggle on' })}>
        {t('cust.guide.s3a', { defaultValue: 'Make sure' })} <strong>{t('cust.guide.s3auto', { defaultValue: 'Automatic Updates' })}</strong> {t('cust.guide.s3b', { defaultValue: 'is switched on. This keeps your stamps refreshing on their own going forward.' })}
      </Step>

      <Step n={4} title={t('cust.guide.s4title', { defaultValue: 'Pull to refresh' })} img="/wallet-guide/04.png"
        alt={t('cust.guide.s4alt', { defaultValue: 'The pass refreshing with a loading spinner' })}>
        {t('cust.guide.s4a', { defaultValue: 'To update right now, go back to the card and' })} <strong>{t('cust.guide.s4swipe', { defaultValue: 'swipe down' })}</strong> {t('cust.guide.s4b', { defaultValue: ". You'll see a brief spinner while it refreshes." })}
      </Step>

      <Step n={5} title={t('cust.guide.s5title', { defaultValue: "You're up to date" })} img="/wallet-guide/05.png"
        alt={t('cust.guide.s5alt', { defaultValue: 'The card showing Updated just now with the latest stamps' })}>
        {t('cust.guide.s5a', { defaultValue: "That's it —" })} <strong>{t('cust.guide.s5updated', { defaultValue: '"Updated just now"' })}</strong> {t('cust.guide.s5b', { defaultValue: 'with your latest stamps.' })}
      </Step>

      <p className="pt-4">
        {t('cust.guide.stuckA', { defaultValue: 'Still stuck? Email' })}{' '}
        <a href="mailto:support@stampfix.app" className="underline">support@stampfix.app</a>.
      </p>
    </LegalPage>
  );
}
