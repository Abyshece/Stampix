import { useMemo, useState } from 'react';
import {
  Users, TrendingUp, Award, Calendar, MapPin, Activity as ActivityIcon,
  ArrowUp, ArrowDown, Minus, Clock, Sparkles,
} from 'lucide-react';
import type { ActivityItem, Campaign, Location, UserCard } from '../types';
import { useTranslation } from 'react-i18next';

type DateRange = 'today' | 'yesterday' | '7d' | '30d' | 'this_month' | 'last_month' | 'custom';
type LocationFilter = 'all' | string; // location id or 'all'

interface InsightsPanelProps {
  campaign: Campaign;
  cards: UserCard[];
  activities: ActivityItem[];
  locations: Location[];
}

/**
 * Comprehensive insights / analytics for the B2B merchant.
 *
 * What a small-business owner running a loyalty program wants:
 *  - Headline numbers (members, stamps, rewards) with trend vs prior period
 *  - Per-location breakdown so multi-branch merchants can compare branches
 *  - Engagement quality: active vs dormant customers
 *  - Reward economics: rough $ value given away
 *  - Day-of-week pattern for staffing decisions
 *  - Activity timeline so they can spot growth or stagnation
 *
 * All filtering happens client-side because the merchant's dataset is
 * small (a typical small business has ~50-500 customer cards). If we
 * ever ship merchants with 10k+ customers we'd push aggregation to
 * the database.
 */
/** Calendar-aligned date presets (mirrors the admin Overview filter), plus the
 *  matching prior period for the "vs prior" trend numbers. */
function resolveRange(
  preset: DateRange,
  customFrom: string,
  customTo: string,
): { from: Date; to: Date; prevFrom: Date; prevTo: Date; label: string } {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from: Date;
  let to: Date;
  let label: string;
  switch (preset) {
    case 'today': from = startOfToday; to = endOfToday; label = 'today'; break;
    case 'yesterday': {
      const s = new Date(startOfToday); s.setDate(s.getDate() - 1);
      const e = new Date(s); e.setHours(23, 59, 59, 999);
      from = s; to = e; label = 'yesterday'; break;
    }
    case '7d': { const s = new Date(startOfToday); s.setDate(s.getDate() - 6); from = s; to = endOfToday; label = 'the last 7 days'; break; }
    case '30d': { const s = new Date(startOfToday); s.setDate(s.getDate() - 29); from = s; to = endOfToday; label = 'the last 30 days'; break; }
    case 'this_month': from = new Date(now.getFullYear(), now.getMonth(), 1); to = endOfToday; label = 'this month'; break;
    case 'last_month':
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      label = 'last month'; break;
    case 'custom':
      from = customFrom ? new Date(customFrom + 'T00:00:00') : (() => { const d = new Date(startOfToday); d.setDate(d.getDate() - 29); return d; })();
      to = customTo ? new Date(customTo + 'T23:59:59') : endOfToday;
      label = 'the selected range'; break;
    default: from = startOfToday; to = endOfToday; label = 'today';
  }
  const span = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - span);
  return { from, to, prevFrom, prevTo, label };
}

