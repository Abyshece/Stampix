import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Campaign, UserCard, ActivityItem, Location, OnboardingState, MerchantBilling, Plan } from '../types';
import { useAuth, signOut } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { checkDailyCap } from '../services/stampGuard';
import { useTranslation } from 'react-i18next';
import { StampReasonModal } from './StampReasonModal';
import {
  getCampaignByMerchant,
  listCardsForCampaign,
  listActivities,
  updateCampaign,
  addStamp,
  redeemReward,
  setCardStatus,
  deleteCard,
  createCard,
  listLocations,
  createLocation,
  updateLocation,
  getOnboardingState,
  setOnboardingFlag,
  getMerchantBilling,
  logMerchantActivity,
} from '../lib/db';
import { redeemStampToken } from '../services/stampToken';
import { MerchantOnboarding, consumePendingCampaign } from './MerchantOnboarding';
import { MerchantDashboard } from './MerchantDashboard';
import { BrandLoading } from './BrandLoading';
import { OnboardingWizard } from './OnboardingWizard';

interface MerchantAppProps {
  onLogout: () => void;
  /** When true, the onboarding screen opens on the login form rather than
   *  the signup form (used after a user confirms their email). */
  startOnLogin?: boolean;
}

/**
 * Loads the merchant's campaign, cards, and activities, and exposes
 * action handlers to the dashboard. Optimistically updates local state
 * after each action and refetches activities (cheap) — keeps the UI
 * snappy without needing a heavyweight data layer like react-query.
 */
