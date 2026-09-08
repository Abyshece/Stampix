# Stampfix — German i18n, complete set

This folder contains **every file changed for the German translation**, each already
in its correct repo path. To apply: copy the `src/` folder here over your repo's `src/`.
Only these files are overwritten — nothing else is touched.

`de.ts` is the single, final German dictionary (supersedes all earlier per-batch copies).

## What's inside

**Dictionary**
- src/locales/de.ts  ← final, complete

**Marketing site**
- src/components/marketing/PricingPage.tsx, FeaturesPage.tsx, AboutPage.tsx, UseCasesPage.tsx, MarketingLayout.tsx
- src/components/SiteFooter.tsx, Faq.tsx, ContactFormSection.tsx
- src/components/legal/LegalPage.tsx  (shared legal/FAQ chrome)

**Merchant dashboard** (incl. the new language switcher in the header)
- src/components/MerchantDashboard.tsx
- src/components/StaffPanel.tsx, LinksSettings.tsx, LocationsPanel.tsx, DangerZonePanel.tsx,
  AccountBilling.tsx, AccountSecurity.tsx, UpgradeModal.tsx, GetHelpPanel.tsx,
  ComplianceSettings.tsx, CustomerPrivacyNoticePanel.tsx, DownloadMyDataButton.tsx,
  PosterSettings.tsx, InsightsPanel.tsx

**Customer app + onboarding**
- src/components/CustomerApp.tsx, MyCardPage.tsx, CardRecovery.tsx, AddToAppleWalletButton.tsx,
  CustomerActivityLog.tsx, AppleWalletGuide.tsx, StaffGate.tsx
- src/components/OnboardingWizard.tsx, MerchantOnboarding.tsx

## Already in your repo (from the earlier phases 1–2, no need to re-copy)
- src/i18n.ts, src/components/LanguageSwitcher.tsx, src/components/LandingPage.tsx, src/locales/en.ts

## Notes / known tiny gaps (English on purpose)
- Relative timestamps in the Insights recent-activity feed ("just now", "3d ago").
- The language switcher's own screen-reader label ("Change language").
- Legal page *bodies* (Terms, Privacy, Impressum, DPA, Cardholder pages) were deferred —
  German legal text should get a lawyer's review before going live. Their chrome (nav,
  "last updated", footer) is translated.

Every file was type-checked (`tsc -b`, exit 0) as a complete set.
