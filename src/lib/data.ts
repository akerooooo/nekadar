import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Category, type Transaction } from '../db';
import { monthRange, today } from './format';
import { dueDates } from './recurring';

/** Gunu gelen tekrarlayan kayitlari ekler. Ayni ay icin iki kez eklemez (lastMonth ile). */
export async function applyRecurring(todayIso = today()) {
  await db.transaction('rw', [db.recurring, db.transactions], async () => {
    for (const r of await db.recurring.toArray()) {
      const dates = dueDates(r, todayIso);
      if (!dates.length) continue;
      const { type, amount, categoryId, note } = r;
      await db.transactions.bulkAdd(dates.map((date) => ({ type, amount, categoryId, note, date, createdAt: Date.now() })));
      await db.recurring.update(r.id!, { lastMonth: dates[dates.length - 1].slice(0, 7) });
    }
  });
}

export function useCategories() {
  return useLiveQuery(() => db.categories.toArray(), [], [] as Category[]);
}

export function useCategoryMap() {
  const cats = useCategories();
  return new Map(cats.map((c) => [c.id!, c]));
}

export function useMonthTransactions(month: string) {
  return useLiveQuery(
    () => {
      const [from, to] = monthRange(month);
      return db.transactions.where('date').between(from, to, true, true).toArray();
    },
    [month],
    [] as Transaction[],
  );
}

/** Aylik toplam butce (meta tablosunda), yoksa 0 */
export function useTotalBudget() {
  return useLiveQuery(async () => Number((await db.meta.get('totalBudget'))?.value ?? 0), [], 0);
}

export async function setTotalBudget(limit: number) {
  if (limit > 0) await db.meta.put({ key: 'totalBudget', value: String(limit) });
  else await db.meta.delete('totalBudget');
}

export function useBudgets() {
  return useLiveQuery(() => db.budgets.toArray(), [], []);
}

export function totals(txs: Transaction[]) {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

export function expenseByCategory(txs: Transaction[]) {
  const m = new Map<number, number>();
  for (const t of txs) if (t.type === 'expense') m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount);
  return m;
}