export function MerchantApp({ onLogout, startOnLogin }: MerchantAppProps) {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [cards, setCards] = useState<UserCard[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingState>({});
  const [billing, setBilling] = useState<MerchantBilling & { country: 'DE' | 'CA' | null }>({ plan: 'free', country: null });
  // Which location the scanner is "operating as" right now. Persisted per
  // device in localStorage so a barista's tablet remembers between shifts.
  const [activeLocationId, setActiveLocationIdState] = useState<string | null>(
    () => localStorage.getItem('stampfix_active_location_id'),
  );
  const setActiveLocationId = useCallback((id: string | null) => {
    setActiveLocationIdState(id);
    if (id) localStorage.setItem('stampfix_active_location_id', id);
    else localStorage.removeItem('stampfix_active_location_id');
  }, []);
  const [loading, setLoading] = useState(true);

  // Log one "login" activity per browser session for the admin activity feed.
  useEffect(() => {
    if (user && !sessionStorage.getItem('sf_login_logged')) {
      sessionStorage.setItem('sf_login_logged', '1');
      logMerchantActivity('login');
    }
  }, [user]);

  const loadAll = useCallback(async () => {
    if (!user) {
      // Signed out — the render shows the login form directly via the `!user`
      // check below, so keep loading=true. That way, the instant a user
      // appears (e.g. right after login) we show the loader instead of a
      // one-frame flash of the signup form, until loadAll fetches their data.
      setLoading(true);
      return;
    }
    setLoading(true);
    try {
      let c = await getCampaignByMerchant(user.id);
      // If the user just confirmed their email, they may have a pending
      // campaign config in sessionStorage from the signup form.
      if (!c) {
        const consumed = await consumePendingCampaign(user.id);
        if (consumed) c = await getCampaignByMerchant(user.id);
      }
      setCampaign(c);
      if (c) {
        const [cs, acts, locs, ob, bill] = await Promise.all([
          listCardsForCampaign(c.id),
          listActivities(c.id),
          listLocations(c.id),
          getOnboardingState(user.id),
          getMerchantBilling(user.id),
        ]);
        setCards(cs);
        setActivities(acts);
        setLocations(locs);
        setOnboarding(ob);
        setBilling(bill);
        // If the persisted active location no longer exists (or there's
        // none yet), fall back to the first one. This keeps the scanner
        // always pointing somewhere sensible.
        const persisted = localStorage.getItem('stampfix_active_location_id');
        const stillValid = persisted && locs.some((l) => l.id === persisted && !l.archived);
        if (!stillValid) {
          const first = locs.find((l) => !l.archived);
          setActiveLocationId(first ? first.id : null);
        }
      } else {
        setCards([]);
        setActivities([]);
        setLocations([]);
        setOnboarding({});
      }
    } catch (err) {
      console.error('[merchant] loadAll failed:', err);
      // Don't leave the user stuck on a spinner if the DB is unreachable
      // or the schema isn't applied. Show the onboarding screen instead;
      // they can sign out from there.
      setCampaign(null);
      setCards([]);
      setActivities([]);
      setLocations([]);
      setOnboarding({});
    } finally {
      setLoading(false);
    }
  }, [user, setActiveLocationId]);

  // Silent card-only refresh (no loading screen) — used by the realtime/focus
  // sync so the merchant list stays fresh WITHOUT flashing the full-page loader
  // or interrupting the scan celebration.
  const refreshCards = useCallback(async () => {
    if (!campaign) return;
    try {
      setCards(await listCardsForCampaign(campaign.id));
    } catch (err) {
      console.error('[merchant] refreshCards failed:', err);
    }
  }, [campaign]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Keep the card list live so the merchant view never shows a stale count
  // (e.g. still 6/6 after a card already redeemed to 0). Refresh from the DB on
  // any realtime change to this campaign's cards, and whenever the tab regains
  // focus. If realtime isn't enabled on the project the subscription is a
  // harmless no-op and the focus refresh still keeps things fresh.
  useEffect(() => {
    if (!campaign) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => { void refreshCards(); }, 250);
    };
    const channel = supabase
      .channel(`cards-${campaign.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cards', filter: `campaign_id=eq.${campaign.id}` },
        refresh,
      )
      .subscribe();
    const onFocus = () => { if (document.visibilityState === 'visible') void refreshCards(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      if (t) clearTimeout(t);
      supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [campaign, refreshCards]);

  // Refresh activities after an action — they're the cheapest to refetch
  // and the source of truth (since the DB writes them).
  const refreshActivities = useCallback(async () => {
    if (!campaign) return;
    const acts = await listActivities(campaign.id);
    setActivities(acts);
  }, [campaign]);

  const [pendingStamp, setPendingStamp] = useState<
    { cardId: string; customerName: string; stampsToday: number; cap: number } | null
  >(null);

  // Applies the stamp. `reason` is recorded for overrides so the activity log
  // always explains the unusual ones.
  const applyStamp = useCallback(
    async (cardId: string, reason?: string | null, isOverride = false) => {
      if (!campaign) return;
      try {
        const card = cards.find((c) => c.id === cardId);
        const updated = await addStamp(cardId, card?.maxStampsSnapshot ?? campaign.maxStamps, { reason, isOverride });
        setCards((prev) => prev.map((c) => (c.id === cardId ? updated : c)));
        refreshActivities();
      } catch (err) {
        alert(err instanceof Error ? err.message : t('dash.shell.errStamp', { defaultValue: 'Stamp failed' }));
      }
    },
    [campaign, refreshActivities, cards],
  );

  const handleStampCard = useCallback(
    async (cardId: string) => {
      if (!campaign) return;
      const card = cards.find((c) => c.id === cardId);
      const cap = campaign.maxStampsPerDay ?? 1;
      const check = await checkDailyCap(cardId, cap);
      if (check.atCap) {
        // Over the daily limit — make the person say why before it goes through.
        setPendingStamp({
          cardId,
          customerName: card?.customerName ?? t('dash.shell.thisCustomer', { defaultValue: 'This customer' }),
          stampsToday: check.stampsToday,
          cap: check.cap,
        });
        return;
      }
      applyStamp(cardId);
    },
    [campaign, cards, applyStamp],
  );

  const handleResetCard = useCallback(
    async (cardId: string) => {
      try {
        const updated = await redeemReward(cardId);
        setCards((prev) => prev.map((c) => (c.id === cardId ? updated : c)));
        refreshActivities();
      } catch (err) {
        alert(err instanceof Error ? err.message : t('dash.shell.errReset', { defaultValue: 'Reset failed' }));
      }
    },
    [refreshActivities],
  );

  const handleBlockCustomer = useCallback(
    async (cardId: string) => {
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;
      const newStatus = card.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
      try {
        const updated = await setCardStatus(cardId, newStatus);
        setCards((prev) => prev.map((c) => (c.id === cardId ? updated : c)));
        refreshActivities();
      } catch (err) {
        alert(err instanceof Error ? err.message : t('dash.shell.errStatus', { defaultValue: 'Status update failed' }));
      }
    },
    [cards, refreshActivities],
  );

  const handleDeleteCustomer = useCallback(
    async (cardId: string) => {
      try {
        await deleteCard(cardId);
        setCards((prev) => prev.filter((c) => c.id !== cardId));
        refreshActivities();
      } catch (err) {
        alert(err instanceof Error ? err.message : t('dash.shell.errDelete', { defaultValue: 'Delete failed' }));
      }
    },
    [refreshActivities],
  );

  const handleAddCustomer = useCallback(
    async (data: { firstName: string; surname: string; email: string }) => {
      if (!campaign) return;
      try {
        const created = await createCard({
          campaignId: campaign.id,
          customerName: `${data.firstName} ${data.surname}`.trim(),
          email: data.email,
        });
        setCards((prev) => [created, ...prev]);
        refreshActivities();
      } catch (err) {
        alert(err instanceof Error ? err.message : t('dash.shell.errAddCustomer', { defaultValue: 'Could not add customer' }));
      }
    },
    [campaign, refreshActivities],
  );

  const handleMarkOnboardingStep = useCallback(
    async (patch: Partial<OnboardingState>) => {
      if (!user) return;
      // Optimistic local update so UI feels instant.
      setOnboarding((prev) => ({ ...prev, ...patch }));
      try {
        const updated = await setOnboardingFlag(user.id, patch);
        setOnboarding(updated);
      } catch (err) {
        console.warn('[onboarding] flag update failed:', err);
        // Best-effort; the wizard is non-critical.
      }
    },
    [user],
  );

  /**
   * Redeems a signed stamp token via the Edge Function. Server is
   * authoritative — it verifies the signature, checks expiry/replay,
   * applies the stamp, and returns the updated card. We mirror that
   * update locally so the UI stays in sync without a full refetch, then
   * fire the wallet sync (best-effort).
   *
   * The active location id is sent along so the server can tag the
   * activity row with which branch did the stamping.
   */
  const handleRedeemToken = useCallback(
    async (token: string) => {
      const result = await redeemStampToken(token, activeLocationId);
      setCards((prev) =>
        prev.map((c) =>
          c.id === result.card.id
            ? {
                ...c,
                currentStamps: result.card.currentStamps,
                rewardsRedeemed: result.card.rewardsRedeemed,
                status: result.card.status,
              }
            : c,
        ),
      );
      refreshActivities();
      // Onboarding: a successful stamp counts as the first-stamp milestone.
      if (!onboarding.first_stamp_given) {
        handleMarkOnboardingStep({ first_stamp_given: true });
      }
      return result;
    },
    [refreshActivities, activeLocationId, onboarding.first_stamp_given, handleMarkOnboardingStep],
  );

  // ----- Location handlers -----

  const handleAddLocation = useCallback(
    async (name: string, address?: string, latitude?: number | null, longitude?: number | null) => {
      if (!campaign) return;
      const created = await createLocation({ campaignId: campaign.id, name, address, latitude, longitude });
      setLocations((prev) => [...prev, created]);
      // If we didn't have an active location yet, the new one becomes active.
      if (!activeLocationId) setActiveLocationId(created.id);
    },
    [campaign, activeLocationId, setActiveLocationId],
  );

  const handleUpdateLocation = useCallback(
    async (locationId: string, patch: { name?: string; address?: string; latitude?: number | null; longitude?: number | null; archived?: boolean }) => {
      const updated = await updateLocation(locationId, patch);
      setLocations((prev) => prev.map((l) => (l.id === locationId ? updated : l)));
      // If the active location was archived, pick another one.
      if (updated.archived && activeLocationId === locationId) {
        const next = locations.find((l) => l.id !== locationId && !l.archived);
        setActiveLocationId(next ? next.id : null);
      }
    },
    [activeLocationId, locations, setActiveLocationId],
  );

  const handleUpdateCampaign = useCallback(
    async (patch: Partial<Campaign>) => {
      if (!campaign) return;
      try {
        const updated = await updateCampaign(campaign.id, patch);
        setCampaign(updated);
      } catch (err) {
        alert(err instanceof Error ? err.message : t('dash.shell.errUpdate', { defaultValue: 'Update failed' }));
      }
    },
    [campaign],
  );

  const handleLogout = useCallback(async () => {
    await signOut();
    onLogout();
  }, [onLogout]);

  // A merchant who just finished signup must always land on the thank-you /
  // pending-review screen — never a flash of the loader, the dashboard, or a
  // remounted empty form. Signup briefly creates a session (then signs out),
  // which churns auth state and would otherwise race us into one of those.
  // While the just-registered flag is set (cleared when they hit "Sign in" on
  // the thank-you screen), hold on the onboarding component, whose own
  // initializer reads the same flag and renders the THANK_YOU step.
  let justRegistered = false;
  try { justRegistered = sessionStorage.getItem('sf_just_registered') === '1'; } catch { /* ignore */ }
  if (justRegistered) {
    return <MerchantOnboarding onComplete={loadAll} initialStep="FORM" onBack={onLogout} />;
  }

  // Auth still resolving (e.g. right after a refresh) — show the loader, not
  // the signup form. This useAuth instance starts with user=null until its
  // getSession() settles, which is what caused the "Create your workspace"
  // flash on reload.
  if (authLoading) {
    return <BrandLoading />;
  }

  if (!user) {
    return <MerchantOnboarding onComplete={loadAll} initialStep={startOnLogin ? 'LOGIN' : 'FORM'} onBack={onLogout} />;
  }

  if (loading) {
    return <BrandLoading />;
  }

  if (!campaign) {
    return <MerchantOnboarding onComplete={loadAll} initialStep={startOnLogin ? 'LOGIN' : 'FORM'} onBack={onLogout} />;
  }

  // Show the first-run wizard when the merchant hasn't dismissed it AND
  // hasn't completed the core milestones. Once they've dismissed (or
  // completed) it, the dashboard's "Get Started" checklist takes over.
  const shouldShowWizard = campaign && !onboarding.wizard_dismissed;

  return (
    <>
      <MerchantDashboard
        campaign={campaign}
        cards={cards}
        activities={activities}
        locations={locations}
        activeLocationId={activeLocationId}
        onboarding={onboarding}
        billing={billing}
        country={billing.country}
        onSetActiveLocation={setActiveLocationId}
        onAddLocation={handleAddLocation}
        onUpdateLocation={handleUpdateLocation}
        onStampCard={handleStampCard}
        onResetCard={handleResetCard}
        onRedeemToken={handleRedeemToken}
        onUpdateCampaign={handleUpdateCampaign}
        onAddCustomer={handleAddCustomer}
        onDeleteCustomer={handleDeleteCustomer}
        onBlockCustomer={handleBlockCustomer}
        onMarkOnboardingStep={handleMarkOnboardingStep}
        onLogout={handleLogout}
      />
      {shouldShowWizard && (
        <OnboardingWizard
          campaign={campaign}
          locations={locations}
          initialState={onboarding}
          onMarkStep={handleMarkOnboardingStep}
          onUpdateCampaign={handleUpdateCampaign}
          onClose={() => {
            // The wizard already saves wizard_dismissed=true to the server;
            // local state will sync via handleMarkOnboardingStep.
          }}
        />
      )}

      {pendingStamp && (
        <StampReasonModal
          customerName={pendingStamp.customerName}
          atCap
          stampsToday={pendingStamp.stampsToday}
          cap={pendingStamp.cap}
          onCancel={() => setPendingStamp(null)}
          onConfirm={async (reason) => {
            const p = pendingStamp;
            setPendingStamp(null);
            await applyStamp(p.cardId, reason, true);
          }}
        />
      )}
    </>
  );
}
