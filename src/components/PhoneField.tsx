import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Country dial-code dropdown (searchable, empty by default) + phone-number
 *  field. Reports the combined value (e.g. "+49 170 1234567") via onChange;
 *  emits '' until both a country and a number are entered. */
// [ISO alpha-2, name, dial code]. Flags are derived from the ISO code.
const COUNTRIES: [string, string, string][] = [
  ['AF', 'Afghanistan', '+93'], ['AL', 'Albania', '+355'], ['DZ', 'Algeria', '+213'], ['AD', 'Andorra', '+376'],
  ['AO', 'Angola', '+244'], ['AG', 'Antigua and Barbuda', '+1'], ['AR', 'Argentina', '+54'], ['AM', 'Armenia', '+374'],
  ['AU', 'Australia', '+61'], ['AT', 'Austria', '+43'], ['AZ', 'Azerbaijan', '+994'], ['BS', 'Bahamas', '+1'],
  ['BH', 'Bahrain', '+973'], ['BD', 'Bangladesh', '+880'], ['BB', 'Barbados', '+1'], ['BY', 'Belarus', '+375'],
  ['BE', 'Belgium', '+32'], ['BZ', 'Belize', '+501'], ['BJ', 'Benin', '+229'], ['BT', 'Bhutan', '+975'],
  ['BO', 'Bolivia', '+591'], ['BA', 'Bosnia and Herzegovina', '+387'], ['BW', 'Botswana', '+267'], ['BR', 'Brazil', '+55'],
  ['BN', 'Brunei', '+673'], ['BG', 'Bulgaria', '+359'], ['BF', 'Burkina Faso', '+226'], ['BI', 'Burundi', '+257'],
  ['KH', 'Cambodia', '+855'], ['CM', 'Cameroon', '+237'], ['CA', 'Canada', '+1'], ['CV', 'Cabo Verde', '+238'],
  ['CF', 'Central African Republic', '+236'], ['TD', 'Chad', '+235'], ['CL', 'Chile', '+56'], ['CN', 'China', '+86'],
  ['CO', 'Colombia', '+57'], ['KM', 'Comoros', '+269'], ['CG', 'Congo', '+242'], ['CD', 'Congo (DRC)', '+243'],
  ['CR', 'Costa Rica', '+506'], ['CI', "Côte d'Ivoire", '+225'], ['HR', 'Croatia', '+385'], ['CU', 'Cuba', '+53'],
  ['CY', 'Cyprus', '+357'], ['CZ', 'Czechia', '+420'], ['DK', 'Denmark', '+45'], ['DJ', 'Djibouti', '+253'],
  ['DM', 'Dominica', '+1'], ['DO', 'Dominican Republic', '+1'], ['EC', 'Ecuador', '+593'], ['EG', 'Egypt', '+20'],
  ['SV', 'El Salvador', '+503'], ['GQ', 'Equatorial Guinea', '+240'], ['ER', 'Eritrea', '+291'], ['EE', 'Estonia', '+372'],
  ['SZ', 'Eswatini', '+268'], ['ET', 'Ethiopia', '+251'], ['FJ', 'Fiji', '+679'], ['FI', 'Finland', '+358'],
  ['FR', 'France', '+33'], ['GA', 'Gabon', '+241'], ['GM', 'Gambia', '+220'], ['GE', 'Georgia', '+995'],
  ['DE', 'Germany', '+49'], ['GH', 'Ghana', '+233'], ['GR', 'Greece', '+30'], ['GD', 'Grenada', '+1'],
  ['GT', 'Guatemala', '+502'], ['GN', 'Guinea', '+224'], ['GW', 'Guinea-Bissau', '+245'], ['GY', 'Guyana', '+592'],
  ['HT', 'Haiti', '+509'], ['HN', 'Honduras', '+504'], ['HK', 'Hong Kong', '+852'], ['HU', 'Hungary', '+36'],
  ['IS', 'Iceland', '+354'], ['IN', 'India', '+91'], ['ID', 'Indonesia', '+62'], ['IR', 'Iran', '+98'],
  ['IQ', 'Iraq', '+964'], ['IE', 'Ireland', '+353'], ['IL', 'Israel', '+972'], ['IT', 'Italy', '+39'],
  ['JM', 'Jamaica', '+1'], ['JP', 'Japan', '+81'], ['JO', 'Jordan', '+962'], ['KZ', 'Kazakhstan', '+7'],
  ['KE', 'Kenya', '+254'], ['KI', 'Kiribati', '+686'], ['KW', 'Kuwait', '+965'], ['KG', 'Kyrgyzstan', '+996'],
  ['LA', 'Laos', '+856'], ['LV', 'Latvia', '+371'], ['LB', 'Lebanon', '+961'], ['LS', 'Lesotho', '+266'],
  ['LR', 'Liberia', '+231'], ['LY', 'Libya', '+218'], ['LI', 'Liechtenstein', '+423'], ['LT', 'Lithuania', '+370'],
  ['LU', 'Luxembourg', '+352'], ['MO', 'Macao', '+853'], ['MG', 'Madagascar', '+261'], ['MW', 'Malawi', '+265'],
  ['MY', 'Malaysia', '+60'], ['MV', 'Maldives', '+960'], ['ML', 'Mali', '+223'], ['MT', 'Malta', '+356'],
  ['MH', 'Marshall Islands', '+692'], ['MR', 'Mauritania', '+222'], ['MU', 'Mauritius', '+230'], ['MX', 'Mexico', '+52'],
  ['FM', 'Micronesia', '+691'], ['MD', 'Moldova', '+373'], ['MC', 'Monaco', '+377'], ['MN', 'Mongolia', '+976'],
  ['ME', 'Montenegro', '+382'], ['MA', 'Morocco', '+212'], ['MZ', 'Mozambique', '+258'], ['MM', 'Myanmar', '+95'],
  ['NA', 'Namibia', '+264'], ['NR', 'Nauru', '+674'], ['NP', 'Nepal', '+977'], ['NL', 'Netherlands', '+31'],
  ['NZ', 'New Zealand', '+64'], ['NI', 'Nicaragua', '+505'], ['NE', 'Niger', '+227'], ['NG', 'Nigeria', '+234'],
  ['MK', 'North Macedonia', '+389'], ['NO', 'Norway', '+47'], ['OM', 'Oman', '+968'], ['PK', 'Pakistan', '+92'],
  ['PW', 'Palau', '+680'], ['PS', 'Palestine', '+970'], ['PA', 'Panama', '+507'], ['PG', 'Papua New Guinea', '+675'],
  ['PY', 'Paraguay', '+595'], ['PE', 'Peru', '+51'], ['PH', 'Philippines', '+63'], ['PL', 'Poland', '+48'],
  ['PT', 'Portugal', '+351'], ['PR', 'Puerto Rico', '+1'], ['QA', 'Qatar', '+974'], ['RO', 'Romania', '+40'],
  ['RU', 'Russia', '+7'], ['RW', 'Rwanda', '+250'], ['KN', 'Saint Kitts and Nevis', '+1'], ['LC', 'Saint Lucia', '+1'],
  ['VC', 'Saint Vincent and the Grenadines', '+1'], ['WS', 'Samoa', '+685'], ['SM', 'San Marino', '+378'],
  ['ST', 'São Tomé and Príncipe', '+239'], ['SA', 'Saudi Arabia', '+966'], ['SN', 'Senegal', '+221'], ['RS', 'Serbia', '+381'],
  ['SC', 'Seychelles', '+248'], ['SL', 'Sierra Leone', '+232'], ['SG', 'Singapore', '+65'], ['SK', 'Slovakia', '+421'],
  ['SI', 'Slovenia', '+386'], ['SB', 'Solomon Islands', '+677'], ['SO', 'Somalia', '+252'], ['ZA', 'South Africa', '+27'],
  ['KR', 'South Korea', '+82'], ['SS', 'South Sudan', '+211'], ['ES', 'Spain', '+34'], ['LK', 'Sri Lanka', '+94'],
  ['SD', 'Sudan', '+249'], ['SR', 'Suriname', '+597'], ['SE', 'Sweden', '+46'], ['CH', 'Switzerland', '+41'],
  ['SY', 'Syria', '+963'], ['TW', 'Taiwan', '+886'], ['TJ', 'Tajikistan', '+992'], ['TZ', 'Tanzania', '+255'],
  ['TH', 'Thailand', '+66'], ['TL', 'Timor-Leste', '+670'], ['TG', 'Togo', '+228'], ['TO', 'Tonga', '+676'],
  ['TT', 'Trinidad and Tobago', '+1'], ['TN', 'Tunisia', '+216'], ['TR', 'Türkiye', '+90'], ['TM', 'Turkmenistan', '+993'],
  ['TV', 'Tuvalu', '+688'], ['UG', 'Uganda', '+256'], ['UA', 'Ukraine', '+380'], ['AE', 'United Arab Emirates', '+971'],
  ['GB', 'United Kingdom', '+44'], ['US', 'United States', '+1'], ['UY', 'Uruguay', '+598'], ['UZ', 'Uzbekistan', '+998'],
  ['VU', 'Vanuatu', '+678'], ['VA', 'Vatican City', '+39'], ['VE', 'Venezuela', '+58'], ['VN', 'Vietnam', '+84'],
  ['YE', 'Yemen', '+967'], ['ZM', 'Zambia', '+260'], ['ZW', 'Zimbabwe', '+263'],
];

