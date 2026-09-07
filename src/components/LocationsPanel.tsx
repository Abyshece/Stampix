import { useState, useEffect, useRef } from 'react';
import { MapPin, Plus, Archive, Loader2, X, Edit2, Check, Lock } from 'lucide-react';
import type { Location } from '../types';
import { searchAddresses, type AddressHit } from '../lib/geocode';
import { useTranslation } from 'react-i18next';

interface LocationsPanelProps {
  locations: Location[];
  activeLocationId: string | null;
  onAdd: (name: string, address?: string, latitude?: number | null, longitude?: number | null) => Promise<void>;
  onUpdate: (
    locationId: string,
    patch: { name?: string; address?: string; latitude?: number | null; longitude?: number | null; archived?: boolean },
  ) => Promise<void>;
  /** Free plan is capped at one active location; Pro is unlimited. */
  isPro: boolean;
  onUpgrade: () => void;
}

/**
 * Address search backed by OpenStreetMap (Nominatim). The merchant picks a real
 * result so coordinates are always valid — freely typed addresses frequently
 * fail to geocode. Picking a suggestion sets the address text AND its lat/lng.
 */
function AddressAutocomplete({
  initial,
  onPick,
}: {
  initial: string;
  onPick: (label: string, lat: number | null, lng: number | null) => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState(initial);
  const [hits, setHits] = useState<AddressHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const skip = useRef(false); // suppress the search that would fire right after a pick

  useEffect(() => {
    if (skip.current) { skip.current = false; return; }
    const query = q.trim();
    if (query.length < 3) { setHits([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const r = await searchAddresses(query);
      setLoading(false);
      setHits(r);
      setOpen(true);
    }, 450);
    return () => clearTimeout(t);
  }, [q]);

  const inp =
    'w-full bg-white border notion-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300';
  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); onPick(e.target.value, null, null); }}
        onFocus={() => { if (hits.length) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t('dash.loc.searchPh', { defaultValue: 'Search your address (street, city)…' })}
        className={inp}
      />
      {open && (loading || hits.length > 0) && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-md border notion-border bg-white shadow-lg">
          {loading && <div className="px-3 py-2 text-xs text-gray-400">{t('dash.loc.searching', { defaultValue: 'Searching…' })}</div>}
          {hits.map((h, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => { skip.current = true; setQ(h.label); onPick(h.label, h.latitude, h.longitude); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b notion-border last:border-b-0"
            >
              {h.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const coordLine = (lat: number, lng: number, label: string) => (
  <div className="text-xs text-green-600 mt-0.5">
    📍 {lat.toFixed(5)}, {lng.toFixed(5)} · {label}
  </div>
);

/**
 * Settings panel for managing the campaign's locations. A merchant with one
 * shop can rename their initial location; multi-branch merchants add more.
 * Archiving (not hard deletion) keeps old activities' location references intact.
 */
export function LocationsPanel({ locations, activeLocationId, onAdd, onUpdate, isPro, onUpgrade }: LocationsPanelProps) {
  const { t } = useTranslation();
  const [addingName, setAddingName] = useState('');
  const [addingAddress, setAddingAddress] = useState('');
  const [addingLat, setAddingLat] = useState<number | null>(null);
  const [addingLng, setAddingLng] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLat, setEditLat] = useState<number | null>(null);
  const [editLng, setEditLng] = useState<number | null>(null);

  const active = locations.filter((l) => !l.archived);
  const archived = locations.filter((l) => l.archived);

  const resetAdd = () => {
    setIsAdding(false);
    setAddingName('');
    setAddingAddress('');
    setAddingLat(null);
    setAddingLng(null);
  };

  const handleAdd = async () => {
    if (!addingName.trim()) return;
    setBusy(true);
    try {
      await onAdd(addingName.trim(), addingAddress.trim() || undefined, addingLat, addingLng);
      resetAdd();
    } catch (e) {
      alert(e instanceof Error ? e.message : t('dash.loc.errAdd', { defaultValue: 'Could not add location' }));
    } finally {
      setBusy(false);
    }
  };

  const beginEdit = (loc: Location) => {
    setEditingId(loc.id);
    setEditName(loc.name);
    setEditAddress(loc.address ?? '');
    setEditLat(loc.latitude ?? null);
    setEditLng(loc.longitude ?? null);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setBusy(true);
    try {
      await onUpdate(editingId, {
        name: editName.trim(),
        address: editAddress.trim() || undefined,
        latitude: editLat,
        longitude: editLng,
      });
      setEditingId(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : t('dash.loc.errSave', { defaultValue: 'Could not save' }));
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async (loc: Location) => {
    if (active.length <= 1) {
      alert(t('dash.loc.errMinOne', { defaultValue: 'You must have at least one active location. Add another location before archiving this one.' }));
      return;
    }
    if (!confirm(t('dash.loc.confirmArchive', { name: loc.name, defaultValue: 'Archive "{{name}}"? Past stamps will still show this location, but it won\'t appear in pickers or generate QR codes.' }))) return;
    setBusy(true);
    try {
      await onUpdate(loc.id, { archived: true });
    } finally {
      setBusy(false);
    }
  };

  const handleUnarchive = async (loc: Location) => {
    setBusy(true);
    try {
      await onUpdate(loc.id, { archived: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border notion-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-gray-500" /> {t('dash.loc.title', { defaultValue: 'Locations' })}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {t('dash.loc.sub', { defaultValue: 'Each branch gets its own QR poster. Stamps are recorded per location.' })}
          </p>
        </div>
        {!isAdding && (
          isPro || active.length === 0 ? (
            <button
              onClick={() => setIsAdding(true)}
              className="text-sm bg-[#37352F] text-white px-3 py-1.5 rounded-md font-medium hover:bg-opacity-90 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> {t('dash.loc.addLocation', { defaultValue: 'Add location' })}
            </button>
          ) : (
            <button
              onClick={onUpgrade}
              title={t('dash.loc.proTitle', { defaultValue: 'Multiple locations is a Pro feature' })}
              className="text-sm bg-white border notion-border text-gray-600 px-3 py-1.5 rounded-md font-medium hover:border-[#37352F] transition flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-amber-500" /> {t('dash.loc.addLocation', { defaultValue: 'Add location' })}
              <span className="text-[9px] uppercase tracking-wider text-amber-600 font-bold">Pro</span>
            </button>
          )
        )}
      </div>

      {isAdding && (
        <div className="bg-[#F7F7F5] rounded-md p-4 space-y-3 border notion-border">
          <input
            value={addingName}
            onChange={(e) => setAddingName(e.target.value)}
            placeholder={t('dash.loc.namePh', { defaultValue: 'Name (e.g. "Downtown branch")' })}
            className="w-full bg-white border notion-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
            autoFocus
          />
          <AddressAutocomplete
            initial=""
            onPick={(label, lat, lng) => { setAddingAddress(label); setAddingLat(lat); setAddingLng(lng); }}
          />
          {addingLat != null && addingLng != null && coordLine(addingLat, addingLng, t('dash.loc.geoOn', { defaultValue: 'Auto geo-location on' }))}
          <div className="flex gap-2 justify-end">
            <button onClick={resetAdd} className="text-sm text-gray-500 hover:text-[#37352F] px-3 py-1.5">
              {t('dash.loc.cancel', { defaultValue: 'Cancel' })}
            </button>
            <button
              onClick={handleAdd}
              disabled={!addingName.trim() || busy}
              className="text-sm bg-[#37352F] text-white px-3 py-1.5 rounded-md font-medium disabled:opacity-50 flex items-center gap-1.5"
            >
              {busy && <Loader2 className="w-3 h-3 animate-spin" />} {t('dash.loc.save', { defaultValue: 'Save' })}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {active.map((loc) => (
          <div key={loc.id} className="flex items-center justify-between bg-[#F7F7F5] rounded-md p-3 border notion-border">
            {editingId === loc.id ? (
              <div className="flex-1 space-y-2 mr-3">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white border notion-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
                />
                <AddressAutocomplete
                  initial={editAddress}
                  onPick={(label, lat, lng) => { setEditAddress(label); setEditLat(lat); setEditLng(lng); }}
                />
                {editLat != null && editLng != null && coordLine(editLat, editLng, t('dash.loc.geoOn', { defaultValue: 'Auto geo-location on' }))}
              </div>
            ) : (
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{loc.name}</span>
                  {loc.id === activeLocationId && (
                    <span className="text-[9px] uppercase tracking-wider text-green-700 bg-green-50 border border-green-100 px-1.5 py-0.5 rounded">
                      {t('dash.loc.activeScanner', { defaultValue: 'Active scanner' })}
                    </span>
                  )}
                </div>
                {loc.address && <div className="text-xs text-gray-500 mt-0.5">{loc.address}</div>}
                {loc.latitude != null && loc.longitude != null ? (
                  coordLine(loc.latitude, loc.longitude, t('dash.loc.geoOn', { defaultValue: 'Auto geo-location on' }))
                ) : loc.address ? (
                  <div className="text-xs text-amber-600 mt-0.5">{t('dash.loc.pickAddress', { defaultValue: 'Pick your address from the search suggestions to turn on geo-location' })}</div>
                ) : null}
              </div>
            )}
            <div className="flex items-center gap-1">
              {editingId === loc.id ? (
                <>
                  <button onClick={() => setEditingId(null)} className="p-2 text-gray-400 hover:text-[#37352F]" aria-label={t('dash.loc.ariaCancel', { defaultValue: 'Cancel' })}>
                    <X className="w-4 h-4" />
                  </button>
                  <button onClick={saveEdit} disabled={busy} className="p-2 text-green-600 hover:bg-green-50 rounded" aria-label={t('dash.loc.ariaSave', { defaultValue: 'Save' })}>
                    <Check className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => beginEdit(loc)} className="p-2 text-gray-400 hover:text-[#37352F] rounded" aria-label={t('dash.loc.ariaEdit', { defaultValue: 'Edit' })}>
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleArchive(loc)} className="p-2 text-gray-400 hover:text-red-500 rounded" aria-label={t('dash.loc.ariaArchive', { defaultValue: 'Archive' })}>
                    <Archive className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}

        {active.length === 0 && (
          <p className="text-sm text-gray-400 italic px-3 py-4 text-center">
            {t('dash.loc.noLocations', { defaultValue: 'No locations yet. Add one to start stamping.' })}
          </p>
        )}
      </div>

      {archived.length > 0 && (
        <div className="pt-4 border-t notion-border space-y-2">
          <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider">{t('dash.loc.archived', { defaultValue: 'Archived' })}</h4>
          {archived.map((loc) => (
            <div key={loc.id} className="flex items-center justify-between bg-white rounded-md p-3 border notion-border">
              <div>
                <div className="font-medium text-sm text-gray-500">{loc.name}</div>
                {loc.address && <div className="text-xs text-gray-400">{loc.address}</div>}
              </div>
              <button
                onClick={() => handleUnarchive(loc)}
                className="text-xs text-gray-500 hover:text-[#37352F] px-3 py-1.5 border notion-border rounded"
              >
                {t('dash.loc.restore', { defaultValue: 'Restore' })}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
