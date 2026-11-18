import { memo } from 'react';

import { formatNumber } from '@/lib/format';

export type StatTone = 'in' | 'out' | 'command' | 'error';

interface StatCardProps {
  label: string;
  value: number;
  hint: string;
  tone: StatTone;
}

export const StatCard = memo(function StatCard({ label, value, hint, tone }: StatCardProps) {
  return (
    <div className={`stat stat--${tone}`}>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{formatNumber(value)}</span>
      <span className="stat__hint">{hint}</span>
    </div>
  );
});
