import { useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import {
  X, ArrowRight, ArrowLeft, Check, Loader2, Printer, Smartphone, ScanLine, Sparkles,
} from 'lucide-react';
import type { Campaign, Location, OnboardingState } from '../types';
import { buildPosterHtml } from '../services/posterGenerator';
import { downloadPosterPng } from '../services/posterImage';
import { useTranslation } from 'react-i18next';

interface OnboardingWizardProps {
  campaign: Campaign;
  locations: Location[];
  initialState: OnboardingState;
  /** Called whenever a step's outcome should be saved to the server. */
  onMarkStep: (patch: Partial<OnboardingState>) => Promise<void>;
  /** Persist the loyalty reward set in the first step. */
  onUpdateCampaign: (patch: Partial<Campaign>) => Promise<void>;
  /** Called to close the wizard (after completion or skip). */
  onClose: () => void;
}

type Step = 0 | 1 | 2 | 3 | 4;

/**
 * First-run wizard shown to brand-new merchants after signup. Walks
 * them from "what is this?" to "I've personally tested the customer
 * flow and given my first stamp" in ~3 minutes.
 *
 * Design decisions:
 *  - Skippable from every step (some merchants will explore on their own;
 *    that's fine — they'll see the dashboard checklist instead).
 *  - Each step persists its outcome to the server as soon as it's done,
 *    so closing the laptop mid-wizard doesn't lose progress.
 *  - The "test as customer" step uses the merchant's REAL QR — no fake
 *    demo data. If it works for them, they know it works for customers.
 */
export function OnboardingWizard({
  campaign,
  locations,
  initialState,
  onMarkStep,
  onUpdateCampaign,
  onClose,
}: OnboardingWizardProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);
  const [offerTitle, setOfferTitle] = useState(campaign.offerTitle);
  const [maxStamps, setMaxStamps] = useState(campaign.maxStamps);

  const primaryLocation = locations.find((l) => !l.archived) ?? null;
  const joinUrl = primaryLocation
    ? `${window.location.origin}/?campaign=${campaign.id}&location=${primaryLocation.id}`
    : `${window.location.origin}/?campaign=${campaign.id}`;

  const goNext = () => setStep((s) => Math.min(4, s + 1) as Step);
  const goBack = () => setStep((s) => Math.max(0, s - 1) as Step);

  const handleContinue = async () => {
    if (step === 0) {
      setSaving(true);
      try {
        await onUpdateCampaign({ offerTitle: offerTitle.trim() || campaign.offerTitle, maxStamps });
      } finally {
        setSaving(false);
      }
    }
    goNext();
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      await onMarkStep({ wizard_dismissed: true });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await onMarkStep({ wizard_dismissed: true });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPoster = async (color: string) => {
    // Open the real designed pamphlet (same generator the Share tab uses),
    // tinted with the colour the merchant picked.
    const html = buildPosterHtml({
      campaign,
      location: primaryLocation,
      size: 'pamphlet',
      posterBgOverride: color,
    });
    await downloadPosterPng(html, 'pamphlet', 'stampfix-poster.png');
    // Mark the step done as soon as the merchant initiates the download.
    await onMarkStep({ poster_downloaded: true });
  };

  const handleOpenCustomerView = async () => {
    window.open(joinUrl, '_blank');
    await onMarkStep({ test_signup_done: true });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur z-10 px-6 py-4 border-b notion-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'bg-[#37352F] w-8'
                    : i < step ? 'bg-[#37352F]/40 w-4'
                    : 'bg-gray-200 w-4'
                }`}
              />
            ))}
            <span className="ml-2 text-xs text-gray-400 font-medium">{t('dash.onboard.stepOf', { n: step + 1, defaultValue: 'Step {{n}} of 5' })}</span>
          </div>
          <button
            onClick={handleSkip}
            disabled={saving}
            className="text-sm text-gray-400 hover:text-[#37352F] transition flex items-center gap-1"
          >
            {t('dash.onboard.skip', { defaultValue: 'Skip' })} <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 py-10">
          {step === 0 && (
            <LoyaltyStep
              businessName={campaign.businessName}
              offerTitle={offerTitle}
              setOfferTitle={setOfferTitle}
              maxStamps={maxStamps}
              setMaxStamps={setMaxStamps}
            />
          )}
          {step === 1 && <WelcomeStep businessName={campaign.businessName} />}
          {step === 2 && (
            <PrintStep
              campaign={campaign}
              location={primaryLocation}
              alreadyDone={!!initialState.poster_downloaded}
              onDownload={handleDownloadPoster}
            />
          )}
          {step === 3 && (
            <TestStep
              alreadyDone={!!initialState.test_signup_done}
              onOpen={handleOpenCustomerView}
            />
          )}
          {step === 4 && <ScanTourStep />}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t notion-border px-6 py-4 flex items-center justify-between">
          <button
            onClick={goBack}
            disabled={step === 0 || saving}
            className="text-sm text-gray-500 hover:text-[#37352F] disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> {t('dash.onboard.back', { defaultValue: 'Back' })}
          </button>
          {step < 4 ? (
            <button
              onClick={handleContinue}
              disabled={saving || (step === 0 && (maxStamps < 1 || !offerTitle.trim()))}
              className="bg-[#37352F] text-white px-5 py-2 rounded-md font-medium text-sm hover:bg-opacity-90 transition flex items-center gap-2 disabled:opacity-50"
            >
              {saving && step === 0 && <Loader2 className="w-4 h-4 animate-spin" />} {t('dash.onboard.continue', { defaultValue: 'Continue' })} <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="bg-[#37352F] text-white px-5 py-2 rounded-md font-medium text-sm hover:bg-opacity-90 transition flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {t('dash.onboard.finish', { defaultValue: 'Got it, take me to the dashboard' })}
            </button>
          )}
        </div>

        {/* Hidden QR — referenced by the print preview window */}
        <div className="absolute -left-[9999px] top-0">
          <QRCode id="wizard-qr-code" value={joinUrl} size={160} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------

function LoyaltyStep({
  businessName,
  offerTitle,
  setOfferTitle,
  maxStamps,
  setMaxStamps,
}: {
  businessName: string;
  offerTitle: string;
  setOfferTitle: (v: string) => void;
  maxStamps: number;
  setMaxStamps: (v: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-[#37352F]/5 items-center justify-center mb-1">
          <Sparkles className="w-7 h-7 text-[#37352F]" />
        </div>
        <h2 className="text-2xl font-serif-display font-semibold">{t('dash.onboard.loyaltyTitle', { defaultValue: 'Set your loyalty reward' })}</h2>
        <p className="text-gray-500 text-sm">{t('dash.onboard.loyaltySub', { name: businessName, defaultValue: 'This is the deal your customers see on their card at {{name}}. You can change it anytime in Settings.' })}</p>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">{t('dash.onboard.reward', { defaultValue: 'Reward' })}</label>
        <input
          value={offerTitle}
          onChange={(e) => setOfferTitle(e.target.value)}
          placeholder={t('dash.onboard.rewardPh', { defaultValue: 'e.g. Buy 8, get 1 free' })}
          className="w-full bg-[#F7F7F5] border notion-border rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#37352F]/20"
        />
        <p className="text-[11px] text-gray-400">{t('dash.onboard.rewardHint', { defaultValue: 'Describe it in your customers\' words, e.g. "Buy 8 coffees, get 1 free".' })}</p>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">{t('dash.onboard.stampsNeeded', { defaultValue: 'Stamps needed to earn the reward' })}</label>
        <input
          type="number"
          min={1}
          max={20}
          value={maxStamps === 0 ? '' : maxStamps}
          onChange={(e) => setMaxStamps(parseInt(e.target.value) || 0)}
          placeholder={t('dash.onboard.stampsPh', { defaultValue: 'e.g. 8' })}
          className="w-full bg-[#F7F7F5] border notion-border rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#37352F]/20"
        />
        <p className="text-[11px] text-gray-400">{t('dash.onboard.stampsHint', { defaultValue: 'e.g. 8 means they collect 8 stamps and the 9th visit is the reward.' })}</p>
      </div>
    </div>
  );
}

function WelcomeStep({ businessName }: { businessName: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6 text-center">
      <div className="w-16 h-16 bg-[#F7F7F5] rounded-full mx-auto flex items-center justify-center border notion-border">
        <Sparkles className="w-7 h-7 text-[#37352F]" />
      </div>
      <div className="space-y-2">
        <h2 id="wizard-title" className="text-2xl md:text-3xl font-serif-display font-semibold">
          {t('dash.onboard.welcome', { name: businessName, defaultValue: 'Welcome, {{name}}!' })}
        </h2>
        <p className="text-gray-500 max-w-md mx-auto">
          {t('dash.onboard.welcomeSub', { defaultValue: "Stampfix turns paper punch cards into a digital loyalty program that lives in your customers' phones." })}
        </p>
      </div>
      <div className="bg-[#F7F7F5] rounded-lg p-6 text-left space-y-3 border notion-border">
        <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">{t('dash.onboard.flowTitle', { defaultValue: "Here's the flow:" })}</p>
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="font-bold text-[#37352F] flex-shrink-0">1.</span>
            <span><strong>{t('dash.onboard.w1bold', { defaultValue: 'Print a QR poster' })}</strong> {t('dash.onboard.w1rest', { defaultValue: '— customers scan it once to sign up.' })}</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-[#37352F] flex-shrink-0">2.</span>
            <span><strong>{t('dash.onboard.w2bold', { defaultValue: 'They get a digital card' })}</strong> {t('dash.onboard.w2rest', { defaultValue: '— saved to Apple or Google Wallet, no app to install.' })}</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-[#37352F] flex-shrink-0">3.</span>
            <span><strong>{t('dash.onboard.w3bold', { defaultValue: 'You scan their card' })}</strong> {t('dash.onboard.w3rest', { defaultValue: '— to give a stamp when they visit.' })}</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-[#37352F] flex-shrink-0">4.</span>
            <span><strong>{t('dash.onboard.w4bold', { defaultValue: 'They unlock rewards' })}</strong> {t('dash.onboard.w4rest', { defaultValue: '— automatic, no spreadsheet required.' })}</span>
          </li>
        </ol>
      </div>
      <p className="text-xs text-gray-400">{t('dash.onboard.welcomeTime', { defaultValue: 'This will take about 3 minutes. You can skip and come back anytime.' })}</p>
    </div>
  );
}

const POSTER_COLORS = ['#37352F', '#1D4ED8', '#047857', '#9D174D'];
const PREVIEW_SCALE = 0.34;
const PREVIEW_W = Math.round(1123 * PREVIEW_SCALE);
const PREVIEW_H = Math.round(794 * PREVIEW_SCALE);
// Strip the standalone-window chrome so only the pamphlet shows in the preview.
const PREVIEW_CSS =
  '.controls{display:none!important}' +
  '.size-card,.size-poster{display:none!important}' +
  '.size-pamphlet{margin:0!important;box-shadow:none!important;display:flex!important}' +
  'body{margin:0!important;overflow:hidden!important;background:#fff!important}';

function PrintStep({
  campaign, location, alreadyDone, onDownload,
}: {
  campaign: Campaign;
  location: Location | null;
  alreadyDone: boolean;
  onDownload: (color: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [posterColor, setPosterColor] = useState(POSTER_COLORS[0]);

  const previewHtml = useMemo(
    () =>
      buildPosterHtml({ campaign, location, size: 'pamphlet', posterBgOverride: posterColor })
        .replace('</head>', `<style>${PREVIEW_CSS}</style></head>`),
    [campaign, location, posterColor],
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="w-12 h-12 bg-[#F7F7F5] rounded-full mx-auto flex items-center justify-center border notion-border mb-2">
          <Printer className="w-5 h-5 text-[#37352F]" />
        </div>
        <h2 className="text-2xl font-serif-display font-semibold">{t('dash.onboard.printTitle', { defaultValue: 'Print your join poster' })}</h2>
        <p className="text-gray-500 text-sm max-w-md mx-auto">
          {t('dash.onboard.printSub', { defaultValue: 'Put this by your till — customers scan the QR once to sign up. No app needed.' })}
        </p>
      </div>

      <div className="bg-[#F7F7F5] border notion-border rounded-xl p-5 flex flex-col items-center space-y-4">
        <div
          className="rounded-lg overflow-hidden shadow-md bg-white"
          style={{ width: PREVIEW_W, height: PREVIEW_H }}
        >
          <iframe
            title="Pamphlet preview"
            srcDoc={previewHtml}
            scrolling="no"
            style={{
              width: 1123,
              height: 794,
              border: 0,
              transform: `scale(${PREVIEW_SCALE})`,
              transformOrigin: 'top left',
              pointerEvents: 'none',
            }}
          />
        </div>

        <div className="flex items-center gap-2.5">
          {POSTER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setPosterColor(c)}
              aria-label={t('dash.onboard.useColor', { color: c, defaultValue: 'Use {{color}}' })}
              className={`w-8 h-8 rounded-full border-2 border-white shadow-sm transition ${
                posterColor === c ? 'ring-2 ring-offset-2 ring-[#37352F] scale-110' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 max-w-sm">
          <strong>{t('dash.onboard.noticeBold', { defaultValue: 'Notice:' })}</strong> {t('dash.onboard.noticeRest', { defaultValue: "Coloured posters are a Pro feature. As a one-time welcome you can download a coloured poster now — afterwards, free accounts can only download plain white posters, and you'd need Pro to make coloured ones again. So if you like a colour, grab it now." })}
        </div>

        <button
          onClick={() => onDownload(posterColor)}
          className="bg-[#37352F] text-white px-5 py-2.5 rounded-md font-medium text-sm hover:bg-opacity-90 transition flex items-center gap-2"
        >
          <Printer className="w-4 h-4" /> {alreadyDone ? t('dash.onboard.downloadAgain', { defaultValue: 'Download again' }) : t('dash.onboard.downloadPoster', { defaultValue: 'Download poster (PNG)' })}
        </button>
        {alreadyDone && (
          <div className="text-xs text-green-600 flex items-center gap-1">
            <Check className="w-3 h-3" /> {t('dash.onboard.downloaded', { defaultValue: 'Downloaded — you can move on' })}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
        <strong>{t('dash.onboard.tipBold', { defaultValue: 'Tip:' })}</strong> {t('dash.onboard.tipRest', { defaultValue: 'Got multiple locations? Download a separate poster for each from Settings → Share & Promote.' })}
      </div>
    </div>
  );
}

function TestStep({
  alreadyDone, onOpen,
}: { alreadyDone: boolean; onOpen: () => Promise<void> }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="w-12 h-12 bg-[#F7F7F5] rounded-full mx-auto flex items-center justify-center border notion-border mb-2">
          <Smartphone className="w-5 h-5 text-[#37352F]" />
        </div>
        <h2 className="text-2xl font-serif-display font-semibold">{t('dash.onboard.testTitle', { defaultValue: 'Try it as a customer' })}</h2>
        <p className="text-gray-500 text-sm max-w-md mx-auto">
          {t('dash.onboard.testSub', { defaultValue: "The fastest way to understand your customers' experience is to live it once yourself." })}
        </p>
      </div>

      <div className="bg-[#F7F7F5] border notion-border rounded-lg p-6 space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">{t('dash.onboard.whatToDo', { defaultValue: 'What to do:' })}</p>
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="font-bold text-[#37352F] flex-shrink-0">1.</span>
            <span>{t('dash.onboard.t1', { defaultValue: 'Click the button below to open the customer signup page in a new tab.' })}</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-[#37352F] flex-shrink-0">2.</span>
            <span>{t('dash.onboard.t2', { defaultValue: "Sign up with a personal email — you'll get a magic link to log in." })}</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-[#37352F] flex-shrink-0">3.</span>
            <span>{t('dash.onboard.t3', { defaultValue: 'You\u2019ll see your loyalty card with the rotating QR code. On iPhone, tap "Add to Apple Wallet"; on Android, "Save to Google Wallet".' })}</span>
          </li>
        </ol>
      </div>

      <button
        onClick={onOpen}
        className="w-full bg-[#37352F] text-white py-3 rounded-md font-medium text-sm hover:bg-opacity-90 transition flex items-center justify-center gap-2"
      >
        {alreadyDone ? t('dash.onboard.openAgain', { defaultValue: 'Open again' }) : t('dash.onboard.openSignup', { defaultValue: 'Open customer signup' })}  <ArrowRight className="w-4 h-4" />
      </button>

      {alreadyDone && (
        <div className="text-xs text-green-600 flex items-center justify-center gap-1">
          <Check className="w-3 h-3" /> {t('dash.onboard.opened', { defaultValue: 'Opened — finish the signup on that tab, then come back here' })}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-xs text-amber-800">
        <strong>{t('dash.onboard.noteBold', { defaultValue: 'Note:' })}</strong> {t('dash.onboard.noteRest', { defaultValue: "Use a different email than the one you signed up with as a merchant. Otherwise you'll just sign back into the dashboard." })}
      </div>
    </div>
  );
}

function ScanTourStep() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="w-12 h-12 bg-[#F7F7F5] rounded-full mx-auto flex items-center justify-center border notion-border mb-2">
          <ScanLine className="w-5 h-5 text-[#37352F]" />
        </div>
        <h2 className="text-2xl font-serif-display font-semibold">{t('dash.onboard.scanTitle', { defaultValue: 'Last thing — the scanner' })}</h2>
        <p className="text-gray-500 text-sm max-w-md mx-auto">
          {t('dash.onboard.scanSub', { defaultValue: "When a customer visits, here's how you give them a stamp." })}
        </p>
      </div>

      <div className="bg-[#F7F7F5] border notion-border rounded-lg p-6 space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">{t('dash.onboard.howToStamp', { defaultValue: 'How to stamp a customer:' })}</p>
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="font-bold text-[#37352F] flex-shrink-0">1.</span>
            <span>{t('dash.onboard.s1a', { defaultValue: 'Go to the' })} <strong>{t('dash.onboard.s1bold', { defaultValue: 'Dashboard tab' })}</strong> {t('dash.onboard.s1b', { defaultValue: "(the one you'll see when this closes)." })}</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-[#37352F] flex-shrink-0">2.</span>
            <span>{t('dash.onboard.s2a', { defaultValue: 'Tap' })} <strong>{t('dash.onboard.s2bold', { defaultValue: 'Open Scanner' })}</strong> {t('dash.onboard.s2b', { defaultValue: '— your camera turns on.' })}</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-[#37352F] flex-shrink-0">3.</span>
            <span>{t('dash.onboard.s3', { defaultValue: 'The customer shows you their QR (from Apple Wallet, Google Wallet, or the web). Point your camera at it.' })}</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-[#37352F] flex-shrink-0">4.</span>
            <span>{t('dash.onboard.s4', { defaultValue: "That's it — a stamp is added. Keep scanning to stamp the next customer." })}</span>
          </li>
        </ol>
      </div>

      <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-sm text-green-800">
        <strong>{t('dash.onboard.readyBold', { defaultValue: "You're ready." })}</strong> {t('dash.onboard.readyRest', { defaultValue: 'The customer card you just made (in step 3) is real — show it to your own scanner to give yourself the first stamp.' })}
      </div>
    </div>
  );
}
