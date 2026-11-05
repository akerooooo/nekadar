// Saf fonksiyonlar: tarayici DB'si olmadan node testleri ve bildirim betigi de kullanir.

export type Freq = 'weekly' | 'monthly' | 'yearly';

export interface RecurringRule {
  id?: string;
  type: 'expense' | 'income';
  amount: number;
  categoryId: string;
  note: string; // abonelik adi (bos olabilir)
  freq: Freq;
  next: string; // siradaki odeme tarihi, YYYY-MM-DD
  updatedAt?: number;
}

export const FREQ_LABEL: Record<Freq, string> = { weekly: 'Haftalık', monthly: 'Aylık', yearly: 'Yıllık' };

/** Bir sonraki tekrar tarihi. Aylik/yillik kurallarda gun 28'i gecmez (startDate ile). */
export function advance(date: string, freq: Freq): string {
  const [y, m, d] = date.split('-').map(Number);
  const t =
    freq === 'weekly' ? Date.UTC(y, m - 1, d + 7) : freq === 'monthly' ? Date.UTC(y, m, d) : Date.UTC(y + 1, m - 1, d);
  return new Date(t).toISOString().slice(0, 10);
}

/** Aylik/yillik kuralda 29-31 her ay olmadigi icin 28'e cekilir */
export const startDate = (date: string, freq: Freq) =>
  freq === 'weekly' ? date : `${date.slice(0, 8)}${String(Math.min(Number(date.slice(8)), 28)).padStart(2, '0')}`;

/** Bugune kadar gunu gelmis tarihler ve ondan sonraki ilk odeme tarihi */
export function catchUp(rule: Pick<RecurringRule, 'next' | 'freq'>, today: string) {
  const dates: string[] = [];
  let d = rule.next;
  while (d <= today) {
    dates.push(d);
    d = advance(d, rule.freq);
  }
  return { dates, next: d };
}

/** Aylik esdeger tutar (haftalik 52/12, yillik 1/12) */
export const monthlyCost = (r: Pick<RecurringRule, 'amount' | 'freq'>) =>
  r.freq === 'weekly' ? (r.amount * 52) / 12 : r.freq === 'yearly' ? r.amount / 12 : r.amount;

/** Iki tarih arasindaki gun farki */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
