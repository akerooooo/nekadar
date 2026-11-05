import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthLabel, shiftMonth, monthKey } from '../lib/format';

export default function MonthPicker({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const isCurrent = month === monthKey(new Date());
  return (
    <div className="month-picker">
      <button aria-label="Önceki ay" onClick={() => setMonth(shiftMonth(month, -1))}>
        <ChevronLeft size={18} strokeWidth={1.75} />
      </button>
      <span>{monthLabel(month)}</span>
      <button aria-label="Sonraki ay" disabled={isCurrent} onClick={() => setMonth(shiftMonth(month, 1))}>
        <ChevronRight size={18} strokeWidth={1.75} />
      </button>
    </div>
  );
}
