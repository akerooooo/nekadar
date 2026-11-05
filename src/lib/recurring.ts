// Bilerek bagimsiz (import yok): node testleri tarayici veritabani olmadan calistirabilsin.

export interface RecurringRule {
  id?: number;
  type: 'expense' | 'income';
  amount: number;
  categoryId: number;
  note: string;
  day: number; // 1-28, her ay ayni gun
  lastMonth: string; // en son kayit eklenen ay, YYYY-MM
}

const nextMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};

/** lastMonth'tan sonra, bugune kadar gunu gelmis her ay icin eklenecek tarihler (YYYY-MM-DD) */
export function dueDates(rule: Pick<RecurringRule, 'day' | 'lastMonth'>, today: string): string[] {
  const out: string[] = [];
  const day = String(Math.min(Math.max(rule.day, 1), 28)).padStart(2, '0');
  for (let m = nextMonth(rule.lastMonth); `${m}-${day}` <= today; m = nextMonth(m)) out.push(`${m}-${day}`);
  return out;
}
