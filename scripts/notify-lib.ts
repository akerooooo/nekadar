// Gunluk bildirim kararlari (saf). notify.ts Firestore'dan veriyi okuyup buraya verir.
import { catchUp, type RecurringRule } from '../src/lib/recurring.ts';

export interface UserData {
  today: string; // Istanbul saatiyle YYYY-MM-DD
  subs: RecurringRule[];
  cats: { id: string; name: string }[];
  budgets: { categoryId: string; limit: number }[];
  totalBudget: number;
  monthTxs: { type: string; amount: number; categoryId: string }[];
  sent: Record<string, true>; // daha once gonderilenler (ayni uyari tekrar gitmesin)
}

export interface Message {
  key: string;
  title: string;
  body: string;
}

const tl = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 });

export const istanbulToday = (now: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(now); // YYYY-MM-DD

const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export function buildMessages(u: UserData): Message[] {
  const tomorrow = addDays(u.today, 1);
  const month = u.today.slice(0, 7);
  const catName = new Map(u.cats.map((c) => [c.id, c.name]));
  const out: Message[] = [];

  // Odeme tarihi uygulama acilmadiysa geride kalmis olabilir; bugunden sonraki ilk odeme bulunur
  for (const s of u.subs) {
    if (s.type !== 'expense' || catchUp(s, u.today).next !== tomorrow) continue;
    const name = s.note || catName.get(s.categoryId) || 'Abonelik';
    out.push({ key: `sub:${s.id}:${tomorrow}`, title: `Yarın ${name} ödemen var`, body: tl.format(s.amount) });
  }

  const spent = new Map<string, number>();
  let total = 0;
  for (const t of u.monthTxs) {
    if (t.type !== 'expense') continue;
    total += t.amount;
    spent.set(t.categoryId, (spent.get(t.categoryId) ?? 0) + t.amount);
  }

  const budgetMessage = (id: string, name: string, used: number, limit: number) => {
    if (limit <= 0 || used < limit * 0.8) return;
    const over = used >= limit;
    out.push({
      key: `budget:${id}:${over ? 100 : 80}:${month}`,
      title: over ? `${name} bütçesi aşıldı` : `${name} bütçesi: %${Math.round((used / limit) * 100)} kullanıldı`,
      body: `${tl.format(used)} / ${tl.format(limit)}`,
    });
  };
  budgetMessage('total', 'Aylık toplam', total, u.totalBudget);
  for (const b of u.budgets) budgetMessage(b.categoryId, catName.get(b.categoryId) ?? 'Kategori', spent.get(b.categoryId) ?? 0, b.limit);

  return out.filter((m) => !u.sent[m.key]);
}

/** Gonderilenler listesi: yalnizca bu ay ve yarinin ayi kalir, liste sonsuza buyumez */
export function nextSent(u: UserData, sentNow: Message[]): Record<string, true> {
  const keep = [u.today.slice(0, 7), addDays(u.today, 1).slice(0, 7)];
  const old = Object.keys(u.sent).filter((k) => keep.some((m) => k.includes(m)));
  return Object.fromEntries([...old, ...sentNow.map((m) => m.key)].map((k) => [k, true]));
}
