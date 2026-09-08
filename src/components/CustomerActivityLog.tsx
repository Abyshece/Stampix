import { useState, useEffect } from 'react';
import { getCustomerActivity, type CustomerActivityRow } from '../lib/db';
import { useTranslation } from 'react-i18next';

const LABEL: Record<string, string> = {
  STAMP: 'Stamp given',
  REDEEM: 'Reward redeemed',
  UNSTAMP: 'Stamp removed',
};

export function CustomerActivityLog({ customerId }: { customerId: string }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<CustomerActivityRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    getCustomerActivity(customerId).then((r) => { if (alive) setRows(r); }).catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [customerId]);

  if (rows === null) return <div className="text-xs text-gray-400">{t('cust.activity.loading', { defaultValue: 'Loading activity…' })}</div>;
  if (rows.length === 0) return <div className="text-xs text-gray-400">{t('cust.activity.empty', { defaultValue: 'No stamp activity yet.' })}</div>;

  return (
    <div className="bg-white border notion-border rounded divide-y notion-border max-h-64 overflow-y-auto">
      {rows.map((a) => (
        <div key={a.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
          <span className="font-medium text-[#37352F]">
            {t(`cust.activity.${a.type}`, { defaultValue: LABEL[a.type] ?? a.type })}
            <span className="text-gray-400 font-normal"> · {a.source}</span>
          </span>
          <span className="text-gray-400 whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