export function InsightsPanel({ campaign, cards, activities, locations }: InsightsPanelProps) {
  const { t } = useTranslation();
  const [range, setRange] = useState<DateRange>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [locFilter, setLocFilter] = useState<LocationFilter>('all');
  // 'all' = no offer filter; otherwise an offer-title snapshot from cards.
  // Lets the merchant see how a previous offer text performed even after
  // they've changed it (each card preserves its snapshot at signup).
  const [offerFilter, setOfferFilter] = useState<string>('all');

  // Distinct offer-title snapshots seen across the merchant's cards,
  // each with the earliest joined_at = when that offer first started.
  // Sorted newest-first so the current offer is at the top of the list.
  const uniqueOffers = useMemo(() => {
    const byOffer = new Map<string, Date>();
    for (const c of cards) {
      if (!c.offerTitleSnapshot) continue;
      const existing = byOffer.get(c.offerTitleSnapshot);
      const joined = new Date(c.joinedAt);
      if (!existing || joined < existing) byOffer.set(c.offerTitleSnapshot, joined);
    }
    return Array.from(byOffer.entries())
      .map(([offer, startedAt]) => ({ offer, startedAt }))
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }, [cards]);

  // --- Compute the time window (+ prior period) from the selected range ---
  const { from, to, prevFrom, prevTo } = useMemo(
    () => resolveRange(range, customFrom, customTo),
    [range, customFrom, customTo],
  );

  // Set of card IDs matching the chosen offer snapshot. Empty set
  // means "no filter" — checked by `offerFilter === 'all'` below.
  const matchingCardIds = useMemo(() => {
    if (offerFilter === 'all') return null;
    return new Set(cards.filter((c) => c.offerTitleSnapshot === offerFilter).map((c) => c.id));
  }, [cards, offerFilter]);

  // --- Filter activities to the selected window AND location AND offer ---
  const filtered = useMemo(() => {
    return activities.filter((a) => {
      const created = new Date(a.timestamp);
      if (created < from || created > to) return false;
      if (locFilter !== 'all' && a.locationId !== locFilter) return false;
      if (matchingCardIds && (!a.cardId || !matchingCardIds.has(a.cardId))) return false;
      return true;
    });
  }, [activities, from, to, locFilter, matchingCardIds]);

  // --- Filter the prior window (for trend comparison) ---
  const filteredPrev = useMemo(() => {
    return activities.filter((a) => {
      const created = new Date(a.timestamp);
      if (created < prevFrom || created > prevTo) return false;
      if (locFilter !== 'all' && a.locationId !== locFilter) return false;
      if (matchingCardIds && (!a.cardId || !matchingCardIds.has(a.cardId))) return false;
      return true;
    });
  }, [activities, prevFrom, prevTo, locFilter, matchingCardIds]);

  // --- Filter cards by location for the breakdown ---
  const filteredCards = useMemo(() => {
    return cards.filter((c) => {
      if (locFilter !== 'all' && c.joinedAtLocationId !== locFilter) return false;
      if (offerFilter !== 'all' && c.offerTitleSnapshot !== offerFilter) return false;
      return true;
    });
  }, [cards, locFilter, offerFilter]);

  // --- Counts (current period) ---
  const joins = filtered.filter((a) => a.type === 'JOIN').length;
  const stamps = filtered.filter((a) => a.type === 'STAMP').length;
  const redeems = filtered.filter((a) => a.type === 'REDEEM').length;

  // --- Counts (previous period, for trends) ---
  const joinsPrev = filteredPrev.filter((a) => a.type === 'JOIN').length;
  const stampsPrev = filteredPrev.filter((a) => a.type === 'STAMP').length;
  const redeemsPrev = filteredPrev.filter((a) => a.type === 'REDEEM').length;

  // --- Activity by location ---
  const byLocation = useMemo(() => {
    const map = new Map<string | null, { joins: number; stamps: number; redeems: number }>();
    filtered.forEach((a) => {
      const key = a.locationId ?? null;
      const e = map.get(key) ?? { joins: 0, stamps: 0, redeems: 0 };
      if (a.type === 'JOIN') e.joins++;
      else if (a.type === 'STAMP') e.stamps++;
      else if (a.type === 'REDEEM') e.redeems++;
      map.set(key, e);
    });
    return Array.from(map.entries()).map(([id, counts]) => ({
      id,
      name: locations.find((l) => l.id === id)?.name ?? 'Unassigned',
      ...counts,
      total: counts.joins + counts.stamps + counts.redeems,
    })).sort((a, b) => b.total - a.total);
  }, [filtered, locations]);

  // --- Activity per day (last N days) for the trend chart ---
  const dailySeries = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;
    const startDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const endDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    const days = Math.min(120, Math.max(1, Math.round((endDay.getTime() - startDay.getTime()) / DAY) + 1));
    const buckets = new Array(days).fill(0).map((_, i) => ({ date: new Date(startDay.getTime() + i * DAY), count: 0 }));
    filtered.forEach((a) => {
      const created = new Date(a.timestamp);
      const idx = Math.floor((created.getTime() - startDay.getTime()) / DAY);
      if (idx >= 0 && idx < days) buckets[idx].count++;
    });
    return buckets;
  }, [filtered, from, to]);

  // --- Day-of-week heatmap (peak times) ---
  const dayOfWeek = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0]; // Sun..Sat
    filtered.forEach((a) => {
      if (a.type === 'STAMP') counts[new Date(a.timestamp).getDay()]++;
    });
    return counts;
  }, [filtered]);

  // --- Engagement: active vs dormant ---
  // A customer is "active" if they had any STAMP/REDEEM in the period.
  const activeCustomerIds = useMemo(() => {
    const ids = new Set<string>();
    filtered.forEach((a) => {
      if ((a.type === 'STAMP' || a.type === 'REDEEM') && a.cardId) {
        ids.add(a.cardId);
      }
    });
    return ids;
  }, [filtered]);
  const activeCount = activeCustomerIds.size;
  const totalCount = filteredCards.length;
  const dormantCount = Math.max(0, totalCount - activeCount);
  const activeRate = totalCount > 0 ? (activeCount / totalCount) * 100 : 0;

  // --- Completion rate: rewards earned / cards issued ---
  const totalRewardsClaimed = filteredCards.reduce((acc, c) => acc + c.rewardsRedeemed, 0);
  const completionRate = totalCount > 0 ? (totalRewardsClaimed / totalCount) * 100 : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif-display font-semibold mb-2">{t('dash.insights.title', { defaultValue: 'Insights' })}</h1>
          <p className="text-gray-500 text-sm md:text-base">
            {t('dash.insights.subMain', { defaultValue: 'How your loyalty program is performing' })}
            {locFilter === 'all' ? t('dash.insights.allLocations', { defaultValue: ' across all locations' }) : ` ${t('dash.insights.atLoc', { defaultValue: 'at' })} ${locations.find((l) => l.id === locFilter)?.name ?? t('dash.insights.thisLocation', { defaultValue: 'this location' })}`}
            {offerFilter !== 'all' && ` · ${t('dash.insights.offerLabel', { defaultValue: 'offer' })} "${offerFilter.length > 30 ? offerFilter.slice(0, 28) + '…' : offerFilter}"`}.
          </p>
        </div>
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            icon={<MapPin className="w-3.5 h-3.5" />}
            label={t('dash.insights.filterLocation', { defaultValue: 'Location' })}
            value={locFilter}
            onChange={setLocFilter}
            options={[
              { value: 'all', label: t('dash.insights.allLocationsOpt', { defaultValue: 'All locations' }) },
              ...locations.filter((l) => !l.archived).map((l) => ({ value: l.id, label: l.name })),
            ]}
          />
          <FilterDropdown
            icon={<Sparkles className="w-3.5 h-3.5" />}
            label={t('dash.insights.filterOffer', { defaultValue: 'Offer' })}
            value={offerFilter}
            onChange={setOfferFilter}
            options={[
              { value: 'all', label: uniqueOffers.length > 0 ? t('dash.insights.allOffersCount', { count: uniqueOffers.length, defaultValue: 'All offers ({{count}})' }) : t('dash.insights.allOffers', { defaultValue: 'All offers' }) },
              ...uniqueOffers.map(({ offer, startedAt }) => ({
                value: offer,
                // Show offer text + the date it first started so the
                // merchant can identify old campaigns at a glance.
                label: `${offer.length > 28 ? offer.slice(0, 26) + '…' : offer} · ${t('dash.insights.since', { defaultValue: 'since' })} ${startedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
              })),
            ]}
          />
        </div>
      </header>

      {/* Date range — presets + custom, like the admin overview */}
      <div className="bg-white border notion-border rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Calendar className="w-4 h-4 text-gray-400 mr-1" />
          {([
            ['today', t('dash.insights.rToday', { defaultValue: 'Today' })],
            ['yesterday', t('dash.insights.rYesterday', { defaultValue: 'Yesterday' })],
            ['7d', t('dash.insights.r7d', { defaultValue: 'Last 7 days' })],
            ['30d', t('dash.insights.r30d', { defaultValue: 'Last 30 days' })],
            ['this_month', t('dash.insights.rThisMonth', { defaultValue: 'This month' })],
            ['last_month', t('dash.insights.rLastMonth', { defaultValue: 'Last month' })],
            ['custom', t('dash.insights.rCustom', { defaultValue: 'Custom' })],
          ] as const).map(([id, lbl]) => (
            <button
              key={id}
              onClick={() => setRange(id)}
              className={`text-xs px-3 py-1.5 rounded-md border transition ${
                range === id ? 'bg-[#37352F] text-white border-[#37352F]' : 'bg-white notion-border hover:bg-[#F7F7F5]'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="flex items-center gap-2 text-sm pt-2 border-t notion-border flex-wrap">
            <label className="text-xs text-gray-500">{t('dash.insights.from', { defaultValue: 'From:' })}</label>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} max={customTo || undefined} className="bg-[#F7F7F5] border notion-border rounded px-2 py-1 text-xs" />
            <label className="text-xs text-gray-500 ml-2">{t('dash.insights.to', { defaultValue: 'To:' })}</label>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} min={customFrom || undefined} className="bg-[#F7F7F5] border notion-border rounded px-2 py-1 text-xs" />
          </div>
        )}
        <div className="text-[11px] text-gray-400">
          {t('dash.insights.showingFrom', { defaultValue: 'Showing data from' })} <strong className="text-[#37352F]">{from.toLocaleDateString()}</strong> {t('dash.insights.showingTo', { defaultValue: 'to' })} <strong className="text-[#37352F]">{to.toLocaleDateString()}</strong>
        </div>
      </div>

      {/* Campaign banner — reminds them of the offer they're running */}
      <div className="bg-[#F7F7F5] border notion-border rounded-lg p-4 flex items-center gap-3">
        <div className="text-2xl">{campaign.customIcon || '🏷️'}</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-0.5">{t('dash.insights.currentOffer', { defaultValue: 'Current offer' })}</div>
          <div className="font-semibold truncate">{campaign.offerTitle}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {campaign.maxStamps} {t('dash.insights.stampsRequired', { defaultValue: 'stamps required' })} · {locations.filter((l) => !l.archived).length} {locations.filter((l) => !l.archived).length === 1 ? t('dash.insights.activeLocationOne', { defaultValue: 'active location' }) : t('dash.insights.activeLocationOther', { defaultValue: 'active locations' })}
          </div>
        </div>
      </div>

      {/* Headline metric cards with trend deltas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <TrendMetric
          label={t('dash.insights.newMembers', { defaultValue: 'New members' })}
          value={joins}
          previousValue={joinsPrev}
          icon={<Users className="w-4 h-4" />}
          color="text-blue-600 bg-blue-50"
        />
        <TrendMetric
          label={t('dash.insights.stampsGiven', { defaultValue: 'Stamps given' })}
          value={stamps}
          previousValue={stampsPrev}
          icon={<TrendingUp className="w-4 h-4" />}
          color="text-orange-600 bg-orange-50"
        />
        <TrendMetric
          label={t('dash.insights.rewardsClaimed', { defaultValue: 'Rewards claimed' })}
          value={redeems}
          previousValue={redeemsPrev}
          icon={<Award className="w-4 h-4" />}
          color="text-green-600 bg-green-50"
        />
        <TrendMetric
          label={t('dash.insights.totalMembers', { defaultValue: 'Total members' })}
          value={totalCount}
          icon={<Users className="w-4 h-4" />}
          color="text-purple-600 bg-purple-50"
        />
      </div>

      {/* Activity trend chart */}
      <div className="bg-white border notion-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-lg">{t('dash.insights.activityTrend', { defaultValue: 'Activity trend' })}</h3>
          <span className="text-xs text-gray-400">
            {dailySeries.reduce((a, b) => a + b.count, 0)} {t('dash.insights.eventsInPeriod', { defaultValue: 'events in this period' })}
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-5">{t('dash.insights.allActionsPerDay', { defaultValue: 'All loyalty actions per day (joins, stamps, redemptions).' })}</p>
        <DailyTrendChart series={dailySeries} />
      </div>

      {/* Two-column row: Engagement + Day of week */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border notion-border rounded-lg p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-lg">{t('dash.insights.engagement', { defaultValue: 'Customer engagement' })}</h3>
            <p className="text-xs text-gray-500">{t('dash.insights.engagementSub', { defaultValue: "Active customers vs those who haven't visited." })}</p>
          </div>
          <EngagementBar
            activeCount={activeCount}
            dormantCount={dormantCount}
            activeRate={activeRate}
          />
          <div className="pt-3 border-t notion-border">
            <div className="flex justify-between items-center text-sm">
              <div className="text-gray-500">{t('dash.insights.completionRate', { defaultValue: 'Completion rate' })}</div>
              <div className="font-semibold">{completionRate.toFixed(1)}%</div>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {t('dash.insights.rewardsPerMember', { defaultValue: 'Rewards earned per member' })} ({totalRewardsClaimed} {t('dash.insights.total', { defaultValue: 'total' })}).
            </p>
          </div>
        </div>

        <div className="bg-white border notion-border rounded-lg p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-500" /> {t('dash.insights.busyDays', { defaultValue: 'Busy days' })}
            </h3>
            <p className="text-xs text-gray-500">{t('dash.insights.busyDaysSub', { defaultValue: 'When customers earn stamps. Useful for staffing.' })}</p>
          </div>
          <DayOfWeekChart counts={dayOfWeek} />
        </div>
      </div>

      {/* Per-location breakdown */}
      {locations.filter((l) => !l.archived).length > 1 && locFilter === 'all' && (
        <div className="bg-white border notion-border rounded-lg p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-500" /> {t('dash.insights.byLocation', { defaultValue: 'Activity by location' })}
            </h3>
            <p className="text-xs text-gray-500">{t('dash.insights.byLocationSub', { defaultValue: 'Compare how each branch is performing.' })}</p>
          </div>
          <LocationBreakdown rows={byLocation} />
        </div>
      )}

      {/* Recent activity feed (compact, last 5) */}
      <div className="bg-white border notion-border rounded-lg p-6">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <ActivityIcon className="w-4 h-4 text-gray-500" /> {t('dash.insights.recentActivity', { defaultValue: 'Recent activity' })}
        </h3>
        {filtered.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">
            {t('dash.insights.noActivity', { defaultValue: 'No activity in this period.' })}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.slice(0, 8).map((a) => (
              <RecentRow key={a.id} activity={a} locations={locations} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// Sub-components
// =====================================================================

function FilterDropdown<T extends string>({
  icon, label, value, onChange, options,
}: {
  icon: React.ReactNode;
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs bg-white border notion-border rounded-md px-2 py-1.5 hover:bg-[#F7F7F5] transition cursor-pointer">
      <span className="text-gray-500">{icon}</span>
      <span className="text-gray-500 hidden sm:inline">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-transparent outline-none font-medium pr-1 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function TrendMetric({
  label, value, previousValue, icon, color,
}: {
  label: string;
  value: number;
  previousValue?: number;
  icon: React.ReactNode;
  color: string;
}) {
  // Calculate delta if previousValue is provided
  let trend: 'up' | 'down' | 'flat' | null = null;
  let pct = 0;
  if (previousValue !== undefined) {
    if (previousValue === 0) {
      trend = value > 0 ? 'up' : 'flat';
      pct = value > 0 ? 100 : 0;
    } else {
      pct = ((value - previousValue) / previousValue) * 100;
      trend = pct > 2 ? 'up' : pct < -2 ? 'down' : 'flat';
    }
  }

  return (
    <div className="bg-white border notion-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-8 h-8 rounded-md ${color} flex items-center justify-center`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-400'
          }`}>
            {trend === 'up' ? <ArrowUp className="w-3 h-3" />
              : trend === 'down' ? <ArrowDown className="w-3 h-3" />
              : <Minus className="w-3 h-3" />}
            {Math.abs(pct).toFixed(0)}%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold mb-0.5">{value.toLocaleString()}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function DailyTrendChart({ series }: { series: Array<{ date: Date; count: number }> }) {
  const max = Math.max(1, ...series.map((s) => s.count));
  // For longer ranges (>14 days) skip rendering every label, otherwise show them all.
  const showLabel = (i: number) => {
    if (series.length <= 14) return true;
    return i % Math.ceil(series.length / 8) === 0 || i === series.length - 1;
  };
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-32">
        {series.map((s, i) => {
          const h = (s.count / max) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col justify-end group relative">
              <div
                className="bg-[#37352F] rounded-t opacity-80 group-hover:opacity-100 transition-all"
                style={{ height: `${h}%`, minHeight: s.count > 0 ? '3px' : '0' }}
                title={`${s.date.toLocaleDateString()}: ${s.count} events`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 text-[9px] text-gray-400 font-medium">
        {series.map((s, i) => (
          <div key={i} className="flex-1 text-center">
            {showLabel(i) ? s.date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

function EngagementBar({ activeCount, dormantCount, activeRate }: { activeCount: number; dormantCount: number; activeRate: number }) {
  const { t } = useTranslation();
  const total = activeCount + dormantCount;
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-3xl font-bold">{activeRate.toFixed(0)}%</div>
          <div className="text-xs text-gray-500">{t('dash.insights.membersActive', { defaultValue: 'members active in period' })}</div>
        </div>
        <div className="text-xs text-gray-400 text-right">
          {activeCount.toLocaleString()} {t('dash.insights.of', { defaultValue: 'of' })} {total.toLocaleString()}
        </div>
      </div>
      <div className="h-3 bg-[#F7F7F5] rounded-full overflow-hidden flex">
        <div className="bg-green-500" style={{ width: `${activeRate}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>🟢 {activeCount.toLocaleString()} {t('dash.insights.activeWord', { defaultValue: 'active' })}</span>
        <span>⚪ {dormantCount.toLocaleString()} {t('dash.insights.dormantWord', { defaultValue: 'dormant' })}</span>
      </div>
    </div>
  );
}

function DayOfWeekChart({ counts }: { counts: number[] }) {
  const { t } = useTranslation();
  const labels = [t('dash.insights.dowSun', { defaultValue: 'Sun' }), t('dash.insights.dowMon', { defaultValue: 'Mon' }), t('dash.insights.dowTue', { defaultValue: 'Tue' }), t('dash.insights.dowWed', { defaultValue: 'Wed' }), t('dash.insights.dowThu', { defaultValue: 'Thu' }), t('dash.insights.dowFri', { defaultValue: 'Fri' }), t('dash.insights.dowSat', { defaultValue: 'Sat' })];
  const max = Math.max(1, ...counts);
  return (
    <div className="flex items-end gap-3 h-32">
      {counts.map((c, i) => {
        const h = (c / max) * 100;
        const isPeak = c === max && c > 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="text-[10px] font-medium text-gray-500 h-3">{c > 0 ? c : ''}</div>
            <div className="flex-1 w-full flex items-end">
              <div
                className={`w-full rounded-t transition-all ${isPeak ? 'bg-[#37352F]' : 'bg-gray-300'}`}
                style={{ height: `${h}%`, minHeight: c > 0 ? '4px' : '0' }}
              />
            </div>
            <div className="text-[10px] font-medium text-gray-400">{labels[i]}</div>
          </div>
        );
      })}
    </div>
  );
}

function LocationBreakdown({ rows }: { rows: Array<{ id: string | null; name: string; joins: number; stamps: number; redeems: number; total: number }> }) {
  const { t } = useTranslation();
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  if (rows.length === 0) {
    return <div className="text-sm text-gray-400 text-center py-4">{t('dash.insights.noActivityByLoc', { defaultValue: 'No activity by location in this period.' })}</div>;
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id ?? 'none'} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium truncate flex-1 mr-2">{r.name}</span>
            <span className="text-gray-400 text-xs whitespace-nowrap">
              {r.joins} {t('dash.insights.joined', { defaultValue: 'joined' })} · {r.stamps} {t('dash.insights.stampsWord', { defaultValue: 'stamps' })} · {r.redeems} {t('dash.insights.rewardsWord', { defaultValue: 'rewards' })}
            </span>
          </div>
          <div className="h-2 bg-[#F7F7F5] rounded-full overflow-hidden flex">
            <div className="bg-blue-500" style={{ width: `${(r.joins / maxTotal) * 100}%` }} title={`${r.joins} ${t('dash.insights.joinsWord', { defaultValue: 'joins' })}`} />
            <div className="bg-orange-500" style={{ width: `${(r.stamps / maxTotal) * 100}%` }} title={`${r.stamps} ${t('dash.insights.stampsWord', { defaultValue: 'stamps' })}`} />
            <div className="bg-green-500" style={{ width: `${(r.redeems / maxTotal) * 100}%` }} title={`${r.redeems} ${t('dash.insights.redemptionsWord', { defaultValue: 'redemptions' })}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentRow({ activity, locations }: { activity: ActivityItem; locations: Location[] }) {
  const { t } = useTranslation();
  const time = new Date(activity.timestamp);
  const ago = timeAgo(time);
  const locName = activity.locationId
    ? locations.find((l) => l.id === activity.locationId)?.name
    : null;
  const colors: Record<string, string> = {
    JOIN: 'bg-blue-50 text-blue-700',
    STAMP: 'bg-orange-50 text-orange-700',
    REDEEM: 'bg-green-50 text-green-700',
  };
  const labels: Record<string, string> = {
    JOIN: t('dash.insights.evJoined', { defaultValue: 'Joined' }),
    STAMP: t('dash.insights.evStamped', { defaultValue: 'Stamped' }),
    REDEEM: t('dash.insights.evRedeemed', { defaultValue: 'Redeemed' }),
  };
  return (
    <div className="flex items-center gap-3 py-2 border-b notion-border last:border-b-0">
      <span className={`text-xs px-2 py-0.5 rounded font-medium ${colors[activity.type]}`}>
        {labels[activity.type]}
      </span>
      <span className="text-sm flex-1 truncate">{activity.customerName || '—'}</span>
      {locName && <span className="text-xs text-gray-400 hidden sm:inline">{t('dash.insights.atWord', { defaultValue: 'at' })} {locName}</span>}
      <span className="text-xs text-gray-400 whitespace-nowrap">{ago}</span>
    </div>
  );
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
