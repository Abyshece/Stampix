import { useEffect, useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import type { Campaign, UserCard, ActivityItem, Location, OnboardingState, MerchantBilling } from '../types';
import {
  ScanLine, Settings, Users, ChevronRight, Plus, Palette, Camera, X, Eye, Share, Menu,
  BarChart3, TrendingUp, Award, Upload, History, LogOut, Trash2, Ban, Search, CheckCircle2,
  RotateCcw, Smile, MoreHorizontal, ArrowRight, MapPin, Archive, Sparkles, Check, LifeBuoy, Info, AlertTriangle, Shield, Lock, Download,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { NotificationBell } from './NotificationBell';
import { SupportModal } from './SupportModal';
import { markApprovalBannerSeen, getCardById, logMerchantActivity } from '../lib/db';
import { useTranslation } from 'react-i18next';
import { WalletCard } from './WalletCard';
import { QRScanner, parseCardQRPayload } from './QRScanner';
import { ScanCelebration } from './ScanCelebration';
import { playScanSound } from '../lib/scanSounds';
import { ScanRejection } from './ScanRejection';
import { LocationsPanel } from './LocationsPanel';
import { MerchantValueCalculator } from './MerchantValueCalculator';
import { StaffPanel } from './StaffPanel';

import { InfoHint } from './InfoHint';
import { WalletLivePreview } from './WalletLivePreview';
import { StaffGate } from './StaffGate';
import { listStaff, getStaffSession, clearStaffSession, type StaffMember } from '../services/staff';
import { ProLockOverlay } from './ProLockOverlay';
import { isDarkColor } from '../lib/colors';
import { UpgradeBanner } from './UpgradeBanner';
import { UpgradeModal } from './UpgradeModal';
import { AccountBilling } from './AccountBilling';
import { AccountSecurity } from './AccountSecurity';
import { LinksSettings } from './LinksSettings';
import { ComplianceSettings } from './ComplianceSettings';
import { PosterSettings } from './PosterSettings';
import { CustomerPrivacyNoticePanel } from './CustomerPrivacyNoticePanel';
import { DangerZonePanel } from './DangerZonePanel';
import { DownloadMyDataButton } from './DownloadMyDataButton';
import { InsightsPanel } from './InsightsPanel';
import { RevealableEmail } from './RevealableEmail';
import { GetHelpPanel } from './GetHelpPanel';
import { useToast } from './ToastProvider';
import { supabase } from '../lib/supabase';
import { buildPosterHtml, type PosterSize } from '../services/posterGenerator';
import { downloadPosterPng } from '../services/posterImage';

interface MerchantDashboardProps {
  campaign: Campaign;
  cards: UserCard[];
  activities: ActivityItem[];
  locations: Location[];
  activeLocationId: string | null;
  onboarding: OnboardingState;
  /** Merchant's current plan + Stripe state. Used to decide whether to show
   *  upgrade banners (free plan only) and which CTA to render. */
  billing: MerchantBilling;
  /** Merchant country, used for currency-aware pricing copy. */
  country?: 'DE' | 'CA' | null;
  onSetActiveLocation: (id: string | null) => void;
  onAddLocation: (name: string, address?: string, latitude?: number | null, longitude?: number | null) => Promise<void>;
  onUpdateLocation: (locationId: string, patch: { name?: string; address?: string; latitude?: number | null; longitude?: number | null; archived?: boolean }) => Promise<void>;
  onStampCard: (cardId: string) => void;
  onResetCard: (cardId: string) => void;
  /** Redeems a scanned signed token server-side. Returns the result so the
   *  scanner can show a toast. Throws if the token is invalid/expired/replayed. */
  onRedeemToken: (token: string) => Promise<{
    action: 'STAMP' | 'REDEEM';
    card: { id: string; customerName: string; currentStamps: number; rewardsRedeemed: number; status: 'ACTIVE' | 'BLOCKED' };
  }>;
  onUpdateCampaign: (patch: Partial<Campaign>) => void;
  onAddCustomer: (data: { firstName: string; surname: string; email: string }) => void;
  onDeleteCustomer: (cardId: string) => void;
  onBlockCustomer: (cardId: string) => void;
  onMarkOnboardingStep: (patch: Partial<OnboardingState>) => Promise<void>;
  onLogout: () => void;
}

type SettingsSection = 'stamping' | 'general' | 'wallet' | 'posters' | 'locations' | 'billing' | 'account' | 'links' | 'privacy' | 'danger';
type Tab = 'DASHBOARD' | 'CUSTOMERS' | 'ACTIVITY' | 'ANALYTICS' | 'VALUE' | 'STAFF' | 'PREVIEW' | 'SETTINGS' | 'SHARE' | 'HELP';

/** Each dashboard tab has a real URL so refresh, back/forward and deep links work. */
const TAB_PATH: Record<Tab, string> = {
  DASHBOARD: '/scan',
  CUSTOMERS: '/customers',
  ACTIVITY: '/activity',
  ANALYTICS: '/insights',
  VALUE: '/payback',
  STAFF: '/staff',
  PREVIEW: '/preview-card',
  SETTINGS: '/settings',
  SHARE: '/promote',
  HELP: '/help',
};
const SETTINGS_SECTIONS: SettingsSection[] = ['general', 'wallet', 'posters', 'locations', 'billing', 'account', 'links', 'privacy', 'danger'];
function pathToTab(path: string): Tab | null {
  if (path === '/settings' || path.startsWith('/settings/')) return 'SETTINGS';
  const e = (Object.entries(TAB_PATH) as [Tab, string][]).find(([, p]) => p === path);
  return e ? e[0] : null;
}
function pathToSection(path: string): SettingsSection | null {
  const m = path.match(/^\/settings\/([a-z]+)$/);
  return m && (SETTINGS_SECTIONS as string[]).includes(m[1]) ? (m[1] as SettingsSection) : null;
}

const NOTION_COLORS = [
  { name: 'Default', hex: '#37352F' },
  { name: 'Gray', hex: '#9B9A97' },
  { name: 'Brown', hex: '#64473A' },
  { name: 'Orange', hex: '#D9730D' },
  { name: 'Yellow', hex: '#DFAB01' },
  { name: 'Green', hex: '#0F7B6C' },
  { name: 'Blue', hex: '#0B6E99' },
  { name: 'Purple', hex: '#6940A5' },
  { name: 'Pink', hex: '#AD1A72' },
  { name: 'Red', hex: '#E03E3E' },
];

const EMOJI_LIST = [
  '☕️', '🍔', '🍕', '🥗', '🍦', '🍩', '🍪', '🥐', '🥪', '🌮',
  '🍣', '🍱', '🍛', '🍜', '🍝', '🍷', '🍺', '🍸', '💇‍♀️', '💅',
  '💆‍♀️', '💈', '🏋️', '🧘', '🚲', '🚗', '📚', '🧸', '🎸', '🎮',
  '🧵', '🧶', '🎨', '📷', '💐', '🪴', '👗', '👠', '👓', '🛍️',
];

export function MerchantDashboard({
  campaign, cards, activities, locations, activeLocationId, onboarding, billing, country,
  onSetActiveLocation, onAddLocation, onUpdateLocation,
  onStampCard, onResetCard, onRedeemToken, onUpdateCampaign,
  onAddCustomer, onDeleteCustomer, onBlockCustomer, onMarkOnboardingStep, onLogout,
}: MerchantDashboardProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>(
    () => pathToTab(window.location.pathname) || (sessionStorage.getItem('sf_active_tab') as Tab) || 'DASHBOARD',
  );
  // Keep the open tab sticky so opening a poster (or any re-render) never
  // bounces the merchant back to the dashboard.
  useEffect(() => {
    sessionStorage.setItem('sf_active_tab', activeTab);
  }, [activeTab]);
  const toast = useToast();
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);
  // "Who's on shift?" — ask once per browser session, only if staff exist.
  const [showStaffGate, setShowStaffGate] = useState(false);
  const [staffRoster, setStaffRoster] = useState<StaffMember[]>([]);
  const [gateTarget, setGateTarget] = useState<{ id: string; name: string } | null>(null);
  const [activeStaff, setActiveStaff] = useState(() => getStaffSession(campaign.id));
  // Sections the on-shift staff member is not allowed to see (owner-controlled).
  // Empty when the owner is using the dashboard directly (no staff session).
  const staffHidden = useMemo(
    () => (activeStaff ? (staffRoster.find((r) => r.id === activeStaff.id)?.hiddenSections ?? []) : []),
    [activeStaff, staffRoster],
  );
  useEffect(() => {
    if (staffHidden.includes(activeTab)) { setActiveTab('DASHBOARD'); window.history.replaceState({}, '', TAB_PATH.DASHBOARD); }
  }, [staffHidden, activeTab]);
  useEffect(() => {
    let cancelled = false;
    listStaff(campaign.id)
      .then((rows) => {
        if (cancelled) return;
        const active = rows.filter((r) => r.active);
        setStaffRoster(active);
        if (active.length > 0 && !getStaffSession(campaign.id)) setShowStaffGate(true);
      })
      .catch(() => { /* staff is optional — never block the dashboard */ });
    return () => { cancelled = true; };
  }, [campaign.id]);
  // Show the Admin shortcut only for the platform owner's account.
  const { user } = useAuth();
  const [showSupport, setShowSupport] = useState(false);
  const isStampfixAdmin = (user?.email ?? '').toLowerCase() === 'abyshece@gmail.com';

  // Buffered settings
  const [tempSettings, setTempSettings] = useState<Campaign>(campaign);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Scanner state
  const [manualId, setManualId] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanResult, setScanResult] = useState<{
    status: 'success' | 'error';
    card?: UserCard;
    message: string;
  } | null>(null);
  // Party celebration overlay after a successful scan. Kept separate from
  // scanResult so it can run a full 5s regardless of scanResult's own shorter
  // auto-clear (which drives the inline error state).
  const [celebration, setCelebration] = useState<{
    customerName: string; currentStamps: number; maxStamps: number; offerTitle: string; redeemed: boolean;
  } | null>(null);
  // Wrong-card overlay: a card that belongs to a different business.
  const [rejection, setRejection] = useState<{ businessName: string } | null>(null);
  useEffect(() => {
    if (scanResult?.status === 'success' && scanResult.card) {
      const c = scanResult.card;
      setCelebration({
        customerName: c.customerName,
        currentStamps: c.currentStamps,
        maxStamps: c.maxStampsSnapshot ?? campaign.maxStamps,
        offerTitle: campaign.offerTitle,
        redeemed: /redeem/i.test(scanResult.message),
      });
    }
  }, [scanResult, campaign.maxStamps, campaign.offerTitle]);
  // Subtle tone per successful scan: stamp / reward-unlocked / redeem.
  useEffect(() => {
    if (scanResult?.status !== 'success') return;
    const msg = scanResult.message || '';
    playScanSound(/redeem/i.test(msg) ? 'redeem' : /unlock/i.test(msg) ? 'last' : 'stamp');
  }, [scanResult]);
  // A scanned card that belongs to a different business: show the firm
  // rejection overlay + a negative tone so staff instantly see what went wrong.
  useEffect(() => {
    if (scanResult?.status !== 'error') return;
    const msg = scanResult.message || '';
    if (/different caf|not from this|isn.?t from|another (caf|shop|store|business)|belongs to another/i.test(msg)) {
      setRejection({ businessName: campaign.businessName || 'this café' });
      playScanSound('error');
    }
  }, [scanResult, campaign.businessName]);

  // Derived: non-archived locations, and the currently active one.
  const activeLocations = useMemo(() => locations.filter((l) => !l.archived), [locations]);
  const activeLocation = useMemo(
    () => activeLocations.find((l) => l.id === activeLocationId) ?? null,
    [activeLocations, activeLocationId],
  );

  // Upgrade UI state. The warning-state banner is dismissible per-session
  // (sessionStorage so it pops back if they refresh — they should see it
  // at least once per visit until they upgrade). The "at limit" banner
  // can NOT be dismissed because it reflects a real, ongoing block.
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(() =>
    sessionStorage.getItem('stampfix_upgrade_warning_dismissed') === '1',
  );
  const dismissWarning = () => {
    setWarningDismissed(true);
    sessionStorage.setItem('stampfix_upgrade_warning_dismissed', '1');
  };

  // Show banner only for free-plan merchants. Pro is unlimited so no nudges.
  const showBanner = billing.plan === 'free';
  const isPro = billing.plan === 'pro';

  // Customer list state
  const [customerSearch, setCustomerSearch] = useState('');
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({ firstName: '', surname: '', email: '' });
  const [confirmAction, setConfirmAction] = useState<{
    type: 'DELETE' | 'BLOCK'; cardId: string; name: string;
  } | null>(null);

  // Preview
  const [previewStamps, setPreviewStamps] = useState(3);
  // Which share URL was just copied — shows a "Copied!" confirmation on that button.
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  // Whether the merchant dismissed the green "approved" banner. Persisted
  // per-campaign so it doesn't reappear after they close it.
  const [approvalSeen, setApprovalSeen] = useState(() => {
    if (campaign.approvalBannerSeen) return true;
    try { return localStorage.getItem(`sf_approval_seen_${campaign.id}`) === '1'; } catch { return false; }
  });

  // -------------------- Handlers --------------------

  const handleTabChange = (tab: Tab) => {
    if (tab === 'SETTINGS') {
      setTempSettings(campaign);
      setSettingsSaved(false);
    }
    setActiveTab(tab);
    if (pathToTab(window.location.pathname) !== tab) window.history.pushState({}, '', TAB_PATH[tab]);
    setShowMobileMoreMenu(false);
  };

  const handleManualStamp = () => {
    const q = manualId.trim().toLowerCase();
    if (!q) return;
    const target = cards.find(
      (c) =>
        (c.customerCode ?? '').toLowerCase() === q ||
        c.id.toLowerCase() === q ||
        (c.email ?? '').toLowerCase() === q ||
        c.id.toLowerCase().startsWith(q),
    );
    if (!target) {
      setScanResult({ status: 'error', message: 'Customer not found' });
    } else if (target.status === 'BLOCKED') {
      setScanResult({ status: 'error', message: 'This card is blocked' });
    } else {
      onStampCard(target.id);
      const newStamps = target.currentStamps + 1;
      setScanResult({
        status: 'success',
        card: { ...target, currentStamps: newStamps },
        message: newStamps >= (target.maxStampsSnapshot ?? campaign.maxStamps) ? 'Reward Unlocked!' : 'Stamp Added',
      });
      setManualId('');
    }
    setTimeout(() => setScanResult(null), 2500);
  };

  /**
   * Handles a decoded QR payload from the live scanner. We deliberately do
   * NOT close the scanner after a successful scan — a merchant stamping a
   * busy queue should be able to scan one customer after another without
   * tapping anything between.
   *
   * Two QR formats are supported:
   *  - Signed token (preferred, rotates every 30s) — sent to the server
   *    for verification + stamping. Server is authoritative.
   *  - Plain cardId (legacy, used by already-saved Google Wallet passes)
   *    — handled client-side as before. Still safe because RLS ensures
   *    merchants can only stamp cards in their own campaign, but it does
   *    NOT defend against screenshot replay. The token path does.
   */
  const handleScan = async (payload: string) => {
    const parsed = parseCardQRPayload(payload);
    if (!parsed) {
      setScanResult({ status: 'error', message: "That doesn't look like a Stampfix card" });
      setTimeout(() => setScanResult(null), 2500);
      return;
    }

    if (parsed.kind === 'token') {
      try {
        const result = await onRedeemToken(parsed.token);
        setScanResult({
          status: 'success',
          card: {
            id: result.card.id,
            campaignId: campaign.id,
            customerName: result.card.customerName,
            email: '',
            currentStamps: result.card.currentStamps,
            rewardsRedeemed: result.card.rewardsRedeemed,
            status: result.card.status,
            maxStampsSnapshot: cards.find((c) => c.id === result.card.id)?.maxStampsSnapshot ?? null,
            joinedAt: new Date(),
          },
          message: result.action === 'REDEEM'
            ? 'Reward Redeemed'
            : result.card.currentStamps >= (cards.find((c) => c.id === result.card.id)?.maxStampsSnapshot ?? campaign.maxStamps)
              ? 'Reward Unlocked!'
              : 'Stamp Added',
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stamp failed';
        setScanResult({ status: 'error', message: msg });
      }
      setTimeout(() => setScanResult(null), 2500);
      return;
    }

    // Legacy cardId path — for wallet passes that encode the plain cardId.
    // Re-read the card fresh from the DB so the stamp-vs-redeem decision is
    // never made on a stale local count (which would send an already-full card
    // down the stamp branch and never redeem).
    const local = cards.find((c) => c.id === parsed.cardId);
    let target = local ?? null;
    try {
      const fresh = await getCardById(parsed.cardId);
      if (fresh) target = fresh;
    } catch {
      /* fall back to local state */
    }
    if (!target) {
      setScanResult({ status: 'error', message: 'This card is from a different café' });
      setTimeout(() => setScanResult(null), 2500);
      return;
    }
    if (target.status === 'BLOCKED') {
      setScanResult({ status: 'error', message: 'This card is blocked', card: target });
      setTimeout(() => setScanResult(null), 2500);
      return;
    }
    const goal = target.maxStampsSnapshot ?? campaign.maxStamps;
    if (target.currentStamps >= goal) {
      onResetCard(target.id);
      setScanResult({
        status: 'success',
        card: { ...target, currentStamps: 0, rewardsRedeemed: target.rewardsRedeemed + 1 },
        message: 'Reward Redeemed',
      });
    } else {
      onStampCard(target.id);
      const newStamps = target.currentStamps + 1;
      setScanResult({
        status: 'success',
        card: { ...target, currentStamps: newStamps },
        message: newStamps >= goal ? 'Reward Unlocked!' : 'Stamp Added',
      });
    }
    setTimeout(() => setScanResult(null), 2500);
  };

  const handleSaveSettings = () => {
    onUpdateCampaign(tempSettings);
    setSettingsSaved(true);
    toast.success('Settings saved');
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    if (file.type !== 'image/png') {
      toast.error('Please upload a PNG image.');
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error('Logo is too large — please keep it under 1 MB.');
      return;
    }
    // Enforce a minimum size so the logo isn't blurry on the pass.
    let dims: { w: number; h: number };
    try {
      dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image();
        const objUrl = URL.createObjectURL(file);
        img.onload = () => { URL.revokeObjectURL(objUrl); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
        img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error('decode failed')); };
        img.src = objUrl;
      });
    } catch {
      toast.error("Couldn't read that image — please try a different PNG.");
      return;
    }
    if (dims.w < 200 || dims.h < 200) {
      toast.error(`Logo is too small (${dims.w}×${dims.h}px). Please upload at least 200×200px.`);
      return;
    }
    setLogoUploading(true);
    try {
      const path = `${campaign.id}/logo.png`;
      const { error } = await supabase.storage
        .from('merchant-logos')
        .upload(path, file, { upsert: true, contentType: 'image/png', cacheControl: '3600' });
      if (error) throw error;
      const { data } = supabase.storage.from('merchant-logos').getPublicUrl(path);
      // Cache-buster so Apple/Google/browsers re-fetch after a re-upload.
      const url = `${data.publicUrl}?v=${Date.now()}`;
      setTempSettings((prev) => ({ ...prev, logoImage: url }));
      toast.success('Logo uploaded');
    } catch (err) {
      console.error('[logo upload] failed:', err);
      toast.error('Logo upload failed. Please try again.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleAddCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCustomerData.firstName && newCustomerData.email) {
      onAddCustomer(newCustomerData);
      setNewCustomerData({ firstName: '', surname: '', email: '' });
      setIsAddCustomerModalOpen(false);
    }
  };

  const handleConfirmAction = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'DELETE') onDeleteCustomer(confirmAction.cardId);
    else if (confirmAction.type === 'BLOCK') onBlockCustomer(confirmAction.cardId);
    setConfirmAction(null);
  };

  /** Download the new-format printable poster for a specific location.
   *  Size determines the paper format. The HTML template is generated
   *  by services/posterGenerator and includes the merchant's offer,
   *  branding color (or gradient from posterColor), icon, business name,
   *  and a per-location QR code. */
  const handleDownloadPoster = (location: Location | null, size: PosterSize = 'pamphlet', lang: 'en' | 'de' = 'en') => {
    const html = buildPosterHtml({ campaign, location, size, lang });
    void downloadPosterPng(html, size, `stampfix-${size}-poster.png`);
    // Onboarding: downloading any poster from the Share tab counts as
    // the poster-downloaded milestone. Fire and forget.
    if (!onboarding.poster_downloaded) {
      onMarkOnboardingStep({ poster_downloaded: true });
    }
    logMerchantActivity('poster_downloaded', { size });
  };

  /** Status filter for the Customers tab:
   *    'active'  = ACTIVE cards (default)
   *    'blocked' = BLOCKED cards (excluding those pending deletion)
   *    'pending_deletion' = BLOCKED + deletion_requested_at set
   *  No 'deleted' bucket because the cleanup job actually removes those rows.
   */
  const [settingsSection, setSettingsSection] = useState<SettingsSection>(() => pathToSection(window.location.pathname) || 'general');
  // Keep the browser URL and the active tab in sync: normalize an unknown path
  // (e.g. "/") to the current tab on mount, and follow back/forward navigation.
  useEffect(() => {
    if (pathToTab(window.location.pathname) === null) {
      window.history.replaceState({}, '', activeTab === 'SETTINGS' ? `/settings/${settingsSection}` : TAB_PATH[activeTab]);
    }
    const onPop = () => {
      const t = pathToTab(window.location.pathname);
      if (t) setActiveTab(t);
      const sec = pathToSection(window.location.pathname);
      if (sec) setSettingsSection(sec);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [customerStatusFilter, setCustomerStatusFilter] = useState<'active' | 'blocked' | 'pending_deletion'>('active');
  // Extra customer filters: when they joined, how engaged they are, reward state.
  const [joinedFilter, setJoinedFilter] = useState<'all' | '7' | '30' | '90' | 'custom'>('all');
  const [joinedFrom, setJoinedFrom] = useState('');
  const [joinedTo, setJoinedTo] = useState('');
  const [engagementFilter, setEngagementFilter] = useState<'all' | 'active30' | 'dormant30' | 'never'>('all');
  const [rewardFilter, setRewardFilter] = useState<'all' | 'ready' | 'close' | 'redeemed'>('all');
  // One-tap customer segments (quick pills) for the questions merchants ask most.
  const [segment, setSegment] = useState<'all' | 'top' | 'ready' | 'close' | 'new' | 'inactive'>('all');

  /** Last stamp/redeem per card, derived from the activity log. */
  const lastSeenByCard = useMemo(() => {
    const m = new Map<string, number>();
    activities.forEach((a) => {
      if (!a.cardId) return;
      if (a.type !== 'STAMP' && a.type !== 'REDEEM') return;
      const t = a.timestamp.getTime();
      if (t > (m.get(a.cardId) ?? 0)) m.set(a.cardId, t);
    });
    return m;
  }, [activities]);

  const filteredCards = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    const now = Date.now();
    const list = cards.filter((c) => {
      // Status bucket
      if (customerStatusFilter === 'active') {
        if (c.status !== 'ACTIVE') return false;
      } else if (customerStatusFilter === 'blocked') {
        if (c.status !== 'BLOCKED') return false;
        if (c.deletionRequestedAt) return false;
      } else if (customerStatusFilter === 'pending_deletion') {
        if (!c.deletionRequestedAt) return false;
      }
      // Search: by name OR customer code (intentionally NOT by email — staff
      // shouldn't have to know customers' emails, and asking customers to
      // dictate their email at a counter is awkward; the SF00XXX code is
      // easier to read off a phone and faster to type).
      // Joined date
      if (joinedFilter !== 'all') {
        const joined = c.joinedAt.getTime();
        if (joinedFilter === 'custom') {
          if (joinedFrom && joined < new Date(joinedFrom).setHours(0, 0, 0, 0)) return false;
          if (joinedTo && joined > new Date(joinedTo).setHours(23, 59, 59, 999)) return false;
        } else {
          const days = Number(joinedFilter);
          if (joined < Date.now() - days * 864e5) return false;
        }
      }
      // Engagement, from the activity log
      if (engagementFilter !== 'all') {
        const last = lastSeenByCard.get(c.id);
        const cutoff = Date.now() - 30 * 864e5;
        if (engagementFilter === 'never' && last) return false;
        if (engagementFilter === 'active30' && (!last || last < cutoff)) return false;
        if (engagementFilter === 'dormant30' && (!last || last >= cutoff)) return false;
      }
      // Reward state
      if (rewardFilter !== 'all') {
        const goal = c.maxStampsSnapshot ?? campaign.maxStamps;
        if (rewardFilter === 'ready' && c.currentStamps < goal) return false;
        if (rewardFilter === 'close' && !(c.currentStamps === goal - 1 && goal > 1)) return false;
        if (rewardFilter === 'redeemed' && c.rewardsRedeemed < 1) return false;
      }
      // Quick segment pill
      if (segment !== 'all') {
        const goal = c.maxStampsSnapshot ?? campaign.maxStamps;
        const last = lastSeenByCard.get(c.id);
        if (segment === 'top' && c.rewardsRedeemed < 1) return false;
        if (segment === 'ready' && c.currentStamps < goal) return false;
        if (segment === 'close' && !(c.currentStamps === goal - 1 && goal > 1)) return false;
        if (segment === 'new' && c.joinedAt.getTime() < now - 7 * 864e5) return false;
        if (segment === 'inactive' && last && last >= now - 30 * 864e5) return false;
      }
      if (!q) return true;
      return c.customerName.toLowerCase().includes(q)
        || (c.customerCode ?? '').toLowerCase().includes(q);
    });
    // "Top spenders" ranks by rewards earned (the loyalty proxy for spend).
    if (segment === 'top') list.sort((a, b) => b.rewardsRedeemed - a.rewardsRedeemed);
    return list;
  }, [cards, customerSearch, customerStatusFilter, joinedFilter, joinedFrom, joinedTo,
      engagementFilter, rewardFilter, segment, lastSeenByCard, campaign.maxStamps]);

  // Live counts for each quick-segment pill (over active customers).
  const segCounts = useMemo(() => {
    const now = Date.now();
    const c30 = now - 30 * 864e5;
    const c7 = now - 7 * 864e5;
    const cnt = { all: 0, top: 0, ready: 0, close: 0, new: 0, inactive: 0 };
    for (const c of cards) {
      if (c.status !== 'ACTIVE') continue;
      cnt.all++;
      const goal = c.maxStampsSnapshot ?? campaign.maxStamps;
      if (c.rewardsRedeemed >= 1) cnt.top++;
      if (c.currentStamps >= goal) cnt.ready++;
      if (c.currentStamps === goal - 1 && goal > 1) cnt.close++;
      if (c.joinedAt.getTime() >= c7) cnt.new++;
      const last = lastSeenByCard.get(c.id);
      if (!last || last < c30) cnt.inactive++;
    }
    return cnt;
  }, [cards, lastSeenByCard, campaign.maxStamps]);

  /** Download exactly what's on screen as a CSV. */
  const exportCustomersCsv = () => {
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      'Customer ID', 'Name', 'Email', 'Status', 'Joined', 'Stamps', 'Goal',
      'Rewards redeemed', 'Last activity', 'Location',
    ];
    const rows = filteredCards.map((c) => {
      const last = lastSeenByCard.get(c.id);
      const loc = locations.find((l) => l.id === c.joinedAtLocationId)?.name ?? '';
      return [
        c.customerCode ?? '', c.customerName, c.email,
        c.deletionRequestedAt ? 'Pending deletion' : c.status,
        c.joinedAt.toISOString().slice(0, 10),
        c.currentStamps, c.maxStampsSnapshot ?? campaign.maxStamps,
        c.rewardsRedeemed,
        last ? new Date(last).toISOString().slice(0, 10) : '',
        loc,
      ].map(esc).join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    // BOM so Excel opens UTF-8 names (Müller) correctly.
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Counts per bucket so the chips can show "(N)" badges.
  const bucketCounts = useMemo(() => ({
    active: cards.filter((c) => c.status === 'ACTIVE').length,
    blocked: cards.filter((c) => c.status === 'BLOCKED' && !c.deletionRequestedAt).length,
    pending_deletion: cards.filter((c) => !!c.deletionRequestedAt).length,
  }), [cards]);

  /** Per-location signup URL. The customer signup page reads ?location= and
   *  records it on their new card. The base ?campaign= alone still works
   *  and creates location-less signups. */
  const joinUrlForLocation = (locationId: string | null) =>
    locationId
      ? `${window.location.origin}/?campaign=${campaign.id}&location=${locationId}`
      : `${window.location.origin}/?campaign=${campaign.id}`;

  const stampUrlForLocation = (locationId: string | null) =>
    locationId
      ? `${window.location.origin}/stamp?campaign=${campaign.id}&location=${locationId}`
      : `${window.location.origin}/stamp?campaign=${campaign.id}`;

  // -------------------- Render --------------------

  return (
    <div className="flex min-h-screen bg-white text-[#37352F] font-sans">
      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-white/80 backdrop-blur-md" onClick={() => setConfirmAction(null)} />
          <div className="relative bg-white border notion-border shadow-xl rounded-xl p-8 max-w-sm w-full text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
              confirmAction.type === 'DELETE' ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'
            }`}>
              {confirmAction.type === 'DELETE' ? <Trash2 className="w-8 h-8" /> : <Ban className="w-8 h-8" />}
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-serif-display font-semibold">Are you sure?</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {confirmAction.type === 'DELETE'
                  ? `You are about to permanently delete ${confirmAction.name}. This cannot be undone.`
                  : `You are about to ${cards.find((c) => c.id === confirmAction.cardId)?.status === 'BLOCKED' ? 'unblock' : 'block'} ${confirmAction.name}.`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmAction(null)} className="px-4 py-2.5 border notion-border rounded-md text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleConfirmAction} className={`px-4 py-2.5 rounded-md text-sm font-medium text-white shadow-sm ${
                confirmAction.type === 'DELETE' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
              }`}>
                {confirmAction.type === 'DELETE' ? 'Yes, Delete' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsAddCustomerModalOpen(false)}></div>
          <div className="relative bg-white rounded-lg shadow-xl border notion-border w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b notion-border flex justify-between items-center bg-[#F7F7F5]">
              <h3 className="font-semibold text-sm">Add New Customer</h3>
              <button onClick={() => setIsAddCustomerModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddCustomerSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-gray-400 tracking-wider">First Name</label>
                <input autoFocus value={newCustomerData.firstName}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, firstName: e.target.value })}
                  className="w-full bg-[#F7F7F5] border notion-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-gray-400 tracking-wider">Surname</label>
                <input value={newCustomerData.surname}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, surname: e.target.value })}
                  className="w-full bg-[#F7F7F5] border notion-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-gray-400 tracking-wider">Email</label>
                <input type="email" value={newCustomerData.email}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                  className="w-full bg-[#F7F7F5] border notion-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300" />
              </div>
              <button type="submit" disabled={!newCustomerData.firstName || !newCustomerData.email}
                className="w-full bg-[#37352F] text-white py-2.5 rounded text-sm font-medium hover:bg-opacity-90 transition disabled:opacity-50">
                Add Customer
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-[#F7F7F5] border-r notion-border hidden md:flex flex-col fixed inset-y-0 left-0 z-40">
        <div className="p-4 flex items-center gap-2 font-semibold text-sm border-b notion-border h-[60px]">
          <svg viewBox="0 0 282 90" className="h-4 w-auto min-w-[20px] text-[#37352F]" fill="currentColor" role="img" aria-label="Stampfix"><rect x="8" y="12" width="66" height="66" rx="4"/><circle cx="140" cy="45" r="34"/><rect x="195" y="36" width="90" height="18" rx="9" transform="rotate(45 240 45)"/><rect x="195" y="36" width="90" height="18" rx="9" transform="rotate(-45 240 45)"/></svg>
          <button type="button" onClick={() => handleTabChange('DASHBOARD')} className="truncate text-left hover:underline focus:outline-none focus-visible:underline" title="Go to scanner">{campaign.businessName}</button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 mb-2">
            <div className="text-xs font-semibold text-gray-400 mb-1 px-2">{t('dash.nav.workspace', { defaultValue: 'Workspace' })}</div>
            {([
              ['DASHBOARD', ScanLine, t('dash.nav.scanner', { defaultValue: 'Scanner' })],
              ['CUSTOMERS', Users, t('dash.nav.customers', { defaultValue: 'Customers' })],
              ['ACTIVITY', History, t('dash.nav.activity', { defaultValue: 'Activity' })],
              ['ANALYTICS', BarChart3, t('dash.nav.insights', { defaultValue: 'Insights' })],
              ['VALUE', TrendingUp, t('dash.nav.payback', { defaultValue: 'Payback' })],
              ['STAFF', Users, t('dash.nav.staff', { defaultValue: 'Staff' })],
              ['PREVIEW', Eye, t('dash.nav.previewCard', { defaultValue: 'Preview Card' })],
              ['SHARE', Share, t('dash.nav.sharePromote', { defaultValue: 'Share & Promote' })],
              ['SETTINGS', Settings, t('dash.nav.settings', { defaultValue: 'Settings' })],
              ['HELP', LifeBuoy, t('dash.nav.getHelp', { defaultValue: 'Get help' })],
            ] as const).filter(([id]) => !staffHidden.includes(id)).map(([id, Icon, label]) => (
              <button key={id} onClick={() => handleTabChange(id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition ${
                  activeTab === id ? 'bg-[#EFEFEE] font-medium' : 'hover:bg-[#EFEFEE] text-gray-600'
                }`}>
                <Icon className="w-4 h-4" />
                <span className="flex-1 text-left truncate">{label}</span>
                {billing.plan === 'free' && (id === 'ANALYTICS' || id === 'HELP' || id === 'STAFF') && (
                  <Lock className="w-3 h-3 text-gray-300 flex-shrink-0" />
                )}
              </button>
            ))}
            {isStampfixAdmin && (
              <button
                onClick={() => { window.location.href = '/admin'; }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition hover:bg-[#EFEFEE] text-gray-600"
              >
                <Shield className="w-4 h-4" /> {t('dash.nav.admin', { defaultValue: 'Admin' })}
              </button>
            )}
          </div>
        </div>

        {/* Pro upgrade CTA — free plan only. Sits above logout so it's
         *  always visible without being intrusive. Single click opens
         *  the same UpgradeModal used elsewhere. */}
        {billing.plan === 'free' && (
          <div className="px-3 pb-3">
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="w-full text-left group bg-gradient-to-br from-[#37352F] to-[#1a1918] text-white rounded-lg p-3.5 shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-full bg-amber-400/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                </div>
                <span className="text-sm font-semibold">{t('dash.nav.upgradeTitle', { defaultValue: 'Upgrade to Pro' })}</span>
              </div>
              <p className="text-[11px] text-gray-300 leading-snug">
                {t('dash.nav.upgradeBody', { defaultValue: 'Unlock unlimited customers and unlock more.' })}
              </p>
              <div className="mt-2 text-[10px] font-medium text-amber-300 group-hover:text-amber-200 inline-flex items-center gap-0.5">
                {t('dash.nav.seePlans', { defaultValue: 'See plans' })} <ArrowRight className="w-3 h-3" />
              </div>
            </button>
          </div>
        )}

        <div className="p-3 border-t notion-border">
          <button onClick={onLogout} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-red-50 text-gray-600 hover:text-red-600">
            <LogOut className="w-4 h-4" /> {t('dash.nav.logout', { defaultValue: 'Log out' })}
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-12 md:pl-72 pb-24 md:pb-12 max-w-7xl mx-auto w-full min-w-0">
        {/* Mobile header */}
        <div className="md:hidden sticky top-0 z-10 bg-white/80 backdrop-blur-md flex justify-between items-center mb-6 py-4 border-b notion-border -mx-6 px-6">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 282 90" className="h-5 w-auto text-[#37352F]" fill="currentColor" role="img" aria-label="Stampfix"><rect x="8" y="12" width="66" height="66" rx="4"/><circle cx="140" cy="45" r="34"/><rect x="195" y="36" width="90" height="18" rx="9" transform="rotate(45 240 45)"/><rect x="195" y="36" width="90" height="18" rx="9" transform="rotate(-45 240 45)"/></svg>
            <button type="button" onClick={() => handleTabChange('DASHBOARD')} className="font-semibold text-sm truncate max-w-[150px] text-left hover:underline focus:outline-none" title="Go to scanner">{campaign.businessName}</button>
          </div>
          <button onClick={onLogout} className="text-gray-400 p-1"><LogOut className="w-5 h-5" /></button>
        </div>

        <div className="hidden md:flex items-center text-sm text-gray-400 mb-6 gap-2">
          <span>{campaign.businessName}</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-[#37352F] font-medium capitalize">{t(`dash.tab.${activeTab}`, { defaultValue: activeTab.toLowerCase() })}</span>
        </div>

        {/* Account approval status banner */}
        {campaign.approvalStatus === 'pending' && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 m-0">
              <span className="font-semibold">Your account is being reviewed.</span> You can set up and test everything now: customize your card, and open your card link to enroll a test customer and try stamping. Your card goes live for real customers once approved, usually within 6-12 hours.
            </p>
          </div>
        )}
        {campaign.approvalStatus === 'rejected' && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 m-0">
              <span className="font-semibold">Your application wasn't approved.</span> Please contact support if you believe this is a mistake.
            </p>
            <button onClick={() => setShowSupport(true)} className="ml-auto self-center whitespace-nowrap text-xs font-medium px-3 py-1.5 rounded-md bg-[#37352F] text-white hover:bg-[#2F2D28] transition">Contact support</button>
          </div>
        )}
        {showSupport && (
          <SupportModal defaultEmail={user?.email ?? undefined} businessName={campaign.businessName} onClose={() => setShowSupport(false)} />
        )}
        {campaign.approvalStatus === 'approved' && !approvalSeen && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800 m-0 flex-1">
              <span className="font-semibold">Your business has been approved!</span> You're all set — your loyalty program is live.
            </p>
            <button
              onClick={() => { markApprovalBannerSeen(campaign.id); try { localStorage.setItem(`sf_approval_seen_${campaign.id}`, '1'); } catch { /* ignore */ } setApprovalSeen(true); }}
              className="text-green-600 hover:text-green-800 flex-shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* --- DASHBOARD / SCANNER --- */}
        {activeTab === 'DASHBOARD' && (
          <div className="flex flex-col h-[calc(100vh-7rem)] md:h-[calc(100vh-5rem)] md:space-y-3 relative">
            {/* Compact header: title + inline location selector on the same row.
                No description text, no big margins — this page exists for one
                action (scan) and the merchant uses it dozens of times a day.
                Total vertical footprint above the scanner: ~60px on mobile. */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3 mb-2 md:mb-0 flex-shrink-0">
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-serif-display font-semibold truncate">{t('dash.scan.hi', { defaultValue: 'Hi,' })} {campaign.businessName || t('dash.scan.there', { defaultValue: 'there' })}</h1>
                <p className="text-[11px] md:text-xs text-gray-400 truncate">{t('dash.scan.loggedInAs', { defaultValue: 'You are logged in as' })} {user?.email ?? '—'}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
              <NotificationBell />
              {staffRoster.length > 0 && (
                <div className="flex items-center gap-1.5 bg-white border notion-border rounded-md px-2.5 py-1.5 shadow-sm">
                  <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <select
                    value={activeStaff?.id ?? ''}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) { clearStaffSession(); setActiveStaff(null); return; }
                      const m = staffRoster.find((r) => r.id === id);
                      if (m) { setGateTarget({ id: m.id, name: m.name }); setShowStaffGate(true); }
                    }}
                    className="text-xs md:text-sm font-medium text-[#37352F] bg-transparent focus:outline-none cursor-pointer max-w-[130px] truncate"
                    title="Who is on shift"
                  >
                    <option value="">{t('dash.scan.staffOpt', { defaultValue: 'Staff…' })}</option>
                    {staffRoster.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {activeLocations.length > 0 && (
                <div className="flex items-center gap-1.5 bg-white border notion-border rounded-md px-2.5 py-1.5 shadow-sm">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <select
                    value={activeLocationId ?? ''}
                    onChange={(e) => onSetActiveLocation(e.target.value || null)}
                    className="text-xs md:text-sm font-medium text-[#37352F] bg-transparent focus:outline-none cursor-pointer max-w-[140px] truncate"
                  >
                    {activeLocations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              )}
              </div>
            </div>

            {/* Get Started checklist — disappears once all three milestones are hit.
                Hidden on mobile to keep the Scan view non-scrollable; merchants
                see it on desktop where there's room. */}
            {!onboarding.checklist_dismissed && !(onboarding.poster_downloaded && onboarding.test_signup_done && onboarding.first_stamp_given) && (
              <div className="hidden md:block bg-gradient-to-br from-[#F7F7F5] to-white border notion-border rounded-lg p-5 max-w-2xl flex-shrink-0">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" /> {t('dash.scan.getStarted', { defaultValue: 'Get Started' })}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t('dash.scan.getStartedSub', { defaultValue: 'Three small steps to your first stamp.' })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs font-medium text-gray-500">
                      {Number(!!onboarding.poster_downloaded) + Number(!!onboarding.test_signup_done) + Number(!!onboarding.first_stamp_given)} / 3
                    </span>
                    <button
                      onClick={() => onMarkOnboardingStep({ checklist_dismissed: true })}
                      className="text-[11px] text-gray-400 hover:text-[#37352F] transition"
                    >
                      {t('dash.scan.skipForNow', { defaultValue: 'Skip for now' })}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <ChecklistItem
                    done={!!onboarding.poster_downloaded}
                    label={t('dash.scan.cl1', { defaultValue: 'Download your QR poster' })}
                    actionLabel={t('dash.scan.cl1a', { defaultValue: 'Go to Share & Promote' })}
                    onClick={() => handleTabChange('SHARE')}
                  />
                  <ChecklistItem
                    done={!!onboarding.test_signup_done}
                    label={t('dash.scan.cl2', { defaultValue: 'Try the customer flow yourself' })}
                    actionLabel={t('dash.scan.cl2a', { defaultValue: 'Open in new tab' })}
                    onClick={async () => {
                      const primary = activeLocations[0];
                      const url = primary
                        ? `${window.location.origin}/?campaign=${campaign.id}&location=${primary.id}`
                        : `${window.location.origin}/?campaign=${campaign.id}`;
                      window.open(url, '_blank');
                      await onMarkOnboardingStep({ test_signup_done: true });
                    }}
                  />
                  <ChecklistItem
                    done={!!onboarding.first_stamp_given}
                    label={t('dash.scan.cl3', { defaultValue: 'Give your first stamp' })}
                    actionLabel={t('dash.scan.cl3a', { defaultValue: 'Open scanner' })}
                    onClick={() => setIsScannerOpen(true)}
                  />
                </div>
              </div>
            )}

            <div className="flex-1 min-h-0 flex flex-col max-w-2xl w-full mx-auto md:mx-0">
              {/* Upgrade banner — sits above the scanner so it's seen the
               *  moment the merchant lands on Dashboard. Free plan only;
               *  hidden under 8/10 customers; warning at 8-9 (dismissible
               *  per session); hard block at 10 (not dismissible). */}
              {showBanner && cards.length >= 8 &&
               !(cards.length < 10 && warningDismissed) && (
                <div className="hidden md:block mb-4 flex-shrink-0">
                  <UpgradeBanner
                    customerCount={cards.length}
                    country={country}
                    onUpgrade={() => setShowUpgradeModal(true)}
                    onDismiss={cards.length < 10 ? dismissWarning : undefined}
                  />
                </div>
              )}
              {/* Location picker — which branch is doing the stamping
                  (Moved into the compact header row above; this block removed.) */}
              <div className="flex-1 min-h-0 border notion-border rounded-xl bg-white shadow-sm p-3 md:p-4 flex flex-col relative overflow-hidden">
                {celebration && <ScanCelebration data={celebration} onClose={() => setCelebration(null)} />}
                {rejection && <ScanRejection data={rejection} onClose={() => setRejection(null)} />}
                {scanResult && scanResult.status === 'error' && (
                  <div className="absolute inset-0 z-20 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-sm border bg-red-50 border-red-100 text-red-500">
                      <Ban className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-serif-display font-semibold mb-2">{scanResult.message}</h3>
                    {scanResult.card && (
                      <div className="text-center space-y-1">
                        <p className="text-gray-900 font-medium">{scanResult.card.customerName}</p>
                        <p className="text-gray-500 text-sm">{scanResult.card.currentStamps} / {scanResult.card.maxStampsSnapshot ?? campaign.maxStamps} {t('dash.scan.stamps', { defaultValue: 'Stamps' })}</p>
                      </div>
                    )}
                  </div>
                )}

                {isScannerOpen ? (
                  <div className="relative flex-1 min-h-0 rounded-lg overflow-hidden">
                    <QRScanner onScan={handleScan} onClose={() => setIsScannerOpen(false)} />
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center space-y-4 bg-[#F7F7F5] rounded-lg border-2 border-dashed border-gray-200 hover:border-gray-300 hover:bg-[#F0F0EE] transition cursor-pointer group touch-manipulation active:scale-[0.98]" onClick={() => setIsScannerOpen(true)}>
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm border notion-border group-hover:scale-105 transition duration-300">
                      <Camera className="w-8 h-8 text-gray-400 group-hover:text-[#37352F] transition" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-lg">{t('dash.scan.tapActivate', { defaultValue: 'Tap to Activate Scanner' })}</h3>
                      <p className="text-sm text-gray-400">{t('dash.scan.cameraRequired', { defaultValue: 'Camera access required' })}</p>
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t notion-border">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-[#F7F7F5] border notion-border rounded px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
                      placeholder={t('dash.scan.manualPlaceholder', { defaultValue: 'Or enter Customer ID / Email...' })}
                      value={manualId}
                      onChange={(e) => setManualId(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleManualStamp()}
                    />
                    <button onClick={handleManualStamp} className="text-white px-6 py-3 rounded text-sm font-medium hover:bg-opacity-90 transition shadow-sm active:scale-95"
                      style={{ backgroundColor: campaign.primaryColor }}>
                      {t('dash.scan.stampBtn', { defaultValue: 'Stamp' })}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- ACTIVITY --- */}
        {activeTab === 'ACTIVITY' && (
          <div className="space-y-6">
            <header>
              <h1 className="text-3xl md:text-4xl font-serif-display font-semibold mb-2">{t('dash.activity.title', { defaultValue: 'Recent Activity' })}</h1>
              <p className="text-gray-500 text-sm md:text-base">{t('dash.activity.sub', { defaultValue: 'History of recent stamps, redemptions, and new members.' })}</p>
            </header>
            <div className="border notion-border rounded-lg bg-white">
              {activities.length === 0 ? (
                <div className="text-sm text-gray-400 italic p-8 text-center">{t('dash.activity.empty', { defaultValue: 'No activity recorded yet.' })}</div>
              ) : (
                <div className="divide-y notion-border">
                  {activities.map((act) => (
                    <div key={act.id} className="flex items-center justify-between p-4 hover:bg-[#F7F7F5] transition">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          act.type === 'STAMP' ? 'bg-blue-50 text-blue-600' :
                          act.type === 'REDEEM' ? 'bg-green-50 text-green-600' :
                          act.type === 'JOIN' ? 'bg-gray-100 text-gray-600' :
                          'bg-orange-50 text-orange-600'
                        }`}>
                          {act.type === 'STAMP' ? '+' :
                            act.type === 'REDEEM' ? '★' :
                            act.type === 'JOIN' ? '👋' :
                            act.type === 'BLOCK' ? '🚫' : '✓'}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 flex items-center gap-2 flex-wrap">
                            <span>
                              {act.type === 'STAMP' ? t('dash.activity.stamped', { name: act.customerName, defaultValue: 'Stamped {{name}}' }) :
                                act.type === 'REDEEM' ? t('dash.activity.redeemed', { name: act.customerName, defaultValue: 'Reward claimed by {{name}}' }) :
                                act.type === 'JOIN' ? t('dash.activity.joined', { name: act.customerName, defaultValue: '{{name}} joined the program' }) :
                                act.type === 'BLOCK' ? t('dash.activity.blocked', { name: act.customerName, defaultValue: 'Blocked {{name}}' }) :
                                t('dash.activity.unblocked', { name: act.customerName, defaultValue: 'Unblocked {{name}}' })}
                            </span>
                            {act.source && (
                              <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
                                act.source === 'qr' ? 'bg-green-50 text-green-700' :
                                act.source === 'manual_dashboard' ? 'bg-amber-50 text-amber-700' :
                                'bg-gray-100 text-gray-600'
                              }`} title={
                                act.source === 'qr' ? t('dash.activity.srcQrTitle', { defaultValue: 'Triggered by a real QR scan' })
                                  : act.source === 'manual_dashboard' ? t('dash.activity.srcManualTitle', { defaultValue: 'Manually clicked in the dashboard' })
                                  : act.source
                              }>
                                {act.source === 'qr' ? t('dash.activity.srcQr', { defaultValue: 'QR scan' }) : act.source === 'manual_dashboard' ? t('dash.activity.srcManual', { defaultValue: 'Manual' }) : act.source}
                              </span>
                            )}
                            {act.locationName && (
                              <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                                {act.locationName}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">{act.timestamp.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- CUSTOMERS --- */}
        {activeTab === 'CUSTOMERS' && (
          <div className="space-y-6">
            <header className="flex justify-between items-end">
              <div>
                <h1 className="text-3xl md:text-4xl font-serif-display font-semibold mb-2">{t('dash.customers.title', { defaultValue: 'Customers' })}</h1>
                <p className="text-gray-500 text-sm md:text-base">{t('dash.customers.sub', { defaultValue: 'Search by name or customer ID (SF00XXX). Toggle to view blocked or pending-deletion accounts.' })}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative hidden md:block">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder={t('dash.customers.searchPh', { defaultValue: 'Name or SF00001...' })} value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-9 pr-4 py-1.5 bg-white border notion-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 w-64" />
                </div>
                <button
                  onClick={exportCustomersCsv}
                  disabled={filteredCards.length === 0}
                  title="Download the filtered list as CSV"
                  className="text-sm px-3 py-2 rounded border notion-border hover:bg-[#F7F7F5] disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" /> <span className="hidden sm:inline">{t('dash.customers.exportCsv', { defaultValue: 'Export CSV' })}</span>
                </button>
                <button onClick={() => setIsAddCustomerModalOpen(true)} className="text-sm text-white px-3 py-2 rounded hover:bg-opacity-90 flex items-center gap-1 shadow-sm"
                  style={{ backgroundColor: campaign.primaryColor }}>
                  <Plus className="w-4 h-4" /> {t('dash.customers.new', { defaultValue: 'New' })}
                </button>
              </div>
            </header>
            <div className="md:hidden mb-4 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder={t('dash.customers.searchPh', { defaultValue: 'Name or SF00001...' })} value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="pl-9 pr-4 py-2.5 bg-white border notion-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 w-full" />
            </div>

            {/* Quick segment pills */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {([
                ['all', t('dash.customers.segAll', { defaultValue: 'All' }), segCounts.all],
                ['top', t('dash.customers.segTop', { defaultValue: 'Top spenders' }), segCounts.top],
                ['ready', t('dash.customers.segReady', { defaultValue: 'Reward ready' }), segCounts.ready],
                ['close', t('dash.customers.segClose', { defaultValue: 'One away' }), segCounts.close],
                ['new', t('dash.customers.segNew', { defaultValue: 'New this week' }), segCounts.new],
                ['inactive', t('dash.customers.segInactive', { defaultValue: 'Inactive 30d+' }), segCounts.inactive],
              ] as const).map(([id, label, count]) => (
                <button
                  key={id}
                  onClick={() => setSegment(id)}
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition ${
                    segment === id ? 'bg-[#37352F] text-white border-[#37352F]' : 'bg-white notion-border text-gray-600 hover:bg-[#F7F7F5]'
                  }`}
                >
                  {label}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${segment === id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
                </button>
              ))}
            </div>

            {/* Joined / engagement / reward filters */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={joinedFilter}
                onChange={(e) => setJoinedFilter(e.target.value as typeof joinedFilter)}
                className="bg-white border notion-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300"
                title="Filter by when they joined"
              >
                <option value="all">{t('dash.customers.joinedAny', { defaultValue: 'Joined: any time' })}</option>
                <option value="7">{t('dash.customers.joined7', { defaultValue: 'Joined: last 7 days' })}</option>
                <option value="30">{t('dash.customers.joined30', { defaultValue: 'Joined: last 30 days' })}</option>
                <option value="90">{t('dash.customers.joined90', { defaultValue: 'Joined: last 90 days' })}</option>
                <option value="custom">{t('dash.customers.joinedCustom', { defaultValue: 'Joined: custom range…' })}</option>
              </select>
              {joinedFilter === 'custom' && (
                <>
                  <input type="date" value={joinedFrom} onChange={(e) => setJoinedFrom(e.target.value)}
                    className="bg-white border notion-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300" />
                  <span className="text-gray-400">{t('dash.customers.to', { defaultValue: 'to' })}</span>
                  <input type="date" value={joinedTo} onChange={(e) => setJoinedTo(e.target.value)}
                    className="bg-white border notion-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300" />
                </>
              )}
              <select
                value={engagementFilter}
                onChange={(e) => setEngagementFilter(e.target.value as typeof engagementFilter)}
                className="bg-white border notion-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300"
                title="Based on the last stamp or redemption"
              >
                <option value="all">{t('dash.customers.actAll', { defaultValue: 'Activity: all' })}</option>
                <option value="active30">{t('dash.customers.actActive', { defaultValue: 'Active (last 30 days)' })}</option>
                <option value="dormant30">{t('dash.customers.actDormant', { defaultValue: 'Dormant (30+ days)' })}</option>
                <option value="never">{t('dash.customers.actNever', { defaultValue: 'Never stamped' })}</option>
              </select>
              <select
                value={rewardFilter}
                onChange={(e) => setRewardFilter(e.target.value as typeof rewardFilter)}
                className="bg-white border notion-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300"
                title="Where they are on the card"
              >
                <option value="all">{t('dash.customers.rewAll', { defaultValue: 'Reward: all' })}</option>
                <option value="ready">{t('dash.customers.rewReady', { defaultValue: 'Reward ready to claim' })}</option>
                <option value="close">{t('dash.customers.rewClose', { defaultValue: 'One stamp away' })}</option>
                <option value="redeemed">{t('dash.customers.rewRedeemed', { defaultValue: 'Has redeemed before' })}</option>
              </select>
              {(joinedFilter !== 'all' || engagementFilter !== 'all' || rewardFilter !== 'all' || segment !== 'all') && (
                <button
                  onClick={() => { setJoinedFilter('all'); setJoinedFrom(''); setJoinedTo(''); setEngagementFilter('all'); setRewardFilter('all'); setSegment('all'); }}
                  className="px-2.5 py-1.5 rounded-md border notion-border text-gray-500 hover:bg-[#F7F7F5]"
                >
                  {t('dash.customers.clearFilters', { defaultValue: 'Clear filters' })}
                </button>
              )}
              <span className="text-gray-400 ml-auto">{filteredCards.length} {t('dash.customers.shown', { defaultValue: 'shown' })}</span>
            </div>

            {/* Status filter chips — Active | Blocked | Pending deletion */}
            <div className="flex flex-wrap gap-2">
              {([
                ['active',           t('dash.customers.active', { defaultValue: 'Active' }),           bucketCounts.active,           'bg-green-50 text-green-700 border-green-200'],
                ['blocked',          t('dash.customers.blocked', { defaultValue: 'Blocked' }),          bucketCounts.blocked,          'bg-red-50 text-red-700 border-red-200'],
                ['pending_deletion', t('dash.customers.pendingDeletion', { defaultValue: 'Pending deletion' }), bucketCounts.pending_deletion, 'bg-amber-50 text-amber-700 border-amber-200'],
              ] as const).map(([id, label, count, activeStyle]) => {
                const isActive = customerStatusFilter === id;
                return (
                  <button
                    key={id}
                    onClick={() => setCustomerStatusFilter(id)}
                    className={`text-xs px-3 py-1.5 rounded-md border transition flex items-center gap-1.5 ${
                      isActive ? activeStyle : 'bg-white notion-border hover:bg-[#F7F7F5] text-gray-600'
                    }`}
                  >
                    <span className="font-medium">{label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/60' : 'bg-gray-100'}`}>{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="border notion-border rounded-lg overflow-x-auto bg-white">
              {/* Mobile list */}
              <div className="md:hidden divide-y notion-border">
                {filteredCards.map((card) => (
                  <div key={card.id} className="p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{card.customerName}</span>
                        <span className="text-[10px] font-mono text-gray-400">{card.customerCode ?? ''}</span>
                      </div>
                      <div className="text-xs text-gray-500"><RevealableEmail email={card.email} /></div>
                      <div className="text-[11px] text-gray-400">{t('dash.customers.joinedLabel', { defaultValue: 'Joined' })} {card.joinedAt.toLocaleDateString()}</div>
                      <div className="flex gap-1 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          card.status === 'BLOCKED' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                        }`}>{card.currentStamps} {t('dash.customers.stamps', { defaultValue: 'Stamps' })}</span>
                        {card.deletionRequestedAt && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase">{t('dash.customers.pendingDeletion', { defaultValue: 'Pending deletion' })}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {card.status !== 'BLOCKED' && (
                        card.currentStamps >= (card.maxStampsSnapshot ?? campaign.maxStamps) ? (
                          <button onClick={() => onResetCard(card.id)} className="px-3 h-8 rounded-full bg-green-50 text-green-600 text-xs font-semibold flex items-center justify-center">
                            {t('dash.customers.redeem', { defaultValue: 'Redeem' })}
                          </button>
                        ) : (
                          <button onClick={() => onStampCard(card.id)} className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Plus className="w-4 h-4" />
                          </button>
                        )
                      )}
                      <button onClick={() => setConfirmAction({ type: 'BLOCK', cardId: card.id, name: card.customerName })}
                        className="w-8 h-8 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredCards.length === 0 && (
                  <div className="p-8 text-center text-gray-400 italic text-sm">{customerStatusFilter === "blocked" ? t('dash.customers.noBlocked', { defaultValue: 'No blocked customers.' }) : customerStatusFilter === "pending_deletion" ? t('dash.customers.noPending', { defaultValue: 'No customers are pending deletion.' }) : t('dash.customers.noFound', { defaultValue: 'No customers found.' })}</div>
                )}
              </div>

              {/* Desktop table */}
              <table className="w-full text-sm text-left min-w-[820px] hidden md:table">
                <thead className="bg-[#F7F7F5] text-gray-500 font-medium">
                  <tr>
                    <th className="px-4 py-3 border-b notion-border w-24">{t('dash.customers.colId', { defaultValue: 'ID' })}</th>
                    <th className="px-4 py-3 border-b notion-border">{t('dash.customers.colName', { defaultValue: 'Name' })}</th>
                    <th className="px-4 py-3 border-b notion-border">{t('dash.customers.colEmail', { defaultValue: 'Email' })}</th>
                    <th className="px-4 py-3 border-b notion-border">{t('dash.customers.colJoined', { defaultValue: 'Joined on' })}</th>
                    <th className="px-4 py-3 border-b notion-border">{t('dash.customers.colOffer', { defaultValue: 'Campaign offer' })}</th>
                    <th className="px-4 py-3 border-b notion-border">{t('dash.customers.colProgress', { defaultValue: 'Progress' })}</th>
                    <th className="px-4 py-3 border-b notion-border">{t('dash.customers.colRedeemed', { defaultValue: 'Redeemed' })}</th>
                    <th className="px-4 py-3 border-b notion-border">{t('dash.customers.colStatus', { defaultValue: 'Status' })}</th>
                    <th className="px-4 py-3 border-b notion-border w-28">{t('dash.customers.colAction', { defaultValue: 'Action' })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y notion-border">
                  {filteredCards.map((card) => {
                    // Each card holds a snapshot of the offer the customer
                    // joined under. If the merchant has since changed the
                    // campaign, existing customers keep their original
                    // offer — we show the snapshot here, with a "(was)"
                    // hint when it differs from the current campaign.
                    const cardOffer = card.offerTitleSnapshot ?? campaign.offerTitle;
                    const cardMax = card.maxStampsSnapshot ?? campaign.maxStamps;
                    const isStale = !!card.offerTitleSnapshot && card.offerTitleSnapshot !== campaign.offerTitle;
                    return (
                    <tr key={card.id} className="hover:bg-[#F7F7F5]">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{card.customerCode ?? '—'}</td>
                      <td className="px-4 py-3 font-medium">{card.customerName}</td>
                      <td className="px-4 py-3 text-gray-500"><RevealableEmail email={card.email || ''} /></td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{card.joinedAt.toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-xs">
                        <div className="text-gray-700 truncate max-w-[180px]" title={cardOffer}>{cardOffer}</div>
                        {isStale && (
                          <div className="text-[10px] text-amber-600 mt-0.5" title={t('dash.customers.wasMigrateTitle', { defaultValue: "The merchant has changed the offer since this customer joined. They'll migrate to the new offer when they redeem." })}>{t('dash.customers.wasMigrate', { defaultValue: '(was — auto-migrates on redeem)' })}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full" style={{
                              width: `${(card.currentStamps / cardMax) * 100}%`,
                              backgroundColor: card.status === 'BLOCKED' ? '#ccc' : campaign.primaryColor,
                            }} />
                          </div>
                          <span className="text-xs text-gray-400">{card.currentStamps}/{cardMax}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono">{card.rewardsRedeemed}</td>
                      <td className="px-4 py-3">
                        {card.deletionRequestedAt ? (
                          <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider" title={t('dash.customers.pendingDeletionTitle', { defaultValue: 'Customer requested deletion. Will be removed within 24 hours.' })}>{t('dash.customers.pendingDeletion', { defaultValue: 'Pending deletion' })}</span>
                        ) : card.status === 'BLOCKED' ? (
                          <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider">{t('dash.customers.blocked', { defaultValue: 'Blocked' })}</span>
                        ) : card.currentStamps >= cardMax ? (
                          <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs font-medium">{t('dash.customers.rewardReady', { defaultValue: 'Reward Ready' })}</span>
                        ) : (
                          <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs">{t('dash.customers.collecting', { defaultValue: 'Collecting' })}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {card.status !== 'BLOCKED' && (
                            <>
                              {card.currentStamps >= cardMax ? (
                                <button onClick={() => onResetCard(card.id)} className="text-green-600 hover:underline text-xs font-medium">{t('dash.customers.redeem', { defaultValue: 'Redeem' })}</button>
                              ) : (
                                <button onClick={() => onStampCard(card.id)} className="text-blue-600 hover:underline text-xs font-medium">{t('dash.customers.addStamp', { defaultValue: '+Stamp' })}</button>
                              )}
                              <div className="h-4 w-px bg-gray-200 mx-1"></div>
                            </>
                          )}
                          <button onClick={() => setConfirmAction({ type: 'BLOCK', cardId: card.id, name: card.customerName })}
                            className="text-gray-400 hover:text-orange-500 transition" title={card.status === 'BLOCKED' ? t('dash.customers.unblock', { defaultValue: 'Unblock' }) : t('dash.customers.block', { defaultValue: 'Block' })}>
                            <Ban className="w-4 h-4" />
                          </button>
                          <button onClick={() => setConfirmAction({ type: 'DELETE', cardId: card.id, name: card.customerName })}
                            className="text-gray-400 hover:text-red-500 transition" title={t('dash.customers.delete', { defaultValue: 'Delete' })}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );})}
                  {filteredCards.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 italic">
                      {customerStatusFilter === 'blocked' ? t('dash.customers.noBlocked', { defaultValue: 'No blocked customers.' })
                        : customerStatusFilter === 'pending_deletion' ? t('dash.customers.noPending', { defaultValue: 'No customers are pending deletion.' })
                        : t('dash.customers.noFound', { defaultValue: 'No customers found.' })}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- ANALYTICS --- */}
        {activeTab === 'ANALYTICS' && (
          billing.plan === 'pro' ? (
            <InsightsPanel
              campaign={campaign}
              cards={cards}
              activities={activities}
              locations={locations}
            />
          ) : (
            <ProFeatureLock
              title="Insights is a Pro feature"
              description="See which branches and rewards actually drive repeat visits, with per-location and per-offer analytics."
              bullets={['Repeat-visit & retention trends', 'Per-location performance', 'Per-offer breakdowns']}
              onUpgrade={() => setShowUpgradeModal(true)}
            />
          )
        )}

        {/* --- PREVIEW --- */}
        {activeTab === 'PREVIEW' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <header>
              <h1 className="text-3xl md:text-4xl font-serif-display font-semibold mb-2">Card Preview</h1>
              <p className="text-gray-500 text-sm md:text-base">See what your customers see in their digital wallet.</p>
            </header>
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div className="bg-white p-6 rounded-lg border notion-border shadow-sm">
                <h3 className="font-medium mb-4 text-sm uppercase tracking-wider text-gray-400">Preview Options</h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Stamps Collected: {previewStamps}</label>
                    <input type="range" min={0} max={campaign.maxStamps} value={previewStamps}
                      onChange={(e) => setPreviewStamps(parseInt(e.target.value))}
                      className="w-full accent-[#37352F] cursor-pointer" />
                  </div>
                  <div className="p-4 bg-gray-50 rounded text-xs text-gray-500 leading-relaxed border notion-border">
                    Customers see this card in Apple Wallet (iPhone) and Google Wallet (Android). Adjust the slider to preview different stamp counts.
                  </div>
                </div>
              </div>
              <div className="flex justify-center bg-[#F7F7F5] p-8 rounded-xl border notion-border">
                <div className="w-full max-w-[320px]">
                  <WalletCard
                    campaign={campaign}
                    card={{
                      id: 'preview-id',
                      campaignId: campaign.id,
                      currentStamps: previewStamps,
                      customerName: 'Customer Preview',
                      email: 'preview@example.com',
                      rewardsRedeemed: 0,
                      joinedAt: new Date(),
                      status: 'ACTIVE',
                    }}
                    disableSave
                    staticQR
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- SHARE --- */}
        {activeTab === 'SHARE' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <header>
              <h1 className="text-3xl md:text-4xl font-serif-display font-semibold mb-2">Share & Promote</h1>
              <p className="text-gray-500 text-sm md:text-base">
                {activeLocations.length > 1
                  ? `Print a poster for each of your ${activeLocations.length} locations. Each QR records which branch a customer joined at.`
                  : 'Print this QR code so customers can join your program.'}
              </p>
            </header>

            <div className="grid md:grid-cols-2 gap-12 items-start">
              {/* Left column: one QR card per location. Falls back to a single
                  campaign-wide QR if there are no locations (defensive — every
                  campaign should have a "Main" after the migration). */}
              <div className="space-y-6">
                {(activeLocations.length > 0 ? activeLocations : [null]).map((loc) => {
                  const url = joinUrlForLocation(loc?.id ?? null);
                  const qrId = loc ? `share-qr-${loc.id}` : 'share-qr-code';
                  return (
                    <div key={loc?.id ?? 'campaign-wide'} className="space-y-6">
                    <div className="bg-white p-8 rounded-lg border notion-border shadow-sm flex flex-col items-center text-center space-y-5">
                      <div className="space-y-1">
                        <h3 className="text-xl font-serif-display font-semibold">Join {campaign.businessName}</h3>
                        {loc && (
                          <p className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-gray-500 bg-[#F7F7F5] px-2.5 py-1 rounded-full border notion-border">
                            <MapPin className="w-3 h-3" /> {loc.name}
                          </p>
                        )}
                      </div>
                      <div className="p-4 bg-white border-2 border-dashed border-gray-200 rounded-xl max-w-[240px]">
                        <QRCode id={qrId} value={url} size={160} />
                      </div>
                      <div className="space-y-2 w-full pt-2">
                        <div className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">Download as</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button onClick={() => handleDownloadPoster(loc, 'loyalty')} className="bg-[#37352F] text-white py-2 px-1 rounded-md text-xs font-medium hover:bg-opacity-90 transition" title="Pamphlet (A5 landscape)">
                            Pamphlet · EN
                          </button>
                          <button onClick={() => handleDownloadPoster(loc, 'loyalty', 'de')} className="bg-[#37352F] text-white py-2 px-1 rounded-md text-xs font-medium hover:bg-opacity-90 transition" title="Flyer (A5, Deutsch)">
                            Pamphlet · DE
                          </button>
                        </div>
                        <button
                          onClick={async () => {
                            try { await navigator.clipboard.writeText(url); } catch { /* clipboard may be blocked */ }
                            setCopiedUrl(url);
                            setTimeout(() => setCopiedUrl((c) => (c === url ? null : c)), 2000);
                          }}
                          className={`w-full border py-2 rounded-md font-medium text-sm transition flex items-center justify-center gap-1.5 ${
                            copiedUrl === url
                              ? 'bg-green-50 border-green-200 text-green-700'
                              : 'bg-white notion-border text-[#37352F] hover:bg-gray-50'
                          }`}
                        >
                          {copiedUrl === url ? (<><Check className="w-4 h-4" /> Copied!</>) : 'Copy Link'}
                        </button>
                      </div>
                      <div className="text-[10px] text-gray-400 break-all">{url}</div>
                    </div>
                    {campaign.stampingMode === 'self_serve' && (
                      <div className="bg-white p-8 rounded-lg border notion-border shadow-sm flex flex-col items-center text-center space-y-4">
                        <div className="space-y-1">
                          <h3 className="text-xl font-serif-display font-semibold">Stamp QR</h3>
                          <p className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">Keep behind the counter</p>
                        </div>
                        <div className="p-4 bg-white border-2 border-dashed border-gray-200 rounded-xl max-w-[240px]">
                          <QRCode value={stampUrlForLocation(loc?.id ?? null)} size={160} />
                        </div>
                        {campaign.stampCode ? (
                          <div className="text-3xl font-bold tracking-[0.3em] text-[#37352F]">{campaign.stampCode}</div>
                        ) : (
                          <div className="text-xs text-amber-600">Set a 4-digit stamp code in Settings &rarr; Stamping mode</div>
                        )}
                        <p className="text-xs text-gray-500 max-w-[240px]">Customers scan this to collect a stamp (they must be at the shop — location-checked). Show it on request rather than leaving it on public display.</p>
                        {(() => {
                          const stampUrl = stampUrlForLocation(loc?.id ?? null);
                          return (
                            <button
                              onClick={async () => {
                                try { await navigator.clipboard.writeText(stampUrl); } catch { /* clipboard may be blocked */ }
                                setCopiedUrl(stampUrl);
                                setTimeout(() => setCopiedUrl((c) => (c === stampUrl ? null : c)), 2000);
                              }}
                              className="w-full max-w-[240px] flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-md border notion-border hover:bg-[#F7F7F5] transition"
                            >
                              {copiedUrl === stampUrl ? (<><Check className="w-4 h-4" /> Copied!</>) : 'Copy stamp link (for NFC tag)'}
                            </button>
                          );
                        })()}
                        <button onClick={() => handleDownloadPoster(loc, 'selfscan')} className="w-full max-w-[240px] flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-md bg-[#37352F] text-white font-medium hover:bg-opacity-90 transition">
                          Download stamp poster · EN
                        </button>
                        <button onClick={() => handleDownloadPoster(loc, 'selfscan', 'de')} className="w-full max-w-[240px] flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-md bg-[#37352F] text-white font-medium hover:bg-opacity-90 transition">
                          Stempel-Poster · DE
                        </button>
                      </div>
                    )}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-6">
                <div className="bg-[#F7F7F5] p-6 rounded-lg border notion-border">
                  <h3 className="font-medium mb-2">How it works</h3>
                  <ul className="text-sm text-gray-600 space-y-3 list-disc pl-4">
                    <li>Customers scan the QR code at your checkout.</li>
                    <li>They enter their email; we send them a magic sign-in link.</li>
                    <li>They land on a page with their card and a button to save it to Apple or Google Wallet.</li>
                    <li>You scan their card here on future visits to give stamps.</li>
                  </ul>
                </div>
                {activeLocations.length > 1 && (
                  <div className="bg-amber-50 p-6 rounded-lg border border-amber-100">
                    <h3 className="font-medium mb-2 text-amber-900">Multiple locations</h3>
                    <p className="text-sm text-amber-800">
                      Print a different poster for each branch. Customers' cards work everywhere — the per-location QR just records which branch they joined at, so you can see in Analytics which location is driving signups.
                    </p>
                  </div>
                )}
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                  <h3 className="font-medium mb-2 text-blue-900">Try it yourself</h3>
                  <p className="text-sm text-blue-700 mb-4">Open the customer signup page in a new tab to preview the join flow.</p>
                  <a
                    href={joinUrlForLocation(activeLocations[0]?.id ?? null)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      if (!onboarding.test_signup_done) {
                        onMarkOnboardingStep({ test_signup_done: true });
                      }
                    }}
                    className="inline-flex bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition items-center gap-2"
                  >
                    Open Customer View <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- SETTINGS --- */}
        {activeTab === 'STAFF' && (
          !isPro ? (
            <ProFeatureLock
              title="Staff management is a Pro feature"
              description="Give your team their own PINs, see who stamped what, and control what each person can access."
              bullets={['Individual staff PINs', 'Activity tracked per staff member', 'Hide sections from staff', 'Owner-PIN protected settings']}
              onUpgrade={() => setShowUpgradeModal(true)}
            />
          ) : (
            <StaffPanel campaignId={campaign.id} onSwitchStaff={() => setShowStaffGate(true)} />
          )
        )}

        {activeTab === 'VALUE' && (
          <MerchantValueCalculator country={country ?? null} businessName={campaign.businessName} />
        )}

        {activeTab === 'SETTINGS' && (
          <div className="space-y-8">
            <header className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl md:text-4xl font-serif-display font-semibold mb-2">Settings</h1>
                <p className="text-gray-500 text-sm md:text-base">Configure campaign, branding, and integrations.</p>
              </div>
              {settingsSaved && (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-full text-sm font-medium animate-in fade-in slide-in-from-top-2">
                  <CheckCircle2 className="w-4 h-4" /> Saved
                </div>
              )}
            </header>
            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* Settings sub-navigation */}
              <nav className="w-full md:w-52 flex-shrink-0 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
                {([
                  ['general',   t('dash.settings.general', { defaultValue: 'General' })],
                  ['wallet',    t('dash.settings.wallet', { defaultValue: 'Wallet & card' })],
                  ['posters',   t('dash.settings.posters', { defaultValue: 'Posters & print' })],
                  ['locations', t('dash.settings.locations', { defaultValue: 'Locations' })],
                  ['stamping',  t('dash.settings.stamping', { defaultValue: 'Stamping mode' })],
                  ['billing',   t('dash.settings.billing', { defaultValue: 'Account & billing' })],
                  ['account',   t('dash.settings.account', { defaultValue: 'Login & security' })],
                  ['links', t('dash.settings.links', { defaultValue: 'Links & socials' })],
                  ['privacy',   t('dash.settings.privacy', { defaultValue: 'Privacy & data' })],
                  ['danger',    t('dash.settings.danger', { defaultValue: 'Danger zone' })],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => { setSettingsSection(id); window.history.pushState({}, '', `/settings/${id}`); }}
                    className={`text-left text-sm px-3 py-2 rounded-md whitespace-nowrap transition ${
                      settingsSection === id
                        ? 'bg-[#37352F] text-white font-medium'
                        : id === 'danger'
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-gray-600 hover:bg-[#F7F7F5]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              <div className="flex-1 min-w-0 space-y-8">
              {(() => {
                const meta: Record<SettingsSection, { title: string; hint: string }> = {
                  general:   { title: t('dash.settings.generalTitle', { defaultValue: 'General' }), hint: t('dash.settings.generalHint', { defaultValue: 'Your business name, the reward you offer, and how many stamps a customer needs. These appear on every card you issue, so changing them updates what new customers see.' }) },
                  wallet:    { title: t('dash.settings.walletTitle', { defaultValue: 'Customise your wallet' }), hint: t('dash.settings.walletHint', { defaultValue: 'Controls how the loyalty card looks inside Apple Wallet and Google Wallet — colours, text colour, and the logo at the top. The previews update live; nothing is applied until you press Save.' }) },
                  posters:   { title: t('dash.settings.postersTitle', { defaultValue: 'Posters & print' }), hint: t('dash.settings.postersHint', { defaultValue: 'Download printable material with your QR code: business cards, A5 pamphlets, A4 posters, an Instagram square, and table stickers. Customers scan these to join.' }) },
                  locations: { title: t('dash.settings.locationsTitle', { defaultValue: 'Locations' }), hint: t('dash.settings.locationsHint', { defaultValue: 'Add each branch so stamps are recorded against the right shop. The Scan screen lets staff pick which location they are working at, and Insights breaks results down per branch.' }) },
                  stamping: { title: t('dash.settings.stampingTitle', { defaultValue: 'Stamping mode' }), hint: t('dash.settings.stampingHint', { defaultValue: 'Choose how customers collect stamps — staff scanner, or self-serve where the customer scans your counter QR (device-free, location-checked).' }) },
                  billing:   { title: t('dash.settings.billingTitle', { defaultValue: 'Account & billing' }), hint: t('dash.settings.billingHint', { defaultValue: 'Your plan, invoices, and payment method. The free plan covers your first 10 customers; Pro removes that limit and unlocks branding and multi-location features.' }) },
                  account:   { title: t('dash.settings.accountTitle', { defaultValue: 'Login & security' }), hint: t('dash.settings.accountHint', { defaultValue: 'Change the email address and password you use to sign in. Changing your email requires clicking a confirmation link we send to both your old and new address.' }) },
                  links:     { title: t('dash.settings.linksTitle', { defaultValue: 'Links & socials' }), hint: t('dash.settings.linksHint', { defaultValue: 'Add your website, social profiles, and ordering or delivery links. Each one you fill in becomes a tappable link on the back of the Apple Wallet card and in the Google Wallet card details.' }) },
                  privacy:   { title: t('dash.settings.privacyTitle', { defaultValue: 'Privacy & data' }), hint: t('dash.settings.privacyHint', { defaultValue: 'Your business registration details (needed for GDPR and your Impressum), the privacy notice your customers see at signup, and a full export of your data.' }) },
                  danger:    { title: t('dash.settings.dangerTitle', { defaultValue: 'Danger zone' }), hint: t('dash.settings.dangerHint', { defaultValue: 'Permanent actions. Deleting your account removes your cards, customers, and history — this cannot be undone.' }) },
                };
                const m = meta[settingsSection];
                return (
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-[#37352F]">{m.title}</h2>
                    <InfoHint text={m.hint} label={m.title} />
                  </div>
                );
              })()}

            {settingsSection === 'stamping' && (
              <div className="bg-white rounded-lg border notion-border p-6 space-y-5 max-w-2xl">
                <div>
                  <h3 className="text-lg font-semibold">Stamping mode</h3>
                  <p className="text-sm text-gray-500 mt-1">Choose how customers collect stamps.</p>
                </div>
                <div className="space-y-3">
                  {([
                    ['scanner', 'Scanner (staff scans)', 'A staff member scans the customer\u2019s wallet QR to give a stamp. Needs a phone at the counter.'],
                    ['self_serve', 'Self-serve (customer scans)', 'No device needed at the counter. The customer scans your printed stamp QR on their own phone; a location check confirms they\u2019re at the shop.'],
                  ] as const).map(([mode, title, desc]) => (
                    <button
                      key={mode}
                      onClick={() => setTempSettings({ ...tempSettings, stampingMode: mode })}
                      className={`w-full text-left p-4 rounded-lg border transition ${
                        (tempSettings.stampingMode ?? 'scanner') === mode ? 'border-[#37352F] bg-[#F7F7F5]' : 'notion-border hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${(tempSettings.stampingMode ?? 'scanner') === mode ? 'border-[#37352F] bg-[#37352F]' : 'border-gray-300'}`} />
                        <span className="font-medium text-sm">{title}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 ml-6">{desc}</p>
                    </button>
                  ))}
                </div>
                {(tempSettings.stampingMode ?? 'scanner') === 'self_serve' && (
                  <div className="space-y-4 pt-2 border-t notion-border">
                    <div>
                      <label className="text-sm font-medium">Location radius (metres)</label>
                      <p className="text-xs text-gray-500 mb-2">Customers must be within this distance of the shop to get a stamp. 100m recommended (GPS is fuzzy indoors).</p>
                      <input type="number" min={30} max={1000} value={tempSettings.selfServeRadius ?? 100}
                        onChange={(e) => setTempSettings({ ...tempSettings, selfServeRadius: Math.max(30, Math.min(1000, Number(e.target.value) || 100)) })}
                        className="w-32 bg-white border notion-border rounded px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Stamp code (4 digits)</label>
                      <p className="text-xs text-gray-500 mb-2">Printed under your counter stamp QR. A customer can type it if their camera can\u2019t scan.</p>
                      <input value={tempSettings.stampCode ?? ''} maxLength={4} inputMode="numeric" placeholder="e.g. 4821"
                        onChange={(e) => setTempSettings({ ...tempSettings, stampCode: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) })}
                        className="w-32 bg-white border notion-border rounded px-3 py-2 text-sm tracking-widest" />
                    </div>
                  </div>
                )}
                <div className="flex justify-end pt-2">
                  <button onClick={handleSaveSettings} className="bg-[#37352F] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-opacity-90 transition">Save</button>
                </div>
              </div>
            )}
            {settingsSection === 'links' && (
              <ProLockOverlay locked={!isPro} title="Card links are a Pro feature" onUpgrade={() => setShowUpgradeModal(true)}>
                <LinksSettings campaign={campaign} onUpdated={(updated) => onUpdateCampaign({ socialLinks: updated.socialLinks })} />
              </ProLockOverlay>
            )}

            {settingsSection === 'account' && (
              <AccountSecurity currentEmail={user?.email ?? ''} />
            )}

            {settingsSection === 'billing' && (
            <div id="billing-section">
              <AccountBilling
                billing={billing}
                country={country}
                cards={cards}
              />
            </div>
            )}

            {settingsSection === 'locations' && (
            <LocationsPanel
              locations={locations}
              activeLocationId={activeLocationId}
              onAdd={onAddLocation}
              onUpdate={onUpdateLocation}
              isPro={isPro}
              onUpgrade={() => setShowUpgradeModal(true)}
            />
            )}

            {settingsSection === 'privacy' && (
            <ComplianceSettings merchantId={campaign.merchantId} />
            )}

            {settingsSection === 'posters' && (
            <div className="border notion-border rounded-lg p-6 space-y-4">
              <h3 className="font-medium">Posters &amp; pamphlets</h3>
              <p className="text-sm text-gray-500">Download your printable posters and pamphlets &mdash; in English or German &mdash; from the <span className="font-medium">Share &amp; Promote</span> tab.</p>
            </div>
            )}

            {settingsSection === 'posters' && (
            <PosterSettings
              campaign={campaign}
              onUpdated={(updated) => onUpdateCampaign({ posterColor: updated.posterColor })}
              isPro={isPro}
              onUpgrade={() => setShowUpgradeModal(true)}
            />
            )}

            {settingsSection === 'privacy' && (
            <CustomerPrivacyNoticePanel
              campaign={campaign}
              onUpdated={(updated) => onUpdateCampaign({ customerPrivacyNotice: updated.customerPrivacyNotice })}
            />
            )}

            {/* Data export — GDPR Art. 20 portability + PIPEDA Principle 9.
                Lets the merchant download a full JSON snapshot of their
                account, customers, and activity history. */}
            {settingsSection === 'privacy' && (
            <div className="bg-white rounded-lg border notion-border p-6 space-y-2">
              <h3 className="text-base font-semibold">Your data</h3>
              <p className="text-sm text-gray-500">
                Download a complete JSON copy of your account, customers, locations, and activity log.
              </p>
              <DownloadMyDataButton variant="merchant" />
            </div>
            )}

            {settingsSection === 'danger' && (
            <DangerZonePanel
              businessName={campaign.businessName}
              billing={billing}
              onGoToBilling={() => {
                document.getElementById('billing-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />
            )}

            {(settingsSection === 'general' || settingsSection === 'wallet') && (
            <div className="border notion-border rounded-lg p-6 space-y-8">
            {settingsSection === 'general' && (
              <div>
                <h3 className="font-medium mb-4 flex items-center gap-2"><Settings className="w-4 h-4" /> General Configuration</h3> <InfoHint text="Existing cards keep the offer they were issued with. Changing the offer or stamp count affects new cards, and existing ones update after their next reward." label="general configuration" />
                <div className="bg-blue-50 border border-blue-100 rounded-md p-3 mb-4 text-xs text-blue-800 leading-relaxed">
                  <strong>How offer changes work:</strong> When you change the offer title or
                  required stamps, only <strong>new customers</strong> get the updated offer.
                  Existing customers keep working toward the offer they originally signed up for.
                  Once they redeem their reward, their next cycle automatically uses your current offer.
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">Business Name</label>
                    <input value={tempSettings.businessName}
                      onChange={(e) => setTempSettings({ ...tempSettings, businessName: e.target.value })}
                      className="w-full bg-[#F7F7F5] border notion-border rounded px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">Offer Title</label>
                    <input value={tempSettings.offerTitle}
                      onChange={(e) => setTempSettings({ ...tempSettings, offerTitle: e.target.value })}
                      className="w-full bg-[#F7F7F5] border notion-border rounded px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">Primary Color</label>
                    <select value={tempSettings.primaryColor}
                      onChange={(e) => setTempSettings({ ...tempSettings, primaryColor: e.target.value })}
                      className="w-full bg-[#F7F7F5] border notion-border rounded px-3 py-2 text-sm">
                      {NOTION_COLORS.map((c) => <option key={c.hex} value={c.hex}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">Max Stamps</label>
                    <select value={tempSettings.maxStamps}
                      onChange={(e) => setTempSettings({ ...tempSettings, maxStamps: parseInt(e.target.value) })}
                      className="w-full bg-[#F7F7F5] border notion-border rounded px-3 py-2 text-sm">
                      {[4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {settingsSection === 'wallet' && (
              <div className="border-t notion-border pt-6">
                <h3 className="font-medium mb-4 flex items-center gap-2"><Palette className="w-4 h-4" /> Customise your wallet</h3> <InfoHint text="Colours apply to the card in the customer's wallet — not to your posters. Text colour is picked automatically for contrast unless you override it." label="wallet colours" />
                <WalletLivePreview
                  settings={{
                    businessName: tempSettings.businessName,
                    offerTitle: tempSettings.offerTitle,
                    maxStamps: tempSettings.maxStamps,
                    backgroundColor: tempSettings.backgroundColor,
                    cardTextColor: tempSettings.cardTextColor,
                    logoColor: tempSettings.logoColor,
                    logoText: tempSettings.logoText,
                    logoImage: tempSettings.logoImage,
                    logoMode: tempSettings.logoMode ?? 'stampfix',
                  }}
                />
                <ProLockOverlay locked={!isPro} title="Card colour & custom branding are Pro features" onUpgrade={() => setShowUpgradeModal(true)}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">Card Color</label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={tempSettings.backgroundColor || '#f0ece1'}
                        onChange={(e) => setTempSettings({ ...tempSettings, backgroundColor: e.target.value })}
                        className="h-9 w-12 shrink-0 rounded border notion-border bg-white cursor-pointer p-0.5" />
                      <input type="text" value={tempSettings.backgroundColor || '#f0ece1'}
                        onChange={(e) => setTempSettings({ ...tempSettings, backgroundColor: e.target.value })}
                        className="flex-1 bg-[#F7F7F5] border notion-border rounded px-3 py-2 text-sm font-mono" />
                    </div>
                    <p className="text-[11px] text-gray-400">Background of the wallet card on Apple &amp; Google.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">Text Color</label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={tempSettings.cardTextColor || '#1d3458'}
                        onChange={(e) => setTempSettings({ ...tempSettings, cardTextColor: e.target.value })}
                        className="h-9 w-12 shrink-0 rounded border notion-border bg-white cursor-pointer p-0.5" />
                      <input type="text" value={tempSettings.cardTextColor || '#1d3458'}
                        onChange={(e) => setTempSettings({ ...tempSettings, cardTextColor: e.target.value })}
                        className="flex-1 bg-[#F7F7F5] border notion-border rounded px-3 py-2 text-sm font-mono" />
                    </div>
                    <div className="mt-1.5 flex items-start gap-2 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-[11px] text-red-700 leading-relaxed">
                      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>Applies to Apple Wallet only. Google Wallet (Android) picks the text color automatically for contrast, so this won't affect the Android card.</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">Logo Color</label>
                    <div className="flex gap-2 items-center">
                      <input type="color"
                        value={tempSettings.logoColor || (isDarkColor(tempSettings.backgroundColor || '#f0ece1') ? '#FFFFFF' : '#111827')}
                        onChange={(e) => setTempSettings({ ...tempSettings, logoColor: e.target.value })}
                        className="h-9 w-12 shrink-0 rounded border notion-border bg-white cursor-pointer p-0.5" />
                      <input type="text"
                        value={tempSettings.logoColor || (isDarkColor(tempSettings.backgroundColor || '#f0ece1') ? '#FFFFFF' : '#111827')}
                        onChange={(e) => setTempSettings({ ...tempSettings, logoColor: e.target.value })}
                        className="flex-1 bg-[#F7F7F5] border notion-border rounded px-3 py-2 text-sm font-mono" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setTempSettings({ ...tempSettings, logoColor: null })}
                      className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-[#37352F] transition"
                    >
                      <RotateCcw className="w-3 h-3" /> Back to default color (black)
                    </button>
                    {!tempSettings.logoColor && isDarkColor(tempSettings.backgroundColor || '#f0ece1') && (
                      <div className="mt-1.5 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-[11px] text-amber-700 leading-relaxed">
                        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>Colour automatically switched to a light logo because your card colour is dark.</span>
                      </div>
                    )}
                    <p className="text-[11px] text-gray-400">The square / circle / cross mark on your card.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTempSettings({ ...tempSettings, backgroundColor: '#f0ece1', cardTextColor: '#1d3458' })}
                  className="mb-6 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#37352F] transition"
                >
                  <RotateCcw className="w-3 h-3" /> Reset to default colors
                </button>
                <div className="space-y-3 max-w-xl">
                  <label className="text-xs font-bold text-gray-400 uppercase">Card logo</label> <InfoHint label="the card logo" text="Upload a square PNG, about 512×512px (at least ~200×200px), with a transparent background and under 1 MB. Apple Wallet shows it small in the card's top-left; Google Wallet crops it to a circle — so a square, transparent logo looks best on both." />
                  <p className="text-xs text-gray-400 -mt-1">What appears at the top of the wallet card, next to your name.</p>
                  <div className="grid sm:grid-cols-3 gap-2">
                    {([
                      ['stampfix', 'Stampfix mark', 'The \u25aa\u25cf\u2715 symbol'],
                      ['custom',   'Your own logo', 'Upload an image'],
                      ['none',     'Text only',     'No logo at all'],
                    ] as const).map(([mode, title, hint]) => {
                      const on = (tempSettings.logoMode ?? 'stampfix') === mode;
                      return (
                        <button
                          key={mode}
                          onClick={() => setTempSettings({ ...tempSettings, logoMode: mode })}
                          className={`text-left p-3 rounded-lg border-2 transition ${on ? 'border-[#37352F] bg-[#F7F7F5]' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                        >
                          <div className="text-sm font-medium">{title}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{hint}</div>
                        </button>
                      );
                    })}
                  </div>

                  {(tempSettings.logoMode ?? 'stampfix') === 'custom' && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-md p-2.5">
                        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>Requirements: PNG, square, at least 200×200px, and under 1 MB. Files outside these limits are rejected.</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <label className="flex-1 cursor-pointer bg-[#F7F7F5] border notion-border border-dashed rounded h-10 flex items-center justify-center text-xs text-gray-500 hover:bg-gray-100 transition">
                          <Upload className="w-3 h-3 mr-2" />
                          {logoUploading ? 'Uploading…' : tempSettings.logoImage ? 'Change file' : 'Choose file'}
                          <input type="file" className="hidden" accept="image/png" onChange={handleLogoUpload} />
                        </label>
                        {tempSettings.logoImage && (
                          <button onClick={() => setTempSettings({ ...tempSettings, logoImage: null })}
                            className="h-10 px-3 bg-red-50 text-red-500 rounded border border-red-100 text-xs hover:bg-red-100">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {!tempSettings.logoImage && (
                        <p className="text-xs text-amber-700">No image uploaded yet — the card shows your text until you add one.</p>
                      )}
                    </div>
                  )}
                </div>
                </ProLockOverlay>
              </div>
            )}

              <div className="flex justify-end gap-3 pt-4 border-t notion-border">
                <button onClick={() => setTempSettings(campaign)}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 transition font-medium border border-transparent hover:border-gray-200 rounded">
                  Cancel
                </button>
                <button onClick={handleSaveSettings}
                  className="px-6 py-2 bg-[#37352F] text-white rounded text-sm font-medium hover:bg-opacity-90 transition shadow-sm">
                  Save Changes
                </button>
              </div>

              <div className="border-t notion-border pt-6 flex justify-between items-center">
                <div className="text-xs text-gray-400 flex items-center gap-2">
                  <RotateCcw className="w-3 h-3" /> Data synced to Supabase
                </div>
                <button onClick={onLogout} className="text-red-500 text-sm hover:underline flex items-center gap-1">
                  <LogOut className="w-3 h-3" /> Sign out
                </button>
              </div>
            </div>
            )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'HELP' && (
          billing.plan === 'pro' ? (
            <GetHelpPanel />
          ) : (
            <ProFeatureLock
              title="Priority support is a Pro feature"
              description="Pro merchants get priority email support — real help from us, fast, whenever you need it."
              bullets={['Priority email support', 'Setup & wallet troubleshooting', 'A direct line to the team']}
              onUpgrade={() => setShowUpgradeModal(true)}
            />
          )
        )}
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t notion-border z-50 pb-safe">
        <div className="flex justify-around items-center h-16">
          {([
            ['DASHBOARD', ScanLine, t('dash.nav.scan', { defaultValue: 'Scan' })],
            ['CUSTOMERS', Users, t('dash.nav.people', { defaultValue: 'People' })],
            ['ANALYTICS', BarChart3, t('dash.nav.insights', { defaultValue: 'Insights' })],
          ] as const).filter(([id]) => !staffHidden.includes(id)).map(([id, Icon, label]) => (
            <button key={id} onClick={() => handleTabChange(id)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                activeTab === id ? 'text-[#37352F]' : 'text-gray-400'
              }`}>
              <Icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
          <button onClick={() => setShowMobileMoreMenu(true)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
              ['ACTIVITY', 'PREVIEW', 'SETTINGS', 'SHARE', 'HELP', 'VALUE', 'STAFF'].includes(activeTab) ? 'text-[#37352F]' : 'text-gray-400'
            }`}>
            <Menu className="w-6 h-6" />
            <span className="text-[10px] font-medium">{t('dash.nav.more', { defaultValue: 'More' })}</span>
          </button>
        </div>
      </div>

      {showMobileMoreMenu && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMobileMoreMenu(false)} />
          <div className="bg-white rounded-t-xl p-4 animate-in slide-in-from-bottom duration-300 relative z-10 pb-8">
            <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6"></div>
            <div className="grid grid-cols-4 gap-4 mb-4">
              {([
                ['ACTIVITY', History, t('dash.nav.activity', { defaultValue: 'Activity' })],
                ['VALUE', TrendingUp, t('dash.nav.payback', { defaultValue: 'Payback' })],
                ['STAFF', Users, t('dash.nav.staff', { defaultValue: 'Staff' })],
                ['SHARE', Share, t('dash.nav.share', { defaultValue: 'Share' })],
                ['PREVIEW', Eye, t('dash.nav.preview', { defaultValue: 'Preview' })],
                ['SETTINGS', Settings, t('dash.nav.settings', { defaultValue: 'Settings' })],
                ['HELP', LifeBuoy, t('dash.nav.getHelp', { defaultValue: 'Get help' })],
              ] as const).filter(([id]) => !staffHidden.includes(id)).map(([id, Icon, label]) => (
                <button key={id} onClick={() => handleTabChange(id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border ${
                    activeTab === id ? 'bg-[#F7F7F5] border-[#37352F]' : 'bg-white border-transparent'
                  }`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    activeTab === id ? 'bg-[#37352F] text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
              {isStampfixAdmin && (
                <button
                  onClick={() => { window.location.href = '/admin'; }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border bg-white border-transparent"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-100 text-gray-600">
                    <Shield className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-medium">{t('dash.nav.admin', { defaultValue: 'Admin' })}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upgrade modal — rendered at the root so it overlays everything */}
      {showStaffGate && (
        <StaffGate
          campaignId={campaign.id}
          staffId={gateTarget?.id}
          staffName={gateTarget?.name}
          onDone={() => {
            setShowStaffGate(false);
            setGateTarget(null);
            setActiveStaff(getStaffSession(campaign.id));
          }}
          onSkip={() => { setShowStaffGate(false); setGateTarget(null); }}
        />
      )}

      {showUpgradeModal && (
        <UpgradeModal country={country ?? null} onClose={() => setShowUpgradeModal(false)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Small subcomponents
// ---------------------------------------------------------------------

function MetricCard({ label, value, icon, color }: {
  label: string; value: number; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="p-6 border notion-border rounded-lg bg-white shadow-sm flex items-start justify-between">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
        <h3 className="text-3xl font-serif-display font-semibold">{value}</h3>
      </div>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>{icon}</div>
    </div>
  );
}

/**
 * Bucket activities into the last 7 days and show as bars.
 * Today is the rightmost bar.
 */
function ActivityBars({ activities }: { activities: ActivityItem[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const count = activities.filter(
      (a) => a.timestamp >= day && a.timestamp < next && a.type === 'STAMP',
    ).length;
    days.push({
      label: day.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0),
      count,
    });
  }
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  return (
    <div className="flex items-end justify-between h-48 w-full gap-2">
      {days.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2 group cursor-default">
          <div className="w-full bg-[#37352F] rounded-t-sm opacity-10 group-hover:opacity-100 transition-all relative"
            style={{ height: `${Math.max(4, (d.count / maxCount) * 100)}%` }}>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
              {d.count} stamps
            </div>
          </div>
          <span className="text-xs text-gray-400 font-medium">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Full-panel lock shown in place of a Pro-only section (Insights, Get
 * help) when the merchant is on the free plan. One-tap upgrade opens the
 * same UpgradeModal used everywhere else.
 */
function ProFeatureLock({
  title, description, bullets, onUpgrade,
}: { title: string; description: string; bullets: string[]; onUpgrade: () => void }) {
  return (
    <div className="max-w-md mx-auto mt-10 md:mt-20 text-center px-6">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200 flex items-center justify-center mx-auto mb-4">
        <Lock className="w-6 h-6 text-amber-600" />
      </div>
      <h2 className="text-xl font-serif-display font-semibold mb-2">{title}</h2>
      <p className="text-sm text-gray-500 mb-5">{description}</p>
      <div className="bg-[#F7F7F5] border notion-border rounded-lg p-4 text-left space-y-2 mb-6">
        {bullets.map((b) => (
          <div key={b} className="flex items-center gap-2 text-sm">
            <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" strokeWidth={3} />
            <span>{b}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onUpgrade}
        className="inline-flex items-center gap-2 bg-[#37352F] text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-opacity-90 transition"
      >
        <Sparkles className="w-4 h-4" /> Upgrade to Pro
      </button>
    </div>
  );
}

/**
 * Single line in the "Get Started" checklist. Done state shows a green
 * check and strikes through. Undone state shows a tappable action button.
 */
function ChecklistItem({
  done, label, actionLabel, onClick,
}: { done: boolean; label: string; actionLabel: string; onClick: () => void | Promise<void> }) {
  return (
    <div className="flex items-center justify-between bg-white border notion-border rounded-md px-3 py-2.5 text-sm">
      <div className="flex items-center gap-2.5">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
          done ? 'bg-green-500 text-white' : 'border-2 border-gray-300'
        }`}>
          {done && <Check className="w-3 h-3" strokeWidth={3} />}
        </div>
        <span className={done ? 'text-gray-400 line-through' : 'text-[#37352F]'}>{label}</span>
      </div>
      {!done && (
        <button
          onClick={onClick}
          className="text-xs text-[#37352F] font-medium hover:underline flex items-center gap-1"
        >
          {actionLabel} <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
