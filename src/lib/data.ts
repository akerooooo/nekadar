import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Category, type Transaction } from '../db';
import { monthRange } from './format';

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
