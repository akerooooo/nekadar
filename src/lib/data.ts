import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Category, type Transaction } from '../db';
import { monthRange, today } from './format';
import { catchUp, type RecurringRule } from './recurring';

/**
 * Gunu gelen tekrarlayan kayitlari ekler ve siradaki odeme tarihini ilerletir.
 * Kayit kimligi kural+tarihtir: iki cihaz ayni odemeyi eklerse eşitlemede tek kayit kalir.
 */
export async function applyRecurring(todayIso = today()) {
  await db.transaction('rw', [db.subs, db.entries], async () => {
    for (const r of await db.subs.toArray()) {
      const { dates, next } = catchUp(r, todayIso);
      if (!dates.length) continue;
      const { type, amount, categoryId, note } = r;
      await db.entries.bulkPut(
        dates.map((date) => ({ id: `${r.id}_${date}`, type, amount, categoryId, note, date, createdAt: Date.now() })),
      );
      await db.subs.update(r.id!, { next });
    }
  });
}

/** Varsayilanlar kendi sirasinda, sonra eklenenler ada gore */
const catOrder = (c: Category) => (c.id!.startsWith('def-') ? c.id! : `~${c.name.toLocaleLowerCase('tr')}`);

export function useCategories() {
  return useLiveQuery(
    async () => (await db.cats.toArray()).sort((a, b) => catOrder(a).localeCompare(catOrder(b), 'tr')),
    [],
    [] as Category[],
  );
}

export function useCategoryMap() {
  const cats = useCategories();
  return new Map(cats.map((c) => [c.id!, c]));
}

export function useSubs() {
  return useLiveQuery(async () => (await db.subs.toArray()).sort((a, b) => a.next.localeCompare(b.next)), [], [] as RecurringRule[]);
}

export function useMonthTransactions(month: string) {
  return useLiveQuery(
    () => {
      const [from, to] = monthRange(month);
      return db.entries.where('date').between(from, to, true, true).toArray();
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
  const m = new Map<string, number>();
  for (const t of txs) if (t.type === 'expense') m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount);
  return m;
}