function flagOf(iso: string): string {
  return iso.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export function PhoneField({ onChange, onEnter, id }: { onChange: (v: string) => void; onEnter?: () => void; id?: string }) {
  const { t } = useTranslation();
  const [idx, setIdx] = useState(-1); // empty by default — no country pre-selected
  const [number, setNumber] = useState('');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const emit = (i: number, num: string) =>
    onChange(i >= 0 && num.trim() ? `${COUNTRIES[i][2]} ${num.trim()}` : '');

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const filtered = useMemo(() => {
    const withIdx = COUNTRIES.map((c, i) => [c, i] as const);
    const q = query.trim().toLowerCase();
    if (!q) return withIdx;
    return withIdx.filter(([c]) => c[1].toLowerCase().includes(q) || c[2].includes(q) || c[0].toLowerCase() === q);
  }, [query]);

  const sel = idx >= 0 ? COUNTRIES[idx] : null;

  return (
    <div className="flex gap-2">
      <div ref={ref} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="h-full flex items-center gap-1 bg-[#F7F7F5] border notion-border rounded-md px-2.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 whitespace-nowrap"
          aria-label={t('form.phone.ariaCode', { defaultValue: 'Country code' })}
        >
          {sel ? (
            <>
              <span className="text-base leading-none">{flagOf(sel[0])}</span>
              <span>{sel[2]}</span>
            </>
          ) : (
            <span className="text-gray-400">{t('form.phone.code', { defaultValue: 'Code' })}</span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </button>
        {open && (
          <div className="absolute z-30 mt-1 w-64 bg-white border notion-border rounded-md shadow-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b notion-border">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('form.phone.searchPh', { defaultValue: 'Search country…' })}
                className="w-full text-sm bg-transparent focus:outline-none"
              />
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 && <div className="px-4 py-3 text-xs text-gray-400">{t('form.phone.noMatches', { defaultValue: 'No matches' })}</div>}
              {filtered.map(([c, i]) => (
                <button
                  key={c[0]}
                  type="button"
                  onClick={() => { setIdx(i); setOpen(false); setQuery(''); emit(i, number); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-[#F7F7F5] ${i === idx ? 'bg-[#F7F7F5] font-medium' : ''}`}
                >
                  <span className="text-base leading-none">{flagOf(c[0])}</span>
                  <span className="flex-1 truncate">{c[1]}</span>
                  <span className="text-gray-400">{c[2]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <input
        type="tel"
        value={number}
        onChange={(e) => { const n = e.target.value.replace(/[^\d\s]/g, ''); setNumber(n); emit(idx, n); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter(); }}
        className="flex-1 min-w-0 bg-[#F7F7F5] border notion-border rounded-md px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-gray-400 placeholder-gray-300"
        placeholder="170 1234567"
        id={id} aria-label={t('form.phone.ariaPhone', { defaultValue: 'Phone number' })}
      />
    </div>
  );
}
